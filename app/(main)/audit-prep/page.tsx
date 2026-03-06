'use client'

import { useRef, useState } from 'react'
import {
  ClipboardCheck,
  FileCheck,
  Users,
  DollarSign,
  BookOpen,
  CreditCard,
  Shield,
  Loader2,
  Download,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Upload,
  Landmark,
  Package,
  ExternalLink,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { labelFromKey } from '@/lib/fiscalYear'
import { getChecklistItemDetail } from '@/lib/auditChecklistDetails'

// ── SAO Charter School Audit Categories ──────────────────────────────────────

interface AuditCategory {
  key: string
  label: string
  icon: typeof ClipboardCheck
  description: string
  checklistItems: string[]
}

const AUDIT_CATEGORIES: AuditCategory[] = [
  {
    key: 'staff_certification',
    label: 'Staff Certification Compliance',
    icon: Users,
    description: 'All instructional staff hold current WA teaching certificates or OSPI-issued permits per RCW 28A.410 and WAC 181-79A',
    checklistItems: [
      'All instructional staff hold current WA teaching certificates or OSPI-issued permits',
      'S-275 personnel report accurately reflects staff certification status',
      'Special education staff hold valid SpEd endorsements or pre-endorsement authorization',
      'All instructional staff contracts have been approved by the Board',
      'Paraeducator certificates are current per HB 1115 requirements',
    ],
  },
  {
    key: 'enrollment_reporting',
    label: 'Enrollment Reporting Accuracy',
    icon: BookOpen,
    description: 'Student enrollment counts, CEDARS reporting, and special education documentation per WAC 392-121',
    checklistItems: [
      'Student enrollment count date documentation is complete for each month',
      'Special education students have current IEPs and evaluations on file',
      'Special ed students received services on or before each monthly count date',
      'CEDARS enrollment data matches actual student roster',
      'S-275 staff report matches actual employed staff',
    ],
  },
  {
    key: 'accounts_payable',
    label: 'Accounts Payable Controls',
    icon: CreditCard,
    description: 'Disbursement documentation, credit card controls, and dual authorization per SAO best practices',
    checklistItems: [
      'All disbursements have documentation showing goods/services received before payment',
      'Credit card purchases have receipts and business purpose documentation',
      'Electronic funds transfers have dual authorization',
      'No duplicate payments to vendors in current fiscal year',
      'Vendor payments are timely (no late fees or finance charges)',
    ],
  },
  {
    key: 'warrant_approval',
    label: 'Warrant Approval Compliance',
    icon: FileCheck,
    description: 'Board approval of AP and payroll warrants per RCW 42.24.080 and RCW 42.24.090',
    checklistItems: [
      'AP warrants approved by board monthly per RCW 42.24.080',
      'Payroll warrants approved by board monthly per RCW 42.24.090',
      'Warrant documentation includes voucher numbers and vendor names',
      'Warrant register is maintained with sequential numbering',
      'Void warrants are documented with reason and board notification',
    ],
  },
  {
    key: 'categorical_fund',
    label: 'Categorical Fund Compliance',
    icon: DollarSign,
    description: 'Proper segregation and use of categorical (restricted) funds per state and federal requirements',
    checklistItems: [
      'Categorical funds tracked in separate accounts per OSPI fund accounting',
      'Expenditures match approved fund purposes and grant agreements',
      'No commingling of categorical and general funds',
      'Quarterly spending reports filed on time with OSPI',
      'Carryover amounts documented and approved by grantor',
    ],
  },
  {
    key: 'open_meetings',
    label: 'Open Public Meetings Act & Board Governance',
    icon: Shield,
    description: 'OPMA compliance per RCW 42.30, board financial oversight, and required approvals',
    checklistItems: [
      'Board meeting minutes are complete and approved for all meetings this fiscal year',
      'Meeting agendas were posted at least 24 hours in advance per RCW 42.30.077',
      'Executive sessions were properly noticed with specific statutory authority cited',
      'Conflict of interest disclosures are current for all board members',
      'Board has approved all employment contracts for instructional staff',
    ],
  },
  {
    key: 'separation_public_private',
    label: 'Separation of Public & Private Activities',
    icon: Landmark,
    description: 'Public funds, assets, and activities are separate from any private or organizational interests',
    checklistItems: [
      'School bank accounts are separate from any private or organizational accounts',
      'Fundraising revenue is properly tracked and deposited to school accounts',
      'School assets are not commingled with private assets',
      'Public records requests have been properly responded to within statutory timeframes',
      'Management company or CMO transactions are at arms-length with board approval',
    ],
  },
  {
    key: 'asset_tracking',
    label: 'Theft-Sensitive Asset Tracking',
    icon: Package,
    description: 'Inventory and safeguarding of computers, electronics, and other theft-sensitive assets per SAO guidelines',
    checklistItems: [
      'Inventory of computers, tablets, and electronic equipment is current',
      'All assets over $500 are tagged and tracked in an asset management system',
      'Annual physical inventory has been completed and reconciled',
      'Surplus or disposed assets are documented with board approval',
      'Staff-assigned devices have signed checkout agreements on file',
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

// ── Detail panel component ───────────────────────────────────────────────────

function ItemDetailPanel({ itemText }: { itemText: string }) {
  const detail = getChecklistItemDetail(itemText)
  if (!detail) return null

  return (
    <div className="bg-blue-50/60 border-l-4 border-l-blue-400 rounded-r-lg ml-7 mb-1 overflow-hidden animate-[slideDown_200ms_ease-out]">
      <div className="p-4 space-y-4">
        {/* Why It Matters */}
        <div>
          <h5 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1.5">
            Why It Matters
          </h5>
          <p className="text-sm text-blue-900 leading-relaxed">{detail.whyItMatters}</p>
        </div>

        {/* How to Comply */}
        <div>
          <h5 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1.5">
            How to Comply
          </h5>
          <ol className="list-decimal list-inside space-y-1">
            {detail.howToComply.map((step, i) => (
              <li key={i} className="text-sm text-blue-900 leading-relaxed">{step}</li>
            ))}
          </ol>
        </div>

        {/* What to Have Ready */}
        <div>
          <h5 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1.5">
            What to Have Ready
          </h5>
          <ul className="space-y-1">
            {detail.whatToHaveReady.map((doc, i) => (
              <li key={i} className="text-sm text-blue-900 leading-relaxed flex items-start gap-2">
                <span className="text-blue-400 mt-1.5 shrink-0">&#8226;</span>
                {doc}
              </li>
            ))}
          </ul>
        </div>

        {/* Resources */}
        {detail.resources.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1.5">
              Resources
            </h5>
            <div className="flex flex-wrap gap-2">
              {detail.resources.map((res, i) => (
                <a
                  key={i}
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/80 border border-blue-200 rounded-lg text-blue-700 hover:bg-white hover:border-blue-300 transition-colors"
                >
                  <ExternalLink size={10} className="shrink-0" />
                  {res.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
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
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
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

  const toggleItemDetail = (itemText: string) => {
    setExpandedItem((prev) => (prev === itemText ? null : itemText))
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
          `${schoolProfile.name}  ·  SAO Audit Readiness Report  ·  ${monthLabel}`,
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

      pdf.save(`${schoolProfile.name.replace(/\s+/g, '_')}_SAO_Audit_Report_${activeMonth}.pdf`)
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
            WA State Auditor&apos;s Office charter school accountability audit areas
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

      {/* SAO context banner */}
      <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs leading-relaxed">
        Based on WA State Auditor&apos;s Office published charter school accountability audit focus areas.
        Click any checklist item to see detailed guidance on why it matters, how to comply, and what documentation to have ready.
      </div>

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
                <div className="border-t border-gray-100 px-5 py-4 space-y-1">
                  {cat.checklistItems.map((item) => {
                    const checked = cl.checkedItems.includes(item)
                    const isDetailOpen = expandedItem === item
                    const hasDetail = !!getChecklistItemDetail(item)

                    return (
                      <div key={item}>
                        {/* Checklist row */}
                        <div className="flex items-start gap-3 py-2 group">
                          {/* Checkbox — stops propagation so clicking it doesn't toggle the detail */}
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleItem(cat.key, item)}
                            className="mt-1 w-4 h-4 rounded border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]/20 cursor-pointer shrink-0"
                          />
                          {/* Clickable label area — toggles detail panel */}
                          <button
                            onClick={() => hasDetail && toggleItemDetail(item)}
                            className={`flex-1 text-left flex items-start gap-2 ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <span className={`text-sm leading-relaxed ${checked ? 'text-gray-400 line-through' : 'text-gray-700'} ${hasDetail ? 'group-hover:text-gray-900' : ''} transition-colors`}>
                              {item}
                            </span>
                          </button>
                          {/* Chevron indicator */}
                          {hasDetail && (
                            <button
                              onClick={() => toggleItemDetail(item)}
                              className="mt-0.5 shrink-0 text-gray-300 hover:text-blue-500 transition-all"
                            >
                              <ChevronRight
                                size={14}
                                className={`transition-transform duration-200 ${isDetailOpen ? 'rotate-90' : ''}`}
                              />
                            </button>
                          )}
                        </div>

                        {/* Detail panel */}
                        {isDetailOpen && <ItemDetailPanel itemText={item} />}
                      </div>
                    )
                  })}

                  {/* Reviewer note */}
                  <div className="pt-3">
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
            <h2 className="text-lg font-semibold text-gray-800 mb-1"
              style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
              SAO Audit Readiness Report — {monthLabel}
            </h2>
            <p className="text-xs text-gray-400 mb-5">
              Based on WA State Auditor&apos;s Office charter school accountability audit framework
            </p>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Executive Summary
              </h3>
              <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {report.executiveSummary}
              </div>
            </div>

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

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Findings by Audit Area
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
