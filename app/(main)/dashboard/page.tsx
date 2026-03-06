'use client'

import { useState, useEffect, useRef } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  AlertTriangle,
  TrendingUp,
  Calendar,
  FileText,
  MessageSquare,
  Upload,
  ChevronRight,
  Bot,
} from 'lucide-react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { getFiscalMonths, fiscalIndexFromKey, paceFromKey, OSPI_PCT, DEFAULT_OSPI_PCT } from '@/lib/fiscalYear'

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function fmtShort(s: string | undefined | null): string {
  if (!s) return '—'
  const d = new Date(s + 'T12:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDate(s: string | undefined | null): string {
  if (!s) return '—'
  const d = new Date(s + 'T12:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function daysUntil(s: string | undefined | null): number | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  if (isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}


const alertStatusConfig = {
  action:  { label: 'Action Required', borderColor: '#ef4444', bg: 'bg-red-50',    badge: 'bg-red-100 text-red-800',    icon: 'text-red-500' },
  concern: { label: 'Concern',         borderColor: '#f97316', bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-800', icon: 'text-orange-500' },
  watch:   { label: 'Watch',           borderColor: '#eab308', bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-800', icon: 'text-yellow-600' },
} as const

export default function DashboardPage() {
  const {
    schoolProfile,
    financialData,
    alerts,
    monthlySnapshots,
    activeMonth,
    setActiveMonth,
    boardPackets,
    isLoaded,
    schoolContextEntries,
    agentFindings,
    lastAgentRunAt,
  } = useStore()

  const [briefing, setBriefing] = useState('')
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingError, setBriefingError] = useState(false)
  const fetchedForRef = useRef<string | null>(null)

  const activeSnap = monthlySnapshots[activeMonth]
  const cacheKey = `${activeMonth}:${activeSnap?.uploadedAt ?? ''}`

  useEffect(() => {
    if (Object.keys(monthlySnapshots).length === 0) return
    if (fetchedForRef.current === cacheKey) return
    fetchedForRef.current = cacheKey

    const fetchBriefing = async () => {
      const stored = sessionStorage.getItem(`briefing:${cacheKey}`)
      if (stored) {
        setBriefing(stored)
        setBriefingError(false)
        return
      }

      setBriefingLoading(true)
      setBriefing('')
      setBriefingError(false)

      const pacePercent = Math.round(paceFromKey(activeMonth) * 100)
      const monthLabel = activeSnap?.label ?? activeMonth

      try {
        const res = await fetch('/api/briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolProfile, financialData, alerts, pacePercent, monthLabel, schoolContextEntries,
            agentFindings: agentFindings.map((f) => ({
              agent_name: f.agentName.replace(/([A-Z])/g, '_$1').toLowerCase(),
              severity: f.severity,
              title: f.title,
              summary: f.summary,
            })),
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const { briefing: text } = (await res.json()) as { briefing?: string }
        if (text) {
          setBriefing(text)
          sessionStorage.setItem(`briefing:${cacheKey}`, text)
        } else {
          setBriefingError(true)
        }
      } catch (err) {
        console.error('[briefing]', err)
        setBriefingError(true)
      } finally {
        setBriefingLoading(false)
      }
    }

    fetchBriefing()
  }, [cacheKey]) // eslint-disable-line react-hooks/exhaustive-deps -- cacheKey encodes month+uploadedAt; omitting schoolProfile/financialData/alerts avoids re-fetching on unrelated state changes

  // Show spinner only when actively loading with no data to display yet
  if (!isLoaded && Object.keys(monthlySnapshots).length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-[3px] rounded-full animate-spin" style={{ borderColor: 'var(--brand-200)', borderTopColor: 'var(--brand-600)' }} />
      </div>
    )
  }

  if (isLoaded && Object.keys(monthlySnapshots).length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center page-enter">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--brand-50)' }}>
          <Upload size={28} style={{ color: 'var(--brand-500)' }} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>No financial data yet</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-tertiary)' }}>
          Upload your first budget file to see your Morning Briefing dashboard.
        </p>
        <Link
          href="/upload"
          className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white"
          style={{
            background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-display), system-ui, sans-serif',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          Upload your first file
        </Link>
      </div>
    )
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const availableMonths = getFiscalMonths().filter((fm) => monthlySnapshots[fm.key])
  const PACE = paceFromKey(activeMonth)
  const PACE_PCT = Math.round(PACE * 100)

  // Re-derive alert status from burn rate so stale Supabase values don't mislead
  const deriveStatus = (burnRate: number) => {
    const pp = burnRate - PACE_PCT
    if (pp > 20) return 'action' as const
    if (pp > 10) return 'concern' as const
    if (pp > 5 || pp < -20) return 'watch' as const
    return 'ok' as const
  }

  // Health score (use re-derived status so old Supabase data doesn't mislead)
  const hasAction = financialData.categories.some((c) => deriveStatus(c.burnRate) === 'action')
  const hasConcern = financialData.categories.some((c) => deriveStatus(c.burnRate) === 'concern')
  const lowReserves = financialData.daysOfReserves < 30
  const watchReserves = financialData.daysOfReserves < 45
  let healthScore: { label: string; color: string }
  if (hasAction || lowReserves) {
    healthScore = { label: 'At Risk', color: 'bg-red-100 text-red-700' }
  } else if (hasConcern || watchReserves) {
    healthScore = { label: 'Needs Attention', color: 'bg-amber-100 text-amber-700' }
  } else {
    healthScore = { label: 'On Track', color: 'bg-green-100 text-green-700' }
  }

  // Budget pace
  const burnPct =
    financialData.totalBudget > 0
      ? Math.round((financialData.ytdSpending / financialData.totalBudget) * 100)
      : 0
  const paceDelta = burnPct - PACE_PCT

  // Board packet
  const latestPacket = [...boardPackets].sort((a, b) => (a.monthKey > b.monthKey ? -1 : 1))[0]
  const boardMeetingDays = daysUntil(schoolProfile.nextBoardMeeting)
  const packetStatusLabel: Record<string, string> = {
    'not-started': 'Not started',
    draft: 'Draft ready',
    finalized: 'Finalized',
  }

  // Alert counts
  const actionCount = financialData.categories.filter((c) => deriveStatus(c.burnRate) === 'action').length
  const watchConcernCount = financialData.categories.filter(
    (c) => { const s = deriveStatus(c.burnRate); return s === 'concern' || s === 'watch' }
  ).length

  // Enrich alerts with matched category data
  const enrichedAlerts = alerts.slice(0, 4).map((alert) => {
    const matchedCat = financialData.categories.find((cat) =>
      alert.message.toLowerCase().includes(cat.name.toLowerCase())
    )
    const status: keyof typeof alertStatusConfig =
      matchedCat?.alertStatus === 'action'  ? 'action'  :
      matchedCat?.alertStatus === 'concern' ? 'concern' : 'watch'
    return { ...alert, matchedCat, status }
  })

  // Spend chart
  let spendData = financialData.monthlySpend
  if (spendData.length === 0 && activeSnap) {
    const activeIdx = fiscalIndexFromKey(activeMonth)
    const months = getFiscalMonths().filter((fm) => fm.fiscalIndex <= activeIdx)
    const totalActuals = activeSnap.financialSummary.totalActuals
    const totalBudget = activeSnap.financialSummary.totalBudget
    const sumOspi = months.reduce((s, fm) => s + (OSPI_PCT[fm.key.slice(5, 7)] ?? DEFAULT_OSPI_PCT), 0)
    spendData = months.map((fm) => {
      const pct = OSPI_PCT[fm.key.slice(5, 7)] ?? DEFAULT_OSPI_PCT
      const amount = sumOspi > 0 ? Math.round(totalActuals * (pct / sumOspi)) : 0
      const budget = Math.round((totalBudget * pct) / 100)
      return { month: fm.shortLabel, amount, budget }
    })
  }

  // Projections chart — based on active month snapshot only
  const projTotalBudget = financialData.totalBudget
  const activeFiscalIdx = fiscalIndexFromKey(activeMonth)
  const activeYtd = financialData.ytdSpending
  const monthlyRunRate = activeFiscalIdx > 0 ? activeYtd / activeFiscalIdx : 0

  // Build cumulative actual spend from monthlySpend data (or distribute via OSPI weights)
  const cumulativeActuals: Record<number, number> = {}
  if (spendData.length > 0) {
    let running = 0
    const fiscalMonths = getFiscalMonths()
    for (let i = 0; i < Math.min(spendData.length, activeFiscalIdx); i++) {
      running += spendData[i].amount
      cumulativeActuals[fiscalMonths[i].fiscalIndex] = running
    }
  }

  const projectionChartData = getFiscalMonths().map((fm) => {
    const cumulativeBudget = Math.round((projTotalBudget * fm.fiscalIndex) / 12)
    const actual = fm.fiscalIndex <= activeFiscalIdx ? (cumulativeActuals[fm.fiscalIndex] ?? null) : null
    let projected: number | null = null
    if (activeFiscalIdx > 0 && fm.fiscalIndex >= activeFiscalIdx) {
      projected = Math.round(monthlyRunRate * fm.fiscalIndex)
    }
    return { month: fm.shortLabel, budget: cumulativeBudget, actual, projected }
  })

  // Briefing rendering — split on last → to bold the action
  const arrowIdx = briefing.lastIndexOf('→')
  const briefingMain = arrowIdx >= 0 ? briefing.slice(0, arrowIdx).trim() : briefing.trim()
  const briefingAction = arrowIdx >= 0 ? briefing.slice(arrowIdx + 1).trim() : ''

  return (
    <div className="space-y-6 max-w-6xl">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Morning Briefing</h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>{today}</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${healthScore.color}`} style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            {healthScore.label}
          </span>
        </div>
        {availableMonths.length > 1 && (
          <select
            value={activeMonth}
            onChange={(e) => setActiveMonth(e.target.value)}
            className="text-sm px-3 py-1.5 bg-white"
            style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)' }}
          >
            {availableMonths.map((fm) => (
              <option key={fm.key} value={fm.key}>{fm.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── AI Morning Briefing ───────────────────────────────────────────── */}
      <div className="ai-briefing px-6 py-5">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--accent-500) 100%)' }}
          >
            <span className="text-white text-xs font-bold" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>AI</span>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-500)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            CFO Briefing
          </span>
        </div>
        {briefingLoading ? (
          <div className="space-y-2.5">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-11/12" />
            <div className="skeleton h-4 w-4/6" />
          </div>
        ) : briefingError ? (
          <p className="text-sm italic" style={{ color: 'var(--text-tertiary)' }}>
            AI briefing unavailable — check that your ANTHROPIC_API_KEY is configured. Budget analysis and alerts below reflect the current financial position.
          </p>
        ) : briefing ? (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {briefingMain}
            {briefingAction && (
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}> → {briefingAction}</span>
            )}
          </p>
        ) : (
          <div className="space-y-2.5">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-11/12" />
            <div className="skeleton h-4 w-4/6" />
          </div>
        )}
      </div>

      {/* ── Key Metrics Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Card 1 — Cash Position */}
        <div className="card-static p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Cash Position</p>
            <div className={`w-2.5 h-2.5 rounded-full mt-0.5 ${
              financialData.daysOfReserves >= 60 ? 'bg-green-500' :
              financialData.daysOfReserves >= 30 ? 'bg-yellow-400' : 'bg-red-500'
            }`} />
          </div>
          <p className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>{fmt(financialData.cashOnHand)}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {financialData.daysOfReserves} days of operating reserves
          </p>
          <p className={`text-xs mt-1.5 font-medium ${
            financialData.daysOfReserves >= 60 ? 'text-green-600' :
            financialData.daysOfReserves >= 30 ? 'text-amber-600' : 'text-red-600'
          }`}>
            {financialData.daysOfReserves >= 60
              ? '✓ Above 60-day healthy threshold'
              : financialData.daysOfReserves >= 30
              ? '⚠ Monitor closely'
              : '⚠ Below minimum threshold'}
          </p>
        </div>

        {/* Card 2 — Budget Pace */}
        <div className="card-static p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Budget Pace</p>
            <TrendingUp size={16} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>{burnPct}%</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>of annual budget spent</p>
          <p className={`text-xs mt-1.5 font-medium ${
            Math.abs(paceDelta) <= 2  ? 'text-green-600' :
            paceDelta > 5             ? 'text-red-600'   :
            paceDelta > 0             ? 'text-amber-600' : 'text-green-600'
          }`}>
            Expected: {PACE_PCT}%{' '}
            {Math.abs(paceDelta) <= 2
              ? '· On pace ✓'
              : paceDelta > 0
              ? `· +${paceDelta}pp over pace ⚠`
              : `· ${Math.abs(paceDelta)}pp under pace ✓`}
          </p>
        </div>

        {/* Card 3 — Active Alerts (clickable → Budget Analysis) */}
        <Link
          href="/budget-analysis"
          className="card p-5 block"
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Active Alerts</p>
            <AlertTriangle className={alerts.length > 0 ? 'text-amber-500' : 'text-gray-300'} size={16} />
          </div>
          <p className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>{alerts.length}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>items need attention</p>
          {(actionCount > 0 || watchConcernCount > 0) && (
            <p className="text-xs mt-1.5 font-medium">
              {actionCount > 0 && (
                <span className="text-red-600">{actionCount} Action Required</span>
              )}
              {actionCount > 0 && watchConcernCount > 0 && (
                <span className="text-gray-400"> · </span>
              )}
              {watchConcernCount > 0 && (
                <span className="text-amber-600">{watchConcernCount} Watch/Concern</span>
              )}
            </p>
          )}
        </Link>

        {/* Card 4 — Next Board Meeting (clickable → Board Packet) */}
        <Link
          href="/board-packet"
          className="card p-5 block"
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Next Board Meeting</p>
            <Calendar size={16} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>{fmtShort(schoolProfile.nextBoardMeeting)}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {boardMeetingDays != null
              ? boardMeetingDays > 0
                ? `${boardMeetingDays} days away`
                : boardMeetingDays === 0
                ? 'Today'
                : `${Math.abs(boardMeetingDays)} days ago`
              : fmtDate(schoolProfile.nextBoardMeeting)}
          </p>
          <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Packet:{' '}
            <span className={
              latestPacket?.status === 'finalized' ? 'text-green-600' :
              latestPacket?.status === 'draft'     ? 'text-amber-600' : 'text-gray-500'
            }>
              {latestPacket ? packetStatusLabel[latestPacket.status] : 'Not started'}
            </span>
          </p>
        </Link>
      </div>

      {/* ── Alerts Panel ─────────────────────────────────────────────────── */}
      {enrichedAlerts.length > 0 && (
        <div className="space-y-3">
          {enrichedAlerts.map((alert) => {
            const cfg = alertStatusConfig[alert.status]
            return (
              <div
                key={alert.id}
                className="card-static border-l-4 p-4"
                style={{ borderLeftColor: cfg.borderColor }}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`${cfg.icon} shrink-0 mt-0.5`} size={15} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800">{alert.message}</p>
                    {alert.matchedCat?.narrative && (
                      <p className="text-sm text-gray-500 mt-1 leading-snug">
                        {alert.matchedCat.narrative}
                      </p>
                    )}
                  </div>
                  <Link
                    href="/budget-analysis"
                    className="flex items-center gap-0.5 text-xs text-[#1e3a5f] font-medium whitespace-nowrap hover:underline shrink-0 mt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View detail <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            )
          })}
          {alerts.length > 4 && (
            <Link
              href="/budget-analysis"
              className="block text-center text-sm text-[#1e3a5f] font-medium py-1 hover:underline"
            >
              View all {alerts.length} alerts →
            </Link>
          )}
        </div>
      )}

      {/* ── Agent Insights ────────────────────────────────────────────────── */}
      {agentFindings.length > 0 && (
        <div className="card-static p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot size={16} style={{ color: 'var(--brand-500)' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
                AI Agent Insights
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                {agentFindings.length}
              </span>
            </div>
            {lastAgentRunAt && (
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Last run: {new Date(lastAgentRunAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="space-y-2.5">
            {agentFindings.slice(0, 6).map((finding) => {
              const severityCfg = {
                action: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
                concern: { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
                watch: { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
                info: { badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
              }[finding.severity] ?? { badge: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' }

              const agentLabel = finding.agentName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

              return (
                <div key={finding.id} className="flex items-start gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${severityCfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-800">{finding.title}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${severityCfg.badge}`}>
                        {finding.severity}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{finding.summary}</p>
                    <span className="text-[10px] font-medium mt-0.5 inline-block" style={{ color: 'var(--text-tertiary)' }}>{agentLabel}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/board-packet"
          className="flex items-center justify-center gap-2 text-white px-4 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
          style={{
            background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-display), system-ui, sans-serif',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <FileText size={16} />
          Generate Board Packet
        </Link>
        <Link
          href="/ask-cfo"
          className="card-static flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold hover:shadow-md transition-shadow"
          style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}
        >
          <MessageSquare size={16} />
          Ask Your CFO
        </Link>
        <Link
          href="/upload"
          className="card-static flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold hover:shadow-md transition-shadow"
          style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}
        >
          <Upload size={16} />
          Upload New Data
        </Link>
      </div>

      {/* ── Charts ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card-static p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Spend Rate</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={spendData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `$${v / 1000}K`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: unknown) => (v != null ? fmt(Number(v)) : '—')} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="budget" stroke="#94a3b8" fill="none" strokeDasharray="4 4" name="Budget" />
              <Area type="monotone" dataKey="amount" stroke="#1e3a5f" fill="url(#actualGrad)" strokeWidth={2} name="Actual" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card-static p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Projections</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={projectionChartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `$${v / 1000}K`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: unknown) => (v != null ? fmt(Number(v)) : '—')} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="budget" stroke="#94a3b8" fill="none" strokeDasharray="4 4" name="Budget" />
              <Area type="monotone" dataKey="actual" stroke="#1e3a5f" fill="none" strokeWidth={2} name="Actual" connectNulls={false} />
              <Area type="monotone" dataKey="projected" stroke="#ef4444" fill="url(#projGrad)" strokeDasharray="5 3" strokeWidth={2} name="Projected" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-static p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Budget vs. Actuals — Top Categories</h2>
        <ResponsiveContainer width="100%" height={Math.max(200, Math.min(financialData.categories.length, 8) * 40 + 40)}>
          <BarChart
            data={[...financialData.categories].sort((a, b) => b.budget - a.budget).slice(0, 8)}
            layout="vertical"
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => fmt(Number(v))} tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              width={120}
              tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 15) + '…' : v}
            />
            <Tooltip
              formatter={(v: unknown) => (v != null ? fmt(Number(v)) : '—')}
              labelStyle={{ fontWeight: 600, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="budget" fill="#e2e8f0" name="Budget" radius={[0, 3, 3, 0]} barSize={14} />
            <Bar dataKey="ytdActuals" fill="#1e3a5f" name="YTD Actuals" radius={[0, 3, 3, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
