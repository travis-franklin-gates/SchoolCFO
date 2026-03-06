'use client'

import { useRef, useState } from 'react'
import {
  ClipboardCheck,
  FileCheck,
  Users,
  DollarSign,
  BookOpen,
  Building2,
  Shield,
  Loader2,
  Download,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Upload,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { labelFromKey, paceFromKey } from '@/lib/fiscalYear'

// ── Audit category definitions ───────────────────────────────────────────────

interface AuditCategory {
  key: string
  label: string
  icon: typeof ClipboardCheck
  description: string
  checklistItems: string[]
}

const AUDIT_CATEGORIES: AuditCategory[] = [
  {
    key: 'warrant_approval',
    label: 'Warrant Approval',
    icon: FileCheck,
    description: 'Board approval of accounts payable and payroll warrants before payment processing',
    checklistItems: [
      'All AP warrants have board approval documented in minutes',
      'Payroll warrants are pre-approved per board policy',
      'Warrant register is maintained with sequential numbering',
      'Void warrants are documented with reason',
      'Bank reconciliation completed monthly',
    ],
  },
  {
    key: 'categorical_fund',
    label: 'Categorical Fund Compliance',
    icon: DollarSign,
    description: 'Proper segregation and use of categorical (restricted) funds per state/federal rules',
    checklistItems: [
      'Categorical funds tracked in separate accounts',
      'Expenditures match approved fund purposes',
      'No commingling of categorical and general funds',
      'Quarterly spending reports filed on time',
      'Carryover amounts documented and approved',
    ],
  },
  {
    key: 'time_effort',
    label: 'Time & Effort Documentation',
    icon: Users,
    description: 'Personnel activity reports for staff paid from multiple funding sources',
    checklistItems: [
      'Semi-annual certifications completed for single-cost objective staff',
      'Monthly PARs completed for split-funded staff',
      'Time & effort records match payroll distribution',
      'Supervisor signatures on all certifications',
      'Adjustments made for actual vs. budgeted time',
    ],
  },
  {
    key: 'cash_management',
    label: 'Cash Management',
    icon: Building2,
    description: 'Cash handling, deposits, reserves, and investment practices',
    checklistItems: [
      'Cash receipts deposited within 24 hours',
      'Petty cash fund reconciled monthly',
      'Bank statements reconciled within 30 days',
      'Reserve fund meets minimum days requirement',
      'Investment policy on file and followed',
    ],
  },
  {
    key: 'cedars',
    label: 'CEDARS Reporting',
    icon: BookOpen,
    description: 'Comprehensive Education Data and Research System — state enrollment and program reporting',
    checklistItems: [
      'Student enrollment counts verified monthly',
      'Program participation data current and accurate',
      'Staff FTE data matches payroll records',
      'Submission deadlines met for all windows',
      'Error reports reviewed and resolved',
    ],
  },
  {
    key: 'board_governance',
    label: 'Board Governance',
    icon: Shield,
    description: 'Board financial oversight, policies, and required approvals',
    checklistItems: [
      'Annual budget adopted by board resolution',
      'Monthly financial reports presented to board',
      'Board-approved fiscal policies current (within 2 years)',
      'Conflict of interest disclosures on file',
      'Board minutes document all financial votes',
    ],
  },
]

// ── Status helpers ───────────────────────────────────────────────────────────

type ReadinessStatus = 'ready' | 'needs-attention' | 'at-risk' | 'not-reviewed'

function getReadinessStatus(
  checkedCount: number,
  totalCount: number,
  reviewedAt: string | null,
): ReadinessStatus {
  if (!reviewedAt && checkedCount === 0) return 'not-reviewed'
  const pct = checkedCount / totalCount
  if (pct >= 0.8) return 'ready'
  if (pct >= 0.5) return 'needs-attention'
  return 'at-risk'
}

const STATUS_CFG: Record<ReadinessStatus, { label: string; cls: string }> = {
  ready: { label: 'Ready', cls: 'bg-green-100 text-green-800' },
  'needs-attention': { label: 'Needs Attention', cls: 'bg-yellow-100 text-yellow-800' },
  'at-risk': { label: 'At Risk', cls: 'bg-red-100 text-red-800' },
  'not-reviewed': { label: 'Not Reviewed', cls: 'bg-gray-100 text-gray-600' },
}

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n.toLocaleString()}`
}

// ── Report types ─────────────────────────────────────────────────────────────

interface AuditReport {
  executiveSummary: string
  categoryFindings: {
    category: string
    status: string
    findings: string
    recommendations: string[]
  }[]
  priorityActions: string[]
  timelineRecommendation: string
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AuditPrepPage() {
  const {
    isLoaded,
    schoolProfile,
    financialData,
    grants,
    alerts,
    activeMonth,
    auditChecklists,
    schoolContextEntries,
    updateAuditChecklist,
    markAuditReviewed,
  } = useStore()

  const printRef = useRef<HTMLDivElement>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [report, setReport] = useState<AuditReport | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const monthLabel = labelFromKey(activeMonth)
  const hasData = financialData.categories.length > 0

  // ── Loading / empty states ─────────────────────────────────────────────────

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--brand-100) 0%, var(--brand-50) 100%)' }}>
          <ClipboardCheck size={24} style={{ color: 'var(--brand-600)' }} />
        </div>
        <h2 className="text-xl font-semibold text-gray-800"
          style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
          Audit Prep
        </h2>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          Upload your financial data first, then come back here to review audit readiness and generate reports.
        </p>
        <a href="/upload"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors"
          style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
          <Upload size={16} /> Upload Data
        </a>
      </div>
    )
  }

  // ── Checklist helpers ──────────────────────────────────────────────────────

  const getChecklist = (key: string) =>
    auditChecklists.find((c) => c.category === key) || {
      category: key,
      checkedItems: [],
      reviewedAt: null,
      reviewerNote: '',
    }

  const toggleItem = (categoryKey: string, item: string) => {
    const cl = getChecklist(categoryKey)
    const items = cl.checkedItems.includes(item)
      ? cl.checkedItems.filter((i) => i !== item)
      : [...cl.checkedItems, item]
    updateAuditChecklist(categoryKey, items, cl.reviewerNote)
  }

  const handleNoteChange = (categoryKey: string, note: string) => {
    const cl = getChecklist(categoryKey)
    updateAuditChecklist(categoryKey, cl.checkedItems, note)
  }

  // ── Overall readiness ──────────────────────────────────────────────────────

  const categoryStatuses = AUDIT_CATEGORIES.map((cat) => {
    const cl = getChecklist(cat.key)
    return getReadinessStatus(cl.checkedItems.length, cat.checklistItems.length, cl.reviewedAt)
  })

  const readyCount = categoryStatuses.filter((s) => s === 'ready').length
  const atRiskCount = categoryStatuses.filter((s) => s === 'at-risk').length
  const notReviewedCount = categoryStatuses.filter((s) => s === 'not-reviewed').length

  // ── Generate report ────────────────────────────────────────────────────────

  const generateReport = async () => {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/audit-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: schoolProfile.name,
          monthLabel,
          totalBudget: financialData.totalBudget,
          totalActuals: financialData.ytdSpending,
          cashOnHand: financialData.cashOnHand,
          daysOfReserves: financialData.daysOfReserves,
          variancePercent: financialData.variancePercent,
          categories: financialData.categories,
          grants,
          alerts,
          auditChecklists,
          schoolContextEntries,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to generate report')
      }
      const data: AuditReport = await res.json()
      setReport(data)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate report.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Export PDF ─────────────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    if (!printRef.current || !report) return
    setExporting(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const canvas = await html2canvas(printRef.current, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })

      const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' })
      const pW = pdf.internal.pageSize.getWidth()
      const pH = pdf.internal.pageSize.getHeight()
      const MARGIN = 36
      const HDR_H = 32
      const FTR_H = 28
      const TOP = MARGIN + HDR_H
      const BOTTOM = pH - MARGIN - FTR_H
      const USABLE_H = BOTTOM - TOP
      const CW = pW - 2 * MARGIN

      const ratio = CW / canvas.width
      let yPx = 0
      let page = 1

      const addHeaderFooter = (n: number) => {
        pdf.setFontSize(7.5)
        pdf.setTextColor(150, 150, 150)
        pdf.text(
          `${schoolProfile.name}  ·  Audit Readiness Report  ·  ${monthLabel}`,
          MARGIN, MARGIN + 14
        )
        pdf.setDrawColor(220, 220, 220)
        pdf.setLineWidth(0.5)
        pdf.line(MARGIN, MARGIN + 20, pW - MARGIN, MARGIN + 20)
        pdf.line(MARGIN, BOTTOM + 8, pW - MARGIN, BOTTOM + 8)
        pdf.setFontSize(7.5)
        pdf.text(`Page ${n}`, pW / 2, BOTTOM + 20, { align: 'center' })
      }

      addHeaderFooter(page)
      while (yPx < canvas.height) {
        const sliceH = Math.min(USABLE_H / ratio, canvas.height - yPx)
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = canvas.width
        sliceCanvas.height = sliceH
        const ctx = sliceCanvas.getContext('2d')!
        ctx.drawImage(canvas, 0, yPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH)

        const imgData = sliceCanvas.toDataURL('image/png')
        pdf.addImage(imgData, 'PNG', MARGIN, TOP, CW, sliceH * ratio)
        yPx += sliceH

        if (yPx < canvas.height) {
          pdf.addPage()
          page++
          addHeaderFooter(page)
        }
      }

      pdf.save(`${schoolProfile.name.replace(/\s+/g, '_')}_Audit_Report_${activeMonth}.pdf`)
    } catch (err) {
      console.error('PDF export error:', err)
    } finally {
      setExporting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            Audit Prep
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Review readiness across 6 audit areas and generate a comprehensive report
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generateReport}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
          {report && (
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
              style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}
            >
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Export PDF
            </button>
          )}
        </div>
      </div>

      {genError && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {genError}
        </div>
      )}

      {/* Readiness Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card-static p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: 'var(--brand-700)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            {readyCount}/{AUDIT_CATEGORIES.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Areas Ready</div>
        </div>
        <div className="card-static p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            {AUDIT_CATEGORIES.length - readyCount - atRiskCount - notReviewedCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">Needs Attention</div>
        </div>
        <div className="card-static p-4 text-center">
          <div className="text-2xl font-bold text-red-600" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            {atRiskCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">At Risk</div>
        </div>
        <div className="card-static p-4 text-center">
          <div className="text-2xl font-bold text-gray-400" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            {notReviewedCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">Not Reviewed</div>
        </div>
      </div>

      {/* Audit Category Cards */}
      <div className="space-y-3">
        {AUDIT_CATEGORIES.map((cat, idx) => {
          const cl = getChecklist(cat.key)
          const status = categoryStatuses[idx]
          const cfg = STATUS_CFG[status]
          const expanded = expandedCategory === cat.key
          const Icon = cat.icon
          const checkedCount = cl.checkedItems.length

          return (
            <div key={cat.key} className="card-static overflow-hidden">
              {/* Card header */}
              <button
                onClick={() => setExpandedCategory(expanded ? null : cat.key)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--brand-100) 0%, var(--brand-50) 100%)' }}>
                  <Icon size={18} style={{ color: 'var(--brand-600)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-800"
                      style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
                      {cat.label}
                    </h3>
                    <span className={`inline-flex text-xs px-3 py-1 rounded-full font-medium ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                    {cl.reviewedAt && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <CheckCircle size={11} /> Reviewed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{cat.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-medium text-gray-500">
                    {checkedCount}/{cat.checklistItems.length}
                  </span>
                  {/* Mini progress bar */}
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden hidden sm:block">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(checkedCount / cat.checklistItems.length) * 100}%`,
                        background: status === 'ready' ? '#22c55e' : status === 'needs-attention' ? '#eab308' : status === 'at-risk' ? '#ef4444' : '#d1d5db',
                      }}
                    />
                  </div>
                  {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {/* Expanded checklist */}
              {expanded && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                  {cat.checklistItems.map((item) => {
                    const checked = cl.checkedItems.includes(item)
                    return (
                      <label key={item} className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(cat.key, item)}
                          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]/20"
                        />
                        <span className={`text-sm ${checked ? 'text-gray-500 line-through' : 'text-gray-700'} group-hover:text-gray-900 transition-colors`}>
                          {item}
                        </span>
                      </label>
                    )
                  })}

                  {/* Reviewer note */}
                  <div className="pt-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Reviewer Notes
                    </label>
                    <textarea
                      value={cl.reviewerNote}
                      onChange={(e) => handleNoteChange(cat.key, e.target.value)}
                      placeholder="Add notes about this audit area..."
                      rows={2}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/12 focus:border-[#1e3a5f] bg-white resize-none"
                    />
                  </div>

                  {/* Mark Reviewed button */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={() => markAuditReviewed(cat.key)}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        cl.reviewedAt
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'text-white hover:opacity-90'
                      }`}
                      style={!cl.reviewedAt ? {
                        background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)',
                        fontFamily: 'var(--font-display), system-ui, sans-serif',
                      } : { fontFamily: 'var(--font-display), system-ui, sans-serif' }}
                    >
                      <CheckCircle size={14} />
                      {cl.reviewedAt ? 'Reviewed' : 'Mark Reviewed'}
                    </button>
                    {cl.reviewedAt && (
                      <span className="text-xs text-gray-400">
                        {new Date(cl.reviewedAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* AI-Generated Report */}
      {report && (
        <div ref={printRef} className="space-y-6">
          <div className="card-static p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4"
              style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
              Audit Readiness Report — {monthLabel}
            </h2>

            {/* Executive Summary */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Executive Summary
              </h3>
              <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {report.executiveSummary}
              </div>
            </div>

            {/* Priority Actions */}
            {report.priorityActions.length > 0 && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                  <AlertTriangle size={14} />
                  Priority Actions
                </h3>
                <ol className="list-decimal list-inside space-y-1">
                  {report.priorityActions.map((action, i) => (
                    <li key={i} className="text-sm text-amber-900">{action}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Category Findings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Findings by Area
              </h3>
              {report.categoryFindings.map((finding) => {
                const statusCls = finding.status === 'ready'
                  ? 'bg-green-100 text-green-800'
                  : finding.status === 'needs-attention'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
                const statusLabel = finding.status === 'ready'
                  ? 'Ready'
                  : finding.status === 'needs-attention'
                  ? 'Needs Attention'
                  : 'At Risk'

                return (
                  <div key={finding.category} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-gray-800">{finding.category}</h4>
                      <span className={`inline-flex text-xs px-3 py-1 rounded-full font-medium ${statusCls}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{finding.findings}</p>
                    {finding.recommendations.length > 0 && (
                      <ul className="list-disc list-inside space-y-0.5">
                        {finding.recommendations.map((rec, i) => (
                          <li key={i} className="text-sm text-gray-600">{rec}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Timeline */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">
                Timeline Recommendation
              </h3>
              <p className="text-sm text-blue-900">{report.timelineRecommendation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
