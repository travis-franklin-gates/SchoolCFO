// Commission V8-format Excel export.
// Generates a 6-tab workbook for annual reporting and charter renewal.

import type { SchoolProfile, FinancialSnapshot, Grant, BudgetCategory } from './store'
import type { FinancialAssumptions } from './financialAssumptions'
import { buildRevenueModel, type RevenueLineResult, type RevenueSource } from './revenueModel'
import { buildFpfScorecard } from './fpfScorecard'
import { getFiscalMonths, fiscalIndexFromKey, OSPI_PCT, DEFAULT_OSPI_PCT } from './fiscalYear'

// ── Shared helpers ──────────────────────────────────────────────────────────

const HEADER_FILL = { rgb: 'D6E4F0' } // light blue
const HEADER_FONT = { bold: true }

interface CellStyle {
  font?: { bold?: boolean }
  fill?: { fgColor?: { rgb: string } }
  numFmt?: string
  alignment?: { horizontal?: string }
}

function styledCell(v: string | number | null, style?: CellStyle) {
  const cell: Record<string, unknown> = {}
  if (v == null) { cell.v = ''; cell.t = 's' }
  else if (typeof v === 'number') { cell.v = v; cell.t = 'n' }
  else { cell.v = v; cell.t = 's' }
  if (style) cell.s = style
  return cell
}

function headerCell(v: string) {
  return styledCell(v, { font: HEADER_FONT, fill: { fgColor: HEADER_FILL }, alignment: { horizontal: 'center' } })
}

function currencyCell(v: number | null) {
  return styledCell(v, { numFmt: '$#,##0' })
}

function pctCell(v: number | null) {
  if (v == null) return styledCell(null)
  return styledCell(v / 100, { numFmt: '0.0%' })
}

function titleRow(text: string, cols: number) {
  const row = [styledCell(text, { font: { bold: true } })]
  for (let i = 1; i < cols; i++) row.push(styledCell(null))
  return row
}

function addSheetHeader(rows: unknown[][], schoolName: string, tabTitle: string, reportDate: string, cols: number) {
  rows.push(titleRow(`${schoolName} — ${tabTitle}`, cols))
  rows.push([styledCell(`Report Date: ${reportDate}`)])
  rows.push([]) // blank row
}

// ── Export function ─────────────────────────────────────────────────────────

export async function generateCommissionExport(
  profile: SchoolProfile,
  financialData: FinancialSnapshot,
  grants: Grant[],
  assumptions: FinancialAssumptions,
  activeMonth: string,
  monthlySnapshots: Record<string, { financialSummary: { ytdRevenue: number; ytdExpenses: number } }>,
): Promise<void> {
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()
  const reportDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const schoolName = profile.name || 'School'
  const monthLabel = new Date(activeMonth + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // ── Tab 1: Enrollment ──────────────────────────────────────────────────────

  const enrollRows: unknown[][] = []
  addSheetHeader(enrollRows, schoolName, 'Enrollment Summary', reportDate, 3)

  enrollRows.push([headerCell('Field'), headerCell('Value'), headerCell('Notes')])
  enrollRows.push([styledCell('School Name'), styledCell(schoolName), styledCell(null)])
  enrollRows.push([styledCell('Grade Configuration'), styledCell(`${profile.gradesCurrentFirst}-${profile.gradesCurrentLast}`), styledCell(`Build-out: ${profile.gradesBuildoutFirst}-${profile.gradesBuildoutLast}`)])
  enrollRows.push([styledCell('Current Year FTES'), styledCell(profile.currentFTES), styledCell(null)])
  enrollRows.push([styledCell('Prior Year FTES'), styledCell(profile.priorYearFTES), styledCell(null)])
  enrollRows.push([styledCell('Headcount (Enrolled)'), styledCell(profile.headcount), styledCell(null)])
  enrollRows.push([styledCell('AAFTE (Estimated)'), styledCell(Math.round(profile.headcount * assumptions.aafte_pct / 100)), styledCell(`${assumptions.aafte_pct}% of headcount`)])
  enrollRows.push([styledCell('Operating Year'), styledCell(profile.operatingYear), styledCell(`FPF Stage ${profile.operatingYear <= 2 ? '1' : '2'}`)])
  enrollRows.push([])
  enrollRows.push([styledCell('Student Demographics', { font: { bold: true } })])
  enrollRows.push([styledCell('SPED %'), pctCell(profile.spedPct), styledCell(null)])
  enrollRows.push([styledCell('FRL %'), pctCell(profile.frlPct), styledCell(null)])
  enrollRows.push([styledCell('ELL %'), pctCell(profile.ellPct), styledCell(null)])
  enrollRows.push([styledCell('HiCap %'), pctCell(profile.hicapPct), styledCell(null)])
  enrollRows.push([styledCell('IEP %'), pctCell(profile.iepPct), styledCell(null)])

  const wsEnroll = XLSX.utils.aoa_to_sheet(enrollRows)
  wsEnroll['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsEnroll, 'Enrollment')

  // ── Tab 2: Revenue ─────────────────────────────────────────────────────────

  const revenueCategories = financialData.categories.filter((c) => c.accountType === 'revenue')
  const revenueLines = buildRevenueModel(profile, assumptions, revenueCategories)

  const revRows: unknown[][] = []
  addSheetHeader(revRows, schoolName, 'Revenue — Commission V8 Lines', reportDate, 6)

  revRows.push([
    headerCell('Source'), headerCell('Revenue Line'),
    headerCell('Expected'), headerCell('Actual YTD'),
    headerCell('Variance $'), headerCell('Variance %'),
  ])

  const sourceLabels: Record<RevenueSource, string> = { state: 'State & Local', federal: 'Federal', categorical: 'State Categorical', other: 'Other' }
  const sources: RevenueSource[] = ['state', 'federal', 'categorical', 'other']

  let totalExpected = 0, totalActual = 0
  for (const source of sources) {
    const group = revenueLines.filter((l) => l.source === source)
    for (const line of group) {
      revRows.push([
        styledCell(sourceLabels[source]),
        styledCell(line.label),
        currencyCell(line.expected),
        currencyCell(line.actual),
        currencyCell(line.delta),
        line.expected > 0 ? pctCell(line.deltaPct) : styledCell('—'),
      ])
      totalExpected += line.expected
      totalActual += line.actual
    }
  }
  revRows.push([])
  revRows.push([
    styledCell(null),
    styledCell('TOTAL', { font: { bold: true } }),
    currencyCell(totalExpected),
    currencyCell(totalActual),
    currencyCell(totalActual - totalExpected),
    totalExpected > 0 ? pctCell(Math.round((totalActual - totalExpected) / totalExpected * 1000) / 10) : styledCell('—'),
  ])

  const wsRev = XLSX.utils.aoa_to_sheet(revRows)
  wsRev['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsRev, 'Revenue')

  // ── Tab 3: Staffing ────────────────────────────────────────────────────────

  const staffRows: unknown[][] = []
  addSheetHeader(staffRows, schoolName, 'Personnel Summary', reportDate, 4)

  // Calculate personnel costs from categories
  const personnelCats = financialData.categories.filter((c) =>
    c.accountType === 'expense' && /salary|personnel|staff|benefits|payroll/i.test(c.name)
  )
  const totalPersonnelCost = personnelCats.reduce((s, c) => s + c.ytdActuals, 0)
  const totalPersonnelBudget = personnelCats.reduce((s, c) => s + c.budget, 0)
  const personnelPctOfBudget = financialData.totalBudget > 0
    ? (totalPersonnelBudget / financialData.totalBudget) * 100 : 0
  const personnelPctOfRevenue = financialData.revenueBudget > 0
    ? (totalPersonnelBudget / financialData.revenueBudget) * 100 : 0

  staffRows.push([headerCell('Metric'), headerCell('Budget'), headerCell('YTD Actual'), headerCell('Notes')])
  staffRows.push([styledCell('Total Personnel Cost'), currencyCell(totalPersonnelBudget), currencyCell(totalPersonnelCost), styledCell(null)])
  staffRows.push([styledCell('Personnel as % of Budget'), pctCell(personnelPctOfBudget), styledCell(null), styledCell(`Healthy range: ${assumptions.personnel_healthy_min_pct}–${assumptions.personnel_healthy_max_pct}%`)])
  staffRows.push([styledCell('Personnel as % of Revenue'), pctCell(personnelPctOfRevenue), styledCell(null), styledCell(null)])
  staffRows.push([styledCell('Benefits Load'), pctCell(assumptions.benefits_load_pct), styledCell(null), styledCell('SEBB rate')])
  staffRows.push([styledCell('Employer FICA'), pctCell(assumptions.fica_rate_pct), styledCell(null), styledCell(null)])
  staffRows.push([styledCell('Current FTES'), styledCell(profile.currentFTES), styledCell(null), styledCell(null)])
  staffRows.push([])

  // Personnel category breakdown
  if (personnelCats.length > 0) {
    staffRows.push([styledCell('Personnel Categories', { font: { bold: true } })])
    staffRows.push([headerCell('Category'), headerCell('Budget'), headerCell('YTD Actual'), headerCell('Burn Rate')])
    for (const cat of personnelCats) {
      staffRows.push([
        styledCell(cat.name),
        currencyCell(cat.budget),
        currencyCell(cat.ytdActuals),
        pctCell(cat.burnRate),
      ])
    }
  }

  const wsStaff = XLSX.utils.aoa_to_sheet(staffRows)
  wsStaff['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsStaff, 'Staffing')

  // ── Tab 4: Income Statement ────────────────────────────────────────────────

  const isRows: unknown[][] = []
  addSheetHeader(isRows, schoolName, `Income Statement — Through ${monthLabel}`, reportDate, 4)

  isRows.push([headerCell('Category'), headerCell('Budget'), headerCell('YTD Actual'), headerCell('Variance')])

  // Revenue section
  isRows.push([styledCell('REVENUE', { font: { bold: true } })])
  const revCats = financialData.categories.filter((c) => c.accountType === 'revenue')
  let revBudgetTotal = 0, revActualTotal = 0
  for (const cat of revCats) {
    isRows.push([styledCell(cat.name), currencyCell(cat.budget), currencyCell(cat.ytdActuals), currencyCell(cat.ytdActuals - cat.budget)])
    revBudgetTotal += cat.budget
    revActualTotal += cat.ytdActuals
  }
  isRows.push([styledCell('Total Revenue', { font: { bold: true } }), currencyCell(revBudgetTotal), currencyCell(revActualTotal), currencyCell(revActualTotal - revBudgetTotal)])
  isRows.push([])

  // Expense section
  isRows.push([styledCell('EXPENSES', { font: { bold: true } })])
  const expCats = financialData.categories.filter((c) => c.accountType === 'expense')
  let expBudgetTotal = 0, expActualTotal = 0
  for (const cat of expCats) {
    isRows.push([styledCell(cat.name), currencyCell(cat.budget), currencyCell(cat.ytdActuals), currencyCell(cat.budget - cat.ytdActuals)])
    expBudgetTotal += cat.budget
    expActualTotal += cat.ytdActuals
  }
  isRows.push([styledCell('Total Expenses', { font: { bold: true } }), currencyCell(expBudgetTotal), currencyCell(expActualTotal), currencyCell(expBudgetTotal - expActualTotal)])
  isRows.push([])

  // Net position
  const netBudget = revBudgetTotal - expBudgetTotal
  const netActual = revActualTotal - expActualTotal
  isRows.push([styledCell('NET POSITION', { font: { bold: true } }), currencyCell(netBudget), currencyCell(netActual), currencyCell(netActual - netBudget)])

  const wsIS = XLSX.utils.aoa_to_sheet(isRows)
  wsIS['!cols'] = [{ wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsIS, 'Income Statement')

  // ── Tab 5: Cash Flow ───────────────────────────────────────────────────────

  const cfRows: unknown[][] = []
  addSheetHeader(cfRows, schoolName, `Cash Flow — FY${activeMonth.slice(0, 4)}`, reportDate, 6)

  cfRows.push([
    headerCell('Month'), headerCell('OSPI %'),
    headerCell('Beginning Cash'), headerCell('Revenue In'),
    headerCell('Expenses Out'), headerCell('Ending Cash'),
  ])

  const fiscalMonths = getFiscalMonths()
  const activeFiscalIdx = fiscalIndexFromKey(activeMonth)
  const ytdRevenue = financialData.ytdRevenue
  const ytdExpenses = financialData.ytdExpenses
  const monthlyRevRate = activeFiscalIdx > 0 ? ytdRevenue / activeFiscalIdx : 0
  const monthlyExpRate = activeFiscalIdx > 0 ? ytdExpenses / activeFiscalIdx : 0
  let runningCash = profile.openingCashBalance

  for (const fm of fiscalMonths) {
    const ospiPct = OSPI_PCT[fm.key.slice(5, 7)] ?? DEFAULT_OSPI_PCT
    let rev: number
    let exp: number
    if (fm.fiscalIndex <= activeFiscalIdx) {
      rev = Math.round(monthlyRevRate)
      exp = Math.round(monthlyExpRate)
    } else {
      rev = Math.round(monthlyRevRate)
      exp = Math.round(monthlyExpRate)
    }
    const beginCash = runningCash
    const endCash = beginCash + rev - exp
    cfRows.push([
      styledCell(fm.label),
      pctCell(ospiPct),
      currencyCell(beginCash),
      currencyCell(rev),
      currencyCell(exp),
      currencyCell(endCash),
    ])
    runningCash = endCash
  }

  const wsCF = XLSX.utils.aoa_to_sheet(cfRows)
  wsCF['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsCF, 'Cash Flow')

  // ── Tab 6: FPF Scorecard ───────────────────────────────────────────────────

  const scorecard = buildFpfScorecard(profile, financialData)
  const fpfRows: unknown[][] = []
  addSheetHeader(fpfRows, schoolName, `FPF Scorecard — Stage ${scorecard.stage}`, reportDate, 4)

  fpfRows.push([headerCell('Metric'), headerCell('Current Value'), headerCell('Threshold'), headerCell('Status')])
  for (const m of scorecard.metrics) {
    const statusLabel = m.status === 'meets' ? 'Meets'
      : m.status === 'does-not-meet' ? 'Does Not Meet'
      : m.status === 'not-evaluated' ? 'Not Evaluated'
      : 'Insufficient Data'
    fpfRows.push([styledCell(m.name), styledCell(m.formatted), styledCell(m.threshold), styledCell(statusLabel)])
  }
  fpfRows.push([])
  fpfRows.push([styledCell(`Summary: ${scorecard.met} of ${scorecard.applicable} applicable metrics met`, { font: { bold: true } })])

  const wsFPF = XLSX.utils.aoa_to_sheet(fpfRows)
  wsFPF['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 20 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsFPF, 'FPF Scorecard')

  // ── Write ──────────────────────────────────────────────────────────────────

  const fileName = `${schoolName.replace(/\s+/g, '_')}_Financial_Report_${activeMonth}.xlsx`
  XLSX.writeFile(wb, fileName)
}
