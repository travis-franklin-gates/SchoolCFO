'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, Info, BarChart2 } from 'lucide-react'
import { useStore, type BudgetAlertStatus } from '@/lib/store'
import { paceFromKey, fiscalIndexFromKey } from '@/lib/fiscalYear'

function fmt(n: number) {
  return n >= 0 ? `$${n.toLocaleString()}` : `-$${Math.abs(n).toLocaleString()}`
}

type StatusCfg = { label: string; badge: string; row: string }

const statusConfig: Record<BudgetAlertStatus, StatusCfg> = {
  ok: {
    label: 'On Track',
    badge: 'bg-green-100 text-green-800',
    row: '',
  },
  watch: {
    label: 'Watch',
    badge: 'bg-yellow-100 text-yellow-800',
    row: 'bg-yellow-50/40',
  },
  concern: {
    label: 'Concern',
    badge: 'bg-orange-100 text-orange-800',
    row: 'bg-orange-50/40',
  },
  action: {
    label: 'Action Required',
    badge: 'bg-red-100 text-red-800',
    row: 'bg-red-50/30',
  },
}

const revenueStatusConfig: Record<BudgetAlertStatus, StatusCfg> = {
  ok: {
    label: 'On Track',
    badge: 'bg-green-100 text-green-800',
    row: '',
  },
  watch: {
    label: 'Watch',
    badge: 'bg-yellow-100 text-yellow-800',
    row: 'bg-yellow-50/40',
  },
  concern: {
    label: 'Concern',
    badge: 'bg-orange-100 text-orange-800',
    row: 'bg-orange-50/40',
  },
  action: {
    label: 'Above Budget',
    badge: 'bg-blue-100 text-blue-800',
    row: 'bg-blue-50/30',
  },
}

export default function BudgetAnalysisPage() {
  const { financialData, isLoaded, monthlySnapshots, activeMonth } = useStore()
  const [expanded, setExpanded] = useState<string | null>(null)

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
          <BarChart2 size={28} style={{ color: 'var(--brand-500)' }} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>No budget data yet</h1>
        <p className="text-gray-500 text-sm mb-6">
          Upload financial data to see your budget analysis and category-level breakdown.
        </p>
        <a
          href="/upload"
          className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-display), system-ui, sans-serif', boxShadow: 'var(--shadow-sm)' }}
        >
          Upload data
        </a>
      </div>
    )
  }

  const PACE = paceFromKey(activeMonth)
  const MONTHS_ELAPSED = fiscalIndexFromKey(activeMonth)
  const TOTAL_MONTHS = 12
  const PACE_PCT = Math.round(PACE * 100)

  // Re-derive alertStatus from burn rate so stale Supabase values don't produce wrong badges.
  const deriveAlertStatus = (burnRate: number): BudgetAlertStatus => {
    const pp = burnRate - PACE_PCT
    if (pp > 20) return 'action'
    if (pp > 10) return 'concern'
    if (pp > 5 || pp < -20) return 'watch'
    return 'ok'
  }

  // Revenue: over-budget is good, under-budget is concerning (inverted logic).
  const deriveRevenueAlertStatus = (burnRate: number): BudgetAlertStatus => {
    const pp = burnRate - PACE_PCT
    if (pp > 0) return 'action'     // above budget → "Above Budget" (green)
    if (pp >= -10) return 'ok'      // within 10% → "On Track" (green)
    if (pp >= -20) return 'watch'   // 10-20% below → "Watch" (yellow)
    return 'concern'                // >20% below → "Concern" (orange)
  }

  // Thresholds (pp over expected pace): +5 → watch, +10 → concern, +20 → action
  const burnColor = (burnRate: number) => {
    const pp = burnRate - PACE_PCT
    if (pp > 20) return { bar: 'bg-red-500',    text: 'text-red-600 font-semibold' }
    if (pp > 10) return { bar: 'bg-orange-400',  text: 'text-orange-600 font-semibold' }
    if (pp > 5)  return { bar: 'bg-yellow-400',  text: 'text-yellow-700' }
    return           { bar: 'bg-green-500',    text: 'text-green-700' }
  }

  // Revenue: over-pace is positive (blue), under-pace is concerning
  const revenueBurnColor = (burnRate: number) => {
    const pp = burnRate - PACE_PCT
    if (pp > 0)   return { bar: 'bg-blue-500',    text: 'text-blue-600 font-semibold' }
    if (pp >= -10) return { bar: 'bg-green-500',   text: 'text-green-700' }
    if (pp >= -20) return { bar: 'bg-yellow-400',  text: 'text-yellow-700' }
    return            { bar: 'bg-orange-400',   text: 'text-orange-600 font-semibold' }
  }

  const categories = financialData.categories.map((cat) => {
    const expectedToDate = cat.budget * PACE
    const varianceDollar = cat.ytdActuals - expectedToDate
    // Override stored alertStatus with re-derived value based on current fiscal pace
    const alertStatus = cat.accountType === 'revenue'
      ? deriveRevenueAlertStatus(cat.burnRate)
      : deriveAlertStatus(cat.burnRate)
    return { ...cat, alertStatus, varianceDollar }
  })

  const expenseCategories = categories.filter((c) => c.accountType === 'expense')
  const revenueCategories = categories.filter((c) => c.accountType === 'revenue')

  const toggleRow = (name: string) => {
    setExpanded((prev) => (prev === name ? null : name))
  }

  const totalBudget = expenseCategories.reduce((s, c) => s + c.budget, 0)
  const totalYtd    = expenseCategories.reduce((s, c) => s + c.ytdActuals, 0)
  const totalVarianceDollar = expenseCategories.reduce((s, c) => s + c.varianceDollar, 0)
  const totalBurnRate = totalBudget > 0 ? (totalYtd / totalBudget) * 100 : 0
  const totalProjYearEnd = expenseCategories.reduce((s, c) => s + c.projectedYearEnd, 0)

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Budget Analysis</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Year-to-date budget performance by category
        </p>
      </div>

      {/* Legend + pace note */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 font-medium">
          On Track
        </span>
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 font-medium">
          Watch
        </span>
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-orange-100 text-orange-800 font-medium">
          Concern
        </span>
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-800 font-medium">
          Action Required
        </span>
        <span className="ml-auto text-gray-400">
          Month {MONTHS_ELAPSED} of {TOTAL_MONTHS} · Expected pace: <strong className="text-gray-600">{PACE_PCT}%</strong> of annual budget
        </span>
      </div>

      {/* ── Desktop table (md and up) ── */}
      <div className="hidden md:block card-static overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr] gap-0 bg-gray-50 border-b border-gray-200 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <div>Category</div>
          <div className="text-right">Budget</div>
          <div className="text-right">YTD Actuals</div>
          <div className="text-right">Variance $</div>
          <div className="text-right">% of Budget</div>
          <div className="text-right">Proj. Year-End</div>
          <div className="text-center">Status</div>
        </div>

        {expenseCategories.map((cat) => {
          const cfg = statusConfig[cat.alertStatus]
          const isExpanded = expanded === cat.name
          const hasNarrative = !!cat.narrative && cat.alertStatus !== 'ok'
          const bc = burnColor(cat.burnRate)

          return (
            <div key={cat.name}>
              <div
                className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr] gap-0 px-4 py-3.5 border-b border-gray-100 text-sm transition-colors ${cfg.row} ${hasNarrative ? 'cursor-pointer hover:brightness-95' : ''}`}
                onClick={() => hasNarrative && toggleRow(cat.name)}
              >
                {/* Category */}
                <div className="flex items-center gap-2 font-medium text-gray-800">
                  {hasNarrative ? (
                    isExpanded ? (
                      <ChevronDown size={14} className="text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-400 shrink-0" />
                    )
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  {cat.name}
                </div>

                {/* Budget */}
                <div className="text-right text-gray-700">{fmt(cat.budget)}</div>

                {/* YTD Actuals */}
                <div className="text-right text-gray-700">{fmt(cat.ytdActuals)}</div>

                {/* Variance $ */}
                <div className={`text-right font-medium ${cat.varianceDollar > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fmt(Math.round(cat.varianceDollar))}
                </div>

                {/* % of Budget — burn rate with color-coded bar */}
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${bc.bar}`}
                        style={{ width: `${Math.min(cat.burnRate, 100)}%` }}
                      />
                    </div>
                    <span className={`tabular-nums w-10 text-right ${bc.text}`}>
                      {cat.burnRate.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Projected Year-End */}
                <div className={`text-right font-medium ${cat.projectedYearEnd > cat.budget ? 'text-red-600' : 'text-gray-700'}`}>
                  {fmt(cat.projectedYearEnd)}
                </div>

                {/* Status */}
                <div className="flex justify-center">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                </div>
              </div>

              {/* Narrative */}
              {isExpanded && cat.narrative && (
                <div className="px-12 py-4 bg-blue-50/60 border-b border-gray-100 border-l-4 border-l-blue-400">
                  <div className="flex gap-3">
                    <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wide">
                        CFO Analysis
                      </p>
                      <p className="text-sm text-blue-900 leading-relaxed">{cat.narrative}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Expense Totals Row */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr] gap-0 px-4 py-3.5 bg-gray-50 border-t-2 border-gray-200 text-sm font-semibold text-gray-800">
          <div className="pl-5">Total Expenses</div>
          <div className="text-right">{fmt(totalBudget)}</div>
          <div className="text-right">{fmt(totalYtd)}</div>
          <div className={`text-right ${totalVarianceDollar > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {fmt(Math.round(totalVarianceDollar))}
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <div className="w-16 bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${burnColor(totalBurnRate).bar}`}
                  style={{ width: `${Math.min(totalBurnRate, 100)}%` }}
                />
              </div>
              <span className={`tabular-nums w-10 text-right ${burnColor(totalBurnRate).text}`}>
                {totalBurnRate.toFixed(0)}%
              </span>
            </div>
          </div>
          <div className={`text-right ${totalProjYearEnd > totalBudget ? 'text-red-600' : 'text-gray-800'}`}>
            {fmt(totalProjYearEnd)}
          </div>
          <div />
        </div>

        {/* Revenue Section */}
        {revenueCategories.length > 0 && (
          <>
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr] gap-0 bg-[#1e3a5f]/5 border-t-2 border-[#1e3a5f]/20 px-4 py-2.5 text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide">
              <div>Revenue</div>
              <div /><div /><div /><div /><div /><div />
            </div>

            {revenueCategories.map((cat) => {
              const cfg = revenueStatusConfig[cat.alertStatus]
              const isExpanded = expanded === cat.name
              const hasNarrative = !!cat.narrative && cat.alertStatus !== 'ok' && cat.alertStatus !== 'action'
              const bc = revenueBurnColor(cat.burnRate)

              return (
                <div key={cat.name}>
                  <div
                    className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr] gap-0 px-4 py-3.5 border-b border-gray-100 text-sm transition-colors ${cfg.row} ${hasNarrative ? 'cursor-pointer hover:brightness-95' : ''}`}
                    onClick={() => hasNarrative && toggleRow(cat.name)}
                  >
                    <div className="flex items-center gap-2 font-medium text-gray-800">
                      {hasNarrative ? (
                        isExpanded ? (
                          <ChevronDown size={14} className="text-gray-400 shrink-0" />
                        ) : (
                          <ChevronRight size={14} className="text-gray-400 shrink-0" />
                        )
                      ) : (
                        <span className="w-3.5 shrink-0" />
                      )}
                      {cat.name}
                    </div>
                    <div className="text-right text-gray-700">{fmt(cat.budget)}</div>
                    <div className="text-right text-gray-700">{fmt(cat.ytdActuals)}</div>
                    <div className={`text-right font-medium ${cat.varianceDollar > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {fmt(Math.round(cat.varianceDollar))}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${bc.bar}`}
                            style={{ width: `${Math.min(cat.burnRate, 100)}%` }}
                          />
                        </div>
                        <span className={`tabular-nums w-10 text-right ${bc.text}`}>
                          {cat.burnRate.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className={`text-right font-medium ${cat.projectedYearEnd > cat.budget ? 'text-blue-600' : 'text-gray-700'}`}>
                      {fmt(cat.projectedYearEnd)}
                    </div>
                    <div className="flex justify-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>

                  {isExpanded && cat.narrative && (
                    <div className="px-12 py-4 bg-blue-50/60 border-b border-gray-100 border-l-4 border-l-blue-400">
                      <div className="flex gap-3">
                        <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wide">
                            CFO Analysis
                          </p>
                          <p className="text-sm text-blue-900 leading-relaxed">{cat.narrative}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* ── Mobile cards (below md) ── */}
      <div className="flex flex-col gap-3 md:hidden">
        {expenseCategories.map((cat) => {
          const cfg = statusConfig[cat.alertStatus]
          const isExpanded = expanded === cat.name
          const hasNarrative = !!cat.narrative && cat.alertStatus !== 'ok'
          const bc = burnColor(cat.burnRate)

          return (
            <div
              key={cat.name}
              className={`card-static overflow-hidden ${cfg.row}`}
            >
              {/* Card header — name + badge */}
              <div
                className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 ${hasNarrative ? 'cursor-pointer' : ''}`}
                onClick={() => hasNarrative && toggleRow(cat.name)}
              >
                <div className="flex items-center gap-2 font-medium text-gray-800 text-sm">
                  {hasNarrative ? (
                    isExpanded
                      ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
                      : <ChevronRight size={14} className="text-gray-400 shrink-0" />
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  {cat.name}
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>

              <div className="px-4 py-3 space-y-3">
                {/* Burn rate bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">% of Budget Spent</span>
                    <span className={`text-sm font-semibold tabular-nums ${bc.text}`}>
                      {cat.burnRate.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${bc.bar}`}
                      style={{ width: `${Math.min(cat.burnRate, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-400">
                    <span>0%</span>
                    <span className="text-gray-500">Expected: {PACE_PCT}%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* 3-column stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg px-2 py-2">
                    <p className="text-xs text-gray-400 mb-0.5">Budget</p>
                    <p className="text-sm font-semibold text-gray-800">{fmt(cat.budget)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-2 py-2">
                    <p className="text-xs text-gray-400 mb-0.5">YTD Actual</p>
                    <p className="text-sm font-semibold text-gray-800">{fmt(cat.ytdActuals)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-2 py-2">
                    <p className="text-xs text-gray-400 mb-0.5">Proj. Year-End</p>
                    <p className={`text-sm font-semibold ${cat.projectedYearEnd > cat.budget ? 'text-red-600' : 'text-gray-800'}`}>
                      {fmt(cat.projectedYearEnd)}
                    </p>
                  </div>
                </div>

                {/* Variance vs expected pace */}
                <div className="flex items-center justify-between text-xs border-t border-gray-100 pt-2">
                  <span className="text-gray-500">Variance vs expected pace</span>
                  <span className={`font-medium ${cat.varianceDollar > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {cat.varianceDollar > 0 ? '+' : ''}{fmt(Math.round(cat.varianceDollar))}
                  </span>
                </div>
              </div>

              {/* Expandable CFO narrative */}
              {isExpanded && cat.narrative && (
                <div className="px-4 pb-4 border-t border-gray-100 bg-blue-50/60 border-l-4 border-l-blue-400">
                  <div className="flex gap-2 pt-3">
                    <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wide">
                        CFO Analysis
                      </p>
                      <p className="text-sm text-blue-900 leading-relaxed">{cat.narrative}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Expense Totals card */}
        <div className="bg-[#1e3a5f] rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-sm font-semibold text-white">Total Expenses</p>
          </div>
          <div className="px-4 py-3 space-y-3">
            {/* Total burn rate bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-blue-200">Overall % of Budget Spent</span>
                <span className={`text-sm font-semibold tabular-nums ${burnColor(totalBurnRate).text}`}>
                  {totalBurnRate.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${burnColor(totalBurnRate).bar}`}
                  style={{ width: `${Math.min(totalBurnRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Totals stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/10 rounded-lg px-2 py-2">
                <p className="text-xs text-blue-200 mb-0.5">Budget</p>
                <p className="text-sm font-semibold text-white">{fmt(totalBudget)}</p>
              </div>
              <div className="bg-white/10 rounded-lg px-2 py-2">
                <p className="text-xs text-blue-200 mb-0.5">YTD Actual</p>
                <p className="text-sm font-semibold text-white">{fmt(totalYtd)}</p>
              </div>
              <div className="bg-white/10 rounded-lg px-2 py-2">
                <p className="text-xs text-blue-200 mb-0.5">Proj. Year-End</p>
                <p className={`text-sm font-semibold ${totalProjYearEnd > totalBudget ? 'text-red-300' : 'text-white'}`}>
                  {fmt(totalProjYearEnd)}
                </p>
              </div>
            </div>

            {/* Total variance */}
            <div className="flex items-center justify-between text-xs border-t border-white/10 pt-2">
              <span className="text-blue-200">Variance vs expected pace</span>
              <span className={`font-medium ${totalVarianceDollar > 0 ? 'text-red-300' : 'text-green-300'}`}>
                {totalVarianceDollar > 0 ? '+' : ''}{fmt(Math.round(totalVarianceDollar))}
              </span>
            </div>
          </div>
        </div>

        {/* Revenue cards */}
        {revenueCategories.length > 0 && (
          <>
            <div className="px-3 py-2 bg-[#1e3a5f]/5 border-2 border-[#1e3a5f]/20 rounded-lg">
              <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide">Revenue</p>
            </div>
            {revenueCategories.map((cat) => {
              const cfg = revenueStatusConfig[cat.alertStatus]
              const isExpanded = expanded === cat.name
              const hasNarrative = !!cat.narrative && cat.alertStatus !== 'ok' && cat.alertStatus !== 'action'
              const bc = revenueBurnColor(cat.burnRate)

              return (
                <div
                  key={cat.name}
                  className={`card-static overflow-hidden ${cfg.row}`}
                >
                  <div
                    className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 ${hasNarrative ? 'cursor-pointer' : ''}`}
                    onClick={() => hasNarrative && toggleRow(cat.name)}
                  >
                    <div className="flex items-center gap-2 font-medium text-gray-800 text-sm">
                      {hasNarrative ? (
                        isExpanded
                          ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
                          : <ChevronRight size={14} className="text-gray-400 shrink-0" />
                      ) : (
                        <span className="w-3.5 shrink-0" />
                      )}
                      {cat.name}
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>

                  <div className="px-4 py-3 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">% of Budget Received</span>
                        <span className={`text-sm font-semibold tabular-nums ${bc.text}`}>
                          {cat.burnRate.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${bc.bar}`}
                          style={{ width: `${Math.min(cat.burnRate, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1 text-xs text-gray-400">
                        <span>0%</span>
                        <span className="text-gray-500">Expected: {PACE_PCT}%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-gray-50 rounded-lg px-2 py-2">
                        <p className="text-xs text-gray-400 mb-0.5">Budget</p>
                        <p className="text-sm font-semibold text-gray-800">{fmt(cat.budget)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-2 py-2">
                        <p className="text-xs text-gray-400 mb-0.5">YTD Actual</p>
                        <p className="text-sm font-semibold text-gray-800">{fmt(cat.ytdActuals)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-2 py-2">
                        <p className="text-xs text-gray-400 mb-0.5">Proj. Year-End</p>
                        <p className={`text-sm font-semibold ${cat.projectedYearEnd > cat.budget ? 'text-blue-600' : 'text-gray-800'}`}>
                          {fmt(cat.projectedYearEnd)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs border-t border-gray-100 pt-2">
                      <span className="text-gray-500">Variance vs expected pace</span>
                      <span className={`font-medium ${cat.varianceDollar > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {cat.varianceDollar > 0 ? '+' : ''}{fmt(Math.round(cat.varianceDollar))}
                      </span>
                    </div>
                  </div>

                  {isExpanded && cat.narrative && (
                    <div className="px-4 pb-4 border-t border-gray-100 bg-blue-50/60 border-l-4 border-l-blue-400">
                      <div className="flex gap-2 pt-3">
                        <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wide">
                            CFO Analysis
                          </p>
                          <p className="text-sm text-blue-900 leading-relaxed">{cat.narrative}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <AlertTriangle size={12} />
        Click any flagged category to see a plain-English explanation of what&apos;s happening.
      </p>
    </div>
  )
}
