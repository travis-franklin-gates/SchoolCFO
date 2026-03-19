import Anthropic from '@anthropic-ai/sdk'
import { fiscalIndexFromKey } from '@/lib/fiscalYear'
import { CLAUDE_MODEL } from '@/lib/constants'
import { buildSchoolContextBlock, type ContextEntry } from '@/lib/schoolContext'
import { type FinancialAssumptions, mergeAssumptions } from '@/lib/financialAssumptions'
import { createClient } from '@/lib/supabase-server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface AgentFindingRow {
  agent_name: string
  severity: string
  title: string
  summary: string
  finding_type: string
}

function buildAgentFindingsBlock(findings: AgentFindingRow[]): string {
  if (!findings || findings.length === 0) return ''

  const byAgent: Record<string, AgentFindingRow[]> = {}
  for (const f of findings) {
    const agent = f.agent_name
    if (!byAgent[agent]) byAgent[agent] = []
    byAgent[agent].push(f)
  }

  const sections = Object.entries(byAgent).map(([agent, items]) => {
    const label = agent.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const lines = items.map((f) =>
      `  - [${f.severity.toUpperCase()}] ${f.title}: ${f.summary}`
    ).join('\n')
    return `${label}:\n${lines}`
  }).join('\n')

  return `\n\nSPECIALIST AGENT FINDINGS (use these to ground your responses — cite the source agent when relevant):
${sections}`
}

function buildSystemPrompt(
  schoolProfile: Record<string, unknown>,
  financialData: Record<string, unknown>,
  grants: Array<Record<string, unknown>>,
  alerts: Array<Record<string, unknown>>,
  otherGrants: Array<Record<string, unknown>>,
  activeMonth: string,
  schoolContextEntries: ContextEntry[] = [],
  agentFindings: AgentFindingRow[] = [],
  assumptions: FinancialAssumptions = mergeAssumptions(),
): string {
  // WA State fiscal year — September 1 start. Update when adding multi-state support.
  const monthsElapsed = fiscalIndexFromKey(activeMonth)
  const totalMonths = 12
  const pacePercent = ((monthsElapsed / totalMonths) * 100).toFixed(0)

  const fd = financialData as {
    totalBudget: number
    revenueBudget: number
    ytdSpending: number
    ytdExpenses?: number
    cashOnHand: number
    daysOfReserves: number
    variancePercent: number
    categories: Array<{ name: string; ytdActuals: number; budget: number; burnRate: number; alertStatus: string }>
  }

  const sp = schoolProfile as {
    name: string
    authorizer: string
    gradesCurrentFirst: string
    gradesCurrentLast: string
    gradesBuildoutFirst: string
    gradesBuildoutLast: string
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

WA CHARTER SCHOOL REVENUE KNOWLEDGE:

Fiscal Year:
- WA charter school fiscal year: September 1 through August 31 (12-month cycle: Sep, Oct, Nov, Dec, Jan, Feb, Mar, Apr, May, Jun, Jul, Aug).
- The WA Charter School Commission fiscal year is July 1 through June 30 — this only matters for Commission reporting deadlines, not for the school's own budget cycle.
- Never confuse the two. All budget pace, burn rate, and cash flow calculations use the Sep–Aug school fiscal year.

Funding Formula — AAFTE vs Headcount:
- WA charter schools are funded on Annual Average Full-Time Equivalent (AAFTE), not headcount. A student enrolled part-time or for part of the year generates a fraction of an FTE.
- AAFTE is calculated from enrollment reported on Form P-223 (monthly enrollment counts). October count is the most consequential — it sets the baseline for the year's apportionment.
- January true-up: OSPI adjusts apportionment based on updated enrollment data. Schools that lost students between October and January will see a revenue reduction. Schools that gained students may see an increase.
- Budget conservatively: build revenue projections on October AAFTE, not optimistic headcount targets.

OSPI Apportionment Schedule (% of annual state aid by month):
September 9% | October 8% | November 5% (LOW) | December 9% | January 8.5% | February 9% | March 9% | April 9% | May 5% (LOW) | June 6% | July 12.5% | August 10%

Levy Equity:
- Levy equity per student is currently $0. The legislature has not reinstated this funding.
- If levy equity is restored, it will appear in the school's apportionment data. Do not assume any levy equity revenue in projections unless the school has confirmed a specific appropriation.

Revenue Risk Flags — proactively warn the school leader about these:
- Enrollment decline between October and January (triggers apportionment reduction at January true-up)
- AAFTE running below budgeted FTES (revenue will fall short of plan)
- Over-reliance on one-time grants or philanthropic funding for recurring operating expenses
- Categorical grant underspend approaching clawback thresholds (especially Title I and IDEA)
- Cash flow gaps in November and May (low OSPI payment months — 5% each vs. 8–12.5% in other months)
- Revenue budget built on headcount rather than AAFTE (likely overstated)

SCHOOL-CONFIGURED FINANCIAL ASSUMPTIONS (use these thresholds when analyzing — the school leader has reviewed and approved them):
- Benefits load: ${assumptions.benefits_load_pct}% above base salary | Employer FICA: ${assumptions.fica_rate_pct}%
- Personnel healthy range: ${assumptions.personnel_healthy_min_pct}–${assumptions.personnel_healthy_max_pct}% of total budget | Concern above ${assumptions.personnel_concern_pct}%
- Salary step escalator: ${assumptions.salary_escalator_pct}% | COLA: ${assumptions.cola_rate_pct}% | Ops escalator: ${assumptions.operations_escalator_pct}%
- AAFTE projection: ${assumptions.aafte_pct}% of headcount | Authorizer fee: ${assumptions.authorizer_fee_pct}% of state revenue
- Cash reserves — Healthy: ≥${assumptions.cash_healthy_days} days | Watch: <${assumptions.cash_watch_days} days | Concern: <${assumptions.cash_concern_days} days | Crisis: <${assumptions.cash_crisis_days} days
- Interest rate on reserves: ${assumptions.interest_rate_pct}%

CURRENT SCHOOL:
School: ${sp.name}
Authorizer: ${sp.authorizer}
Grades Currently Served: ${sp.gradesCurrentFirst}${sp.gradesCurrentLast ? '-' + sp.gradesCurrentLast : ''}
Grades at Full Build-out: ${sp.gradesBuildoutFirst}${sp.gradesBuildoutLast ? '-' + sp.gradesBuildoutLast : ''}
Current FTES: ${sp.currentFTES}

FINANCIAL SNAPSHOT (${monthsElapsed} of ${totalMonths} months elapsed — ${pacePercent}% through fiscal year):
- Annual Expense Budget: $${fd.totalBudget.toLocaleString()}${fd.revenueBudget > 0 ? `\n- Annual Revenue Budget: $${fd.revenueBudget.toLocaleString()}` : ''}
- YTD Expenses: $${(fd.ytdExpenses ?? fd.ytdSpending).toLocaleString()} (${fd.totalBudget > 0 ? (((fd.ytdExpenses ?? fd.ytdSpending) / fd.totalBudget) * 100).toFixed(1) : '0.0'}% of expense budget)
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
}).join('\n')}${buildSchoolContextBlock(schoolContextEntries)}${buildAgentFindingsBlock(agentFindings)}`
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const { messages, schoolProfile, financialData, grants, alerts, otherGrants = [], activeMonth = '2026-03', schoolContextEntries = [], agentFindings = [], financialAssumptions = null } = await req.json()

    const assumptions = mergeAssumptions(financialAssumptions)
    const systemPrompt = buildSystemPrompt(schoolProfile, financialData, grants, alerts, otherGrants, activeMonth, schoolContextEntries, agentFindings, assumptions)

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
