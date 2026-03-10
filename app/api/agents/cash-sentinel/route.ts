import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CLAUDE_MODEL } from '@/lib/constants'
import { createClient } from '@/lib/supabase-server'
import { OSPI_PCT, DEFAULT_OSPI_PCT, getFiscalMonths, fiscalIndexFromKey } from '@/lib/fiscalYear'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface RequestBody {
  schoolId: string
  activeMonth: string
  cashOnHand: number
  daysOfReserves: number
  totalBudget: number
  ytdSpending: number
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const body: RequestBody = await req.json()
    const { schoolId, activeMonth, cashOnHand, daysOfReserves, totalBudget, ytdSpending } = body

    if (!schoolId) {
      return NextResponse.json({ error: 'Missing schoolId' }, { status: 400 })
    }

    // Calculate upcoming OSPI apportionment months
    const currentIdx = fiscalIndexFromKey(activeMonth)
    const fiscalMonths = getFiscalMonths()
    const upcoming = fiscalMonths
      .filter((fm) => fm.fiscalIndex > currentIdx && fm.fiscalIndex <= currentIdx + 3)
      .map((fm) => {
        const calMonth = fm.key.slice(5, 7)
        const pct = OSPI_PCT[calMonth] ?? DEFAULT_OSPI_PCT
        return { month: fm.label, pct, isLow: pct <= 5.5 }
      })

    // Monthly burn = total YTD spending / months elapsed (consistent with store calculation)
    const monthlyBurn = currentIdx > 0 ? Math.round(ytdSpending / currentIdx) : 0

    const prompt = `Analyze the cash position for a Washington State charter school.

CURRENT POSITION:
- Cash on Hand: $${cashOnHand.toLocaleString()}
- Days of Operating Reserves: ${daysOfReserves}
- Monthly Burn Rate (average): $${monthlyBurn.toLocaleString()}
- Annual Budget: $${totalBudget.toLocaleString()}

UPCOMING OSPI APPORTIONMENT (next 3 months):
${upcoming.map((u) => `- ${u.month}: ${u.pct}% of annual state aid${u.isLow ? ' [LOW PAYMENT MONTH]' : ''}`).join('\n')}

THRESHOLDS:
- Watch: <45 days of reserves
- Concern: <30 days of reserves
- Action: <15 days of reserves

Return a JSON array of findings. Each finding must have:
- findingType: "cash_risk"
- severity: "watch" | "concern" | "action"
- title: short plain-English title
- summary: 1-2 sentences explaining the risk and recommended action
- detail: { cashOnHand, daysOfReserves, monthlyBurn, upcomingLowMonths }

Flag:
1. Current reserves threshold breach (if applicable)
2. Upcoming low payment months that could stress cash (November=5%, May=5%)
3. 90-day cash projection: will cash cover 3 months of expenses given OSPI schedule?

Only include findings at watch/concern/action level. Return ONLY the JSON array, no markdown fences.`

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system: 'You are a cash management specialist for Washington State charter schools. Respond only with valid JSON arrays. No markdown, no explanation outside the JSON.',
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
      console.error('[cash-sentinel] Failed to parse response:', text)
      findings = []
    }

    // Write findings to Supabase
    const supabase = await createClient()

    await supabase
      .from('agent_findings')
      .delete()
      .eq('school_id', schoolId)
      .eq('agent_name', 'cash_sentinel')

    if (findings.length > 0) {
      const rows = findings.map((f) => ({
        school_id: schoolId,
        agent_name: 'cash_sentinel',
        finding_type: f.findingType || 'cash_risk',
        severity: f.severity,
        title: f.title,
        summary: f.summary,
        detail: f.detail || {},
        expires_at: null,
      }))

      const { error } = await supabase.from('agent_findings').insert(rows)
      if (error) console.error('[cash-sentinel] Insert error:', error)
    }

    return NextResponse.json({ findings: findings.length, agent: 'cash_sentinel' })
  } catch (error) {
    console.error('[cash-sentinel]', error)
    return NextResponse.json({ error: 'Cash sentinel failed' }, { status: 500 })
  }
}
