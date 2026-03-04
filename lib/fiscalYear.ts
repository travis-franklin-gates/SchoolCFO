// WA State fiscal year: September 1 – August 31.
// Update when adding multi-state support.
// All helpers are pure functions with no store dependency.

export interface FiscalMonth {
  key: string        // "2026-03"
  label: string      // "March 2026"
  shortLabel: string // "Mar"
  fiscalIndex: number // 1 = September … 12 = August
}

function fiscalYearBounds(date: Date = new Date()): { startYear: number; endYear: number } {
  const m = date.getMonth() + 1 // 1-indexed
  const y = date.getFullYear()
  // WA State fiscal year — September 1 is the start. Update when adding multi-state support.
  return m >= 9 ? { startYear: y, endYear: y + 1 } : { startYear: y - 1, endYear: y }
}

/** All 12 months of the fiscal year that contains `date` (defaults to today). */
export function getFiscalMonths(date: Date = new Date()): FiscalMonth[] {
  const { startYear, endYear } = fiscalYearBounds(date)
  return Array.from({ length: 12 }, (_, i) => {
    // WA State fiscal year — September 1 is the start. Update when adding multi-state support.
    const calMonth = ((8 + i) % 12) + 1 // 9, 10, 11, 12, 1, 2, …, 8
    const year = calMonth >= 9 ? startYear : endYear
    const key = `${year}-${String(calMonth).padStart(2, '0')}`
    const d = new Date(year, calMonth - 1, 15)
    return {
      key,
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      shortLabel: d.toLocaleDateString('en-US', { month: 'short' }),
      fiscalIndex: i + 1,
    }
  })
}

/** "YYYY-MM" key for the current calendar month. */
export function currentMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** "March 2026" from "2026-03" */
export function labelFromKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 15).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** "Mar" from "2026-03" */
export function shortLabelFromKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 15).toLocaleDateString('en-US', { month: 'short' })
}

/**
 * 1-based position in the fiscal year.
 * WA State: September = 1, October = 2, …, December = 4,
 *           January = 5, …, August = 12
 * Update when adding multi-state support.
 */
export function fiscalIndexFromKey(key: string): number {
  const m = parseInt(key.split('-')[1], 10)
  return m >= 9 ? m - 8 : m + 4
}

/** Fraction of the fiscal year elapsed at the end of `key`'s month. */
export function paceFromKey(key: string): number {
  return fiscalIndexFromKey(key) / 12
}

/**
 * WA OSPI monthly apportionment as % of annual state aid, keyed by zero-padded
 * calendar month ("09"–"08"). All 12 months are covered.
 * Update when adding multi-state support.
 */
export const OSPI_PCT: Record<string, number> = {
  '09': 9.0, '10': 8.0, '11': 5.0, '12': 9.0,
  '01': 8.5, '02': 9.0, '03': 9.0, '04': 9.0,
  '05': 5.0, '06': 6.0, '07': 12.5, '08': 10.0,
}

/** Safety fallback for months not in OSPI_PCT (should never be reached). */
export const DEFAULT_OSPI_PCT = 8.33
