'use client'

import { useRef, useState, useEffect } from 'react'
import {
  FileText,
  Download,
  Clock,
  Loader2,
  CheckCircle,
  Pencil,
  X,
  Save,
  AlertTriangle,
  ChevronRight,
  FileBarChart,
  Bot,
} from 'lucide-react'
import { useStore, type PacketStatus, type BoardPacketContent } from '@/lib/store'
import { getFiscalMonths, fiscalIndexFromKey, paceFromKey, labelFromKey, OSPI_PCT, DEFAULT_OSPI_PCT } from '@/lib/fiscalYear'
import { generateBoardPacketPdf, type BoardPacketPdfData } from '@/lib/boardPacketPdf'

// ── Constants ─────────────────────────────────────────────────────────────────

const AP_WARRANTS = [
  { range: '2025-0847 – 2025-0921', description: 'Various Operational Vendors', amount: 42350 },
  { range: '2025-0922 – 2025-0971', description: 'Educational Materials & Supplies', amount: 14867 },
  { range: '2025-0972 – 2025-0985', description: 'Technology Services & Equipment', amount: 6125 },
]

const PAYROLL_WARRANTS = [
  { range: 'PR2025-0112', description: 'Regular Certificated & Classified Payroll', amount: 287400 },
  { range: 'PR2025-0113', description: 'Employee Benefits & Withholdings', amount: 67200 },
]

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  ok: { label: 'On Track', cls: 'bg-green-100 text-green-800' },
  watch: { label: 'Watch', cls: 'bg-yellow-100 text-yellow-800' },
  concern: { label: 'Concern', cls: 'bg-orange-100 text-orange-800' },
  action: { label: 'Action Required', cls: 'bg-red-100 text-red-800' },
}

const PACKET_STATUS_CFG: Record<PacketStatus, { label: string; cls: string }> = {
  'not-started': { label: 'Not Started', cls: 'bg-gray-100 text-gray-600' },
  draft: { label: 'Draft', cls: 'bg-yellow-100 text-yellow-800' },
  finalized: { label: 'Finalized', cls: 'bg-green-100 text-green-800' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function fmtFull(n: number) {
  return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString()
}

function fmtDate(s: string | undefined | null) {
  if (!s) return '—'
  const d = new Date(s + 'T12:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function fmtPct(n: number, decimals = 1) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-[#1e3a5f]">
        <span className="text-xs font-bold text-white bg-[#1e3a5f] px-2 py-0.5 rounded">
          {number}
        </span>
        <h2 className="text-base font-bold text-[#1e3a5f] uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function BoardPacketPage() {
  const {
    schoolProfile,
    financialData,
    grants,
    alerts,
    boardPackets,
    monthlySnapshots,
    activeMonth,
    saveBoardPacket,
    finalizeBoardPacket,
    updateBoardPacketContent,
    setActiveMonth,
    isLoaded,
    schoolContextEntries,
    agentFindings,
    schoolId,
  } = useStore()

  const printRef = useRef<HTMLDivElement>(null)
  const [genState, setGenState] = useState<'idle' | 'generating' | 'error'>('idle')
  const [genError, setGenError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [boardPrepRunning, setBoardPrepRunning] = useState(false)
  const boardPrepTriggered = useRef(false)

  // Editing state: 'narrative' | 'cashFlow' | `variance-${category}` | null
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editBuffer, setEditBuffer] = useState('')

  // Auto-trigger board-prep agent when meeting is within 10 days
  useEffect(() => {
    if (boardPrepTriggered.current) return
    if (!schoolId || !schoolProfile.nextBoardMeeting) return

    const meetingDate = new Date(schoolProfile.nextBoardMeeting + 'T12:00:00')
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const daysUntilMeeting = Math.round((meetingDate.getTime() - today.getTime()) / 86_400_000)

    if (daysUntilMeeting >= 0 && daysUntilMeeting <= 10) {
      boardPrepTriggered.current = true
      setBoardPrepRunning(true)
      fetch(`/api/agents/board-prep?schoolId=${schoolId}&nextBoardMeeting=${schoolProfile.nextBoardMeeting}&schoolName=${encodeURIComponent(schoolProfile.name)}`)
        .then(() => setBoardPrepRunning(false))
        .catch(() => setBoardPrepRunning(false))
    }
  }, [schoolId, schoolProfile.nextBoardMeeting, schoolProfile.name])

  if (!isLoaded && Object.keys(monthlySnapshots).length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-[3px] rounded-full animate-spin" style={{ borderColor: 'var(--brand-200)', borderTopColor: 'var(--brand-600)' }} />
      </div>
    )
  }

  if (isLoaded && Object.keys(monthlySnapshots).length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--brand-50)' }}>
          <FileBarChart size={28} style={{ color: 'var(--brand-400)' }} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>No financial data yet</h1>
        <p className="text-gray-500 text-sm mb-6">
          Upload financial data before generating a board packet.
        </p>
        <a
          href="/upload"
          className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-white rounded-lg"
          style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)' }}
        >
          Upload data
        </a>
      </div>
    )
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const activeSnap = monthlySnapshots[activeMonth]
  const monthLabel = activeSnap?.label ?? labelFromKey(activeMonth)
  const currentPacket = boardPackets.find((p) => p.monthKey === activeMonth) ?? null
  const hasContent = !!currentPacket?.content
  const content = currentPacket?.content ?? null

  const pace = paceFromKey(activeMonth)
  const expectedPct = Math.round(pace * 100)
  const { categories, totalBudget, ytdSpending, cashOnHand, daysOfReserves, variancePercent } =
    financialData

  // Re-derive alert status from burnRate at render time so stale Supabase values
  // don't produce wrong badges. Thresholds match Budget Analysis page exactly.
  const deriveAlertStatus = (burnRate: number): string => {
    const overPace = burnRate / 100 - pace
    if (overPace > 0.20) return 'action'
    if (overPace > 0.10) return 'concern'
    if (overPace > 0.05) return 'watch'
    return 'ok'
  }

  const flaggedCategories = categories.filter((c) => deriveAlertStatus(c.burnRate) !== 'ok')

  // OSPI Cash Flow projection
  const activeFiscalIdx = fiscalIndexFromKey(activeMonth)
  let runningBalance = cashOnHand
  const cashFlowRows = getFiscalMonths().map((fm) => {
    const mm = fm.key.split('-')[1]
    const ospiPct = OSPI_PCT[mm] ?? DEFAULT_OSPI_PCT
    const revenue = Math.round((totalBudget * ospiPct) / 100)
    const expenses = Math.round(totalBudget / 12)
    const net = revenue - expenses
    const isLow = mm === '11' || mm === '05'

    const snap = monthlySnapshots[fm.key]
    let balance: number | null = null
    let days: number | null = null

    if (snap) {
      balance = snap.financialSummary.cashOnHand
      days = snap.financialSummary.daysOfReserves
      runningBalance = balance
    } else if (fm.fiscalIndex > activeFiscalIdx) {
      runningBalance += net
      balance = runningBalance
      days = Math.round((runningBalance / totalBudget) * 365)
    }

    return { fm, ospiPct, revenue, expenses, net, balance, days, isLow, hasSnap: !!snap }
  })

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!activeSnap) return
    setGenState('generating')
    setGenError(null)

    try {
      const res = await fetch('/api/board-packet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: schoolProfile.name,
          monthLabel,
          pace,
          totalBudget,
          totalActuals: ytdSpending,
          cashOnHand,
          daysOfReserves,
          variancePercent,
          categories,
          flaggedCategories,
          grants,
          alerts,
          schoolContextEntries,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'API error')
      }

      const data: BoardPacketContent = await res.json()
      saveBoardPacket(activeMonth, data)
      setGenState('idle')
    } catch (err) {
      console.error(err)
      setGenError(err instanceof Error ? err.message : 'Failed to generate board packet.')
      setGenState('error')
    }
  }

  const handleExportPDF = async () => {
    if (!hasContent || !content) return
    setExporting(true)
    setGenError(null)

    try {
      const pdfData: BoardPacketPdfData = {
        schoolName: schoolProfile.name,
        monthLabel,
        activeMonth,
        nextBoardMeeting: schoolProfile.nextBoardMeeting || null,
        generatedDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        totalBudget,
        ytdSpending,
        cashOnHand,
        daysOfReserves,
        variancePercent,
        expectedPct,
        pace,
        categories,
        grants,
        cashFlowRows: cashFlowRows.map((r) => ({
          label: r.fm.label,
          ospiPct: r.ospiPct,
          revenue: r.revenue,
          expenses: r.expenses,
          net: r.net,
          balance: r.balance,
          days: r.days,
          isLow: r.isLow,
          hasSnap: r.hasSnap,
          isCurrent: r.fm.key === activeMonth,
        })),
        content,
        flaggedCategories,
        apWarrants: AP_WARRANTS,
        payrollWarrants: PAYROLL_WARRANTS,
        hasRealWarrants: false, // placeholder data — will be true when real warrant data exists
      }

      await generateBoardPacketPdf(pdfData)
      finalizeBoardPacket(activeMonth)
    } catch (err) {
      console.error('PDF export error:', err)
      setGenError('PDF export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const startEdit = (key: string, value: string) => {
    setEditingKey(key)
    setEditBuffer(value)
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setEditBuffer('')
  }

  const saveEdit = () => {
    if (!editingKey || !content) return
    if (editingKey === 'narrative') {
      updateBoardPacketContent(activeMonth, { financialNarrative: editBuffer })
    } else if (editingKey === 'cashFlow') {
      updateBoardPacketContent(activeMonth, { cashFlowNotes: editBuffer })
    } else if (editingKey.startsWith('variance-')) {
      const category = editingKey.slice('variance-'.length)
      const updated = content.varianceExplanations.map((ve) =>
        ve.category === category ? { ...ve, explanation: editBuffer } : ve
      )
      updateBoardPacketContent(activeMonth, { varianceExplanations: updated })
    }
    cancelEdit()
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  const EditButton = ({ editKey, value }: { editKey: string; value: string }) => (
    <button
      data-html2canvas-ignore
      onClick={() => startEdit(editKey, value)}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#1e3a5f] transition-colors"
    >
      <Pencil size={11} />
      Edit
    </button>
  )

  const EditArea = ({ editKey }: { editKey: string }) =>
    editingKey === editKey ? (
      <div data-html2canvas-ignore className="mt-2 space-y-2">
        <textarea
          value={editBuffer}
          onChange={(e) => setEditBuffer(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 border border-[#1e3a5f]/30 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 resize-y"
        />
        <div className="flex gap-2">
          <button
            onClick={saveEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors"
            style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)' }}
          >
            <Save size={11} /> Save
          </button>
          <button
            onClick={cancelEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X size={11} /> Cancel
          </button>
        </div>
      </div>
    ) : null

  // ── Page layout ───────────────────────────────────────────────────────────────

  const sortedPackets = [...boardPackets].sort((a, b) => (a.id > b.id ? -1 : 1))

  return (
    <div className="max-w-5xl space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Board Packet</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Generate and export monthly board financial reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasContent && (
            <button
              onClick={handleExportPDF}
              disabled={exporting || !!editingKey}
              className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors"
              style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)' }}
            >
              {exporting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <Download size={14} />
                  Finalize &amp; Export PDF
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="card-static px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <Clock size={14} className="text-gray-400" />
          <span>Next board meeting: <span className="font-medium text-gray-800">{fmtDate(schoolProfile.nextBoardMeeting)}</span></span>
          <span className="text-gray-300">·</span>
          <span>Finance committee: <span className="font-medium text-gray-800">{fmtDate(schoolProfile.nextFinanceCommittee)}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{monthLabel}</span>
          {currentPacket && (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${PACKET_STATUS_CFG[currentPacket.status].cls}`}>
              {PACKET_STATUS_CFG[currentPacket.status].label}
            </span>
          )}
        </div>
      </div>

      {/* Board Prep Agent Banner */}
      {(boardPrepRunning || agentFindings.filter((f) => f.agentName === 'board_prep').length > 0) && (
        <div className="ai-briefing px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Bot size={15} style={{ color: 'var(--brand-500)' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-500)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
              Board Prep Agent
            </span>
            {boardPrepRunning && (
              <Loader2 size={13} className="animate-spin" style={{ color: 'var(--brand-400)' }} />
            )}
          </div>
          {boardPrepRunning ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Analyzing findings for upcoming board meeting...</p>
          ) : (
            <div className="space-y-2">
              {agentFindings
                .filter((f) => f.agentName === 'board_prep')
                .map((f) => {
                  const sev = { action: 'text-red-700', concern: 'text-orange-700', watch: 'text-amber-700', info: 'text-blue-700' }[f.severity] ?? 'text-gray-700'
                  return (
                    <div key={f.id} className="flex items-start gap-2">
                      <span className={`text-xs font-semibold mt-0.5 uppercase ${sev}`}>{f.severity}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{f.title}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{f.summary}</p>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* Error banner */}
      {genError && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {genError}
        </div>
      )}

      {/* No snapshot warning */}
      {!activeSnap && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2.5 text-sm text-amber-800">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          No financial data found for {monthLabel}. Upload data for this month before generating a board packet.
        </div>
      )}

      {/* Generate card (shown when no content yet) */}
      {!hasContent && activeSnap && (
        <div className="card-static p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Generate Board Packet for {monthLabel}</h2>
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Packet includes</p>
            <ul className="space-y-1 text-sm text-gray-600">
              {[
                'Budget vs. Actuals Summary — full category breakdown',
                'Financial Narrative — AI-written plain-English summary',
                'Cash Flow Report — OSPI apportionment projection',
                'Grant / Categorical Spend Snapshot',
                'Variance Explanations — for flagged items',
                'Warrant Approval Package',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <ChevronRight size={13} className="text-[#1e3a5f] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {genState === 'generating' ? (
            <div className="flex items-center gap-3 py-4">
              <Loader2 size={20} className="animate-spin text-[#1e3a5f] shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">Generating your board packet…</p>
                <p className="text-xs text-gray-500 mt-0.5">Claude is analyzing your financial data and writing narrative sections. This takes about 30 seconds.</p>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-medium rounded-lg transition-colors"
              style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)' }}
            >
              <FileText size={15} />
              Generate Board Packet
            </button>
          )}
        </div>
      )}

      {/* ── Packet preview (printable) ── */}
      {hasContent && content && (
        <div
          ref={printRef}
          className="card-static p-8 space-y-2"
        >
          {/* Cover */}
          <div className="text-center pb-6 mb-6 border-b-2 border-[#1e3a5f]">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Board Financial Packet</p>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">{schoolProfile.name}</h1>
            <p className="text-base text-gray-600 mt-1">{monthLabel}</p>
            <div className="mt-3 flex justify-center gap-6 text-xs text-gray-500">
              <span>Annual Budget: <strong className="text-gray-800">{fmt(totalBudget)}</strong></span>
              <span>YTD Actuals: <strong className="text-gray-800">{fmt(ytdSpending)}</strong></span>
              <span>Cash on Hand: <strong className="text-gray-800">{fmt(cashOnHand)}</strong></span>
              <span>Days of Reserves: <strong className="text-gray-800">{daysOfReserves}</strong></span>
            </div>
          </div>

          {/* ── Section 1: Budget vs. Actuals ── */}
          <Section number={1} title="Budget vs. Actuals Summary">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e3a5f] text-white">
                    <th className="text-left px-3 py-2 font-semibold">Category</th>
                    <th className="text-right px-3 py-2 font-semibold">Annual Budget</th>
                    <th className="text-right px-3 py-2 font-semibold">YTD Actual</th>
                    <th className="text-right px-3 py-2 font-semibold">YTD Budget</th>
                    <th className="text-right px-3 py-2 font-semibold">Variance $</th>
                    <th className="text-right px-3 py-2 font-semibold">Variance %</th>
                    <th className="text-center px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat, i) => {
                    const ytdBudget = Math.round(cat.budget * pace)
                    const varDollar = cat.ytdActuals - ytdBudget
                    const varPct = ytdBudget > 0 ? ((cat.ytdActuals - ytdBudget) / ytdBudget) * 100 : 0
                    const cfg = STATUS_CFG[deriveAlertStatus(cat.burnRate)] ?? STATUS_CFG.ok
                    return (
                      <tr key={cat.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 font-medium text-gray-800">{cat.name}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{fmtFull(cat.budget)}</td>
                        <td className="px-3 py-2 text-right text-gray-800 font-medium">{fmtFull(cat.ytdActuals)}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{fmtFull(ytdBudget)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${varDollar > 0 ? 'text-red-600' : varDollar < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                          {varDollar >= 0 ? '+' : ''}{fmtFull(varDollar)}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${varPct > 5 ? 'text-red-600' : varPct < -20 ? 'text-amber-600' : 'text-gray-600'}`}>
                          {fmtPct(varPct)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#1e3a5f] bg-[#f0f4f8] font-semibold">
                    <td className="px-3 py-2 text-gray-800">Total</td>
                    <td className="px-3 py-2 text-right text-gray-800">{fmtFull(totalBudget)}</td>
                    <td className="px-3 py-2 text-right text-gray-800">{fmtFull(ytdSpending)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmtFull(Math.round(totalBudget * pace))}</td>
                    <td className={`px-3 py-2 text-right ${ytdSpending - Math.round(totalBudget * pace) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {ytdSpending - Math.round(totalBudget * pace) >= 0 ? '+' : ''}{fmtFull(ytdSpending - Math.round(totalBudget * pace))}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {fmtPct(variancePercent)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              YTD Budget reflects expected spending at {expectedPct}% through the fiscal year ({monthLabel}).
            </p>
          </Section>

          {/* ── Section 2: Financial Narrative ── */}
          <Section number={2} title="Financial Narrative">
            {editingKey === 'narrative' ? (
              <EditArea editKey="narrative" />
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-blue-50/40 border border-blue-100 rounded-lg p-4 flex-1">
                  {content.financialNarrative}
                </div>
                <EditButton editKey="narrative" value={content.financialNarrative} />
              </div>
            )}
          </Section>

          {/* ── Section 3: Cash Flow Report ── */}
          <Section number={3} title="Cash Flow Report">
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e3a5f] text-white">
                    <th className="text-left px-3 py-2 font-semibold">Month</th>
                    <th className="text-right px-3 py-2 font-semibold">OSPI %</th>
                    <th className="text-right px-3 py-2 font-semibold">Est. Revenue</th>
                    <th className="text-right px-3 py-2 font-semibold">Est. Expenses</th>
                    <th className="text-right px-3 py-2 font-semibold">Net</th>
                    <th className="text-right px-3 py-2 font-semibold">Proj. Balance</th>
                    <th className="text-right px-3 py-2 font-semibold">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlowRows.map(({ fm, ospiPct, revenue, expenses, net, balance, days, isLow, hasSnap }, i) => (
                    <tr
                      key={fm.key}
                      className={[
                        i % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                        isLow ? 'bg-amber-50' : '',
                        fm.key === activeMonth ? 'ring-1 ring-inset ring-[#1e3a5f]' : '',
                      ].join(' ')}
                    >
                      <td className="px-3 py-2 font-medium text-gray-800">
                        {fm.label}
                        {isLow && (
                          <span className="ml-1.5 text-xs font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            LOW
                          </span>
                        )}
                        {hasSnap && (
                          <span className="ml-1.5 text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                            Actual
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">{ospiPct.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right text-gray-600">{fmtFull(revenue)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{fmtFull(expenses)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${net < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {net >= 0 ? '+' : ''}{fmtFull(net)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-800">
                        {balance != null ? fmtFull(balance) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className={`px-3 py-2 text-right ${days != null && days < 30 ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                        {days != null ? days : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800 mb-3">
              <strong>Note:</strong> November and May receive reduced OSPI apportionment payments (4.17% vs. 8.33% in other months). Schools must maintain adequate reserves to cover these periods.
            </div>
            {/* AI Cash Flow Notes */}
            {editingKey === 'cashFlow' ? (
              <EditArea editKey="cashFlow" />
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="text-sm text-gray-700 leading-relaxed bg-blue-50/40 border border-blue-100 rounded-lg p-4 flex-1">
                  {content.cashFlowNotes}
                </div>
                <EditButton editKey="cashFlow" value={content.cashFlowNotes} />
              </div>
            )}
          </Section>

          {/* ── Section 4: Grant Snapshot ── */}
          <Section number={4} title="Grant / Categorical Spend Snapshot">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e3a5f] text-white">
                    <th className="text-left px-3 py-2 font-semibold">Grant</th>
                    <th className="text-right px-3 py-2 font-semibold">Award</th>
                    <th className="text-right px-3 py-2 font-semibold">Spent</th>
                    <th className="text-right px-3 py-2 font-semibold">Remaining</th>
                    <th className="text-left px-3 py-2 font-semibold w-32">Spend Rate</th>
                    <th className="text-right px-3 py-2 font-semibold">Proj. Year-End</th>
                    <th className="text-center px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {grants.map((grant, i) => {
                    const spendPct = grant.awardAmount > 0
                      ? (grant.spent / grant.awardAmount) * 100
                      : 0
                    const projYE = pace > 0 ? Math.round(grant.spent / pace) : grant.spent
                    const statusCls =
                      grant.status === 'on-pace'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800'
                    const statusLabel =
                      grant.status === 'on-pace'
                        ? 'On Pace'
                        : grant.status === 'underspend-risk'
                        ? 'Underspend Risk'
                        : 'Overspend Risk'
                    return (
                      <tr key={grant.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 font-medium text-gray-800">{grant.name}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{fmtFull(grant.awardAmount)}</td>
                        <td className="px-3 py-2 text-right text-gray-800 font-medium">{fmtFull(grant.spent)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{fmtFull(grant.awardAmount - grant.spent)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${spendPct > expectedPct + 10 ? 'bg-red-500' : spendPct < expectedPct - 15 ? 'bg-amber-400' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(spendPct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 shrink-0">{spendPct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">{fmtFull(projYE)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusCls}`}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {grants.filter((g) => g.status !== 'on-pace').map((g) => (
              <div key={g.id} className="mt-2 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                <span>
                  <strong>{g.name}</strong>:{' '}
                  {g.status === 'underspend-risk'
                    ? `Spending pace is below expected. At current rate, ${fmtFull(Math.round(g.spent / pace) - g.awardAmount < 0 ? Math.abs(Math.round(g.spent / pace) - g.awardAmount) : 0)} may go unspent. Confirm all planned activities are on track.`
                    : `Spending is ahead of pace. Review to confirm award amount is sufficient.`}
                </span>
              </div>
            ))}
          </Section>

          {/* ── Section 5: Variance Explanations ── */}
          <Section number={5} title="Variance Explanation">
            {flaggedCategories.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <CheckCircle size={14} />
                All budget categories are on track. No variances requiring board explanation.
              </div>
            ) : (
              <div className="space-y-4">
                {content.varianceExplanations.map((ve, i) => {
                  const cat = categories.find((c) => c.name === ve.category)
                  const cfg = cat ? (STATUS_CFG[deriveAlertStatus(cat.burnRate)] ?? STATUS_CFG.ok) : STATUS_CFG.watch
                  const editKey = `variance-${ve.category}`
                  return (
                    <div key={ve.category} className={`rounded-lg border p-4 ${i % 2 === 0 ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800">{ve.category}</span>
                          {cat && (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                              {cfg.label}
                            </span>
                          )}
                          {cat && (
                            <span className="text-xs text-gray-500">
                              {cat.burnRate.toFixed(0)}% spent (exp. {expectedPct}%)
                            </span>
                          )}
                        </div>
                        {editingKey !== editKey && (
                          <EditButton editKey={editKey} value={ve.explanation} />
                        )}
                      </div>
                      {editingKey !== editKey ? (
                        <p className="text-sm text-gray-700 leading-relaxed">{ve.explanation}</p>
                      ) : (
                        <EditArea editKey={editKey} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* ── Section 6: Warrant Approval ── */}
          <Section number={6} title={`Warrant Approval — ${monthLabel}`}>
            <div className="flex items-start gap-2.5 bg-amber-50 border-2 border-amber-400 rounded-lg px-4 py-3 mb-4 text-sm text-amber-900">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
              <span>
                <strong>Placeholder Data —</strong> These warrant numbers and amounts are for demonstration only.
                Replace with your actual AP and payroll warrant register before presenting to the board.
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Board approval required per <strong>RCW 42.24.080</strong>. The following warrants are presented for board ratification.
            </p>

            {/* AP Warrants */}
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Accounts Payable Warrants</p>
            <table className="w-full text-sm mb-5">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-600">Warrant Number Range</th>
                  <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-600">Payee / Description</th>
                  <th className="text-right py-1.5 px-2 text-xs font-semibold text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                {AP_WARRANTS.map((w, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="py-1.5 px-2 font-mono text-xs text-gray-600">{w.range}</td>
                    <td className="py-1.5 px-2 text-gray-700">{w.description}</td>
                    <td className="py-1.5 px-2 text-right text-gray-800">{fmtFull(w.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 font-semibold bg-gray-50">
                  <td colSpan={2} className="py-1.5 px-2 text-gray-800">AP Total</td>
                  <td className="py-1.5 px-2 text-right text-gray-800">
                    {fmtFull(AP_WARRANTS.reduce((s, w) => s + w.amount, 0))}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Payroll Warrants */}
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Payroll Warrants</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-600">Warrant Number</th>
                  <th className="text-left py-1.5 px-2 text-xs font-semibold text-gray-600">Description</th>
                  <th className="text-right py-1.5 px-2 text-xs font-semibold text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                {PAYROLL_WARRANTS.map((w, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="py-1.5 px-2 font-mono text-xs text-gray-600">{w.range}</td>
                    <td className="py-1.5 px-2 text-gray-700">{w.description}</td>
                    <td className="py-1.5 px-2 text-right text-gray-800">{fmtFull(w.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 font-semibold bg-gray-50">
                  <td colSpan={2} className="py-1.5 px-2 text-gray-800">Payroll Total</td>
                  <td className="py-1.5 px-2 text-right text-gray-800">
                    {fmtFull(PAYROLL_WARRANTS.reduce((s, w) => s + w.amount, 0))}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-8 text-xs text-gray-500">
              <div>
                <p className="font-semibold text-gray-700 mb-2">Board Chair Signature</p>
                <div className="border-b border-gray-400 h-8 mb-1" />
                <p>Signature &amp; Date</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700 mb-2">Clerk of the Board</p>
                <div className="border-b border-gray-400 h-8 mb-1" />
                <p>Signature &amp; Date</p>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ── Packet History ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Packet History</h2>
        {sortedPackets.length === 0 ? (
          <div className="card-static px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No packets generated yet</p>
          </div>
        ) : (
          <div className="card-static divide-y divide-gray-100">
            {sortedPackets.map((packet) => (
              <div key={packet.id} className="flex items-center gap-4 px-5 py-4">
                <FileText size={17} className="text-gray-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{packet.month}</p>
                  {packet.generatedAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Generated {fmtDate(packet.generatedAt)}
                    </p>
                  )}
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${PACKET_STATUS_CFG[packet.status].cls}`}>
                  {PACKET_STATUS_CFG[packet.status].label}
                </span>
                {packet.content && (
                  <button
                    onClick={() => {
                      setActiveMonth(packet.monthKey)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="text-gray-400 hover:text-[#1e3a5f] transition-colors"
                    title="Switch to this month to re-export"
                  >
                    <Download size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
