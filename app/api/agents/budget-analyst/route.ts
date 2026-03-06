import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CLAUDE_MODEL } from '@/lib/constants'
import { createClient } from '@/lib/supabase-server'
import type { BudgetCategory } from '@/lib/store'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface RequestBody {
  schoolId: string
  activeMonth: string
  pacePercent: number
  categories: BudgetCategory[]
  totalBudget: number
  ytdSpending: number
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const body: RequestBody = await req.json()
    const { schoolId, activeMonth, pacePercent, categories, totalBudget, ytdSpending } = body

    if (!schoolId || !categories?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const personnelCats = categories.filter((c) =>
      /salary|personnel|staff|benefits|payroll/i.test(c.name)
    )
    const personnelTotal = personnelCats.reduce((s, c) => s + c.ytdActuals, 0)
    const personnelPct = ytdSpending > 0 ? ((personnelTotal / ytdSpending) * 100).toFixed(1) : '0'

    const catLines = categories.map((c) => {
      const burnDelta = c.burnRate - pacePercent
      const remaining = c.budget - c.ytdActuals
      const projectedYE = c.budget > 0 ? Math.round((c.ytdActuals / pacePercent) * 100) : 0
      const projectedOver = projectedYE - c.budget
      return `- ${c.name}: $${c.ytdActuals.toLocaleString()} of $${c.budget.toLocaleString()} (${c.burnRate.toFixed(0)}% burned, pace ${pacePercent}%, delta ${burnDelta > 0 ? '+' : ''}${burnDelta.toFixed(0)}pp) — $${remaining.toLocaleString()} remaining — projected year-end: $${projectedYE.toLocaleString()} (${projectedOver > 0 ? '+$' + projectedOver.toLocaleString() + ' over' : '$' + Math.abs(projectedOver).toLocaleString() + ' under'})`
    }).join('\n')

    const prompt = `Analyze the following budget data for a Washington State charter school. Month: ${activeMonth}, fiscal year pace: ${pacePercent}%.

OVERALL:
- Annual Budget: $${totalBudget.toLocaleString()}
- YTD Spending: $${ytdSpending.toLocaleString()} (${((ytdSpending / totalBudget) * 100).toFixed(1)}%)
- Personnel as % of total spending: ${personnelPct}%

CATEGORIES:
${catLines}

Return a JSON array of findings. Each finding must have:
- findingType: "variance"
- severity: "watch" | "concern" | "action" (only include items that warrant attention — skip "info" level)
- title: short plain-English title (no jargon)
- summary: 1-2 sentences explaining the issue and what to do
- detail: { category, burnRate, pacePercent, projectedYearEnd, budgetRemaining }

Only include categories where burn rate exceeds pace by >5pp (watch), >10pp (concern), >20pp (action), OR where underspend is >20pp below pace (watch — may indicate coding errors or delayed purchases).

Also flag if personnel % is above 85% of total spending (concern) or above 90% (action).

Return ONLY the JSON array, no markdown fences.`

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      system: 'You are a budget analyst specialist for Washington State charter schools. Respond only with valid JSON arrays. No markdown, no explanation outside the JSON.',
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
      console.error('[budget-analyst] Failed to parse response:', text)
      findings = []
    }

    // Write findings to Supabase
    const supabase = await createClient()

    // Delete old budget_analyst findings for this school
    await supabase
      .from('agent_findings')
      .delete()
      .eq('school_id', schoolId)
      .eq('agent_name', 'budget_analyst')

    // Insert new findings
    if (findings.length > 0) {
      const rows = findings.map((f) => ({
        school_id: schoolId,
        agent_name: 'budget_analyst',
        finding_type: f.findingType || 'variance',
        severity: f.severity,
        title: f.title,
        summary: f.summary,
        detail: f.detail || {},
        expires_at: null,
      }))

      const { error } = await supabase.from('agent_findings').insert(rows)
      if (error) console.error('[budget-analyst] Insert error:', error)
    }

    return NextResponse.json({ findings: findings.length, agent: 'budget_analyst' })
  } catch (error) {
    console.error('[budget-analyst]', error)
    return NextResponse.json({ error: 'Budget analyst failed' }, { status: 500 })
  }
}
