import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CLAUDE_MODEL } from '@/lib/constants'
import { buildSchoolContextBlock, type ContextEntry } from '@/lib/schoolContext'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY environment variable is not configured on this server.' },
      { status: 500 }
    )
  }

  try {
    const {
      schoolName,
      monthLabel,
      totalBudget,
      totalActuals,
      cashOnHand,
      daysOfReserves,
      variancePercent,
      categories,
      grants,
      alerts,
      auditChecklists,
      schoolContextEntries = [],
    } = await req.json()

    const categoryList = (categories as Array<{
      name: string; budget: number; ytdActuals: number; burnRate: number; alertStatus: string
    }>)
      .map((c) =>
        `- ${c.name}: budget $${c.budget.toLocaleString()}, actual $${c.ytdActuals.toLocaleString()}, burn rate ${c.burnRate.toFixed(0)}%, status: ${c.alertStatus.toUpperCase()}`
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

    const checklistSummary = (auditChecklists as Array<{
      category: string; checkedItems: string[]; reviewedAt: string | null; reviewerNote: string
    }>)
      .map((c) => {
        const status = c.reviewedAt ? `Reviewed ${c.reviewedAt}` : 'Not yet reviewed'
        return `- ${c.category}: ${c.checkedItems.length} items checked, ${status}${c.reviewerNote ? `. Note: ${c.reviewerNote}` : ''}`
      })
      .join('\n')

    const prompt = `You are generating a comprehensive audit readiness report for ${schoolName}, a Washington state charter school.

Financial snapshot as of ${monthLabel}:
- Annual budget: $${totalBudget.toLocaleString()}
- YTD actuals: $${totalActuals.toLocaleString()} (${((totalActuals / totalBudget) * 100).toFixed(1)}% of budget)
- Cash on hand: $${cashOnHand.toLocaleString()} (${daysOfReserves} days of operating reserves)
- Overall variance: ${variancePercent > 0 ? '+' : ''}${variancePercent}%

Budget categories:
${categoryList || 'None'}

Grant status:
${grantList || 'None'}

Active alerts:
${alertList || 'None'}

Audit checklist status:
${checklistSummary || 'No checklists reviewed yet'}
${buildSchoolContextBlock(schoolContextEntries as ContextEntry[])}

Generate an audit readiness report. Return a JSON object with exactly these keys. No other text, no markdown fences — just raw JSON:

{
  "executiveSummary": "2-3 paragraphs assessing overall audit readiness. Be specific about strengths and gaps. Reference WA state charter school audit requirements. Tone: professional, actionable, direct.",

  "categoryFindings": [
    {
      "category": "CategoryName",
      "status": "ready|needs-attention|at-risk",
      "findings": "2-3 sentences about what an auditor would find in this area. Reference specific data points.",
      "recommendations": ["Specific action item 1", "Specific action item 2"]
    }
  ],

  "priorityActions": ["Top priority action 1 with specific detail", "Top priority action 2", "Top priority action 3"],

  "timelineRecommendation": "2-3 sentences about when to address the most critical items before the next audit cycle. Be specific about deadlines."
}

The categoryFindings should cover these 6 audit areas: Warrant Approval, Categorical Fund Compliance, Time & Effort Documentation, Cash Management, CEDARS Reporting, Board Governance. Base findings on the actual financial data provided.`

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0]
    if (raw.type !== 'text') throw new Error('Unexpected response type')

    const jsonText = raw.text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const parsed = JSON.parse(jsonText)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Audit report API error:', err)
    return NextResponse.json(
      { error: 'Failed to generate audit report. Ensure ANTHROPIC_API_KEY is set.' },
      { status: 500 }
    )
  }
}
