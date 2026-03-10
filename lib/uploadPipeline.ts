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
  confidenceScore: number // 0–100
  sampleValues: string[]
}

export interface ParseWarning {
  row: number // 1-based data row index
  column: string
  originalValue: string
}

export type AccountType = 'revenue' | 'expense'

export interface MappedCategory {
  category: string
  budget: number
  ytdActuals: number
  fund?: string
  accountType: AccountType
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
    let confidenceScore = 0

    for (const [field, patterns] of Object.entries(FIELD_PATTERNS) as [
      Exclude<SchoolCFOField, 'ignore'>,
      RegExp[],
    ][]) {
      if (patterns.some((p) => p.test(h))) {
        mappedField = field
        confident = true
        confidenceScore = 100
        break
      }
    }

    const sampleValues = dataRows
      .slice(0, 4)
      .map((row) => String(row[colIndex] ?? '').trim())
      .filter(Boolean)

    return { sourceColumn: header, columnIndex: colIndex, mappedField, confident, confidenceScore, sampleValues }
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

// ── Ignored account types ──────────────────────────────────────────────────────
// Rows with these account types are completely stripped during processing.
// Opening cash balance is managed exclusively via the school profile field.
const IGNORED_ACCOUNT_TYPES = [
  /^cash ?balance$/i,
]

// Category-name patterns that also identify cash balance entries.
const CASH_BALANCE_CATEGORY = /^(prior ?year ?)?cash ?(reserves?|balance|on ?hand|position|carry ?forward)/i

function isCashBalanceRow(
  row: string[],
  catCol: number,
  accountTypeCol: number,
): boolean {
  // Check Account Type column against ignored list (most explicit signal)
  if (accountTypeCol >= 0) {
    const acctType = String(row[accountTypeCol] ?? '').trim()
    if (IGNORED_ACCOUNT_TYPES.some((p) => p.test(acctType))) return true
  }
  // Fall back to category name pattern matching
  if (catCol >= 0) {
    const category = String(row[catCol] ?? '').trim()
    if (CASH_BALANCE_CATEGORY.test(category)) return true
  }
  return false
}

/** Classify a raw account type string as revenue or expense. Defaults to expense. */
const REVENUE_PATTERNS = [/^revenue$/i, /^income$/i, /^receipts?$/i, /^inflow$/i]

function classifyAccountType(raw: string): AccountType {
  const trimmed = raw.trim()
  if (REVENUE_PATTERNS.some((p) => p.test(trimmed))) return 'revenue'
  return 'expense'
}

/** Convert "hello world" → "Hello World" for category normalization. */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-/])\S/g, (ch) => ch.toUpperCase())
}

// Values treated as intentionally blank (not real numbers).
const UNPARSEABLE = /^(n\/?a|tbd|#n\/?a|#ref!|#value!|--?|\.{2,})$/i

function parseNumber(
  value: string | number | undefined,
  warnings?: ParseWarning[],
  row?: number,
  column?: string,
): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value
  const raw = String(value ?? '').trim()
  const cleaned = raw.replace(/[$,\s]/g, '')

  // Collect warning for known-unparseable placeholders (non-empty, non-zero)
  if (raw !== '' && UNPARSEABLE.test(cleaned)) {
    if (warnings && row !== undefined && column) {
      warnings.push({ row, column, originalValue: raw })
    }
    return 0
  }

  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

export interface ApplyMappingsResult {
  categories: MappedCategory[]
  /** Number of rows skipped because they were cash balance entries. */
  cashBalanceRowsSkipped: number
}

/**
 * Apply a finalized column mapping to all data rows, aggregate duplicate
 * category names, and return one MappedCategory per unique category.
 *
 * Cash balance rows (Account Type = "Cash Balance" or matching category name
 * patterns) are silently stripped — opening cash balance is managed exclusively
 * via the school profile field, never from uploaded data.
 */
export function applyMappings(
  mappings: ColumnMappingResult[],
  dataRows: string[][],
  warnings?: ParseWarning[],
): ApplyMappingsResult {
  const getCol = (field: SchoolCFOField) =>
    mappings.find((m) => m.mappedField === field)?.columnIndex ?? -1

  const catCol = getCol('category')
  const budgetCol = getCol('budget')
  const ytdCol = getCol('ytdActuals')
  const fundCol = getCol('fund')
  const accountTypeCol = getCol('accountType')

  const budgetHeader = budgetCol >= 0 ? (mappings.find(m => m.columnIndex === budgetCol)?.sourceColumn ?? 'Budget') : 'Budget'
  const ytdHeader = ytdCol >= 0 ? (mappings.find(m => m.columnIndex === ytdCol)?.sourceColumn ?? 'YTD Actuals') : 'YTD Actuals'

  const grouped = new Map<
    string,
    { budget: number; ytdActuals: number; fund?: string; accountType: AccountType }
  >()

  let cashBalanceRowsSkipped = 0

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rawCategory = String(row[catCol] ?? '').trim()
    if (!rawCategory) continue

    // Skip cash balance rows — opening cash is from school profile only
    if (isCashBalanceRow(row, catCol, accountTypeCol)) {
      cashBalanceRowsSkipped++
      continue
    }

    const budget = parseNumber(row[budgetCol], warnings, i + 1, budgetHeader)
    const ytdActuals = parseNumber(row[ytdCol], warnings, i + 1, ytdHeader)
    if (budget === 0 && ytdActuals === 0) continue

    // Normalize category to title case so "personnel" / "PERSONNEL" / "Personnel" aggregate together
    const category = toTitleCase(rawCategory)

    const fund =
      fundCol >= 0 ? String(row[fundCol] ?? '').trim() || undefined : undefined

    // Classify as revenue or expense from the Account Type column (defaults to expense)
    const acctTypeRaw = accountTypeCol >= 0 ? String(row[accountTypeCol] ?? '').trim() : ''
    const accountType = classifyAccountType(acctTypeRaw)

    if (grouped.has(category)) {
      const existing = grouped.get(category)!
      existing.budget += budget
      existing.ytdActuals += ytdActuals
    } else {
      grouped.set(category, { budget, ytdActuals, fund, accountType })
    }
  }

  const categories = Array.from(grouped.entries()).map(([category, data]) => ({
    category,
    ...data,
  }))

  return { categories, cashBalanceRowsSkipped }
}

/**
 * Second pass: extract grant rows from data using grantName/grantAmount/grantSpent columns.
 * Fully independent of applyMappings — both functions receive the same dataRows and iterate
 * them separately. A row can contribute to budget data, grant data, both, or neither.
 */
export function extractGrants(
  mappings: ColumnMappingResult[],
  dataRows: string[][],
  warnings?: ParseWarning[],
): MappedGrant[] {
  const nameCol = mappings.find((m) => m.mappedField === 'grantName')?.columnIndex ?? -1
  const amountCol = mappings.find((m) => m.mappedField === 'grantAmount')?.columnIndex ?? -1
  const spentCol = mappings.find((m) => m.mappedField === 'grantSpent')?.columnIndex ?? -1

  // If no Grant Name column was detected, return early — there is nothing to extract.
  if (nameCol === -1) return []

  const amountHeader = amountCol >= 0 ? (mappings.find(m => m.columnIndex === amountCol)?.sourceColumn ?? 'Grant Award') : 'Grant Award'
  const spentHeader = spentCol >= 0 ? (mappings.find(m => m.columnIndex === spentCol)?.sourceColumn ?? 'Grant Spent') : 'Grant Spent'

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

    const awardAmount = amountCol >= 0 ? parseNumber(row[amountCol], warnings, i + 1, amountHeader) : 0
    const spent = spentCol >= 0 ? parseNumber(row[spentCol], warnings, i + 1, spentHeader) : 0

    grants.push({ name, awardAmount, spent })
  }

  return grants
}

