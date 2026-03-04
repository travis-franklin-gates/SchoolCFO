'use client'

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
import { AlertTriangle, TrendingUp, DollarSign, Calendar, Bell } from 'lucide-react'
import { useStore } from '@/lib/store'
import { getFiscalMonths, fiscalIndexFromKey } from '@/lib/fiscalYear'

function fmt(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

function fmtDate(s: string | undefined | null) {
  if (!s) return '—'
  const d = new Date(s + 'T12:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

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

  if (!isLoaded) {
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
        <a
          href="/upload"
          className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-white rounded-xl"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          Upload your first file
        </a>
      </div>
    )
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const activeSnap = monthlySnapshots[activeMonth]
  const availableMonths = getFiscalMonths().filter((fm) => monthlySnapshots[fm.key])

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical')
  const warningAlerts = alerts.filter((a) => a.severity === 'warning')
  const latestPacket = [...boardPackets].sort((a, b) => (a.id > b.id ? -1 : 1))[0]

  // When monthlySpend is empty (real import), synthesize from the active snapshot
  let spendData = financialData.monthlySpend
  if (spendData.length === 0 && activeSnap) {
    const activeIdx = fiscalIndexFromKey(activeMonth)
    const months = getFiscalMonths().filter((fm) => fm.fiscalIndex <= activeIdx)
    const totalActuals = activeSnap.financialSummary.totalActuals
    const totalBudget = activeSnap.financialSummary.totalBudget
    const monthlyBudget = Math.round(totalBudget / 12)
    const monthlyAmount = months.length > 0 ? Math.round(totalActuals / months.length) : 0
    spendData = months.map((fm) => ({ month: fm.shortLabel, amount: monthlyAmount, budget: monthlyBudget }))
  }

  // Health score
  const hasAction = financialData.categories.some((c) => c.alertStatus === 'action')
  const hasConcern = financialData.categories.some((c) => c.alertStatus === 'concern')
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

  // Build cumulative projections chart from all available snapshots
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
      projected = Math.round(
        (lastSnap.financialSummary.totalActuals / lastFiscalIdx) * fm.fiscalIndex
      )
    }

    return { month: fm.shortLabel, budget: cumulativeBudget, actual, projected }
  })

  // Dynamic year-end projection
  const projectedYearEnd =
    lastSnap && lastFiscalIdx > 0
      ? Math.round((lastSnap.financialSummary.totalActuals * 12) / lastFiscalIdx)
      : null
  const projectedOverUnder =
    projectedYearEnd != null ? projectedYearEnd - projTotalBudget : null

  const packetStatusColor: Record<string, string> = {
    'not-started': 'bg-gray-100 text-gray-600',
    draft: 'bg-yellow-100 text-yellow-800',
    finalized: 'bg-green-100 text-green-800',
  }
  const packetStatusLabel: Record<string, string> = {
    'not-started': 'Not Started',
    draft: 'Draft',
    finalized: 'Finalized',
  }

  const metricCards = [
    {
      label: 'YTD Spending',
      value: fmt(financialData.ytdSpending),
      sub: `${((financialData.ytdSpending / financialData.totalBudget) * 100).toFixed(1)}% of annual budget`,
      icon: TrendingUp,
      iconBg: 'bg-orange-100',
      accent: 'text-orange-500',
    },
    {
      label: 'Total Budget',
      value: fmt(financialData.totalBudget),
      sub: 'Annual allocation',
      icon: DollarSign,
      iconBg: 'bg-blue-100',
      accent: 'text-blue-600',
    },
    {
      label: 'Projected Year-End',
      value: projectedYearEnd != null ? fmt(projectedYearEnd) : '—',
      sub:
        projectedOverUnder != null
          ? projectedOverUnder >= 0
            ? `+${fmt(projectedOverUnder)} over budget`
            : `${fmt(Math.abs(projectedOverUnder))} under budget`
          : 'No data yet',
      icon: Calendar,
      iconBg: projectedOverUnder != null && projectedOverUnder > 0 ? 'bg-red-100' : 'bg-green-100',
      accent:
        projectedOverUnder != null && projectedOverUnder > 0
          ? 'text-red-500'
          : 'text-green-500',
    },
    {
      label: 'Active Alerts',
      value: String(alerts.length),
      sub: `${criticalAlerts.length} critical`,
      icon: Bell,
      iconBg: 'bg-red-100',
      accent: 'text-red-500',
    },
  ]

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Morning Briefing</h1>
            <p className="text-gray-500 mt-1 text-sm">{today}</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${healthScore.color}`}>
            {healthScore.label}
          </span>
        </div>
        {availableMonths.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Viewing:</span>
            <select
              value={activeMonth}
              onChange={(e) => setActiveMonth(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 bg-white"
            >
              {availableMonths.map((fm) => (
                <option key={fm.key} value={fm.key}>
                  {fm.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Alert Banner — all alerts */}
      {alerts.length > 0 && (
        <div className="rounded-xl overflow-hidden shadow-sm">
          {criticalAlerts.map((alert) => (
            <div key={alert.id} className="bg-red-50 border-l-4 border-red-500 px-4 py-3 flex items-start gap-3 border-b border-red-100 last:border-b-0">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
              <p className="text-sm text-red-800">{alert.message}</p>
            </div>
          ))}
          {warningAlerts.map((alert) => (
            <div key={alert.id} className="bg-amber-50 border-l-4 border-amber-400 px-4 py-3 flex items-start gap-3 border-b border-amber-100 last:border-b-0">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
              <p className="text-sm text-amber-800">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Data Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-500 font-medium">Financial Data</span>
        {activeSnap ? (
          <span className="text-sm text-gray-500">
            {activeSnap.label} · Uploaded{' '}
            <span className="font-medium text-gray-800">
              {fmtDate(activeSnap.uploadedAt.split('T')[0])}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
            No data
          </span>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Spend Rate */}
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
              <Area
                type="monotone"
                dataKey="budget"
                stroke="#94a3b8"
                fill="none"
                strokeDasharray="4 4"
                name="Budget"
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#1e3a5f"
                fill="url(#actualGrad)"
                strokeWidth={2}
                name="Actual"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Projections */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Projections</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={projectionChartData}
              margin={{ top: 0, right: 0, left: -10, bottom: 0 }}
            >
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
              <Area
                type="monotone"
                dataKey="budget"
                stroke="#94a3b8"
                fill="none"
                strokeDasharray="4 4"
                name="Budget"
              />
              <Area
                type="monotone"
                dataKey="actual"
                stroke="#1e3a5f"
                fill="none"
                strokeWidth={2}
                name="Actual"
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey="projected"
                stroke="#ef4444"
                fill="url(#projGrad)"
                strokeDasharray="5 3"
                strokeWidth={2}
                name="Projected"
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Budget vs Actuals */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Budget vs. Actuals by Category</h2>
        <ResponsiveContainer width="100%" height={300}>
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

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map(({ label, value, sub, icon: Icon, iconBg, accent }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
              <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
                <Icon className={accent} size={18} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Board Packet Status */}
      {latestPacket && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Board Packet Status</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">{latestPacket.month}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Next board meeting: {fmtDate(schoolProfile.nextBoardMeeting)}
              </p>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                packetStatusColor[latestPacket.status]
              }`}
            >
              {packetStatusLabel[latestPacket.status]}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
