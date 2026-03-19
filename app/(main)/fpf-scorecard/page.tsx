'use client'

import { useStore } from '@/lib/store'
import { buildFpfScorecard, type FpfStatus, type FpfCategory } from '@/lib/fpfScorecard'
import { CheckCircle2, XCircle, MinusCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

const STATUS_CONFIG: Record<FpfStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  'meets':             { label: 'Meets',             cls: 'bg-green-50 text-green-700 ring-1 ring-green-200',  icon: CheckCircle2 },
  'does-not-meet':     { label: 'Does Not Meet',     cls: 'bg-red-50 text-red-700 ring-1 ring-red-200',        icon: XCircle },
  'not-evaluated':     { label: 'Not Evaluated',     cls: 'bg-gray-50 text-gray-500 ring-1 ring-gray-200',     icon: MinusCircle },
  'insufficient-data': { label: 'Insufficient Data', cls: 'bg-gray-50 text-gray-400 ring-1 ring-gray-200',     icon: AlertTriangle },
}

const CATEGORY_LABELS: Record<FpfCategory, string> = {
  performance: 'Financial Performance',
  sustainability: 'Financial Sustainability',
}

export default function FpfScorecardPage() {
  const { schoolProfile, financialData, isLoaded, monthlySnapshots } = useStore()

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]" />
      </div>
    )
  }

  const hasData = financialData.categories.length > 0

  if (!hasData) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
          Commission FPF Scorecard
        </h1>
        <div className="card-static px-8 py-12 text-center">
          <p className="text-gray-400 mb-3">Upload financial data to populate the scorecard.</p>
          <Link href="/upload" className="text-sm text-[#1e3a5f] font-medium hover:underline">
            Upload Data →
          </Link>
        </div>
      </div>
    )
  }

  // Try to get prior year data from snapshots
  const snapshotKeys = Object.keys(monthlySnapshots).sort()
  const priorYearRevenue = snapshotKeys.length > 1
    ? monthlySnapshots[snapshotKeys[0]].financialSummary.ytdRevenue
    : null
  const priorYearCash = schoolProfile.openingCashBalance > 0
    ? schoolProfile.openingCashBalance
    : null

  const scorecard = buildFpfScorecard(
    schoolProfile,
    financialData,
    priorYearRevenue,
    priorYearCash,
  )

  const categories: FpfCategory[] = ['performance', 'sustainability']

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
          Commission FPF Scorecard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
          WA Charter School Commission Financial Performance Framework
          {' — '}
          <span className="font-medium text-gray-600">
            Stage {scorecard.stage} (Year {schoolProfile.operatingYear} of operation)
          </span>
        </p>
      </div>

      {/* Summary banner */}
      <div className={`rounded-lg px-5 py-4 flex items-center gap-4 ${
        scorecard.notMet > 0
          ? 'bg-red-50 border border-red-200'
          : scorecard.insufficientData > 0
          ? 'bg-amber-50 border border-amber-200'
          : 'bg-green-50 border border-green-200'
      }`}>
        <div className={`text-3xl font-bold ${
          scorecard.notMet > 0 ? 'text-red-700' : scorecard.insufficientData > 0 ? 'text-amber-700' : 'text-green-700'
        }`} style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
          {scorecard.met}/{scorecard.applicable}
        </div>
        <div>
          <p className={`text-sm font-semibold ${
            scorecard.notMet > 0 ? 'text-red-800' : scorecard.insufficientData > 0 ? 'text-amber-800' : 'text-green-800'
          }`}>
            {scorecard.notMet === 0 && scorecard.insufficientData === 0
              ? 'All applicable metrics met'
              : scorecard.notMet > 0
              ? `${scorecard.notMet} metric${scorecard.notMet > 1 ? 's' : ''} not met`
              : 'Some metrics need additional data'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {scorecard.met} met
            {scorecard.notMet > 0 && ` · ${scorecard.notMet} not met`}
            {scorecard.insufficientData > 0 && ` · ${scorecard.insufficientData} insufficient data`}
            {scorecard.applicable < scorecard.metrics.length && ` · ${scorecard.metrics.length - scorecard.applicable} not evaluated at Stage ${scorecard.stage}`}
          </p>
        </div>
      </div>

      {/* Metric tables by category */}
      {categories.map((category) => {
        const group = scorecard.metrics.filter((m) => m.category === category)
        return (
          <div key={category} className="card-static overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
                {CATEGORY_LABELS[category]}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500">
                    <th className="text-left py-2.5 px-5 font-medium">Metric</th>
                    <th className="text-right py-2.5 px-4 font-medium">Current Value</th>
                    <th className="text-left py-2.5 px-4 font-medium">Threshold</th>
                    <th className="text-center py-2.5 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((metric) => {
                    const cfg = STATUS_CONFIG[metric.status]
                    const Icon = cfg.icon
                    return (
                      <tr key={metric.key} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-3 px-5 text-gray-800 font-medium">{metric.name}</td>
                        <td className={`py-3 px-4 text-right tabular-nums font-medium ${
                          metric.status === 'meets' ? 'text-green-700'
                          : metric.status === 'does-not-meet' ? 'text-red-700'
                          : 'text-gray-400'
                        }`}>
                          {metric.formatted}
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{metric.threshold}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.cls}`}>
                            <Icon size={12} />
                            {cfg.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-3 text-xs text-blue-800">
        <p className="font-semibold mb-1">About the FPF</p>
        <p>
          The WA Charter School Commission evaluates operating schools using the Financial Performance Framework.
          Stage 1 applies to schools in Years 1-2 with relaxed thresholds. Stage 2 (Year 3+) applies the full framework.
          Metrics requiring balance sheet data (Current Ratio, Debt-to-Asset, DSCR) will show &quot;Insufficient Data&quot;
          until those inputs are available. You can update your Operating Year in{' '}
          <Link href="/settings" className="underline font-medium">Settings</Link>.
        </p>
      </div>
    </div>
  )
}
