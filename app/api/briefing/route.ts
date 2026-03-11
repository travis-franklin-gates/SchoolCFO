import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CLAUDE_MODEL } from '@/lib/constants'
import { buildSchoolContextBlock, type ContextEntry } from '@/lib/schoolContext'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[briefing] ANTHROPIC_API_KEY is not set')
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const body = await req.json()
    const { schoolProfile, financialData, alerts, pacePercent, monthLabel, schoolContextEntries = [], agentFindings = [] } = body as {
      schoolProfile: Record<string, unknown>
      financialData: Record<string, unknown>
      alerts: unknown
      pacePercent: number
      monthLabel: string
      schoolContextEntries: ContextEntry[]
      agentFindings: Array<{ agent_name: string; severity: string; title: string; summary: string }>
    }

    const spName = String(schoolProfile?.name ?? 'the school')
    const spGradeCurrent = `${schoolProfile?.gradesCurrentFirst ?? ''}${schoolProfile?.gradesCurrentLast ? '-' + schoolProfile.gradesCurrentLast : ''}`
    const spGradeBuildout = `${schoolProfile?.gradesBuildoutFirst ?? ''}${schoolProfile?.gradesBuildoutLast ? '-' + schoolProfile.gradesBuildoutLast : ''}`
    const spFtes = Number(schoolProfile?.currentFTES ?? 0)

    const fdBudget = Number(financialData?.totalBudget ?? 0)
    const fdYtd = Number(financialData?.ytdSpending ?? 0)
    const fdCash = Number(financialData?.cashOnHand ?? 0)
    const fdDays = Number(financialData?.daysOfReserves ?? 0)
    const categories = Array.isArray(financialData?.categories)
      ? (financialData.categories as Array<{
          name?: string; ytdActuals?: number; budget?: number;
          burnRate?: number; alertStatus?: string
        }>)
      : []
    const alertList = Array.isArray(alerts)
      ? (alerts as Array<{ severity?: string; message?: string }>)
      : []

    const burnPct = fdBudget > 0
      ? ((fdYtd / fdBudget) * 100).toFixed(1)
      : '0'

    const flagged = categories.filter((c) => c.alertStatus && c.alertStatus !== 'ok')

    const context = `SCHOOL: ${spName} (${spGradeCurrent}${spGradeBuildout && spGradeBuildout !== spGradeCurrent ? `, build-out ${spGradeBuildout}` : ''}, ${spFtes} FTES)
DATA THROUGH: ${monthLabel} — ${pacePercent}% expected budget pace

FINANCIAL POSITION:
- Annual Expense Budget: $${fdBudget.toLocaleString()}
- YTD Spending: $${fdYtd.toLocaleString()} (${burnPct}% spent vs ${pacePercent}% expected)
- Cash on Hand: $${fdCash.toLocaleString()} (${fdDays} days of reserves)

FLAGGED CATEGORIES:
${flagged.map((c) => {
  const name = c.name ?? 'Unknown'
  const budget = Number(c.budget ?? 0)
  const ytd = Number(c.ytdActuals ?? 0)
  const burnRate = Number(c.burnRate ?? 0)
  const remaining = budget - ytd
  const status = String(c.alertStatus ?? 'ok').toUpperCase()
  return `- ${name}: ${burnRate.toFixed(0)}% spent, $${remaining.toLocaleString()} remaining [${status}]`
}).join('\n') || 'None'}

ACTIVE ALERTS:
${alertList.map((a) => `- [${String(a.severity ?? 'info').toUpperCase()}] ${String(a.message ?? '')}`).join('\n') || 'None'}${buildSchoolContextBlock(schoolContextEntries)}${agentFindings.length > 0 ? '\n\nSPECIALIST AGENT FINDINGS:\n' + agentFindings.map((f) => `- [${f.severity.toUpperCase()}] ${f.title}: ${f.summary}`).join('\n') : ''}`

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 220,
      system: `You are a virtual CFO delivering a morning briefing to a charter school CEO. Write exactly 3-4 sentences in plain English. No headers, no bullet points, no jargon.

Structure:
1. Overall financial position: how spending compares to expected pace, and cash health.
2. The most important concern: a specific category, dollar amount, and why it matters.
3. One additional notable item if relevant (optional — skip if nothing else worth flagging).
4. End with exactly this format: "→ [One specific action they should take today, written as a direct command, time-specific if relevant.]"

Be direct and concrete. Use real numbers. Write like a trusted advisor giving a quick briefing before a meeting.`,
      messages: [{ role: 'user', content: context }],
    })

    const briefing =
      response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    return NextResponse.json({ briefing })
  } catch (error) {
    console.error('[briefing]', error)
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 })
  }
}
