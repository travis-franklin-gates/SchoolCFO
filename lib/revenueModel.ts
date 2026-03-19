// V8 Commission-aligned revenue model.
// 12 discrete revenue lines grouped by source.
// State lines use AAFTE (headcount × aafte_pct). Federal and categorical use headcount directly.

import type { FinancialAssumptions } from './financialAssumptions'
import type { SchoolProfile, BudgetCategory } from './store'

export type RevenueSource = 'state' | 'federal' | 'categorical' | 'other'

export interface RevenueLineResult {
  key: string
  label: string
  source: RevenueSource
  formula: string           // human-readable formula
  expected: number          // calculated expected annual revenue
  actual: number            // from CSV upload (matched by name)
  delta: number             // actual - expected
  deltaPct: number          // (delta / expected) × 100, or 0 if expected is 0
}

/** All 12 revenue line definitions. */
const REVENUE_LINES: {
  key: string
  label: string
  source: RevenueSource
  calc: (profile: SchoolProfile, a: FinancialAssumptions) => { expected: number; formula: string }
}[] = [
  // ── State & Local ──
  {
    key: 'regular_ed',
    label: 'Regular Ed Per-Pupil',
    source: 'state',
    calc: (p, a) => {
      const aafte = Math.round(p.headcount * a.aafte_pct / 100)
      return {
        expected: Math.round(aafte * a.regular_ed_per_pupil),
        formula: `${p.headcount} headcount × ${a.aafte_pct}% AAFTE × $${a.regular_ed_per_pupil.toLocaleString()}`,
      }
    },
  },
  {
    key: 'sped',
    label: 'SPED Per-Pupil',
    source: 'state',
    calc: (p, a) => {
      const aafte = Math.round(p.headcount * a.aafte_pct / 100)
      const spedStudents = Math.round(aafte * p.spedPct / 100)
      return {
        expected: Math.round(spedStudents * a.sped_per_pupil),
        formula: `${aafte} AAFTE × ${p.spedPct}% SPED × $${a.sped_per_pupil.toLocaleString()}`,
      }
    },
  },
  {
    key: 'facilities',
    label: 'Facilities Per-Pupil',
    source: 'state',
    calc: (p, a) => {
      const aafte = Math.round(p.headcount * a.aafte_pct / 100)
      return {
        expected: Math.round(aafte * a.facilities_per_pupil),
        formula: `${aafte} AAFTE × $${a.facilities_per_pupil.toLocaleString()}`,
      }
    },
  },
  {
    key: 'levy_equity',
    label: 'Levy Equity',
    source: 'state',
    calc: (p, a) => {
      const aafte = Math.round(p.headcount * a.aafte_pct / 100)
      return {
        expected: Math.round(aafte * a.levy_equity_per_pupil),
        formula: a.levy_equity_per_pupil === 0
          ? 'Currently $0 — legislature has not reinstated'
          : `${aafte} AAFTE × $${a.levy_equity_per_pupil.toLocaleString()}`,
      }
    },
  },
  // ── Federal ──
  {
    key: 'title_i',
    label: 'Title I Part A',
    source: 'federal',
    calc: (p, a) => {
      const eligible = p.frlPct >= 40
      const students = eligible ? Math.round(p.headcount * p.frlPct / 100) : 0
      return {
        expected: Math.round(students * a.title_i_per_pupil),
        formula: eligible
          ? `${p.headcount} × ${p.frlPct}% FRL × $${a.title_i_per_pupil.toLocaleString()}`
          : `FRL ${p.frlPct}% — below 40% threshold`,
      }
    },
  },
  {
    key: 'idea',
    label: 'IDEA (Special Ed)',
    source: 'federal',
    calc: (p, a) => {
      const students = Math.round(p.headcount * p.iepPct / 100)
      return {
        expected: Math.round(students * a.idea_per_pupil),
        formula: `${p.headcount} × ${p.iepPct}% IEP × $${a.idea_per_pupil.toLocaleString()}`,
      }
    },
  },
  // ── State Categorical ──
  {
    key: 'lap',
    label: 'LAP (Learning Assistance)',
    source: 'categorical',
    calc: (p, a) => {
      const students = Math.round(p.headcount * p.frlPct / 100)
      return {
        expected: Math.round(students * a.lap_per_pupil),
        formula: `${p.headcount} × ${p.frlPct}% FRL × $${a.lap_per_pupil.toLocaleString()}`,
      }
    },
  },
  {
    key: 'tbip',
    label: 'TBIP (Bilingual)',
    source: 'categorical',
    calc: (p, a) => {
      const students = Math.round(p.headcount * p.ellPct / 100)
      return {
        expected: Math.round(students * a.tbip_per_pupil),
        formula: `${p.headcount} × ${p.ellPct}% ELL × $${a.tbip_per_pupil.toLocaleString()}`,
      }
    },
  },
  {
    key: 'hicap',
    label: 'HiCap (Highly Capable)',
    source: 'categorical',
    calc: (p, a) => {
      const students = Math.round(p.headcount * p.hicapPct / 100)
      return {
        expected: Math.round(students * a.hicap_per_pupil),
        formula: `${p.headcount} × ${p.hicapPct}% HiCap × $${a.hicap_per_pupil.toLocaleString()}`,
      }
    },
  },
  // ── Other ──
  {
    key: 'food_service',
    label: 'Food Service Revenue',
    source: 'other',
    calc: () => ({ expected: 0, formula: 'From CSV upload actuals' }),
  },
  {
    key: 'interest_income',
    label: 'Interest Income',
    source: 'other',
    calc: () => ({ expected: 0, formula: 'From CSV upload actuals' }),
  },
  {
    key: 'other_revenue',
    label: 'Other Revenue',
    source: 'other',
    calc: () => ({ expected: 0, formula: 'From CSV upload actuals' }),
  },
]

/**
 * Match a revenue BudgetCategory to a revenue model line key.
 * Uses prefix matching against the category name (case-insensitive).
 */
const LINE_MATCH_PATTERNS: Record<string, RegExp[]> = {
  regular_ed:    [/regular\s*ed/i, /per[- ]?pupil\s*(alloc|rev)/i, /basic\s*ed/i, /prototypical/i, /state\s*apportionment/i, /general\s*apportionment/i],
  sped:          [/sped/i, /special\s*ed/i],
  facilities:    [/facilit/i, /building/i, /capital/i],
  levy_equity:   [/levy\s*equity/i],
  title_i:       [/title\s*i\b/i, /title\s*1\b/i, /title\s*i\s*part\s*a/i],
  idea:          [/\bidea\b/i, /special\s*ed.*federal/i, /federal\s*idea/i],
  lap:           [/\blap\b/i, /learning\s*assist/i],
  tbip:          [/\btbip\b/i, /bilingual/i, /transitional\s*bilingual/i],
  hicap:         [/\bhicap\b/i, /highly\s*capable/i, /gifted/i],
  food_service:  [/food\s*serv/i, /lunch/i, /nutrition/i, /nslp/i],
  interest_income: [/interest\s*(income|earn|rev)/i],
  other_revenue: [], // catch-all for unmatched revenue categories
}

function matchCategoryToLine(categoryName: string): string {
  const name = categoryName.trim()
  for (const [lineKey, patterns] of Object.entries(LINE_MATCH_PATTERNS)) {
    if (lineKey === 'other_revenue') continue // skip catch-all
    if (patterns.some((p) => p.test(name))) return lineKey
  }
  return 'other_revenue'
}

/**
 * Build the full 12-line revenue model.
 * `revenueCategories` are the revenue-type BudgetCategories from the active snapshot (CSV actuals).
 */
export function buildRevenueModel(
  profile: SchoolProfile,
  assumptions: FinancialAssumptions,
  revenueCategories: BudgetCategory[],
): RevenueLineResult[] {
  // Sum actuals by matched line key
  const actualsByLine: Record<string, number> = {}
  for (const cat of revenueCategories) {
    const lineKey = matchCategoryToLine(cat.name)
    actualsByLine[lineKey] = (actualsByLine[lineKey] ?? 0) + cat.ytdActuals
  }

  return REVENUE_LINES.map((line) => {
    const { expected, formula } = line.calc(profile, assumptions)
    const actual = actualsByLine[line.key] ?? 0
    const delta = actual - expected
    const deltaPct = expected > 0 ? Math.round((delta / expected) * 1000) / 10 : 0
    return {
      key: line.key,
      label: line.label,
      source: line.source,
      formula,
      expected,
      actual,
      delta,
      deltaPct,
    }
  })
}

/**
 * Format a revenue model as text for AI system prompt injection.
 */
export function formatRevenueModelForPrompt(lines: RevenueLineResult[]): string {
  const sourceLabels: Record<RevenueSource, string> = {
    state: 'STATE & LOCAL',
    federal: 'FEDERAL',
    categorical: 'STATE CATEGORICAL',
    other: 'OTHER',
  }
  const groups: Record<RevenueSource, RevenueLineResult[]> = { state: [], federal: [], categorical: [], other: [] }
  for (const line of lines) {
    groups[line.source].push(line)
  }

  const sections: string[] = []
  for (const source of ['state', 'federal', 'categorical', 'other'] as RevenueSource[]) {
    const group = groups[source]
    if (group.length === 0) continue
    const header = sourceLabels[source]
    const rows = group.map((l) => {
      const expStr = l.expected > 0 ? `$${l.expected.toLocaleString()}` : '$0'
      const actStr = l.actual > 0 ? `$${l.actual.toLocaleString()}` : '$0'
      const deltaStr = l.delta !== 0
        ? `${l.delta > 0 ? '+' : ''}$${l.delta.toLocaleString()} (${l.deltaPct > 0 ? '+' : ''}${l.deltaPct}%)`
        : 'on track'
      return `  - ${l.label}: expected ${expStr}, actual ${actStr}, delta ${deltaStr} — ${l.formula}`
    }).join('\n')
    sections.push(`${header}:\n${rows}`)
  }

  const totalExpected = lines.reduce((s, l) => s + l.expected, 0)
  const totalActual = lines.reduce((s, l) => s + l.actual, 0)
  const totalDelta = totalActual - totalExpected

  return `REVENUE MODEL (V8 Commission-aligned, 12 lines):
${sections.join('\n')}
TOTAL: expected $${totalExpected.toLocaleString()}, actual $${totalActual.toLocaleString()}, delta ${totalDelta > 0 ? '+' : ''}$${totalDelta.toLocaleString()}`
}
