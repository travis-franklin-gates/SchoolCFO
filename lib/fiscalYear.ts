// WA school fiscal year: July 1 – June 30.
// All helpers are pure functions with no store dependency.

export interface FiscalMonth {
  key: string       // "2026-02"
  label: string     // "February 2026"
  shortLabel: string // "Feb"
  fiscalIndex: number // 1 = July … 12 = June
}

function fiscalYearBounds(date: Date = new Date()): { startYear: number; endYear: number } {
  const m = date.getMonth() + 1 // 1-indexed
  const y = date.getFullYear()
  return m >= 7 ? { startYear: y, endYear: y + 1 } : { startYear: y - 1, endYear: y }
}

/** All 12 months of the fiscal year that contains `date` (defaults to today). */
export function getFiscalMonths(date: Date = new Date()): FiscalMonth[] {
  const { startYear, endYear } = fiscalYearBounds(date)
  return Array.from({ length: 12 }, (_, i) => {
    const calMonth = ((6 + i) % 12) + 1 // 7, 8, …, 12, 1, 2, …, 6
    const year = calMonth >= 7 ? startYear : endYear
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

/** "February 2026" from "2026-02" */
export function labelFromKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 15).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** "Feb" from "2026-02" */
export function shortLabelFromKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 15).toLocaleDateString('en-US', { month: 'short' })
}

/**
 * 1-based position in the fiscal year.
 * July = 1, August = 2, …, December = 6, January = 7, …, June = 12
 */
export function fiscalIndexFromKey(key: string): number {
  const m = parseInt(key.split('-')[1], 10)
  return m >= 7 ? m - 6 : m + 6
}

/** Fraction of the fiscal year elapsed at the end of `key`'s month. */
export function paceFromKey(key: string): number {
  return fiscalIndexFromKey(key) / 12
}
