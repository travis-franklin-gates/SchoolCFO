'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
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
  Bot,
  XCircle,
  CircleDot,
  RefreshCw,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { labelFromKey } from '@/lib/fiscalYear'
import { getChecklistItemDetail } from '@/lib/auditChecklistDetails'

// ── Types ────────────────────────────────────────────────────────────────────

type ItemStatus = 'verified' | 'warning' | 'action' | 'manual'

interface ComplianceItem {
  item: string
  category: string
  status: ItemStatus
  reason: string
}

interface DocGap {
  item: string
  category: string
  documentName: string
  mustContain: string
  prepTimeEstimate: string
  templateAvailable: boolean
  templateNote: string
}

interface ReadinessAssessment {
  score: number
  grade: string
  priorityActions: { action: string; timeEstimate: string; category: string }[]
  executiveSummary: string
  categoryStatus: { category: string; label: string; status: string; itemCount: number; verifiedCount: number; gapCount: number }[]
  estimatedTimeToReady: string
}

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

// ── Status icon component ─────────────────────────────────────────────────────

const STATUS_ICON: Record<ItemStatus, { icon: typeof CheckCircle; cls: string; label: string; bg: string }> = {
  verified: { icon: CheckCircle, cls: 'text-green-600', label: 'Verified', bg: 'bg-green-50' },
  warning: { icon: AlertTriangle, cls: 'text-yellow-600', label: 'Needs Review', bg: 'bg-yellow-50' },
  action: { icon: XCircle, cls: 'text-red-600', label: 'Action Required', bg: 'bg-red-50' },
  manual: { icon: CircleDot, cls: 'text-gray-400', label: 'Manual Review', bg: 'bg-gray-50' },
}

function StatusBadge({ status }: { status: ItemStatus }) {
  const cfg = STATUS_ICON[status]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.cls}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  )
}

// ── Detail panel component ───────────────────────────────────────────────────

function ItemDetailPanel({
  itemText,
  complianceItem,
  docGap,
}: {
  itemText: string
  complianceItem?: ComplianceItem
  docGap?: DocGap
}) {
  const detail = getChecklistItemDetail(itemText)
  if (!detail) return null

  return (
    <div className="bg-blue-50/60 border-l-4 border-l-blue-400 rounded-r-lg ml-7 mb-1 overflow-hidden animate-[slideDown_200ms_ease-out]">
      <div className="p-4 space-y-4">
        {/* Agent Finding */}
        {complianceItem && complianceItem.status !== 'manual' && (
          <div className={`p-3 rounded-lg border ${
            complianceItem.status === 'verified' ? 'bg-green-50/80 border-green-200' :
            complianceItem.status === 'warning' ? 'bg-yellow-50/80 border-yellow-200' :
            'bg-red-50/80 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Bot size={12} className={STATUS_ICON[complianceItem.status].cls} />
              <h5 className={`text-xs font-semibold uppercase tracking-wide ${STATUS_ICON[complianceItem.status].cls}`}>
                Agent Finding
              </h5>
            </div>
            <p className="text-sm leading-relaxed text-gray-800">{complianceItem.reason}</p>
            {docGap && (
              <div className="mt-2 pt-2 border-t border-gray-200/50 space-y-1">
                <p className="text-xs"><span className="font-semibold text-gray-700">SAO will request:</span> {docGap.documentName}</p>
                <p className="text-xs text-gray-600"><span className="font-semibold text-gray-700">Must contain:</span> {docGap.mustContain}</p>
                <p className="text-xs text-gray-600"><span className="font-semibold text-gray-700">Prep time:</span> {docGap.prepTimeEstimate}</p>
                {docGap.templateAvailable && (
                  <p className="text-xs text-blue-700">{docGap.templateNote}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Why It Matters */}
        <div>
          <h5 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1.5">Why It Matters</h5>
          <p className="text-sm text-blue-900 leading-relaxed">{detail.whyItMatters}</p>
        </div>

        {/* How to Comply */}
        <div>
          <h5 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1.5">How to Comply</h5>
          <ol className="list-decimal list-inside space-y-1">
            {detail.howToComply.map((step, i) => (
              <li key={i} className="text-sm text-blue-900 leading-relaxed">{step}</li>
            ))}
          </ol>
        </div>

        {/* What to Have Ready */}
        <div>
          <h5 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1.5">What to Have Ready</h5>
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
            <h5 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1.5">Resources</h5>
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
    activeMonth,
    auditChecklists,
    updateAuditChecklist,
    markAuditReviewed,
    schoolId,
    auditAgentsLastRun,
    auditReadinessScore,
    auditReadinessGrade,
    setAuditMeta,
    setAgentFindings,
    agentFindings,
    monthlySnapshots,
  } = useStore()

  const printRef = useRef<HTMLDivElement>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Agent state
  const [agentPhase, setAgentPhase] = useState<'idle' | 'compliance' | 'federal' | 'docs' | 'coordinator' | 'done'>('idle')
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>([])
  const [docGaps, setDocGaps] = useState<DocGap[]>([])
  const [assessment, setAssessment] = useState<ReadinessAssessment | null>(null)
  const [agentError, setAgentError] = useState<string | null>(null)
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const hasTriggered = useRef(false)

  const monthLabel = labelFromKey(activeMonth)
  const hasData = financialData.categories.length > 0
  const isRunning = agentPhase !== 'idle' && agentPhase !== 'done'

  // ── Run audit agents ─────────────────────────────────────────────────────

  const runAuditAgents = useCallback(async () => {
    if (!schoolId || !hasData) return
    setAgentError(null)

    try {
      // Phase 1: Compliance verification
      setAgentPhase('compliance')
      const compRes = await fetch('/api/agents/audit-compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, activeMonth }),
      })
      if (!compRes.ok) throw new Error('Compliance verification failed')
      const { items }: { items: ComplianceItem[] } = await compRes.json()
      setComplianceItems(items)

      // Phase 2: Federal programs (parallel with docs)
      setAgentPhase('federal')
      const [fedRes] = await Promise.all([
        fetch('/api/agents/audit-federal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolId,
            activeMonth,
            grants,
            totalBudget: financialData.totalBudget,
            ytdSpending: financialData.ytdSpending,
          }),
        }),
      ])

      const fedData = fedRes.ok ? await fedRes.json() : { findings: 0 }

      // Phase 3: Documentation gap analysis (for flagged items)
      setAgentPhase('docs')
      const gaps = items.filter((i) => i.status === 'warning' || i.status === 'action')
      let parsedDocGaps: DocGap[] = []
      if (gaps.length > 0) {
        const docsRes = await fetch('/api/agents/audit-docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gaps }),
        })
        if (docsRes.ok) {
          const docsData = await docsRes.json()
          parsedDocGaps = docsData.docGaps ?? []
        }
      }
      setDocGaps(parsedDocGaps)

      // Phase 4: Coordinator synthesis
      setAgentPhase('coordinator')

      // Reload agent findings to get federal findings
      const fedFindings = agentFindings
        .filter((f) => f.agentName === 'audit_federal')
        .map((f) => ({ severity: f.severity, title: f.title, summary: f.summary }))

      // Also include any freshly written federal findings
      if (fedData.findings > 0 && fedFindings.length === 0) {
        // Fetch fresh from server since store may not have updated yet
        // Use the items we already have
      }

      const coordRes = await fetch('/api/agents/audit-coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: schoolProfile.name,
          complianceItems: items,
          docGaps: parsedDocGaps,
          federalFindings: fedFindings,
        }),
      })

      if (coordRes.ok) {
        const readiness: ReadinessAssessment = await coordRes.json()
        setAssessment(readiness)

        // Save audit meta
        const now = new Date().toISOString()
        setAuditMeta({ lastRun: now, score: readiness.score, grade: readiness.grade })

        // Persist coordinator output to agent_findings
        const { supabase } = await import('@/lib/supabase')

        // Delete old coordinator finding, then insert new one
        await supabase
          .from('agent_findings')
          .delete()
          .eq('school_id', schoolId)
          .eq('agent_name', 'audit_coordinator')

        await supabase.from('agent_findings').insert({
          school_id: schoolId,
          agent_name: 'audit_coordinator',
          finding_type: 'audit_verified',
          severity: 'info',
          title: `Readiness Assessment: ${readiness.grade} (${readiness.score}/100)`,
          summary: readiness.executiveSummary,
          detail: {
            score: readiness.score,
            grade: readiness.grade,
            priorityActions: readiness.priorityActions,
            executiveSummary: readiness.executiveSummary,
            categoryStatus: readiness.categoryStatus,
            estimatedTimeToReady: readiness.estimatedTimeToReady,
          },
          expires_at: null,
        })

        // Refresh agent findings in store
        const { data: freshFindings } = await supabase
          .from('agent_findings')
          .select('*')
          .eq('school_id', schoolId)
          .in('agent_name', ['audit_compliance', 'audit_federal', 'audit_coordinator'])
          .order('created_at', { ascending: false })

        if (freshFindings) {
          // Merge with existing non-audit findings
          const nonAuditFindings = agentFindings.filter(
            (f) => f.agentName !== 'audit_compliance' && f.agentName !== 'audit_federal' && f.agentName !== 'audit_coordinator'
          )
          setAgentFindings([
            ...nonAuditFindings,
            ...freshFindings.map((r: Record<string, unknown>) => ({
              id: r.id as string,
              agentName: r.agent_name as ComplianceItem['status'],
              findingType: r.finding_type as string,
              severity: r.severity as string,
              title: r.title as string,
              summary: r.summary as string,
              detail: (r.detail as Record<string, unknown>) ?? {},
              expiresAt: (r.expires_at as string) ?? null,
              createdAt: r.created_at as string,
            })),
          ] as typeof agentFindings)
        }
      }

      setAgentPhase('done')
    } catch (err) {
      console.error('[audit-agents]', err)
      setAgentError(err instanceof Error ? err.message : 'Audit agent analysis failed')
      setAgentPhase('done')
    }
  }, [schoolId, hasData, activeMonth, grants, financialData, schoolProfile.name, agentFindings, setAuditMeta, setAgentFindings])

  // Auto-trigger ONLY on first visit (no baseline exists)
  useEffect(() => {
    if (hasTriggered.current || !isLoaded || !hasData || !schoolId) return
    if (auditAgentsLastRun) return // Baseline exists — show cached data, don't auto-run

    hasTriggered.current = true
    runAuditAgents()
  }, [isLoaded, hasData, schoolId, auditAgentsLastRun, runAuditAgents])

  // Load cached compliance data from agent_findings when baseline exists (no agent run needed)
  const hasCacheLoaded = useRef(false)
  useEffect(() => {
    if (hasCacheLoaded.current || !isLoaded || !schoolId || !auditAgentsLastRun) return
    if (agentFindings.length === 0) return // Store hasn't loaded findings yet

    hasCacheLoaded.current = true

    // Populate compliance items from cached agent_findings
    const auditFindings = agentFindings.filter((f) => f.agentName === 'audit_compliance')
    if (auditFindings.length > 0 && complianceItems.length === 0) {
      const items: ComplianceItem[] = auditFindings.map((f) => ({
        item: f.title,
        category: (f.detail?.category as string) ?? '',
        status: (f.detail?.status as ItemStatus) ?? 'manual',
        reason: f.summary,
      }))
      setComplianceItems(items)
    }

    // Populate cached assessment from coordinator finding
    const coordFinding = agentFindings.find((f) => f.agentName === 'audit_coordinator')
    if (coordFinding && !assessment) {
      const d = coordFinding.detail
      setAssessment({
        score: (d.score as number) ?? auditReadinessScore ?? 0,
        grade: (d.grade as string) ?? auditReadinessGrade ?? 'F',
        priorityActions: (d.priorityActions as ReadinessAssessment['priorityActions']) ?? [],
        executiveSummary: (d.executiveSummary as string) ?? coordFinding.summary ?? '',
        categoryStatus: (d.categoryStatus as ReadinessAssessment['categoryStatus']) ?? [],
        estimatedTimeToReady: (d.estimatedTimeToReady as string) ?? '',
      })
    } else if (!coordFinding && auditReadinessScore != null && auditReadinessGrade && !assessment) {
      // Fallback: no coordinator finding but we have score/grade from schools table
      setAssessment({
        score: auditReadinessScore,
        grade: auditReadinessGrade,
        priorityActions: [],
        executiveSummary: '',
        categoryStatus: [],
        estimatedTimeToReady: '',
      })
    }
  }, [isLoaded, schoolId, auditAgentsLastRun, agentFindings, complianceItems.length, auditReadinessScore, auditReadinessGrade, assessment])

  // Stale data check (30+ days)
  const isStale = auditAgentsLastRun
    ? (Date.now() - new Date(auditAgentsLastRun).getTime()) > 30 * 86_400_000
    : false

  // Most recent upload date
  const mostRecentUpload = Object.values(monthlySnapshots)
    .map((s) => s.uploadedAt)
    .sort()
    .pop()

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getChecklist = (key: string) =>
    auditChecklists.find((c) => c.category === key) || {
      category: key, checkedItems: [], reviewedAt: null, reviewerNote: '',
    }

  const getItemStatus = (item: string): ItemStatus => {
    const ci = complianceItems.find((c) => c.item === item)
    return ci?.status ?? 'manual'
  }

  const getItemComplianceData = (item: string) =>
    complianceItems.find((c) => c.item === item)

  const getItemDocGap = (item: string) =>
    docGaps.find((d) => d.item === item)

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

  // Category status based on AI verification
  const getCategoryStatus = (catKey: string) => {
    const catItems = complianceItems.filter((i) => i.category === catKey)
    if (catItems.length === 0) return 'not-started' as const
    const hasAction = catItems.some((i) => i.status === 'action')
    const hasWarning = catItems.some((i) => i.status === 'warning')
    const verifiedCount = catItems.filter((i) => i.status === 'verified').length
    if (hasAction) return 'at-risk' as const
    if (hasWarning) return 'needs-attention' as const
    if (verifiedCount === 0) return 'not-started' as const
    const allVerified = catItems.every((i) => i.status === 'verified')
    if (allVerified) return 'ready' as const
    return 'in-progress' as const
  }

  const STATUS_CFG = {
    ready: { label: 'Ready', cls: 'bg-green-100 text-green-800' },
    'in-progress': { label: 'In Progress', cls: 'bg-blue-100 text-blue-800' },
    'needs-attention': { label: 'Needs Attention', cls: 'bg-yellow-100 text-yellow-800' },
    'at-risk': { label: 'At Risk', cls: 'bg-red-100 text-red-800' },
    'not-started': { label: 'Not Started', cls: 'bg-gray-100 text-gray-600' },
  } as const

  // ── Export PDF ──────────────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    if (!printRef.current) return
    setExporting(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')
      const canvas = await html2canvas(printRef.current, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff', logging: false })
      const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' })
      const pW = pdf.internal.pageSize.getWidth()
      const pH = pdf.internal.pageSize.getHeight()
      const M = 36, HDR = 32, FTR = 28
      const TOP = M + HDR, BOT = pH - M - FTR, UH = BOT - TOP, CW = pW - 2 * M
      const ratio = CW / canvas.width
      let yPx = 0, page = 1
      const hf = (n: number) => {
        pdf.setFontSize(7.5); pdf.setTextColor(150, 150, 150)
        pdf.text(`${schoolProfile.name}  ·  SAO Audit Readiness Report  ·  ${monthLabel}`, M, M + 14)
        pdf.setDrawColor(220, 220, 220); pdf.setLineWidth(0.5)
        pdf.line(M, M + 20, pW - M, M + 20); pdf.line(M, BOT + 8, pW - M, BOT + 8)
        pdf.text(`Page ${n}`, pW / 2, BOT + 20, { align: 'center' })
      }
      hf(page)
      while (yPx < canvas.height) {
        const sh = Math.min(UH / ratio, canvas.height - yPx)
        const sc = document.createElement('canvas'); sc.width = canvas.width; sc.height = sh
        sc.getContext('2d')!.drawImage(canvas, 0, yPx, canvas.width, sh, 0, 0, canvas.width, sh)
        pdf.addImage(sc.toDataURL('image/png'), 'PNG', M, TOP, CW, sh * ratio)
        yPx += sh
        if (yPx < canvas.height) { pdf.addPage(); page++; hf(page) }
      }
      pdf.save(`${schoolProfile.name.replace(/\s+/g, '_')}_SAO_Audit_Report_${activeMonth}.pdf`)
    } catch (err) { console.error('PDF export error:', err) }
    finally { setExporting(false) }
  }

  // ── Loading / empty states ──────────────────────────────────────────────────

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
        <h2 className="text-xl font-semibold text-gray-800" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
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

  // Derived
  const categoryStatuses = AUDIT_CATEGORIES.map((cat) =>
    complianceItems.length > 0 ? getCategoryStatus(cat.key) : 'not-started' as const
  )
  const readyCount = categoryStatuses.filter((s) => s === 'ready').length
  const inProgressCount = categoryStatuses.filter((s) => s === 'in-progress').length
  const atRiskCount = categoryStatuses.filter((s) => s === 'at-risk').length
  const needsAttentionCount = categoryStatuses.filter((s) => s === 'needs-attention').length
  const notStartedCount = categoryStatuses.filter((s) => s === 'not-started').length

  const gradeColor = assessment ? {
    A: 'text-green-600', B: 'text-blue-600', C: 'text-yellow-600', D: 'text-orange-600', F: 'text-red-600',
  }[assessment.grade] ?? 'text-gray-600' : 'text-gray-400'

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl space-y-8" ref={printRef}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            Audit Prep
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
            WA State Auditor&apos;s Office charter school accountability audit areas
          </p>
          {auditAgentsLastRun && !isRunning && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Last assessed: {new Date(auditAgentsLastRun).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
              {mostRecentUpload && (
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Based on data uploaded through {new Date(mostRecentUpload).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2" data-html2canvas-ignore>
          <button
            onClick={() => { hasTriggered.current = true; runAuditAgents() }}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}
          >
            {isRunning ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {isRunning ? 'Analyzing...' : 'Re-run Assessment'}
          </button>
          {(assessment || complianceItems.length > 0) && (
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

      {/* Stale data warning */}
      {isStale && !isRunning && (
        <div className="flex items-center gap-2 p-3.5 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
          <AlertTriangle size={15} className="shrink-0" />
          Assessment is 30+ days old. Click <strong>Re-run Assessment</strong> for current results.
        </div>
      )}

      {/* Agent running indicator */}
      {isRunning && (
        <div className="ai-briefing px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Bot size={15} style={{ color: 'var(--brand-500)' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-500)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
              {!auditAgentsLastRun ? 'Running Initial Assessment...' : 'Audit Agent Team'}
            </span>
            <Loader2 size={13} className="animate-spin" style={{ color: 'var(--brand-400)' }} />
          </div>
          {(() => {
            const phase = agentPhase as string
            return (
              <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className={phase === 'compliance' ? 'font-semibold text-gray-800' : 'text-green-600'}>
                  {phase === 'compliance' ? '● Verifying compliance...' : '✓ Compliance'}
                </span>
                <span className={phase === 'federal' ? 'font-semibold text-gray-800' : ['docs', 'coordinator', 'done'].includes(phase) ? 'text-green-600' : ''}>
                  {phase === 'federal' ? '● Federal programs...' : ['docs', 'coordinator', 'done'].includes(phase) ? '✓ Federal' : '○ Federal'}
                </span>
                <span className={phase === 'docs' ? 'font-semibold text-gray-800' : ['coordinator', 'done'].includes(phase) ? 'text-green-600' : ''}>
                  {phase === 'docs' ? '● Doc gaps...' : ['coordinator', 'done'].includes(phase) ? '✓ Docs' : '○ Docs'}
                </span>
                <span className={phase === 'coordinator' ? 'font-semibold text-gray-800' : phase === 'done' ? 'text-green-600' : ''}>
                  {phase === 'coordinator' ? '● Synthesizing...' : phase === 'done' ? '✓ Complete' : '○ Synthesis'}
                </span>
              </div>
            )
          })()}
        </div>
      )}

      {agentError && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {agentError}
        </div>
      )}

      {/* AI Readiness Assessment Card */}
      {assessment && (
        <div className="ai-briefing px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--accent-500) 100%)' }}>
              <span className="text-white text-xs font-bold" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>AI</span>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-500)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
              Readiness Assessment
            </span>
            {auditAgentsLastRun && (
              <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                Last assessed: {new Date(auditAgentsLastRun).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-6 mb-5">
            <div className="text-center">
              <div className={`text-5xl font-bold ${gradeColor}`} style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
                {assessment.score}
              </div>
              <div className={`text-lg font-bold ${gradeColor}`} style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
                {assessment.grade}
              </div>
            </div>
            <div className="flex-1">
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${assessment.score}%`,
                    background: assessment.score >= 80 ? '#22c55e' : assessment.score >= 60 ? '#eab308' : assessment.score >= 40 ? '#f97316' : '#ef4444',
                  }}
                />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Estimated time to full readiness: {assessment.estimatedTimeToReady}
              </p>
            </div>
          </div>

          {/* Priority Actions */}
          {assessment.priorityActions.length > 0 && (
            <div className="mb-4 p-4 bg-orange-50/80 border border-orange-200 rounded-lg">
              <h4 className="text-xs font-semibold text-orange-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <AlertTriangle size={12} />
                Top 3 Priority Actions
              </h4>
              <ol className="list-decimal list-inside space-y-1.5">
                {assessment.priorityActions.slice(0, 3).map((pa, i) => (
                  <li key={i} className="text-sm text-orange-900">
                    {pa.action}
                    <span className="text-xs text-orange-600 ml-1">({pa.timeEstimate})</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Executive Summary (collapsible) */}
          <div>
            <button
              onClick={() => setSummaryExpanded(!summaryExpanded)}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-1"
              style={{ color: 'var(--brand-500)' }}
              data-html2canvas-ignore
            >
              Executive Summary
              {summaryExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {summaryExpanded && (
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
                {assessment.executiveSummary}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Readiness Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="card-static p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: 'var(--brand-700)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            {readyCount}/{AUDIT_CATEGORIES.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Ready</div>
        </div>
        <div className="card-static p-4 text-center">
          <div className="text-2xl font-bold text-blue-600" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            {inProgressCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">In Progress</div>
        </div>
        <div className="card-static p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            {needsAttentionCount}
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
            {notStartedCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">Not Started</div>
        </div>
      </div>

      {/* SAO context banner */}
      <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs leading-relaxed">
        Based on WA State Auditor&apos;s Office published charter school accountability audit focus areas.
        {complianceItems.length > 0
          ? ` AI agents have verified ${complianceItems.filter((i) => i.status === 'verified').length} items from your data. Items marked "Manual Review" require human assessment.`
          : ' Click any checklist item to see detailed guidance on why it matters, how to comply, and what documentation to have ready.'}
      </div>

      {/* Audit Category Cards */}
      <div className="space-y-3">
        {AUDIT_CATEGORIES.map((cat, idx) => {
          const cl = getChecklist(cat.key)
          const status = categoryStatuses[idx]
          const cfg = STATUS_CFG[status]
          const expanded = expandedCategory === cat.key
          const Icon = cat.icon
          const catComplianceItems = complianceItems.filter((i) => i.category === cat.key)
          const verifiedCount = catComplianceItems.filter((i) => i.status === 'verified').length
          const gapCount = catComplianceItems.filter((i) => i.status === 'warning' || i.status === 'action').length

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
                    <h3 className="text-sm font-semibold text-gray-800" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
                      {cat.label}
                    </h3>
                    <span className={`inline-flex text-xs px-3 py-1 rounded-full font-medium ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{cat.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {catComplianceItems.length > 0 && (
                    <span className="text-xs text-gray-500">
                      <span className="text-green-600 font-medium">{verifiedCount}✓</span>
                      {gapCount > 0 && <span className="text-red-500 font-medium ml-1">{gapCount}!</span>}
                    </span>
                  )}
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden hidden sm:block">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: catComplianceItems.length > 0
                          ? `${(verifiedCount / cat.checklistItems.length) * 100}%`
                          : `${(cl.checkedItems.length / cat.checklistItems.length) * 100}%`,
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
                    const itemStatus = getItemStatus(item)
                    const checked = cl.checkedItems.includes(item)
                    const isDetailOpen = expandedItem === item
                    const hasDetail = !!getChecklistItemDetail(item)
                    const compData = getItemComplianceData(item)
                    const docGapData = getItemDocGap(item)

                    return (
                      <div key={item}>
                        <div className="flex items-start gap-3 py-2 group">
                          {/* Status icon or checkbox for manual items */}
                          {complianceItems.length > 0 && itemStatus !== 'manual' ? (
                            <div className="mt-0.5 shrink-0">
                              <StatusBadge status={itemStatus} />
                            </div>
                          ) : (
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleItem(cat.key, item)}
                              className="mt-1 w-4 h-4 rounded border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]/20 cursor-pointer shrink-0"
                            />
                          )}
                          {/* Clickable label */}
                          <button
                            onClick={() => hasDetail && toggleItemDetail(item)}
                            className={`flex-1 text-left flex items-start gap-2 ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <span className={`text-sm leading-relaxed ${
                              itemStatus === 'verified' ? 'text-green-800' :
                              itemStatus === 'action' ? 'text-red-800' :
                              itemStatus === 'warning' ? 'text-yellow-800' :
                              checked ? 'text-gray-400 line-through' : 'text-gray-700'
                            } ${hasDetail ? 'group-hover:text-gray-900' : ''} transition-colors`}>
                              {item}
                            </span>
                          </button>
                          {hasDetail && (
                            <button
                              onClick={() => toggleItemDetail(item)}
                              className="mt-0.5 shrink-0 text-gray-300 hover:text-blue-500 transition-all"
                            >
                              <ChevronRight size={14} className={`transition-transform duration-200 ${isDetailOpen ? 'rotate-90' : ''}`} />
                            </button>
                          )}
                        </div>
                        {isDetailOpen && (
                          <ItemDetailPanel
                            itemText={item}
                            complianceItem={compData}
                            docGap={docGapData}
                          />
                        )}
                      </div>
                    )
                  })}

                  {/* Reviewer note */}
                  <div className="pt-3" data-html2canvas-ignore>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Reviewer Notes</label>
                    <textarea
                      value={cl.reviewerNote}
                      onChange={(e) => handleNoteChange(cat.key, e.target.value)}
                      placeholder="Add notes about this audit area..."
                      rows={2}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/12 focus:border-[#1e3a5f] bg-white resize-none"
                    />
                  </div>

                  {/* Mark Reviewed */}
                  <div className="flex items-center gap-3 pt-1" data-html2canvas-ignore>
                    <button
                      onClick={() => markAuditReviewed(cat.key)}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        cl.reviewedAt ? 'bg-green-50 text-green-700 border border-green-200' : 'text-white hover:opacity-90'
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
                        {new Date(cl.reviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
