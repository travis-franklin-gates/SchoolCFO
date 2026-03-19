// SchoolLaunch → SchoolCFO import pipeline.
// Parses a SchoolLaunch profile JSON and budget CSV into SchoolCFO data structures.

import type { FinancialAssumptions } from './financialAssumptions'
import { DEFAULT_FINANCIAL_ASSUMPTIONS } from './financialAssumptions'

// ── SchoolLaunch JSON shape ──────────────────────────────────────────────────

export interface SchoolLaunchProfile {
  school_name?: string
  region?: string
  grade_config?: string
  founding_grades?: string[]
  buildout_grades?: string[]
  opening_year?: number
  enrollment?: Record<string, number>   // { year_1: 200, year_2: 250, ... }
  demographics?: {
    frl_pct?: number
    iep_pct?: number
    ell_pct?: number
    hicap_pct?: number
    sped_pct?: number
  }
  financial_assumptions?: Partial<FinancialAssumptions>
  revenue_rates?: {
    regular_ed_per_pupil?: number
    sped_per_pupil?: number
    facilities_per_pupil?: number
    levy_equity_per_pupil?: number
    title_i_per_pupil?: number
    idea_per_pupil?: number
    lap_per_pupil?: number
    tbip_per_pupil?: number
    hicap_per_pupil?: number
  }
  staffing_plan?: Array<{
    position_type: string
    fte: number
    salary: number
  }>
}

// ── Parsed result for SchoolCFO ──────────────────────────────────────────────

export interface ImportedSchoolProfile {
  name: string
  authorizer: string
  gradesCurrentFirst: string
  gradesCurrentLast: string
  gradesBuildoutFirst: string
  gradesBuildoutLast: string
  currentFTES: number
  priorYearFTES: number
  headcount: number
  operatingYear: number
  openingCashBalance: number
  frlPct: number
  iepPct: number
  ellPct: number
  hicapPct: number
  spedPct: number
}

export interface ImportedBudgetLine {
  category: string
  budget: number
  ytdActuals: number
  accountType: 'revenue' | 'expense'
}

export interface ImportResult {
  profile: ImportedSchoolProfile
  assumptions: Partial<FinancialAssumptions>
  budgetLines: ImportedBudgetLine[]
  staffingPlan: Array<{ positionType: string; fte: number; salary: number }>
  warnings: string[]
}

// ── Grade parsing helpers ────────────────────────────────────────────────────

function parseGradeConfig(config: string): { first: string; last: string } {
  if (!config) return { first: 'K', last: '5' }
  const parts = config.split('-').map((s) => s.trim())
  if (parts.length === 2) return { first: parts[0], last: parts[1] }
  return { first: parts[0], last: parts[0] }
}

function gradeFromArray(arr: string[] | undefined, pos: 'first' | 'last'): string {
  if (!arr || arr.length === 0) return ''
  return pos === 'first' ? arr[0] : arr[arr.length - 1]
}

// ── Revenue line mapping ─────────────────────────────────────────────────────

const REVENUE_LINE_MAP: Record<string, string> = {
  regular_ed_per_pupil: 'Regular Ed Per-Pupil Revenue',
  sped_per_pupil: 'SPED Per-Pupil Revenue',
  facilities_per_pupil: 'Facilities Per-Pupil Revenue',
  levy_equity_per_pupil: 'Levy Equity Revenue',
  title_i_per_pupil: 'Title I Part A Revenue',
  idea_per_pupil: 'IDEA Special Education Revenue',
  lap_per_pupil: 'LAP Revenue',
  tbip_per_pupil: 'TBIP Revenue',
  hicap_per_pupil: 'HiCap Revenue',
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseSchoolLaunchProfile(json: SchoolLaunchProfile): ImportResult {
  const warnings: string[] = []

  // Profile
  const name = json.school_name?.trim() || ''
  if (!name) warnings.push('School name is missing — you can enter it manually.')

  const gradeConfig = parseGradeConfig(json.grade_config || '')
  const foundingFirst = gradeFromArray(json.founding_grades, 'first')
  const foundingLast = gradeFromArray(json.founding_grades, 'last')
  const buildoutFirst = gradeFromArray(json.buildout_grades, 'first')
  const buildoutLast = gradeFromArray(json.buildout_grades, 'last')

  // Enrollment — use year_1 as current
  const enrollment = json.enrollment || {}
  const year1Enrollment = enrollment.year_1 || enrollment['year_1'] || 0
  if (!year1Enrollment) warnings.push('Year 1 enrollment not found — defaulting to 0.')

  // Demographics
  const demo = json.demographics || {}

  // Financial assumptions — merge with defaults
  const rawAssumptions = json.financial_assumptions || {}
  const mergedAssumptions: Partial<FinancialAssumptions> = { ...rawAssumptions }

  // Revenue rates
  if (json.revenue_rates) {
    for (const [key, val] of Object.entries(json.revenue_rates)) {
      if (val != null && key in DEFAULT_FINANCIAL_ASSUMPTIONS) {
        (mergedAssumptions as Record<string, number>)[key] = val
      }
    }
  }

  const profile: ImportedSchoolProfile = {
    name,
    authorizer: 'Washington State Charter School Commission',
    gradesCurrentFirst: foundingFirst || gradeConfig.first,
    gradesCurrentLast: foundingLast || gradeConfig.last,
    gradesBuildoutFirst: buildoutFirst || gradeConfig.first,
    gradesBuildoutLast: buildoutLast || gradeConfig.last,
    currentFTES: year1Enrollment,
    priorYearFTES: 0,
    headcount: year1Enrollment,
    operatingYear: 1,
    openingCashBalance: 0,
    frlPct: demo.frl_pct || 0,
    iepPct: demo.iep_pct || demo.sped_pct || 0,
    ellPct: demo.ell_pct || 0,
    hicapPct: demo.hicap_pct || 0,
    spedPct: demo.sped_pct || demo.iep_pct || 0,
  }

  // Build revenue budget lines from per-pupil rates
  const budgetLines: ImportedBudgetLine[] = []
  const headcount = year1Enrollment
  const aaftePct = (mergedAssumptions.aafte_pct || DEFAULT_FINANCIAL_ASSUMPTIONS.aafte_pct) / 100
  const aafte = Math.round(headcount * aaftePct)

  if (json.revenue_rates) {
    const rates = json.revenue_rates
    const rateEntries: [string, number, boolean][] = [
      ['regular_ed_per_pupil', rates.regular_ed_per_pupil || 0, true],
      ['sped_per_pupil', Math.round((rates.sped_per_pupil || 0) * (demo.sped_pct || 0) / 100), true],
      ['facilities_per_pupil', rates.facilities_per_pupil || 0, true],
      ['levy_equity_per_pupil', rates.levy_equity_per_pupil || 0, true],
      ['title_i_per_pupil', (demo.frl_pct || 0) >= 40 ? Math.round((rates.title_i_per_pupil || 0) * (demo.frl_pct || 0) / 100) : 0, false],
      ['idea_per_pupil', Math.round((rates.idea_per_pupil || 0) * (demo.iep_pct || 0) / 100), false],
      ['lap_per_pupil', Math.round((rates.lap_per_pupil || 0) * (demo.frl_pct || 0) / 100), false],
      ['tbip_per_pupil', Math.round((rates.tbip_per_pupil || 0) * (demo.ell_pct || 0) / 100), false],
      ['hicap_per_pupil', Math.round((rates.hicap_per_pupil || 0) * (demo.hicap_pct || 0) / 100), false],
    ]
    for (const [key, perPupilAmount, usesAafte] of rateEntries) {
      const base = usesAafte ? aafte : headcount
      const budget = Math.round(base * perPupilAmount)
      if (budget > 0) {
        budgetLines.push({
          category: REVENUE_LINE_MAP[key] || key,
          budget,
          ytdActuals: 0,
          accountType: 'revenue',
        })
      }
    }
  }

  // Staffing plan
  const staffingPlan = (json.staffing_plan || []).map((p) => ({
    positionType: p.position_type || 'Unknown',
    fte: p.fte || 0,
    salary: p.salary || 0,
  }))

  // Build expense lines from staffing plan
  if (staffingPlan.length > 0) {
    const benefitsRate = (mergedAssumptions.benefits_load_pct || DEFAULT_FINANCIAL_ASSUMPTIONS.benefits_load_pct) / 100
    const ficaRate = (mergedAssumptions.fica_rate_pct || DEFAULT_FINANCIAL_ASSUMPTIONS.fica_rate_pct) / 100

    // Group by category
    const salaryTotal = staffingPlan.reduce((s, p) => s + (p.fte * p.salary), 0)
    const benefitsTotal = Math.round(salaryTotal * benefitsRate)
    const ficaTotal = Math.round(salaryTotal * ficaRate)

    budgetLines.push({ category: 'Personnel - Salaries', budget: Math.round(salaryTotal), ytdActuals: 0, accountType: 'expense' })
    budgetLines.push({ category: 'Personnel - Benefits (SEBB)', budget: benefitsTotal, ytdActuals: 0, accountType: 'expense' })
    budgetLines.push({ category: 'Personnel - Employer FICA', budget: ficaTotal, ytdActuals: 0, accountType: 'expense' })
  }

  return { profile, assumptions: mergedAssumptions, budgetLines, staffingPlan, warnings }
}

// ── Budget CSV parser ────────────────────────────────────────────────────────

export function parseBudgetCSV(csvText: string): { lines: ImportedBudgetLine[]; warnings: string[] } {
  const warnings: string[] = []
  const lines: ImportedBudgetLine[] = []

  const rows = csvText.split('\n').map((r) => r.split(',').map((c) => c.trim().replace(/^"|"$/g, '')))
  if (rows.length < 2) {
    warnings.push('Budget CSV has fewer than 2 rows.')
    return { lines, warnings }
  }

  const header = rows[0].map((h) => h.toLowerCase())
  const catIdx = header.findIndex((h) => /category|line|item|description/i.test(h))
  const budgetIdx = header.findIndex((h) => /budget|amount|projected|planned/i.test(h))
  const typeIdx = header.findIndex((h) => /type|account.?type|rev.*exp/i.test(h))

  if (catIdx < 0 || budgetIdx < 0) {
    warnings.push('Budget CSV must have "Category" and "Budget" columns.')
    return { lines, warnings }
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row[catIdx]) continue
    const category = row[catIdx]
    const budget = parseFloat(row[budgetIdx]?.replace(/[$,]/g, '')) || 0
    const typeRaw = typeIdx >= 0 ? row[typeIdx] : ''
    const accountType: 'revenue' | 'expense' = /revenue|income|receipt/i.test(typeRaw) ? 'revenue' : 'expense'
    lines.push({ category, budget, ytdActuals: 0, accountType })
  }

  return { lines, warnings }
}
