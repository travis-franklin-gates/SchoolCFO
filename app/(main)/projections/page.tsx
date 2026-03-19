'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { TrendingUp, Info, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { POSITION_BENCHMARKS } from '@/lib/positionBenchmarks'
import { fiscalIndexFromKey } from '@/lib/fiscalYear'

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

interface ProjectionYear {
  year: number
  fiscalYear: string
  enrollment: number
  revenue: number
  expenses: number
  net: number
  beginCash: number
  endCash: number
  days: number
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
  const { schoolProfile, financialData, financialAssumptions, isLoaded, activeMonth, schoolId } = useStore()
  const [generating, setGenerating] = useState(false)
  const [projections, setProjections] = useState<ProjectionYear[] | null>(null)

  const hasData = financialData.categories.length > 0
  const enrollment = schoolProfile.headcount || Math.round(schoolProfile.currentFTES) || 200

  // Default enrollment inputs: current + 3% growth per year for years 2-5
  const [enrollmentInputs, setEnrollmentInputs] = useState<number[]>([
    enrollment,
    Math.round(enrollment * 1.03),
    Math.round(enrollment * 1.03 * 1.03),
    Math.round(enrollment * 1.03 * 1.03 * 1.03),
    Math.round(enrollment * 1.03 * 1.03 * 1.03 * 1.03),
  ])

  // Determine fiscal year label from activeMonth
  // WA fiscal year: Sep-Aug. "2026-02" is FY 2025-26.
  function fyLabelFromActiveMonth(): string {
    const [y, m] = activeMonth.split('-').map(Number)
    if (m >= 9) return `FY${String(y).slice(2)}-${String(y + 1).slice(2)}`
    return `FY${String(y - 1).slice(2)}-${String(y).slice(2)}`
  }

  function fyLabelForYear(yearOffset: number): string {
    const [y, m] = activeMonth.split('-').map(Number)
    const baseStartYear = m >= 9 ? y : y - 1
    const startYear = baseStartYear + yearOffset
    return `FY${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`
  }

  // Compute per-pupil vs fixed share from position benchmarks
  const perPupilCount = POSITION_BENCHMARKS.filter(p => p.driverType === 'per_pupil').length
  const fixedCount = POSITION_BENCHMARKS.filter(p => p.driverType === 'fixed').length
  const totalPositionTypes = perPupilCount + fixedCount
  const perPupilShare = perPupilCount / totalPositionTypes
  const fixedShare = fixedCount / totalPositionTypes

  function computeProjections(enrollments: number[]): ProjectionYear[] {
    const assumptions = financialAssumptions
    const fiscalIdx = fiscalIndexFromKey(activeMonth)

    // Year 1 baseline
    const annualizedRevenue = fiscalIdx > 0 && financialData.ytdRevenue > 0
      ? financialData.ytdRevenue * 12 / fiscalIdx
      : financialData.revenueBudget > 0
        ? financialData.revenueBudget
        : financialData.totalBudget * 1.02

    const personnelCategories = financialData.categories.filter(
      c => c.accountType === 'expense' && /salary|personnel|staff|benefits|payroll/i.test(c.name)
    )
    const personnelExpense = personnelCategories.reduce((sum, c) => {
      // Annualize YTD if mid-year
      return sum + (fiscalIdx > 0 ? c.ytdActuals * 12 / fiscalIdx : c.budget)
    }, 0)

    const totalExpenseAnnualized = fiscalIdx > 0 && financialData.ytdExpenses > 0
      ? financialData.ytdExpenses * 12 / fiscalIdx
      : financialData.totalBudget

    const operationsExpense = totalExpenseAnnualized - personnelExpense

    const beginningCash = financialData.cashOnHand

    const years: ProjectionYear[] = []
    let cash = beginningCash

    for (let y = 1; y <= 5; y++) {
      const yearEnrollment = enrollments[y - 1]

      if (y === 1) {
        const revenue = Math.round(annualizedRevenue)
        const expenses = Math.round(totalExpenseAnnualized)
        const net = revenue - expenses
        const endCash = cash + net
        const reserveDays = expenses > 0 && endCash > 0
          ? Math.round(endCash / (expenses / 365))
          : 0

        years.push({
          year: y,
          fiscalYear: fyLabelForYear(0),
          enrollment: yearEnrollment,
          revenue,
          expenses,
          net,
          beginCash: cash,
          endCash,
          days: reserveDays,
        })
        cash = endCash
      } else {
        const enrollmentRatio = enrollments[y - 2] > 0 ? enrollments[y - 1] / enrollments[y - 2] : 1
        const colaFactor = 1 + assumptions.cola_rate_pct / 100

        const revenue = Math.round(
          annualizedRevenue * Math.pow(colaFactor, y - 1) * (enrollments[y - 1] / enrollments[0])
        )

        const personnelCost = Math.round(
          personnelExpense *
          Math.pow(1 + assumptions.salary_escalator_pct / 100, y - 1) *
          (perPupilShare * (enrollments[y - 1] / enrollments[0]) + fixedShare)
        )

        const operationsCost = Math.round(
          operationsExpense * Math.pow(1 + assumptions.operations_escalator_pct / 100, y - 1)
        )

        const expenses = personnelCost + operationsCost
        const net = revenue - expenses
        const endCash = cash + net
        const reserveDays = expenses > 0 && endCash > 0
          ? Math.round(endCash / (expenses / 365))
          : 0

        years.push({
          year: y,
          fiscalYear: fyLabelForYear(y - 1),
          enrollment: yearEnrollment,
          revenue,
          expenses,
          net,
          beginCash: cash,
          endCash,
          days: Math.max(0, reserveDays),
        })
        cash = endCash
      }
    }

    return years
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const years = computeProjections(enrollmentInputs)
      setProjections(years)

      // Save to Supabase
      if (schoolId) {
        try {
          const { supabase } = await import('@/lib/supabase')

          // Delete existing base case projections for this school
          await supabase
            .from('multi_year_projections')
            .delete()
            .eq('school_id', schoolId)
            .eq('projection_name', 'Base Case')

          // Insert new projections
          const rows = years.map(y => ({
            school_id: schoolId,
            projection_name: 'Base Case',
            year_number: y.year,
            fiscal_year: y.fiscalYear,
            projected_enrollment: y.enrollment,
            total_revenue: y.revenue,
            total_expenses: y.expenses,
            net_position: y.net,
            beginning_cash: y.beginCash,
            ending_cash: y.endCash,
            reserve_days: y.days,
            assumptions_snapshot: financialAssumptions,
          }))

          await supabase.from('multi_year_projections').insert(rows)
        } catch (err) {
          console.error('[projections] Failed to save to Supabase:', err)
        }
      }
    } finally {
      setGenerating(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]" />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            Multi-Year Projections
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
            5-year financial forecast based on your current data and configured assumptions
          </p>
        </div>
        <div className="card-static p-8 text-center">
          <TrendingUp size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 mb-4">
            Upload financial data to generate multi-year projections.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
            style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)' }}
          >
            Upload Data
          </Link>
        </div>
      </div>
    )
  }

  const displayYears = projections

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

      {/* Generate button */}
      <div className="flex items-center gap-3">
        <button
          disabled={!hasData || generating}
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}
        >
          <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
          {generating ? 'Generating...' : 'Generate Projections'}
        </button>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Scenario: Base Case
        </span>
      </div>

      {/* Projection Table */}
      <div className="card-static overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            5-Year Financial Projection — Base Case
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 w-44">Metric</th>
                {[1, 2, 3, 4, 5].map((y) => (
                  <th
                    key={y}
                    className={`text-right py-3 px-4 text-xs font-semibold ${
                      y === 1 ? 'bg-[#1e3a5f]/5 text-[#1e3a5f]' : 'text-gray-500'
                    }`}
                  >
                    <div>{fyLabelForYear(y - 1)}</div>
                    <div className="font-normal text-[10px] mt-0.5">Year {y}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Enrollment input row */}
              <tr className="border-b-2 border-gray-200">
                <td className="py-2.5 px-5 text-gray-600">Projected Enrollment</td>
                {enrollmentInputs.map((val, i) => (
                  <td
                    key={i}
                    className={`py-2.5 px-4 text-right ${i === 0 ? 'bg-[#1e3a5f]/5' : ''}`}
                  >
                    {i === 0 ? (
                      <span className="tabular-nums text-gray-700">{val.toLocaleString()}</span>
                    ) : (
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => {
                          const newInputs = [...enrollmentInputs]
                          newInputs[i] = Math.max(0, parseInt(e.target.value) || 0)
                          setEnrollmentInputs(newInputs)
                        }}
                        className="w-20 text-right text-sm tabular-nums border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]/50"
                      />
                    )}
                  </td>
                ))}
              </tr>

              {/* Data rows (skip enrollment since it's the input row above) */}
              {ROW_DEFS.filter(r => r.key !== 'enrollment').map((row) => (
                <tr
                  key={row.key}
                  className={`border-b border-gray-50 ${row.isHeader ? 'bg-gray-50/50 font-semibold' : ''}`}
                >
                  <td className={`py-2.5 px-5 ${row.isHeader ? 'text-gray-800 font-semibold' : 'text-gray-600'}`}>
                    {row.label}
                  </td>
                  {[1, 2, 3, 4, 5].map((y) => {
                    const yearData = displayYears?.find(d => d.year === y)
                    const val = yearData ? yearData[row.key as keyof ProjectionYear] as number : null
                    const isNegative = row.key === 'net' && val != null && val < 0
                    const isDaysLow = row.key === 'days' && val != null && val < 30
                    return (
                      <td
                        key={y}
                        className={`py-2.5 px-4 text-right tabular-nums ${
                          y === 1 ? 'bg-[#1e3a5f]/5' : ''
                        } ${
                          isNegative ? 'text-red-600 font-medium' :
                          isDaysLow ? 'text-red-600 font-medium' :
                          row.isHeader ? 'text-gray-800 font-semibold' : 'text-gray-700'
                        }`}
                      >
                        {val != null ? row.format(val) : '—'}
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
            <p className="text-gray-700 font-medium">COLA {financialAssumptions.cola_rate_pct}% + enrollment</p>
          </div>
          <div>
            <p className="text-gray-400 mb-0.5">Personnel Escalator</p>
            <p className="text-gray-700 font-medium">{financialAssumptions.salary_escalator_pct}% annual step</p>
          </div>
          <div>
            <p className="text-gray-400 mb-0.5">Operations Escalator</p>
            <p className="text-gray-700 font-medium">{financialAssumptions.operations_escalator_pct}% annual</p>
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
