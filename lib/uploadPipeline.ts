// Pure column-mapping and data-transformation logic — no store dependencies.

export type SchoolCFOField =
  | 'category'
  | 'budget'
  | 'ytdActuals'
  | 'fund'
  | 'accountType'
  | 'grantName'
  | 'grantAmount'
  | 'grantSpent'
  | 'ignore'

export interface ColumnMappingResult {
  sourceColumn: string
  columnIndex: number
  mappedField: SchoolCFOField
  confident: boolean
  sampleValues: string[]
}

export interface MappedCategory {
  category: string
  budget: number
  ytdActuals: number
  fund?: string
}

export interface MappedGrant {
  name: string
  awardAmount: number
  spent: number
}

// Each SchoolCFO field's accepted column-name patterns (case-insensitive).
const FIELD_PATTERNS: Record<Exclude<SchoolCFOField, 'ignore'>, RegExp[]> = {
  category: [
    /^categor(y|ies)$/i,
    /^account(s| name| description| desc)?$/i,
    /^(dept|department)$/i,
    /^description$/i,
    /^line item$/i,
    /^object( code)?$/i,
  ],
  budget: [
    /^budget(ed)?$/i,
    /^annual budget$/i,
    /^(approved|adopted|original|total) budget$/i,
    /^budget amount$/i,
    /^appropriation$/i,
    /^planned( amount)?$/i,
  ],
  ytdActuals: [
    /^actuals?$/i,
    /^ytd actuals?$/i,
    /^(year[- ]to[- ]date|ytd)$/i,
    /^spent to date$/i,
    /^(total )?expend(ed|itures?)$/i,
    /^expenses?$/i,
    /^spent$/i,
  ],
  fund: [
    /^fund( code)?$/i,
    /^program( code)?$/i,
    /^grant$/i,
    /^funding source$/i,
  ],
  accountType: [
    /^account ?type$/i,
    /^acct ?type$/i,
    /^type$/i,
    /^line ?type$/i,
  ],
  grantName: [
    /^grant name$/i,
    /^grant title$/i,
  ],
  grantAmount: [
    /^award( amount)?$/i,
    /^grant award( amount)?$/i,
  ],
  grantSpent: [
    /^grant spent( to date)?$/i,
    /^grant (amount )?spent$/i,
  ],
}

/**
 * Attempt to auto-map each header to a SchoolCFO field using pattern matching.
 * `confident: true` means we found a definitive match; `false` means ambiguous.
 *
 * Note: strips a leading BOM character (\uFEFF) from the first header, which some
 * spreadsheet apps prepend when saving UTF-8 CSVs and which breaks regex matching.
 */
export function autoMapColumns(
  headers: string[],
  dataRows: string[][]
): ColumnMappingResult[] {
  return headers.map((header, colIndex) => {
    // Strip BOM from first header and any surrounding whitespace from all headers.
    const h = header.replace(/^\uFEFF/, '').trim()
    let mappedField: SchoolCFOField = 'ignore'
    let confident = false

    for (const [field, patterns] of Object.entries(FIELD_PATTERNS) as [
      Exclude<SchoolCFOField, 'ignore'>,
      RegExp[],
    ][]) {
      if (patterns.some((p) => p.test(h))) {
        mappedField = field
        confident = true
        break
      }
    }

    const sampleValues = dataRows
      .slice(0, 4)
      .map((row) => String(row[colIndex] ?? '').trim())
      .filter(Boolean)

    return { sourceColumn: header, columnIndex: colIndex, mappedField, confident, sampleValues }
  })
}

/**
 * Returns true if all three required budget fields (category, budget, ytdActuals)
 * have a confident mapping — meaning we can skip the manual-mapping step.
 * Grant columns are optional and do not affect this check.
 */
export function isFullyMapped(mappings: ColumnMappingResult[]): boolean {
  const required: SchoolCFOField[] = ['category', 'budget', 'ytdActuals']
  return required.every((field) =>
    mappings.some((m) => m.mappedField === field && m.confident)
  )
}

// Patterns that identify a row as a cash balance entry (not a budget category).
const CASH_BALANCE_ACCOUNT_TYPE = /^cash ?balance$/i
const CASH_BALANCE_CATEGORY = /^(prior ?year ?)?cash ?(reserves?|balance|on ?hand|position|carry ?forward)/i

function isCashBalanceRow(
  row: string[],
  catCol: number,
  accountTypeCol: number,
): boolean {
  // Check Account Type column first (most explicit signal)
  if (accountTypeCol >= 0) {
    const acctType = String(row[accountTypeCol] ?? '').trim()
    if (CASH_BALANCE_ACCOUNT_TYPE.test(acctType)) return true
  }
  // Fall back to category name pattern matching
  if (catCol >= 0) {
    const category = String(row[catCol] ?? '').trim()
    if (CASH_BALANCE_CATEGORY.test(category)) return true
  }
  return false
}

function parseNumber(value: string | number | undefined): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value
  const cleaned = String(value ?? '')
    .replace(/[$,\s]/g, '')
    .trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

/**
 * Apply a finalized column mapping to all data rows, aggregate duplicate
 * category names, and return one MappedCategory per unique category.
 */
export function applyMappings(
  mappings: ColumnMappingResult[],
  dataRows: string[][]
): MappedCategory[] {
  const getCol = (field: SchoolCFOField) =>
    mappings.find((m) => m.mappedField === field)?.columnIndex ?? -1

  const catCol = getCol('category')
  const budgetCol = getCol('budget')
  const ytdCol = getCol('ytdActuals')
  const fundCol = getCol('fund')
  const accountTypeCol = getCol('accountType')

  const grouped = new Map<
    string,
    { budget: number; ytdActuals: number; fund?: string }
  >()

  for (const row of dataRows) {
    const category = String(row[catCol] ?? '').trim()
    if (!category) continue

    // Skip cash balance rows — they're extracted separately via extractCashBalance()
    if (isCashBalanceRow(row, catCol, accountTypeCol)) continue

    const budget = parseNumber(row[budgetCol])
    const ytdActuals = parseNumber(row[ytdCol])
    if (budget === 0 && ytdActuals === 0) continue

    const fund =
      fundCol >= 0 ? String(row[fundCol] ?? '').trim() || undefined : undefined

    if (grouped.has(category)) {
      const existing = grouped.get(category)!
      existing.budget += budget
      existing.ytdActuals += ytdActuals
    } else {
      grouped.set(category, { budget, ytdActuals, fund })
    }
  }

  return Array.from(grouped.entries()).map(([category, data]) => ({
    category,
    ...data,
  }))
}

/**
 * Second pass: extract grant rows from data using grantName/grantAmount/grantSpent columns.
 * Fully independent of applyMappings — both functions receive the same dataRows and iterate
 * them separately. A row can contribute to budget data, grant data, both, or neither.
 */
export function extractGrants(
  mappings: ColumnMappingResult[],
  dataRows: string[][]
): MappedGrant[] {
  const nameCol = mappings.find((m) => m.mappedField === 'grantName')?.columnIndex ?? -1
  const amountCol = mappings.find((m) => m.mappedField === 'grantAmount')?.columnIndex ?? -1
  const spentCol = mappings.find((m) => m.mappedField === 'grantSpent')?.columnIndex ?? -1

  // If no Grant Name column was detected, return early — there is nothing to extract.
  if (nameCol === -1) return []

  const grants: MappedGrant[] = []

  // Explicit index loop through every row. No break. No early return.
  // Rows with an empty Grant Name cell are skipped with continue — the loop keeps going.
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rawName = row[nameCol]
    const name = rawName != null ? String(rawName).trim() : ''

    if (name === '') {
      continue // empty grant name — skip this row, do NOT stop
    }

    const awardAmount = amountCol >= 0 ? parseNumber(row[amountCol]) : 0
    const spent = spentCol >= 0 ? parseNumber(row[spentCol]) : 0

    grants.push({ name, awardAmount, spent })
  }

  return grants
}

/**
 * Extract cash balance from rows identified as cash position entries.
 * Returns the total cash amount found, or null if no cash balance rows detected.
 * Looks at YTD Actuals first (the actual cash amount), falls back to Budget column.
 */
export function extractCashBalance(
  mappings: ColumnMappingResult[],
  dataRows: string[][]
): number | null {
  const getCol = (field: SchoolCFOField) =>
    mappings.find((m) => m.mappedField === field)?.columnIndex ?? -1

  const catCol = getCol('category')
  const budgetCol = getCol('budget')
  const ytdCol = getCol('ytdActuals')
  const accountTypeCol = getCol('accountType')

  let total = 0
  let found = false

  for (const row of dataRows) {
    if (!isCashBalanceRow(row, catCol, accountTypeCol)) continue

    // Prefer YTD Actuals (the actual cash on hand), fall back to budget column
    const ytdVal = ytdCol >= 0 ? parseNumber(row[ytdCol]) : 0
    const budgetVal = budgetCol >= 0 ? parseNumber(row[budgetCol]) : 0
    const amount = ytdVal > 0 ? ytdVal : budgetVal

    if (amount > 0) {
      total += amount
      found = true
    }
  }

  return found ? total : null
}
