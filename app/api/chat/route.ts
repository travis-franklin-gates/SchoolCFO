import Anthropic from '@anthropic-ai/sdk'
import { fiscalIndexFromKey } from '@/lib/fiscalYear'
import { CLAUDE_MODEL } from '@/lib/constants'
import { buildSchoolContextBlock, type ContextEntry } from '@/lib/schoolContext'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildSystemPrompt(
  schoolProfile: Record<string, unknown>,
  financialData: Record<string, unknown>,
  grants: Array<Record<string, unknown>>,
  alerts: Array<Record<string, unknown>>,
  otherGrants: Array<Record<string, unknown>>,
  activeMonth: string,
  schoolContextEntries: ContextEntry[] = []
): string {
  // WA State fiscal year — September 1 start. Update when adding multi-state support.
  const monthsElapsed = fiscalIndexFromKey(activeMonth)
  const totalMonths = 12
  const pacePercent = ((monthsElapsed / totalMonths) * 100).toFixed(0)

  const fd = financialData as {
    totalBudget: number
    ytdSpending: number
    cashOnHand: number
    daysOfReserves: number
    variancePercent: number
    categories: Array<{ name: string; ytdActuals: number; budget: number; burnRate: number; alertStatus: string }>
  }

  const sp = schoolProfile as {
    name: string
    authorizer: string
    gradeConfig: string
    currentFTES: number
  }

  const otherGrantsSection =
    otherGrants.length > 0
      ? `\nOTHER GRANTS & PHILANTHROPIC FUNDING:\n` +
        otherGrants
          .map((g) => {
            const grant = g as {
              name: string
              funder: string
              awardAmount: number
              spentToDate: number
              startDate: string
              endDate: string
              restrictions: string
            }
            const pct = grant.awardAmount > 0
              ? ((grant.spentToDate / grant.awardAmount) * 100).toFixed(0)
              : '0'
            const remaining = grant.awardAmount - grant.spentToDate
            return `- ${grant.name} (${grant.funder}): $${grant.spentToDate.toLocaleString()} of $${grant.awardAmount.toLocaleString()} (${pct}% spent, $${remaining.toLocaleString()} remaining) — ${grant.restrictions} — ${grant.startDate} to ${grant.endDate}`
          })
          .join('\n')
      : ''

  return `You are SchoolCFO, an expert virtual CFO for Washington State charter schools. Your job is to help school principals and executive directors understand their finances in plain, jargon-free language. You are concise, direct, and action-oriented.

You are an expert in Washington State charter school finance including:
- Charter school funding formulas (per-pupil allocation, FTES, prototypical school model)
- Categorical grants: Title I Part A, LAP, IDEA/Special Education, TBIP, HiCap, ELL
- OSPI financial reporting and compliance requirements
- Board reporting best practices for WA charter schools
- WA Charter School Commission authorizer expectations

Always ground your answers in the school's actual financial data below. Avoid accounting jargon. When the answer has action implications, state them clearly.

Always end your response with a section called "Your Next 3 Actions" that lists exactly three specific, concrete steps the school leader should take this week, numbered 1-2-3, written in plain language with no jargon. These should be the highest-leverage actions given the current financial situation.

If the user has attached a document (vendor proposal, contract, invoice, spreadsheet, or other file), analyze it in the context of the school's financial situation. For vendor proposals or contracts, evaluate affordability, hidden costs, and SEBB/FICA implications for new staff. For spreadsheets or budget documents, reconcile them against the school's current financial snapshot.

CURRENT SCHOOL:
School: ${sp.name}
Authorizer: ${sp.authorizer}
Grade Configuration: ${sp.gradeConfig}
Current FTES: ${sp.currentFTES}

FINANCIAL SNAPSHOT (${monthsElapsed} of ${totalMonths} months elapsed — ${pacePercent}% through fiscal year):
- Annual Budget: $${fd.totalBudget.toLocaleString()}
- YTD Spending: $${fd.ytdSpending.toLocaleString()} (${((fd.ytdSpending / fd.totalBudget) * 100).toFixed(1)}% of budget)
- Cash on Hand: $${fd.cashOnHand.toLocaleString()} (${fd.daysOfReserves} days of operating reserves)
- Budget Variance: ${fd.variancePercent}%

BUDGET BY CATEGORY:
${fd.categories.map((c) => `- ${c.name}: $${c.ytdActuals.toLocaleString()} of $${c.budget.toLocaleString()} (${c.burnRate.toFixed(0)}% burned) [${c.alertStatus.toUpperCase()}]`).join('\n')}

WA CATEGORICAL GRANT STATUS:
${grants.map((g) => {
  const grant = g as { name: string; spent: number; awardAmount: number; status: string }
  const pct = ((grant.spent / grant.awardAmount) * 100).toFixed(0)
  return `- ${grant.name}: $${grant.spent.toLocaleString()} of $${grant.awardAmount.toLocaleString()} (${pct}% spent) — ${grant.status}`
}).join('\n')}${otherGrantsSection}

ACTIVE ALERTS:
${alerts.map((a) => {
  const alert = a as { severity: string; message: string }
  return `- [${alert.severity.toUpperCase()}] ${alert.message}`
}).join('\n')}${buildSchoolContextBlock(schoolContextEntries)}`
}

export async function POST(req: Request) {
  try {
    const { messages, schoolProfile, financialData, grants, alerts, otherGrants = [], activeMonth = '2026-03', schoolContextEntries = [] } = await req.json()

    const systemPrompt = buildSystemPrompt(schoolProfile, financialData, grants, alerts, otherGrants, activeMonth, schoolContextEntries)

    const stream = client.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text))
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process request. Ensure ANTHROPIC_API_KEY is set.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
