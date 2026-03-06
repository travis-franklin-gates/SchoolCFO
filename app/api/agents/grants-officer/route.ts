import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CLAUDE_MODEL } from '@/lib/constants'
import { createClient } from '@/lib/supabase-server'
import type { Grant } from '@/lib/store'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface RequestBody {
  schoolId: string
  activeMonth: string
  pacePercent: number
  grants: Grant[]
  otherGrants?: Array<{
    name: string
    funder: string
    awardAmount: number
    spentToDate: number
    startDate: string
    endDate: string
    restrictions: string
  }>
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const body: RequestBody = await req.json()
    const { schoolId, activeMonth, pacePercent, grants, otherGrants = [] } = body

    if (!schoolId) {
      return NextResponse.json({ error: 'Missing schoolId' }, { status: 400 })
    }

    if (grants.length === 0 && otherGrants.length === 0) {
      // No grants to analyze — clear old findings and return
      const supabase = await createClient()
      await supabase
        .from('agent_findings')
        .delete()
        .eq('school_id', schoolId)
        .eq('agent_name', 'grants_officer')
      return NextResponse.json({ findings: 0, agent: 'grants_officer' })
    }

    const catGrantLines = grants.map((g) => {
      const pct = g.awardAmount > 0 ? ((g.spent / g.awardAmount) * 100).toFixed(0) : '0'
      const remaining = g.awardAmount - g.spent
      return `- ${g.name}: $${g.spent.toLocaleString()} of $${g.awardAmount.toLocaleString()} (${pct}% spent, $${remaining.toLocaleString()} remaining) [${g.status}]`
    }).join('\n')

    const otherGrantLines = otherGrants.map((g) => {
      const pct = g.awardAmount > 0 ? ((g.spentToDate / g.awardAmount) * 100).toFixed(0) : '0'
      const remaining = g.awardAmount - g.spentToDate
      return `- ${g.name} (${g.funder}): $${g.spentToDate.toLocaleString()} of $${g.awardAmount.toLocaleString()} (${pct}% spent, $${remaining.toLocaleString()} remaining) — ${g.restrictions} — ends ${g.endDate}`
    }).join('\n')

    const prompt = `Analyze grant spending for a Washington State charter school. Month: ${activeMonth}, fiscal year pace: ${pacePercent}%.

WA CATEGORICAL GRANTS:
${catGrantLines || 'None'}

OTHER GRANTS & PHILANTHROPIC FUNDING:
${otherGrantLines || 'None'}

Return a JSON array of findings. Each finding must have:
- findingType: one of "grant_underspend" | "grant_overspend" | "braiding_opportunity"
- severity: "watch" | "concern" | "action"
- title: short plain-English title
- summary: 1-2 sentences explaining the risk or opportunity
- detail: { grantName, spentPercent, pacePercent, remaining, awardAmount }

Flag:
1. Underspend risk: grant spending >15pp below pace (watch), >25pp (concern), >35pp (action) — risk of returning unspent funds
2. Overspend risk: grant spending >10pp above pace (watch), >20pp (concern) — risk of exhausting grant early
3. Braiding opportunities: if multiple grants could fund similar purposes (e.g., Title I + LAP for same students), suggest braiding to maximize both

Only include findings at watch/concern/action level. Return ONLY the JSON array, no markdown fences.`

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1200,
      system: 'You are a grants management specialist for Washington State charter schools. You know WA categorical grant rules (Title I, LAP, IDEA, TBIP, HiCap). Respond only with valid JSON arrays. No markdown, no explanation outside the JSON.',
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
      console.error('[grants-officer] Failed to parse response:', text)
      findings = []
    }

    // Write findings to Supabase
    const supabase = await createClient()

    await supabase
      .from('agent_findings')
      .delete()
      .eq('school_id', schoolId)
      .eq('agent_name', 'grants_officer')

    if (findings.length > 0) {
      const rows = findings.map((f) => ({
        school_id: schoolId,
        agent_name: 'grants_officer',
        finding_type: f.findingType || 'grant_underspend',
        severity: f.severity,
        title: f.title,
        summary: f.summary,
        detail: f.detail || {},
        expires_at: null,
      }))

      const { error } = await supabase.from('agent_findings').insert(rows)
      if (error) console.error('[grants-officer] Insert error:', error)
    }

    return NextResponse.json({ findings: findings.length, agent: 'grants_officer' })
  } catch (error) {
    console.error('[grants-officer]', error)
    return NextResponse.json({ error: 'Grants officer failed' }, { status: 500 })
  }
}
