import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CLAUDE_MODEL } from '@/lib/constants'
import { buildSchoolContextBlock, type ContextEntry } from '@/lib/schoolContext'
import { type FpfScorecardResult, formatFpfForPrompt } from '@/lib/fpfScorecard'
import { createClient } from '@/lib/supabase-server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// WA OSPI 2025-26 actual apportionment schedule (fiscal year order: Sep–Aug)
const OSPI_SCHEDULE = `WA OSPI 2025-26 monthly apportionment (% of annual state aid, fiscal year order):
September 9% | October 8% | November 5% (LOW PAYMENT MONTH) | December 9%
January 8.5% | February 9% | March 9% | April 9% | May 5% (LOW PAYMENT MONTH) | June 6% | July 12.5% | August 10%`

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[board-packet] ANTHROPIC_API_KEY is not set')
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY environment variable is not configured on this server.' },
      { status: 500 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const {
      schoolName,
      monthLabel,
      pace,
      totalBudget,
      totalActuals,
      cashOnHand,
      daysOfReserves,
      variancePercent,
      flaggedCategories,
      grants,
      alerts,
      schoolContextEntries = [],
      fpfScorecard = null,
    } = await req.json()

    const expectedPct = Math.round(pace * 100)

    const flaggedList = (flaggedCategories as Array<{
      name: string; budget: number; ytdActuals: number; burnRate: number; alertStatus: string
    }>)
      .map((c) =>
        `- ${c.name}: ${c.burnRate.toFixed(0)}% of budget spent (expected ${expectedPct}%), status: ${c.alertStatus.toUpperCase()}, budget $${c.budget.toLocaleString()}, actual $${c.ytdActuals.toLocaleString()}`
      )
      .join('\n')

    const grantList = (grants as Array<{ name: string; spent: number; awardAmount: number; status: string }>)
      .map((g) =>
        `- ${g.name}: $${g.spent.toLocaleString()} of $${g.awardAmount.toLocaleString()} (${((g.spent / g.awardAmount) * 100).toFixed(0)}% spent), status: ${g.status}`
      )
      .join('\n')

    const alertList = (alerts as Array<{ severity: string; message: string }>)
      .map((a) => `- [${a.severity.toUpperCase()}] ${a.message}`)
      .join('\n')

    const prompt = `You are generating sections of an official board packet for ${schoolName}.

Financial snapshot as of ${monthLabel} (${expectedPct}% through the fiscal year):
- Annual Expense Budget: $${totalBudget.toLocaleString()}
- YTD Expense Actuals: $${totalActuals.toLocaleString()} (${totalBudget > 0 ? ((totalActuals / totalBudget) * 100).toFixed(1) : '0.0'}% of expense budget, expected ${expectedPct}%)
- Cash on hand: $${cashOnHand.toLocaleString()} (${daysOfReserves} days of operating reserves)
- Overall variance vs expected pace: ${variancePercent > 0 ? '+' : ''}${variancePercent}%

Flagged budget categories (Watch/Concern/Action Required only):
${flaggedList || 'None flagged'}

Grant status:
${grantList}

Active alerts:
${alertList || 'None'}

${OSPI_SCHEDULE}${fpfScorecard ? '\n\n' + formatFpfForPrompt(fpfScorecard as FpfScorecardResult) : ''}${buildSchoolContextBlock(schoolContextEntries as ContextEntry[])}

Return a JSON object with exactly these three keys. No other text, no markdown fences — just raw JSON:

{
  "financialNarrative": "3-4 paragraphs for board members who are not accountants. Paragraph 1: overall financial position with specific dollar figures. Paragraph 2: the most significant items needing board awareness. Paragraph 3: cash position and reserves. Paragraph 4: outlook for the remainder of the year. Tone: clear, direct, factual with context — neither alarming nor dismissive.",

  "varianceExplanations": [
    { "category": "CategoryName", "explanation": "2-3 sentences: what the variance means in plain English, why it likely occurred, and what the school leader should tell the board. Be specific and direct." }
  ],

  "cashFlowNotes": "2-3 sentences about cash flow risks for the remainder of the year. Reference the November and May low OSPI payment months specifically, and the current reserves position. Be concrete about dollar impact."
}`

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0]
    if (raw.type !== 'text') throw new Error('Unexpected response type')

    // Strip markdown code fences if present
    const jsonText = raw.text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const parsed = JSON.parse(jsonText)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Board packet API error:', err)
    return NextResponse.json(
      { error: 'Failed to generate board packet. Ensure ANTHROPIC_API_KEY is set.' },
      { status: 500 }
    )
  }
}
