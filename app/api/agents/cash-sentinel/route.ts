import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CLAUDE_MODEL } from '@/lib/constants'
import { createClient } from '@/lib/supabase-server'
import { OSPI_PCT, DEFAULT_OSPI_PCT, getFiscalMonths, fiscalIndexFromKey } from '@/lib/fiscalYear'
import { type FinancialAssumptions, mergeAssumptions } from '@/lib/financialAssumptions'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface CategorySummary {
  name: string
  budget: number
  ytdActuals: number
  accountType: 'revenue' | 'expense'
}

interface RequestBody {
  schoolId: string
  activeMonth: string
  cashOnHand: number
  daysOfReserves: number
  totalBudget: number
  ytdSpending: number
  snapshotCount: number
  categories?: CategorySummary[]
  financialAssumptions?: Partial<FinancialAssumptions>
}

// Category names known to be front-loaded / annual lump-sum expenses.
const FRONT_LOADED_PATTERNS = [
  /facilities\s*insurance/i,
  /accounting\s*software/i,
]

function isFrontLoaded(name: string): boolean {
  return FRONT_LOADED_PATTERNS.some((p) => p.test(name))
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const body: RequestBody = await req.json()
    const { schoolId, activeMonth, cashOnHand, daysOfReserves, totalBudget, ytdSpending } = body
    const snapshotCount = body.snapshotCount ?? 1
    const categories: CategorySummary[] = body.categories ?? []
    const assumptions = mergeAssumptions(body.financialAssumptions)

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

    // ── Normalized burn: adjust for front-loaded / one-time expenses ──────────
    const expenseCategories = categories.filter((c) => c.accountType === 'expense')
    const adjustedNames: string[] = []

    let normalizedBurn = monthlyBurn
    if (currentIdx > 0 && expenseCategories.length > 0) {
      let rawTotal = 0
      let adjustedTotal = 0

      for (const cat of expenseCategories) {
        const actualMonthly = cat.ytdActuals / currentIdx
        const budgetedMonthly = cat.budget / 12
        rawTotal += actualMonthly

        // Detect front-loaded: named pattern OR first-month spend > 20% of annual budget
        const overThreshold = currentIdx <= 2 && cat.budget > 0 && (cat.ytdActuals / currentIdx) > (cat.budget * 0.20)
        if (isFrontLoaded(cat.name) || overThreshold) {
          adjustedTotal += budgetedMonthly
          adjustedNames.push(cat.name)
        } else {
          adjustedTotal += actualMonthly
        }
      }

      if (adjustedNames.length > 0) {
        normalizedBurn = Math.round(adjustedTotal)
      }
    }

    const hasEnoughData = snapshotCount >= 3

    // ── Derive low-payment and peak months from OSPI_PCT ─────────────────────
    const calMonthNames: Record<string, string> = {
      '01': 'January', '02': 'February', '03': 'March', '04': 'April',
      '05': 'May', '06': 'June', '07': 'July', '08': 'August',
      '09': 'September', '10': 'October', '11': 'November', '12': 'December',
    }
    const lowMonths = Object.entries(OSPI_PCT)
      .filter(([, pct]) => pct <= 6)
      .map(([mm, pct]) => `${calMonthNames[mm]}=${pct}%`)
      .join(', ')
    const peakEntry = Object.entries(OSPI_PCT).reduce((a, b) => (b[1] > a[1] ? b : a))
    const peakMonth = `${calMonthNames[peakEntry[0]]}=${peakEntry[1]}%`

    // ── Build prompt sections ────────────────────────────────────────────────
    let burnSection = `- Monthly Burn Rate (average): $${monthlyBurn.toLocaleString()}`
    if (adjustedNames.length > 0 && normalizedBurn !== monthlyBurn) {
      burnSection += `\n- Normalized Monthly Burn Rate: $${normalizedBurn.toLocaleString()} (adjusted for front-loaded expenses: ${adjustedNames.join(', ')})`
      burnSection += `\n  NOTE: The normalized rate substitutes budgeted monthly amounts for categories with one-time or front-loaded spending. Use the normalized rate for projections.`
    }

    let projectionInstructions: string
    if (hasEnoughData) {
      projectionInstructions = `3. 90-day cash projection: will cash cover 3 months of expenses given OSPI schedule? Use the ${adjustedNames.length > 0 ? 'normalized' : ''} monthly burn rate for the projection.`
    } else {
      projectionInstructions = `3. 90-day cash projection: SKIP specific projected balances and crisis-level warnings. Only ${snapshotCount} month(s) of data exist — note that a reliable 90-day projection requires at least 3 months of expense history. You may note upcoming low-payment months as a general awareness item at "watch" severity, but do NOT project specific ending balances or generate "action" severity findings based on projected cash shortfalls.`
    }

    let severityConstraint = ''
    if (!hasEnoughData) {
      severityConstraint = `\nIMPORTANT: With only ${snapshotCount} month(s) of data, cap projection-related findings at "watch" severity. Only current reserves threshold breaches (item #1) may use "concern" or "action" severity. Do not extrapolate crisis scenarios from limited data.`
    }

    const prompt = `Analyze the cash position for a Washington State charter school.

CURRENT POSITION:
- Cash on Hand: $${cashOnHand.toLocaleString()}
- Days of Operating Reserves: ${daysOfReserves}
${burnSection}
- Annual Expense Budget: $${totalBudget.toLocaleString()}
- Months of Expense Data: ${snapshotCount}

UPCOMING OSPI APPORTIONMENT (next 3 months):
${upcoming.map((u) => `- ${u.month}: ${u.pct}% of annual state aid${u.isLow ? ' [LOW PAYMENT MONTH]' : ''}`).join('\n')}

THRESHOLDS:
- Watch: <${assumptions.cash_watch_days} days of reserves
- Concern: <${assumptions.cash_concern_days} days of reserves
- Action: <${assumptions.cash_crisis_days} days of reserves
${severityConstraint}
Return a JSON array of findings. Each finding must have:
- findingType: "cash_risk"
- severity: "watch" | "concern" | "action"
- title: short plain-English title
- summary: 1-2 sentences explaining the risk and recommended action
- detail: { cashOnHand, daysOfReserves, monthlyBurn, upcomingLowMonths${adjustedNames.length > 0 ? ', normalizedBurn, adjustedCategories' : ''} }

Flag:
1. Current reserves threshold breach (if applicable)
2. Upcoming low payment months that could stress cash (${lowMonths}; highest inflow: ${peakMonth})
${projectionInstructions}

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

    // Enforce severity cap server-side when data is insufficient
    if (!hasEnoughData) {
      findings = findings.map((f) => {
        // Allow action/concern only for current reserves breach (not projections)
        const isCurrentBreach = f.title?.toLowerCase().includes('reserve') &&
          !f.title?.toLowerCase().includes('project') &&
          !f.title?.toLowerCase().includes('90') &&
          !f.summary?.toLowerCase().includes('project')
        if (!isCurrentBreach && (f.severity === 'action' || f.severity === 'concern')) {
          return { ...f, severity: 'watch' }
        }
        return f
      })
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
