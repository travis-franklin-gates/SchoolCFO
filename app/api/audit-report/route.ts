import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CLAUDE_MODEL } from '@/lib/constants'
import { buildSchoolContextBlock, type ContextEntry } from '@/lib/schoolContext'
import { createClient } from '@/lib/supabase-server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
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

    const prompt = `You are generating a comprehensive audit readiness report for ${schoolName}, a Washington state charter school, aligned with the WA State Auditor's Office (SAO) charter school accountability audit framework.

The SAO conducts accountability audits of charter schools focusing on: staff certification compliance, enrollment reporting accuracy, accounts payable controls, warrant approval compliance, categorical fund compliance, Open Public Meetings Act & board governance, separation of public and private activities, and theft-sensitive asset tracking. Reference specific RCWs and WACs where relevant (RCW 42.24.080/090 for warrants, RCW 42.30 for OPMA, RCW 28A.710 for charter schools, WAC 392-121 for enrollment).

Financial snapshot as of ${monthLabel}:
- Annual Expense Budget: $${totalBudget.toLocaleString()}
- YTD Expense Actuals: $${totalActuals.toLocaleString()} (${totalBudget > 0 ? ((totalActuals / totalBudget) * 100).toFixed(1) : '0.0'}% of expense budget)
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
  "executiveSummary": "2-3 paragraphs assessing overall audit readiness for a WA SAO accountability audit. Be specific about strengths and gaps. Reference applicable RCWs and WACs. Note that staff certification is historically the highest-risk area for WA charter schools. Tone: professional, actionable, direct.",

  "categoryFindings": [
    {
      "category": "CategoryName",
      "status": "ready|needs-attention|at-risk",
      "findings": "2-3 sentences about what the SAO would find in this area. Reference specific data points and applicable statutes.",
      "recommendations": ["Specific action item 1", "Specific action item 2"]
    }
  ],

  "priorityActions": ["Top priority action 1 with specific detail and statute reference", "Top priority action 2", "Top priority action 3"],

  "timelineRecommendation": "2-3 sentences about when to address the most critical items before the next SAO audit cycle. Reference typical SAO audit timing for charter schools."
}

The categoryFindings MUST cover exactly these 8 SAO audit areas in this order:
1. Staff Certification Compliance
2. Enrollment Reporting Accuracy
3. Accounts Payable Controls
4. Warrant Approval Compliance
5. Categorical Fund Compliance
6. Open Public Meetings Act & Board Governance
7. Separation of Public & Private Activities
8. Theft-Sensitive Asset Tracking

Base findings on the actual financial data provided. Where data is limited, note what documentation the school should prepare.`

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 5000,
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
