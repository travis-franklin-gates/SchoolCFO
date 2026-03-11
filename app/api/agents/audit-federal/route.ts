import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CLAUDE_MODEL } from '@/lib/constants'
import { createClient } from '@/lib/supabase-server'
import { paceFromKey } from '@/lib/fiscalYear'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface RequestBody {
  schoolId: string
  activeMonth: string
  grants: Array<{ name: string; awardAmount: number; spent: number; status: string }>
  totalBudget: number
  ytdSpending: number
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const body: RequestBody = await req.json()
    const { schoolId, activeMonth, grants, totalBudget, ytdSpending } = body

    if (!schoolId) {
      return NextResponse.json({ error: 'Missing schoolId' }, { status: 400 })
    }

    if (!grants || grants.length === 0) {
      // No grants — clear old findings
      const supabase = await createClient()
      await supabase
        .from('agent_findings')
        .delete()
        .eq('school_id', schoolId)
        .eq('agent_name', 'audit_federal')
      return NextResponse.json({ findings: 0, agent: 'audit_federal' })
    }

    const pacePercent = Math.round(paceFromKey(activeMonth) * 100)

    const grantLines = grants.map((g) => {
      const pct = g.awardAmount > 0 ? ((g.spent / g.awardAmount) * 100).toFixed(0) : '0'
      const remaining = g.awardAmount - g.spent
      const carryoverRisk = g.awardAmount > 0 && (g.spent / g.awardAmount) < (pacePercent / 100) * 0.85
      return `- ${g.name}: $${g.spent.toLocaleString()} of $${g.awardAmount.toLocaleString()} (${pct}% spent, pace ${pacePercent}%) — $${remaining.toLocaleString()} remaining${carryoverRisk ? ' [CARRYOVER RISK]' : ''} [${g.status}]`
    }).join('\n')

    const prompt = `Analyze federal programs compliance for a WA charter school operating as an LEA.

SCHOOL FINANCIALS:
- Annual Expense Budget: $${totalBudget.toLocaleString()}
- YTD Spending: $${ytdSpending.toLocaleString()}
- Fiscal Year Pace: ${pacePercent}% through

CATEGORICAL GRANTS:
${grantLines}

Analyze for:
1. Supplement not supplant risk: Are expenditure patterns consistent with federal requirements?
2. Time and effort documentation: Which staff on federal funds need semi-annual certifications vs monthly records?
3. Carryover risk: Any grants tracking to end year with >15% unspent (requires waiver)?
4. Maintenance of effort: Is overall spending pattern consistent with MOE requirements?

Return a JSON array of findings. Each finding must have:
- findingType: "federal_risk"
- severity: "watch" | "concern" | "action"
- title: plain-English title
- summary: 2-3 sentences with specific analysis and required action
- detail: { grantName, riskType, spentPercent, pacePercent, requiredAction }

Only include findings at watch/concern/action level. Return ONLY the JSON array, no markdown fences.`

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      system: `You are a federal programs compliance specialist for Washington State charter schools with deep expertise in Title I Part A, IDEA, LAP, and TBIP requirements. You understand supplement-not-supplant, maintenance of effort, time and effort documentation, and carryover rules as they apply to WA charter schools operating as LEAs. When analyzing categorical fund data, identify specific compliance risks, documentation requirements by staff member type, and corrective actions. Reference specific federal regulations and WA-specific guidance.`,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
    let findings: Array<{
      findingType: string
      severity: string
      title: string
      summary: string
      detail: Record<string, unknown>
    }>

    try {
      findings = JSON.parse(text)
      if (!Array.isArray(findings)) findings = []
    } catch {
      console.error('[audit-federal] Failed to parse response:', text)
      findings = []
    }

    const supabase = await createClient()

    await supabase
      .from('agent_findings')
      .delete()
      .eq('school_id', schoolId)
      .eq('agent_name', 'audit_federal')

    if (findings.length > 0) {
      const rows = findings.map((f) => ({
        school_id: schoolId,
        agent_name: 'audit_federal',
        finding_type: f.findingType || 'federal_risk',
        severity: f.severity,
        title: f.title,
        summary: f.summary,
        detail: f.detail || {},
        expires_at: null,
      }))

      const { error } = await supabase.from('agent_findings').insert(rows)
      if (error) console.error('[audit-federal] Insert error:', error)
    }

    return NextResponse.json({ findings: findings.length, agent: 'audit_federal' })
  } catch (error) {
    console.error('[audit-federal]', error)
    return NextResponse.json({ error: 'Federal programs audit failed' }, { status: 500 })
  }
}
