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
} from 'lucide-react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { getFiscalMonths, fiscalIndexFromKey, paceFromKey } from '@/lib/fiscalYear'

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

// WA OSPI payment schedule — % of annual allocation per calendar month.
// WA State fiscal year — September 1 start. Update when adding multi-state support.
const OSPI_PCT: Record<string, number> = {
  '09': 9.0,  '10': 8.0,  '11': 5.0,  '12': 9.0,
  '01': 8.5,  '02': 9.0,  '03': 9.0,  '04': 9.0,
  '05': 5.0,  '06': 6.0,  '07': 12.5, '08': 10.0,
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
          body: JSON.stringify({ schoolProfile, financialData, alerts, pacePercent, monthLabel }),
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
  }, [cacheKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Show spinner only when actively loading with no data to display yet
  if (!isLoaded && Object.keys(monthlySnapshots).length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isLoaded && Object.keys(monthlySnapshots).length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="text-4xl mb-4">📊</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">No financial data yet</h1>
        <p className="text-gray-500 text-sm mb-6">
          Upload your first budget file to see your Morning Briefing dashboard.
        </p>
        <Link
          href="/upload"
          className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-white rounded-xl"
          style={{ backgroundColor: '#1e3a5f' }}
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
    const sumOspi = months.reduce((s, fm) => s + (OSPI_PCT[fm.key.slice(5, 7)] ?? 8.33), 0)
    spendData = months.map((fm) => {
      const pct = OSPI_PCT[fm.key.slice(5, 7)] ?? 8.33
      const amount = sumOspi > 0 ? Math.round(totalActuals * (pct / sumOspi)) : 0
      const budget = Math.round((totalBudget * pct) / 100)
      return { month: fm.shortLabel, amount, budget }
    })
  }

  // Projections chart
  const projTotalBudget = financialData.totalBudget
  const snapshotsByFiscalIndex = Object.values(monthlySnapshots).sort(
    (a, b) => fiscalIndexFromKey(a.month) - fiscalIndexFromKey(b.month)
  )
  const lastSnap = snapshotsByFiscalIndex[snapshotsByFiscalIndex.length - 1]
  const lastFiscalIdx = lastSnap ? fiscalIndexFromKey(lastSnap.month) : 0
  const projectionChartData = getFiscalMonths().map((fm) => {
    const snap = monthlySnapshots[fm.key]
    const cumulativeBudget = Math.round((projTotalBudget * fm.fiscalIndex) / 12)
    const actual = snap ? snap.financialSummary.totalActuals : null
    let projected: number | null = null
    if (lastSnap && lastFiscalIdx > 0 && fm.fiscalIndex >= lastFiscalIdx) {
      projected = Math.round((lastSnap.financialSummary.totalActuals / lastFiscalIdx) * fm.fiscalIndex)
    }
    return { month: fm.shortLabel, budget: cumulativeBudget, actual, projected }
  })

  // Briefing rendering — split on last → to bold the action
  const arrowIdx = briefing.lastIndexOf('→')
  const briefingMain = arrowIdx >= 0 ? briefing.slice(0, arrowIdx).trim() : briefing.trim()
  const briefingAction = arrowIdx >= 0 ? briefing.slice(arrowIdx + 1).trim() : ''

  return (
    <div className="space-y-5 max-w-6xl">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Morning Briefing</h1>
            <p className="text-gray-500 mt-0.5 text-sm">{today}</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${healthScore.color}`}>
            {healthScore.label}
          </span>
        </div>
        {availableMonths.length > 1 && (
          <select
            value={activeMonth}
            onChange={(e) => setActiveMonth(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 bg-white"
          >
            {availableMonths.map((fm) => (
              <option key={fm.key} value={fm.key}>{fm.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── AI Morning Briefing ───────────────────────────────────────────── */}
      <div
        className="bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 p-5"
        style={{ borderLeftColor: '#1e3a5f' }}
      >
        {briefingLoading ? (
          <div className="space-y-2.5 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-11/12" />
            <div className="h-4 bg-gray-200 rounded w-4/6" />
          </div>
        ) : briefingError ? (
          <p className="text-sm text-gray-500 italic">
            AI briefing unavailable — check that your ANTHROPIC_API_KEY is configured. Budget analysis and alerts below reflect the current financial position.
          </p>
        ) : briefing ? (
          <p className="text-sm text-gray-700 leading-relaxed">
            {briefingMain}
            {briefingAction && (
              <span className="font-semibold text-gray-900"> → {briefingAction}</span>
            )}
          </p>
        ) : (
          <div className="space-y-2.5 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-11/12" />
            <div className="h-4 bg-gray-200 rounded w-4/6" />
          </div>
        )}
      </div>

      {/* ── Key Metrics Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Card 1 — Cash Position */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cash Position</p>
            <div className={`w-2.5 h-2.5 rounded-full mt-0.5 ${
              financialData.daysOfReserves >= 60 ? 'bg-green-500' :
              financialData.daysOfReserves >= 30 ? 'bg-yellow-400' : 'bg-red-500'
            }`} />
          </div>
          <p className="text-3xl font-bold text-gray-900">{fmt(financialData.cashOnHand)}</p>
          <p className="text-sm text-gray-500 mt-1">
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Budget Pace</p>
            <TrendingUp className="text-gray-400" size={16} />
          </div>
          <p className="text-3xl font-bold text-gray-900">{burnPct}%</p>
          <p className="text-sm text-gray-500 mt-1">of annual budget spent</p>
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
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 block hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Alerts</p>
            <AlertTriangle className={alerts.length > 0 ? 'text-amber-500' : 'text-gray-300'} size={16} />
          </div>
          <p className="text-3xl font-bold text-gray-900">{alerts.length}</p>
          <p className="text-sm text-gray-500 mt-1">items need attention</p>
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
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 block hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Next Board Meeting</p>
            <Calendar className="text-gray-400" size={16} />
          </div>
          <p className="text-3xl font-bold text-gray-900">{fmtShort(schoolProfile.nextBoardMeeting)}</p>
          <p className="text-sm text-gray-500 mt-1">
            {boardMeetingDays != null
              ? boardMeetingDays > 0
                ? `${boardMeetingDays} days away`
                : boardMeetingDays === 0
                ? 'Today'
                : `${Math.abs(boardMeetingDays)} days ago`
              : fmtDate(schoolProfile.nextBoardMeeting)}
          </p>
          <p className="text-xs mt-1.5 font-medium text-gray-500">
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
                className="bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 p-4"
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

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/board-packet"
          className="flex items-center justify-center gap-2 text-white rounded-xl px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          <FileText size={16} />
          Generate Board Packet
        </Link>
        <Link
          href="/ask-cfo"
          className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-xl px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
        >
          <MessageSquare size={16} />
          Ask Your CFO
        </Link>
        <Link
          href="/upload"
          className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-xl px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Upload size={16} />
          Upload New Data
        </Link>
      </div>

      {/* ── Charts ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Spend Rate</h2>
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
              <Tooltip formatter={(v) => (v != null ? fmt(Number(v)) : '—')} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="budget" stroke="#94a3b8" fill="none" strokeDasharray="4 4" name="Budget" />
              <Area type="monotone" dataKey="amount" stroke="#1e3a5f" fill="url(#actualGrad)" strokeWidth={2} name="Actual" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Projections</h2>
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
              <Tooltip formatter={(v) => (v != null ? fmt(Number(v)) : '—')} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="budget" stroke="#94a3b8" fill="none" strokeDasharray="4 4" name="Budget" />
              <Area type="monotone" dataKey="actual" stroke="#1e3a5f" fill="none" strokeWidth={2} name="Actual" connectNulls={false} />
              <Area type="monotone" dataKey="projected" stroke="#ef4444" fill="url(#projGrad)" strokeDasharray="5 3" strokeWidth={2} name="Projected" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Budget vs. Actuals by Category</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={financialData.categories}
            layout="vertical"
            margin={{ top: 0, right: 16, left: 100, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `$${v / 1000}K`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={95} />
            <Tooltip formatter={(v) => (v != null ? fmt(Number(v)) : '—')} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="budget" fill="#e2e8f0" name="Budget" radius={[0, 2, 2, 0]} />
            <Bar dataKey="ytdActuals" fill="#1e3a5f" name="YTD Actuals" radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
