'use client'

import { useStore } from '@/lib/store'
import { TrendingUp, Lock, Info } from 'lucide-react'
import Link from 'next/link'

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

// Mockup data for the visual framework
function buildMockProjection(totalBudget: number, ytdRevenue: number, cashOnHand: number, enrollment: number) {
  const rev = ytdRevenue > 0 ? ytdRevenue * (12 / 7) : totalBudget * 1.02 // annualize or estimate
  const exp = totalBudget
  const years = []
  let cash = cashOnHand > 0 ? cashOnHand : 300000
  for (let y = 1; y <= 5; y++) {
    const projEnroll = Math.round(enrollment * (1 + 0.03 * (y - 1)))
    const projRev = Math.round(rev * Math.pow(1.03, y - 1) * (projEnroll / Math.max(enrollment, 1)))
    const projExp = Math.round(exp * Math.pow(1.025, y - 1) * (y === 1 ? 1 : 1 + 0.02 * (y - 1)))
    const net = projRev - projExp
    const beginCash = cash
    const endCash = beginCash + net
    const monthlyBurn = projExp / 12
    const days = monthlyBurn > 0 ? Math.round((endCash / monthlyBurn) * 30) : 0
    years.push({
      year: y,
      fiscalYear: `FY${26 + y}`,
      enrollment: projEnroll,
      revenue: projRev,
      expenses: projExp,
      net,
      beginCash,
      endCash,
      days,
    })
    cash = endCash
  }
  return years
}

const ROW_DEFS = [
  { key: 'enrollment', label: 'Projected Enrollment', format: (n: number) => n.toLocaleString(), isHeader: false },
  { key: 'revenue', label: 'Total Revenue', format: fmt, isHeader: false },
  { key: 'expenses', label: 'Total Expenses', format: fmt, isHeader: false },
  { key: 'net', label: 'Net Position', format: fmt, isHeader: false },
  { key: 'beginCash', label: 'Beginning Cash', format: fmt, isHeader: false },
  { key: 'endCash', label: 'Ending Cash', format: fmt, isHeader: true },
  { key: 'days', label: 'Reserve Days', format: (n: number) => `${n} days`, isHeader: false },
] as const

export default function ProjectionsPage() {
  const { schoolProfile, financialData, isLoaded } = useStore()

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]" />
      </div>
    )
  }

  const hasData = financialData.categories.length > 0
  const enrollment = schoolProfile.headcount || Math.round(schoolProfile.currentFTES) || 200
  const mockYears = buildMockProjection(
    financialData.totalBudget || 4000000,
    financialData.ytdRevenue || 0,
    financialData.cashOnHand || 300000,
    enrollment,
  )

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
          Multi-Year Projections
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
          5-year financial forecast based on your current data and configured assumptions
        </p>
      </div>

      {/* Coming Soon Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-4">
        <div className="flex items-start gap-3">
          <TrendingUp size={20} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
              Projection Engine Coming Soon
            </p>
            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
              Multi-year projections will automatically forecast your school&apos;s financial position over 5 years using your
              current revenue, expenses, enrollment trends, and configured assumptions. The engine will apply your salary escalator
              ({'{'}2.5%{'}'}), COLA rate ({'{'}3.0%{'}'}), and operations escalator ({'{'}2.0%{'}'}) to generate realistic projections —
              with Year N ending cash flowing into Year N+1 as beginning cash.
            </p>
            <p className="text-xs text-blue-600 mt-2">
              The preview below shows an illustrative projection based on your current data.
              {!hasData && ' Upload financial data to see projections based on your actuals.'}
            </p>
          </div>
        </div>
      </div>

      {/* Generate button (disabled) */}
      <div className="flex items-center gap-3">
        <div className="relative group">
          <button
            disabled
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg opacity-50 cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}
          >
            <Lock size={14} />
            Generate Projections
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Coming soon — projection engine in development
          </div>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Scenario: Base Case
        </span>
      </div>

      {/* Projection Table */}
      <div className="card-static overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            5-Year Financial Projection — Base Case
          </h2>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            Illustrative Preview
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 w-44">Metric</th>
                {mockYears.map((y) => (
                  <th
                    key={y.year}
                    className={`text-right py-3 px-4 text-xs font-semibold ${
                      y.year === 1 ? 'bg-[#1e3a5f]/5 text-[#1e3a5f]' : 'text-gray-500'
                    }`}
                  >
                    <div>{y.fiscalYear}</div>
                    <div className="font-normal text-[10px] mt-0.5">Year {y.year}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROW_DEFS.map((row, ri) => (
                <tr
                  key={row.key}
                  className={`border-b border-gray-50 ${row.isHeader ? 'bg-gray-50/50 font-semibold' : ''} ${ri === 0 ? 'border-b-2 border-gray-200' : ''}`}
                >
                  <td className={`py-2.5 px-5 ${row.isHeader ? 'text-gray-800 font-semibold' : 'text-gray-600'}`}>
                    {row.label}
                  </td>
                  {mockYears.map((y) => {
                    const val = y[row.key as keyof typeof y] as number
                    const isNegative = row.key === 'net' && val < 0
                    const isDaysLow = row.key === 'days' && val < 30
                    return (
                      <td
                        key={y.year}
                        className={`py-2.5 px-4 text-right tabular-nums ${
                          y.year === 1 ? 'bg-[#1e3a5f]/5' : ''
                        } ${
                          isNegative ? 'text-red-600 font-medium' :
                          isDaysLow ? 'text-red-600 font-medium' :
                          row.isHeader ? 'text-gray-800 font-semibold' : 'text-gray-700'
                        }`}
                      >
                        {row.format(val)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assumptions Reference */}
      <div className="card-static p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info size={14} className="text-gray-400" />
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Projection Assumptions</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-gray-400 mb-0.5">Revenue Growth</p>
            <p className="text-gray-700 font-medium">COLA {hasData ? '3.0' : '—'}% + enrollment</p>
          </div>
          <div>
            <p className="text-gray-400 mb-0.5">Personnel Escalator</p>
            <p className="text-gray-700 font-medium">{hasData ? '2.5' : '—'}% annual step</p>
          </div>
          <div>
            <p className="text-gray-400 mb-0.5">Operations Escalator</p>
            <p className="text-gray-700 font-medium">{hasData ? '2.0' : '—'}% annual</p>
          </div>
          <div>
            <p className="text-gray-400 mb-0.5">Cash Chaining</p>
            <p className="text-gray-700 font-medium">YN end → YN+1 begin</p>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-3">
          Assumptions are configurable in{' '}
          <Link href="/settings" className="underline">Settings → Financial Assumptions</Link>.
          Projections use driver-based staffing (per-pupil positions scale with enrollment, fixed positions do not).
        </p>
      </div>
    </div>
  )
}
