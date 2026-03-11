/**
 * Programmatic Board Packet PDF generator using jsPDF directly.
 * Produces professional, page-aware output with proper typography,
 * tables, and section dividers — no html2canvas.
 */

import type { BudgetCategory, Grant, BoardPacketContent } from './store'

// ── Types ────────────────────────────────────────────────────────────────────

interface CashFlowRow {
  label: string
  ospiPct: number
  revenue: number
  expenses: number
  net: number
  balance: number | null
  days: number | null
  isLow: boolean
  hasSnap: boolean
  isCurrent: boolean
}

interface WarrantRow {
  range: string
  description: string
  amount: number
}

export interface BoardPacketPdfData {
  schoolName: string
  monthLabel: string
  activeMonth: string
  nextBoardMeeting: string | null
  generatedDate: string
  totalBudget: number
  revenueBudget: number
  ytdSpending: number
  ytdRevenue: number
  cashOnHand: number
  daysOfReserves: number
  variancePercent: number
  expectedPct: number
  pace: number
  categories: BudgetCategory[]
  grants: Grant[]
  cashFlowRows: CashFlowRow[]
  content: BoardPacketContent
  flaggedCategories: BudgetCategory[]
  apWarrants: WarrantRow[]
  payrollWarrants: WarrantRow[]
  hasRealWarrants: boolean
}

// ── Constants ────────────────────────────────────────────────────────────────

const BRAND = { r: 30, g: 58, b: 95 }        // #1e3a5f
const BRAND_LIGHT = { r: 240, g: 244, b: 248 } // #f0f4f8
const WHITE = { r: 255, g: 255, b: 255 }
const GRAY_50 = { r: 243, g: 244, b: 246 }    // #f3f4f6
const RED = { r: 220, g: 38, b: 38 }
const GREEN = { r: 22, g: 163, b: 74 }
const AMBER = { r: 180, g: 83, b: 9 }
const TEXT_DARK = { r: 31, g: 41, b: 55 }
const TEXT_MED = { r: 107, g: 114, b: 128 }

const PAGE_W = 612   // Letter width in points
const PAGE_H = 792   // Letter height in points
const MARGIN = 72    // 1 inch
const CONTENT_W = PAGE_W - 2 * MARGIN
const HDR_H = 30
const FTR_H = 24
const TOP_Y = MARGIN + HDR_H + 8
const BOTTOM_Y = PAGE_H - MARGIN - FTR_H - 8

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDollar(n: number): string {
  return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString()
}

function fmtPct(n: number, decimals = 1): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ── Main Export ──────────────────────────────────────────────────────────────

export async function generateBoardPacketPdf(data: BoardPacketPdfData): Promise<void> {
  const { jsPDF } = await import('jspdf')

  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' })
  let page = 1
  let curY = TOP_Y

  // ── Page management ──────────────────────────────────────────────────────

  const addHeaderFooter = (pageNum: number) => {
    // Header line
    pdf.setDrawColor(BRAND.r, BRAND.g, BRAND.b)
    pdf.setLineWidth(1)
    pdf.line(MARGIN, MARGIN + HDR_H, PAGE_W - MARGIN, MARGIN + HDR_H)

    // Logo text left
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    pdf.text('SchoolCFO', MARGIN, MARGIN + HDR_H - 8)

    // School name center
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b)
    pdf.text(data.schoolName, PAGE_W / 2, MARGIN + HDR_H - 8, { align: 'center' })

    // Page number right
    pdf.text(`Page ${pageNum}`, PAGE_W - MARGIN, MARGIN + HDR_H - 8, { align: 'right' })

    // Footer line
    pdf.setDrawColor(200, 200, 200)
    pdf.setLineWidth(0.5)
    const footerLineY = PAGE_H - MARGIN - FTR_H
    pdf.line(MARGIN, footerLineY, PAGE_W - MARGIN, footerLineY)

    // Footer text
    pdf.setFontSize(7)
    pdf.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b)
    pdf.text(
      `Confidential \u2014 ${data.schoolName} Board Packet \u2014 ${data.monthLabel}`,
      PAGE_W / 2,
      footerLineY + 14,
      { align: 'center' }
    )
  }

  const newPage = () => {
    pdf.addPage()
    page++
    curY = TOP_Y
    addHeaderFooter(page)
  }

  const ensureSpace = (needed: number) => {
    if (curY + needed > BOTTOM_Y) {
      newPage()
    }
  }

  // ── Text helpers ─────────────────────────────────────────────────────────

  const writeWrapped = (
    text: string,
    x: number,
    maxWidth: number,
    fontSize: number,
    style: 'normal' | 'bold' | 'italic' = 'normal',
    color: { r: number; g: number; b: number } = TEXT_DARK
  ): number => {
    pdf.setFontSize(fontSize)
    pdf.setFont('helvetica', style)
    pdf.setTextColor(color.r, color.g, color.b)
    const lines = pdf.splitTextToSize(text, maxWidth) as string[]
    const lineHeight = fontSize * 1.4
    for (const line of lines) {
      ensureSpace(lineHeight)
      pdf.text(line, x, curY)
      curY += lineHeight
    }
    return lines.length * lineHeight
  }

  // ── Table helpers ────────────────────────────────────────────────────────

  interface ColDef {
    label: string
    width: number
    align: 'left' | 'right' | 'center'
  }

  interface CellData {
    text: string
    color?: { r: number; g: number; b: number }
    bold?: boolean
  }

  const drawTableRow = (
    cols: ColDef[],
    cells: CellData[],
    rowY: number,
    rowH: number,
    bgColor: { r: number; g: number; b: number } | null,
    fontSize: number = 9
  ) => {
    // Background
    if (bgColor) {
      pdf.setFillColor(bgColor.r, bgColor.g, bgColor.b)
      pdf.rect(MARGIN, rowY, CONTENT_W, rowH, 'F')
    }

    let x = MARGIN
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i]
      const cell = cells[i] || { text: '' }
      pdf.setFontSize(fontSize)
      pdf.setFont('helvetica', cell.bold ? 'bold' : 'normal')
      const c = cell.color || TEXT_DARK
      pdf.setTextColor(c.r, c.g, c.b)

      const textY = rowY + rowH / 2 + fontSize / 3
      const pad = 4
      if (col.align === 'right') {
        pdf.text(cell.text, x + col.width - pad, textY, { align: 'right' })
      } else if (col.align === 'center') {
        pdf.text(cell.text, x + col.width / 2, textY, { align: 'center' })
      } else {
        pdf.text(cell.text, x + pad, textY)
      }
      x += col.width
    }
  }

  const drawTable = (
    cols: ColDef[],
    headerCells: CellData[],
    rows: CellData[][],
    footerCells?: CellData[]
  ) => {
    const rowH = 18
    const headerH = 20

    // Header
    ensureSpace(headerH + rowH) // at least header + 1 row
    drawTableRow(cols, headerCells, curY, headerH, BRAND, 8)
    curY += headerH

    // Body
    for (let i = 0; i < rows.length; i++) {
      ensureSpace(rowH)
      const bg = i % 2 === 0 ? null : GRAY_50
      drawTableRow(cols, rows[i], curY, rowH, bg)
      curY += rowH
    }

    // Footer
    if (footerCells) {
      ensureSpace(rowH + 2)
      // Top border for footer
      pdf.setDrawColor(BRAND.r, BRAND.g, BRAND.b)
      pdf.setLineWidth(1.5)
      pdf.line(MARGIN, curY, MARGIN + CONTENT_W, curY)
      curY += 1
      drawTableRow(cols, footerCells, curY, rowH, BRAND_LIGHT)
      curY += rowH
    }
  }

  // ── Section divider ──────────────────────────────────────────────────────

  const startSection = (number: number, title: string) => {
    newPage()
    // Section number badge
    pdf.setFillColor(BRAND.r, BRAND.g, BRAND.b)
    pdf.roundedRect(MARGIN, curY - 2, 22, 18, 3, 3, 'F')
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b)
    pdf.text(String(number), MARGIN + 11, curY + 11, { align: 'center' })

    // Section title
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    pdf.text(title, MARGIN + 28, curY + 11)

    // Underline
    curY += 22
    pdf.setDrawColor(BRAND.r, BRAND.g, BRAND.b)
    pdf.setLineWidth(1.5)
    pdf.line(MARGIN, curY, MARGIN + CONTENT_W, curY)
    curY += 16
  }

  // ════════════════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ════════════════════════════════════════════════════════════════════════════

  addHeaderFooter(page)

  // Centered cover content
  const coverStartY = PAGE_H * 0.28

  // Brand bar
  pdf.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  pdf.rect(MARGIN, coverStartY - 40, CONTENT_W, 4, 'F')

  // "Board Financial Packet"
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b)
  pdf.text('Board Financial Packet', PAGE_W / 2, coverStartY, { align: 'center' })

  // School name
  pdf.setFontSize(28)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b)
  pdf.text(data.schoolName, PAGE_W / 2, coverStartY + 40, { align: 'center' })

  // Month
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b)
  pdf.text(data.monthLabel, PAGE_W / 2, coverStartY + 70, { align: 'center' })

  // Separator
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.5)
  pdf.line(PAGE_W / 2 - 60, coverStartY + 90, PAGE_W / 2 + 60, coverStartY + 90)

  // Meeting / generated dates
  let coverInfoY = coverStartY + 115
  pdf.setFontSize(10)
  pdf.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b)

  if (data.nextBoardMeeting) {
    const meetingStr = fmtDate(data.nextBoardMeeting)
    if (meetingStr) {
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Next Board Meeting: ${meetingStr}`, PAGE_W / 2, coverInfoY, { align: 'center' })
      coverInfoY += 18
    }
  }

  pdf.text(`Generated: ${data.generatedDate}`, PAGE_W / 2, coverInfoY, { align: 'center' })
  coverInfoY += 36

  // Summary metrics box
  const boxW = 360
  const boxH = 70
  const boxX = (PAGE_W - boxW) / 2
  pdf.setFillColor(BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b)
  pdf.roundedRect(boxX, coverInfoY, boxW, boxH, 4, 4, 'F')
  pdf.setDrawColor(BRAND.r, BRAND.g, BRAND.b)
  pdf.setLineWidth(0.5)
  pdf.roundedRect(boxX, coverInfoY, boxW, boxH, 4, 4, 'S')

  const metricsY = coverInfoY + 18
  const colW = boxW / 4
  const metrics = [
    { label: 'Expense Budget', value: fmtDollar(data.totalBudget) },
    { label: 'YTD Actuals', value: fmtDollar(data.ytdSpending) },
    { label: 'Cash on Hand', value: fmtDollar(data.cashOnHand) },
    { label: 'Days Reserve', value: String(data.daysOfReserves) },
  ]
  metrics.forEach((m, i) => {
    const cx = boxX + colW * i + colW / 2
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b)
    pdf.text(m.label, cx, metricsY, { align: 'center' })
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    pdf.text(m.value, cx, metricsY + 20, { align: 'center' })
  })

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 1: Budget vs. Actuals Summary
  // ════════════════════════════════════════════════════════════════════════════

  startSection(1, 'Budget vs. Actuals Summary')

  const deriveAlertStatus = (burnRate: number): string => {
    const overPace = burnRate / 100 - data.pace
    if (overPace > 0.20) return 'action'
    if (overPace > 0.10) return 'concern'
    if (overPace > 0.05) return 'watch'
    return 'ok'
  }

  const statusLabel = (s: string) =>
    s === 'action' ? 'Action Required' : s === 'concern' ? 'Concern' : s === 'watch' ? 'Watch' : 'On Track'

  const budgetCols: ColDef[] = [
    { label: 'Category', width: CONTENT_W * 0.22, align: 'left' },
    { label: 'Annual Budget', width: CONTENT_W * 0.14, align: 'right' },
    { label: 'YTD Actual', width: CONTENT_W * 0.14, align: 'right' },
    { label: 'YTD Budget', width: CONTENT_W * 0.14, align: 'right' },
    { label: 'Variance $', width: CONTENT_W * 0.13, align: 'right' },
    { label: 'Variance %', width: CONTENT_W * 0.11, align: 'right' },
    { label: 'Status', width: CONTENT_W * 0.12, align: 'center' },
  ]

  const budgetHeaderCells: CellData[] = budgetCols.map((c) => ({
    text: c.label,
    color: WHITE,
    bold: true,
  }))

  const makeBudgetRow = (cat: BudgetCategory): CellData[] => {
    const ytdBudget = Math.round(cat.budget * data.pace)
    const varDollar = cat.ytdActuals - ytdBudget
    const varPct = ytdBudget > 0 ? ((cat.ytdActuals - ytdBudget) / ytdBudget) * 100 : 0
    const status = deriveAlertStatus(cat.burnRate)
    const varColor = varDollar > 0 ? RED : varDollar < 0 ? GREEN : TEXT_DARK
    const varPctColor = varPct > 5 ? RED : varPct < -20 ? AMBER : TEXT_DARK
    return [
      { text: cat.name, bold: true },
      { text: fmtDollar(cat.budget), color: TEXT_MED },
      { text: fmtDollar(cat.ytdActuals), bold: true },
      { text: fmtDollar(ytdBudget), color: TEXT_MED },
      { text: (varDollar >= 0 ? '+' : '') + fmtDollar(varDollar), color: varColor, bold: true },
      { text: fmtPct(varPct), color: varPctColor, bold: true },
      { text: statusLabel(status), color: status === 'action' ? RED : status === 'concern' ? AMBER : status === 'watch' ? AMBER : GREEN },
    ]
  }

  // ── Expenses table ──
  const expenseCats = data.categories.filter((c) => c.accountType === 'expense')

  writeWrapped('Expenses', MARGIN, CONTENT_W, 11, 'bold', BRAND)
  curY += 4

  const expenseRows: CellData[][] = expenseCats.map(makeBudgetRow)

  const expTotalYtdBudget = Math.round(data.totalBudget * data.pace)
  const expTotalVar = data.ytdSpending - expTotalYtdBudget
  const expTotalVarColor = expTotalVar > 0 ? RED : GREEN
  const expTotalVarPct = expTotalYtdBudget > 0 ? ((data.ytdSpending - expTotalYtdBudget) / expTotalYtdBudget) * 100 : 0

  const expenseFooter: CellData[] = [
    { text: 'Total Expenses', bold: true },
    { text: fmtDollar(data.totalBudget), bold: true },
    { text: fmtDollar(data.ytdSpending), bold: true },
    { text: fmtDollar(expTotalYtdBudget), color: TEXT_MED },
    { text: (expTotalVar >= 0 ? '+' : '') + fmtDollar(expTotalVar), color: expTotalVarColor, bold: true },
    { text: fmtPct(expTotalVarPct), color: TEXT_MED },
    { text: '' },
  ]

  drawTable(budgetCols, budgetHeaderCells, expenseRows, expenseFooter)

  // ── Revenue table ──
  const revenueCats = data.categories.filter((c) => c.accountType === 'revenue')

  if (revenueCats.length > 0) {
    curY += 14

    writeWrapped('Revenue', MARGIN, CONTENT_W, 11, 'bold', BRAND)
    curY += 4

    const revenueRows: CellData[][] = revenueCats.map(makeBudgetRow)

    const revTotalYtdBudget = Math.round(data.revenueBudget * data.pace)
    const revTotalVar = data.ytdRevenue - revTotalYtdBudget
    const revTotalVarColor = revTotalVar > 0 ? GREEN : revTotalVar < 0 ? RED : TEXT_DARK
    const revTotalVarPct = revTotalYtdBudget > 0 ? ((data.ytdRevenue - revTotalYtdBudget) / revTotalYtdBudget) * 100 : 0

    const revenueFooter: CellData[] = [
      { text: 'Total Revenue', bold: true },
      { text: fmtDollar(data.revenueBudget), bold: true },
      { text: fmtDollar(data.ytdRevenue), bold: true },
      { text: fmtDollar(revTotalYtdBudget), color: TEXT_MED },
      { text: (revTotalVar >= 0 ? '+' : '') + fmtDollar(revTotalVar), color: revTotalVarColor, bold: true },
      { text: fmtPct(revTotalVarPct), color: TEXT_MED },
      { text: '' },
    ]

    drawTable(budgetCols, budgetHeaderCells, revenueRows, revenueFooter)

    // ── Net summary ──
    curY += 10
    ensureSpace(24)
    const netAmount = data.ytdRevenue - data.ytdSpending
    const netColor = netAmount >= 0 ? GREEN : RED
    const netLabel = netAmount >= 0 ? 'Net Surplus' : 'Net Deficit'
    writeWrapped(
      `${netLabel}: ${fmtDollar(netAmount)}  (YTD Revenue ${fmtDollar(data.ytdRevenue)} \u2013 YTD Expenses ${fmtDollar(data.ytdSpending)})`,
      MARGIN, CONTENT_W, 10, 'bold', netColor
    )
  }

  curY += 8
  writeWrapped(
    `YTD Budget reflects expected pace at ${data.expectedPct}% through the fiscal year (${data.monthLabel}).`,
    MARGIN, CONTENT_W, 8, 'italic', TEXT_MED
  )

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 2: Financial Narrative
  // ════════════════════════════════════════════════════════════════════════════

  startSection(2, 'Financial Narrative')

  // Render narrative as formatted paragraphs
  const narrativeParagraphs = data.content.financialNarrative.split(/\n\n+/)
  for (const para of narrativeParagraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue
    writeWrapped(trimmed, MARGIN, CONTENT_W, 10, 'normal', TEXT_DARK)
    curY += 6
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 3: Cash Flow Report
  // ════════════════════════════════════════════════════════════════════════════

  startSection(3, 'Cash Flow Report')

  const cashCols: ColDef[] = [
    { label: 'Month', width: CONTENT_W * 0.22, align: 'left' },
    { label: 'OSPI %', width: CONTENT_W * 0.10, align: 'right' },
    { label: 'Est. Revenue', width: CONTENT_W * 0.15, align: 'right' },
    { label: 'Est. Expenses', width: CONTENT_W * 0.15, align: 'right' },
    { label: 'Net', width: CONTENT_W * 0.13, align: 'right' },
    { label: 'Proj. Balance', width: CONTENT_W * 0.15, align: 'right' },
    { label: 'Days', width: CONTENT_W * 0.10, align: 'right' },
  ]

  const cashHeaderCells: CellData[] = cashCols.map((c) => ({
    text: c.label,
    color: WHITE,
    bold: true,
  }))

  const cashRows: CellData[][] = data.cashFlowRows.map((row) => {
    const netColor = row.net < 0 ? RED : GREEN
    const daysColor = row.days != null && row.days < 30 ? RED : TEXT_DARK
    const labelSuffix = row.isLow ? ' (LOW)' : row.hasSnap ? ' (Actual)' : ''
    return [
      { text: row.label + labelSuffix, bold: row.isCurrent, color: row.isLow ? AMBER : TEXT_DARK },
      { text: row.ospiPct.toFixed(2) + '%', color: TEXT_MED },
      { text: fmtDollar(row.revenue), color: TEXT_MED },
      { text: fmtDollar(row.expenses), color: TEXT_MED },
      { text: (row.net >= 0 ? '+' : '') + fmtDollar(row.net), color: netColor, bold: true },
      { text: row.balance != null ? fmtDollar(row.balance) : '\u2014', bold: true },
      { text: row.days != null ? String(row.days) : '\u2014', color: daysColor },
    ]
  })

  drawTable(cashCols, cashHeaderCells, cashRows)

  // OSPI note
  curY += 8
  ensureSpace(40)
  pdf.setFillColor(255, 251, 235) // amber-50
  pdf.roundedRect(MARGIN, curY, CONTENT_W, 32, 3, 3, 'F')
  pdf.setDrawColor(217, 169, 58)
  pdf.setLineWidth(0.5)
  pdf.roundedRect(MARGIN, curY, CONTENT_W, 32, 3, 3, 'S')
  curY += 12
  writeWrapped(
    'Note: November and May receive reduced OSPI apportionment payments. Schools must maintain adequate reserves to cover these periods.',
    MARGIN + 8, CONTENT_W - 16, 8, 'normal', AMBER
  )
  curY += 8

  // Cash flow AI notes
  if (data.content.cashFlowNotes) {
    curY += 8
    const cashNoteParagraphs = data.content.cashFlowNotes.split(/\n\n+/)
    for (const para of cashNoteParagraphs) {
      const trimmed = para.trim()
      if (!trimmed) continue
      writeWrapped(trimmed, MARGIN, CONTENT_W, 10, 'normal', TEXT_DARK)
      curY += 4
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 4: Grant Snapshot
  // ════════════════════════════════════════════════════════════════════════════

  startSection(4, 'Grant / Categorical Spend Snapshot')

  if (data.grants.length === 0) {
    writeWrapped('No categorical grants configured. Add grants in Settings.', MARGIN, CONTENT_W, 10, 'italic', TEXT_MED)
  } else {
    const grantCols: ColDef[] = [
      { label: 'Grant', width: CONTENT_W * 0.22, align: 'left' },
      { label: 'Award', width: CONTENT_W * 0.14, align: 'right' },
      { label: 'Spent', width: CONTENT_W * 0.14, align: 'right' },
      { label: 'Remaining', width: CONTENT_W * 0.14, align: 'right' },
      { label: 'Spend Rate', width: CONTENT_W * 0.12, align: 'right' },
      { label: 'Proj. Year-End', width: CONTENT_W * 0.14, align: 'right' },
      { label: 'Status', width: CONTENT_W * 0.10, align: 'center' },
    ]

    const grantHeaderCells: CellData[] = grantCols.map((c) => ({
      text: c.label,
      color: WHITE,
      bold: true,
    }))

    const grantRows: CellData[][] = data.grants.map((grant) => {
      const spendPct = grant.awardAmount > 0 ? (grant.spent / grant.awardAmount) * 100 : 0
      const projYE = data.pace > 0 ? Math.round(grant.spent / data.pace) : grant.spent
      const statusTxt = grant.status === 'on-pace' ? 'On Pace' : grant.status === 'underspend-risk' ? 'Underspend' : 'Watch'
      const statusColor = grant.status === 'on-pace' ? GREEN : AMBER
      return [
        { text: grant.name, bold: true },
        { text: fmtDollar(grant.awardAmount), color: TEXT_MED },
        { text: fmtDollar(grant.spent), bold: true },
        { text: fmtDollar(grant.awardAmount - grant.spent), color: TEXT_MED },
        { text: spendPct.toFixed(0) + '%' },
        { text: fmtDollar(projYE), color: TEXT_MED },
        { text: statusTxt, color: statusColor },
      ]
    })

    drawTable(grantCols, grantHeaderCells, grantRows)

    // Flag warnings for off-pace grants
    const offPace = data.grants.filter((g) => g.status !== 'on-pace')
    if (offPace.length > 0) {
      curY += 8
      for (const g of offPace) {
        ensureSpace(28)
        const msg = g.status === 'underspend-risk'
          ? `${g.name}: Spending pace is below expected. Review to confirm all planned activities are on track.`
          : `${g.name}: Spending is ahead of pace. Review to confirm award amount is sufficient.`
        writeWrapped(msg, MARGIN, CONTENT_W, 8, 'italic', AMBER)
        curY += 4
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 5: Variance Explanations
  // ════════════════════════════════════════════════════════════════════════════

  startSection(5, 'Variance Explanations')

  if (data.flaggedCategories.length === 0) {
    writeWrapped(
      'All budget categories are on track. No variances requiring board explanation.',
      MARGIN, CONTENT_W, 10, 'normal', GREEN
    )
  } else {
    for (const ve of data.content.varianceExplanations) {
      const cat = data.categories.find((c) => c.name === ve.category)
      const status = cat ? deriveAlertStatus(cat.burnRate) : 'watch'
      const statusColor = status === 'action' ? RED : status === 'concern' ? AMBER : AMBER

      ensureSpace(60)

      // Category header with status
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b)
      pdf.text(ve.category, MARGIN, curY)

      // Status badge
      const badgeText = statusLabel(status)
      const badgeX = MARGIN + pdf.getTextWidth(ve.category) + 10
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'bold')
      const badgeW = pdf.getTextWidth(badgeText) + 10
      pdf.setFillColor(statusColor.r, statusColor.g, statusColor.b)
      pdf.roundedRect(badgeX, curY - 9, badgeW, 12, 2, 2, 'F')
      pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b)
      pdf.text(badgeText, badgeX + badgeW / 2, curY - 1, { align: 'center' })

      // Burn rate info
      if (cat) {
        const infoX = badgeX + badgeW + 10
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b)
        pdf.text(`${cat.burnRate.toFixed(0)}% spent (expected ${data.expectedPct}%)`, infoX, curY)
      }

      curY += 14

      // Explanation text
      const explParagraphs = ve.explanation.split(/\n\n+/)
      for (const para of explParagraphs) {
        const trimmed = para.trim()
        if (!trimmed) continue
        writeWrapped(trimmed, MARGIN, CONTENT_W, 10, 'normal', TEXT_DARK)
        curY += 4
      }
      curY += 10
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 6: Warrant Approval
  // ════════════════════════════════════════════════════════════════════════════

  startSection(6, `Warrant Approval \u2014 ${data.monthLabel}`)

  if (!data.hasRealWarrants) {
    // Prominent warning notice
    ensureSpace(40)
    pdf.setFillColor(255, 243, 205) // yellow-100
    pdf.roundedRect(MARGIN, curY, CONTENT_W, 36, 3, 3, 'F')
    pdf.setDrawColor(217, 119, 6)
    pdf.setLineWidth(1)
    pdf.roundedRect(MARGIN, curY, CONTENT_W, 36, 3, 3, 'S')
    curY += 14
    writeWrapped(
      'Warrant data not yet entered \u2014 add via Settings before presenting to board.',
      MARGIN + 8, CONTENT_W - 16, 10, 'bold', AMBER
    )
    curY += 12
  }

  // Legal note
  writeWrapped(
    'Board approval required per RCW 42.24.080. The following warrants are presented for board ratification.',
    MARGIN, CONTENT_W, 8, 'italic', TEXT_MED
  )
  curY += 8

  // AP Warrants table
  writeWrapped('Accounts Payable Warrants', MARGIN, CONTENT_W, 10, 'bold', TEXT_DARK)
  curY += 4

  const warrantCols: ColDef[] = [
    { label: 'Warrant Number Range', width: CONTENT_W * 0.30, align: 'left' },
    { label: 'Payee / Description', width: CONTENT_W * 0.45, align: 'left' },
    { label: 'Amount', width: CONTENT_W * 0.25, align: 'right' },
  ]

  const warrantHeaders: CellData[] = warrantCols.map((c) => ({
    text: c.label,
    color: WHITE,
    bold: true,
  }))

  const apRows: CellData[][] = data.apWarrants.map((w) => [
    { text: w.range, color: TEXT_MED },
    { text: w.description },
    { text: fmtDollar(w.amount), bold: true },
  ])

  const apTotal = data.apWarrants.reduce((s, w) => s + w.amount, 0)
  const apFooter: CellData[] = [
    { text: 'AP Total', bold: true },
    { text: '' },
    { text: fmtDollar(apTotal), bold: true },
  ]

  drawTable(warrantCols, warrantHeaders, apRows, apFooter)
  curY += 12

  // Payroll Warrants table
  writeWrapped('Payroll Warrants', MARGIN, CONTENT_W, 10, 'bold', TEXT_DARK)
  curY += 4

  const prRows: CellData[][] = data.payrollWarrants.map((w) => [
    { text: w.range, color: TEXT_MED },
    { text: w.description },
    { text: fmtDollar(w.amount), bold: true },
  ])

  const prTotal = data.payrollWarrants.reduce((s, w) => s + w.amount, 0)
  const prFooter: CellData[] = [
    { text: 'Payroll Total', bold: true },
    { text: '' },
    { text: fmtDollar(prTotal), bold: true },
  ]

  drawTable(warrantCols, warrantHeaders, prRows, prFooter)

  // Signature lines
  curY += 24
  ensureSpace(60)

  const sigY = curY
  const sigColW = CONTENT_W / 2 - 20

  // Board Chair
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b)
  pdf.text('Board Chair Signature', MARGIN, sigY)
  pdf.setDrawColor(150, 150, 150)
  pdf.setLineWidth(0.5)
  pdf.line(MARGIN, sigY + 30, MARGIN + sigColW, sigY + 30)
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b)
  pdf.text('Signature & Date', MARGIN, sigY + 40)

  // Clerk
  const sig2X = MARGIN + sigColW + 40
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b)
  pdf.text('Clerk of the Board', sig2X, sigY)
  pdf.line(sig2X, sigY + 30, sig2X + sigColW, sigY + 30)
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b)
  pdf.text('Signature & Date', sig2X, sigY + 40)

  // ── Save ───────────────────────────────────────────────────────────────────

  const fileName = `${data.schoolName.replace(/\s+/g, '-')}-Board-Packet-${data.activeMonth}.pdf`
  pdf.save(fileName)
}
