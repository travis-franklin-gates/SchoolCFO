// WA Charter School Commission Financial Performance Framework (FPF) Scorecard.
// Stage 1: Years 1-2 of operation. Stage 2: Year 3+.
// Populated from school's actual financial data.

import type { SchoolProfile, FinancialSnapshot } from './store'

export type FpfStage = 1 | 2
export type FpfStatus = 'meets' | 'does-not-meet' | 'not-evaluated' | 'insufficient-data'
export type FpfCategory = 'performance' | 'sustainability'

export interface FpfMetricResult {
  key: string
  name: string
  category: FpfCategory
  value: number | null         // null = insufficient data
  formatted: string            // human-readable value
  threshold: string            // threshold description for the applicable stage
  status: FpfStatus
}

export interface FpfScorecardResult {
  stage: FpfStage
  metrics: FpfMetricResult[]
  applicable: number           // how many metrics are evaluated at this stage
  met: number                  // how many met their threshold
  notMet: number
  insufficientData: number
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '' : ''}${(n * 100).toFixed(1)}%`
}

function fmtRatio(n: number): string {
  return n.toFixed(2)
}

function fmtDays(n: number): string {
  return `${Math.round(n)} days`
}

function fmtDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

/**
 * Build the FPF scorecard from the school's data.
 *
 * Required inputs:
 * - `profile`: school profile with operatingYear, headcount, currentFTES, priorYearFTES
 * - `financialData`: current snapshot
 * - `priorYearRevenue`: total revenue from the prior year (null if unavailable)
 * - `priorYearCash`: cash on hand at end of prior year (null if unavailable)
 *
 * Several metrics (debt ratios, DSCR) require data not yet tracked in SchoolCFO.
 * These return "Insufficient Data" rather than failing.
 */
export function buildFpfScorecard(
  profile: SchoolProfile,
  financialData: FinancialSnapshot,
  priorYearRevenue: number | null = null,
  priorYearCash: number | null = null,
): FpfScorecardResult {
  const stage: FpfStage = profile.operatingYear <= 2 ? 1 : 2
  const metrics: FpfMetricResult[] = []

  // ── Financial Performance ──

  // 1. Current Ratio = current assets / current liabilities
  if (profile.currentAssets > 0 && profile.currentLiabilities > 0) {
    const ratio = profile.currentAssets / profile.currentLiabilities
    const threshold = stage === 1 ? 1.0 : 1.1
    metrics.push({
      key: 'current_ratio',
      name: 'Current Ratio',
      category: 'performance',
      value: ratio,
      formatted: fmtRatio(ratio),
      threshold: stage === 1 ? '≥ 1.0' : '≥ 1.1',
      status: ratio >= threshold ? 'meets' : 'does-not-meet',
    })
  } else {
    metrics.push({
      key: 'current_ratio',
      name: 'Current Ratio',
      category: 'performance',
      value: null,
      formatted: 'Insufficient Data',
      threshold: stage === 1 ? '≥ 1.0' : '≥ 1.1',
      status: 'insufficient-data',
    })
  }

  // 2. Days Cash on Hand = unrestricted cash / (total expenses / 365)
  const totalExpenses = financialData.ytdExpenses
  const cashOnHand = financialData.cashOnHand
  const daysThreshold1 = 30
  const daysThreshold2 = 60
  if (totalExpenses > 0 && cashOnHand != null) {
    // Annualize expenses for the calculation
    const daysOfReserves = financialData.daysOfReserves
    const threshold = stage === 1 ? daysThreshold1 : daysThreshold2
    metrics.push({
      key: 'days_cash',
      name: 'Days Cash on Hand',
      category: 'performance',
      value: daysOfReserves,
      formatted: fmtDays(daysOfReserves),
      threshold: stage === 1 ? '≥ 30 days' : '≥ 60 days',
      status: daysOfReserves >= threshold ? 'meets' : 'does-not-meet',
    })
  } else {
    metrics.push({
      key: 'days_cash',
      name: 'Days Cash on Hand',
      category: 'performance',
      value: null,
      formatted: 'Insufficient Data',
      threshold: stage === 1 ? '≥ 30 days' : '≥ 60 days',
      status: 'insufficient-data',
    })
  }

  // 3. Enrollment Variance = (actual / projected) - 1
  const projectedEnrollment = profile.currentFTES // budgeted FTES is the projection
  const actualEnrollment = profile.headcount
  if (projectedEnrollment > 0 && actualEnrollment > 0) {
    const variance = (actualEnrollment / projectedEnrollment) - 1
    const threshold = stage === 1 ? -0.10 : -0.05
    metrics.push({
      key: 'enrollment_variance',
      name: 'Enrollment Variance',
      category: 'performance',
      value: variance,
      formatted: fmtPct(variance),
      threshold: stage === 1 ? '≥ -10%' : '≥ -5%',
      status: variance >= threshold ? 'meets' : 'does-not-meet',
    })
  } else {
    metrics.push({
      key: 'enrollment_variance',
      name: 'Enrollment Variance',
      category: 'performance',
      value: null,
      formatted: 'Insufficient Data',
      threshold: stage === 1 ? '≥ -10%' : '≥ -5%',
      status: 'insufficient-data',
    })
  }

  // ── Financial Sustainability ──

  // 4. Total Revenue Change YoY
  const currentRevenue = financialData.ytdRevenue
  if (stage === 1) {
    metrics.push({
      key: 'revenue_change_yoy',
      name: 'Total Revenue Change YoY',
      category: 'sustainability',
      value: null,
      formatted: '—',
      threshold: 'Not evaluated (Stage 1)',
      status: 'not-evaluated',
    })
  } else if (priorYearRevenue != null && priorYearRevenue > 0 && currentRevenue > 0) {
    const change = (currentRevenue - priorYearRevenue) / priorYearRevenue
    metrics.push({
      key: 'revenue_change_yoy',
      name: 'Total Revenue Change YoY',
      category: 'sustainability',
      value: change,
      formatted: fmtPct(change),
      threshold: '> 0%',
      status: change > 0 ? 'meets' : 'does-not-meet',
    })
  } else {
    metrics.push({
      key: 'revenue_change_yoy',
      name: 'Total Revenue Change YoY',
      category: 'sustainability',
      value: null,
      formatted: 'Insufficient Data',
      threshold: '> 0%',
      status: 'insufficient-data',
    })
  }

  // 5. Total Margin = net income / total revenue
  if (currentRevenue > 0) {
    const netIncome = currentRevenue - totalExpenses
    const margin = netIncome / currentRevenue
    const threshold = stage === 1 ? -0.05 : 0
    metrics.push({
      key: 'total_margin',
      name: 'Total Margin',
      category: 'sustainability',
      value: margin,
      formatted: fmtPct(margin),
      threshold: stage === 1 ? '≥ -5%' : '≥ 0%',
      status: margin >= threshold ? 'meets' : 'does-not-meet',
    })
  } else {
    metrics.push({
      key: 'total_margin',
      name: 'Total Margin',
      category: 'sustainability',
      value: null,
      formatted: 'Insufficient Data',
      threshold: stage === 1 ? '≥ -5%' : '≥ 0%',
      status: 'insufficient-data',
    })
  }

  // 6. Debt-to-Asset Ratio — requires balance sheet data
  if (stage === 1) {
    metrics.push({
      key: 'debt_to_asset',
      name: 'Debt-to-Asset Ratio',
      category: 'sustainability',
      value: null,
      formatted: '—',
      threshold: 'Not evaluated (Stage 1)',
      status: 'not-evaluated',
    })
  } else if (profile.totalAssets > 0 && profile.totalLiabilities >= 0) {
    const ratio = profile.totalLiabilities / profile.totalAssets
    metrics.push({
      key: 'debt_to_asset',
      name: 'Debt-to-Asset Ratio',
      category: 'sustainability',
      value: ratio,
      formatted: fmtRatio(ratio),
      threshold: '≤ 0.9',
      status: ratio <= 0.9 ? 'meets' : 'does-not-meet',
    })
  } else {
    metrics.push({
      key: 'debt_to_asset',
      name: 'Debt-to-Asset Ratio',
      category: 'sustainability',
      value: null,
      formatted: 'Insufficient Data',
      threshold: '≤ 0.9',
      status: 'insufficient-data',
    })
  }

  // 7. Cash Flow = change in cash from prior year
  if (stage === 1) {
    metrics.push({
      key: 'cash_flow',
      name: 'Cash Flow (YoY Change)',
      category: 'sustainability',
      value: null,
      formatted: '—',
      threshold: 'Not evaluated (Stage 1)',
      status: 'not-evaluated',
    })
  } else if (priorYearCash != null && cashOnHand != null) {
    const cashChange = cashOnHand - priorYearCash
    metrics.push({
      key: 'cash_flow',
      name: 'Cash Flow (YoY Change)',
      category: 'sustainability',
      value: cashChange,
      formatted: fmtDollars(cashChange),
      threshold: 'Positive',
      status: cashChange > 0 ? 'meets' : 'does-not-meet',
    })
  } else {
    metrics.push({
      key: 'cash_flow',
      name: 'Cash Flow (YoY Change)',
      category: 'sustainability',
      value: null,
      formatted: 'Insufficient Data',
      threshold: 'Positive',
      status: 'insufficient-data',
    })
  }

  // 8. Debt Service Coverage Ratio — requires depreciation and debt service data
  if (stage === 1) {
    metrics.push({
      key: 'dscr',
      name: 'Debt Service Coverage Ratio',
      category: 'sustainability',
      value: null,
      formatted: '—',
      threshold: 'Not evaluated (Stage 1)',
      status: 'not-evaluated',
    })
  } else if (profile.annualDebtService > 0) {
    const netIncome = financialData.ytdRevenue - financialData.ytdExpenses
    const numerator = netIncome + profile.annualDepreciation + profile.interestExpense
    const dscr = numerator / profile.annualDebtService
    metrics.push({
      key: 'dscr',
      name: 'Debt Service Coverage Ratio',
      category: 'sustainability',
      value: dscr,
      formatted: fmtRatio(dscr),
      threshold: '≥ 1.1',
      status: dscr >= 1.1 ? 'meets' : 'does-not-meet',
    })
  } else {
    metrics.push({
      key: 'dscr',
      name: 'Debt Service Coverage Ratio',
      category: 'sustainability',
      value: null,
      formatted: 'Insufficient Data',
      threshold: '≥ 1.1',
      status: 'insufficient-data',
    })
  }

  const applicable = metrics.filter((m) => m.status !== 'not-evaluated').length
  const met = metrics.filter((m) => m.status === 'meets').length
  const notMet = metrics.filter((m) => m.status === 'does-not-meet').length
  const insufficientData = metrics.filter((m) => m.status === 'insufficient-data').length

  return { stage, metrics, applicable, met, notMet, insufficientData }
}

/**
 * Format the FPF scorecard as text for AI system prompt injection.
 */
export function formatFpfForPrompt(scorecard: FpfScorecardResult): string {
  const lines = scorecard.metrics.map((m) => {
    const statusLabel = m.status === 'meets' ? 'MEETS'
      : m.status === 'does-not-meet' ? 'DOES NOT MEET'
      : m.status === 'not-evaluated' ? 'NOT EVALUATED'
      : 'INSUFFICIENT DATA'
    return `  - ${m.name}: ${m.formatted} (threshold: ${m.threshold}) [${statusLabel}]`
  })
  return `COMMISSION FPF SCORECARD (Stage ${scorecard.stage} — Year ${scorecard.stage === 1 ? '1-2' : '3+'}):
${lines.join('\n')}
Summary: ${scorecard.met} of ${scorecard.applicable} applicable metrics met`
}
