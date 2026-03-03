'use client'

import { useStore, type GrantStatus, type OtherGrantRestrictions } from '@/lib/store'
import { paceFromKey } from '@/lib/fiscalYear'

const statusConfig: Record<GrantStatus, { label: string; badge: string; bar: string }> = {
  'on-pace': {
    label: 'On Pace',
    badge: 'bg-green-100 text-green-800',
    bar: 'bg-green-500',
  },
  watch: {
    label: 'Watch',
    badge: 'bg-yellow-100 text-yellow-800',
    bar: 'bg-yellow-500',
  },
  'underspend-risk': {
    label: 'Underspend Risk',
    badge: 'bg-orange-100 text-orange-800',
    bar: 'bg-orange-500',
  },
}

const restrictionConfig: Record<OtherGrantRestrictions, { label: string; badge: string }> = {
  unrestricted: { label: 'Unrestricted', badge: 'bg-green-100 text-green-800' },
  'multi-year': { label: 'Multi-Year', badge: 'bg-blue-100 text-blue-800' },
  restricted: { label: 'Restricted', badge: 'bg-amber-100 text-amber-800' },
}

function fmtMonth(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

export default function GrantTrackerPage() {
  const { grants, otherGrants, activeMonth, isLoaded, monthlySnapshots } = useStore()

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isLoaded && Object.keys(monthlySnapshots).length === 0 && grants.length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="text-4xl mb-4">🏆</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">No grant data yet</h1>
        <p className="text-gray-500 text-sm mb-6">
          Upload financial data or add grants in Settings to see your grant tracker.
        </p>
        <div className="flex gap-3 justify-center">
          <a
            href="/upload"
            className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-white rounded-lg"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            Upload data
          </a>
          <a
            href="/settings"
            className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-gray-700 rounded-lg border border-gray-300 bg-white"
          >
            Settings
          </a>
        </div>
      </div>
    )
  }

  const pacePct = Math.round(paceFromKey(activeMonth) * 100)

  const total = grants.reduce((s, g) => s + g.awardAmount, 0)
  const totalSpent = grants.reduce((s, g) => s + g.spent, 0)

  const otherTotal = otherGrants.reduce((s, g) => s + g.awardAmount, 0)
  const otherTotalSpent = otherGrants.reduce((s, g) => s + g.spentToDate, 0)

  const now = new Date()

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Grant Tracker</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Categorical and discretionary grant status
        </p>
      </div>

      {/* ── WA Categorical Grants ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          WA Categorical Grants
        </h2>

        {/* Summary bar */}
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 flex items-center justify-between">
          <div className="flex gap-8">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Total Awards</p>
              <p className="text-lg font-bold text-gray-800 mt-0.5">${total.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Total Spent</p>
              <p className="text-lg font-bold text-gray-800 mt-0.5">${totalSpent.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Remaining</p>
              <p className="text-lg font-bold text-gray-800 mt-0.5">
                ${(total - totalSpent).toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400">Expected pace: {pacePct}%</p>
        </div>

        {/* Grant cards */}
        <div className="grid grid-cols-2 gap-4">
          {grants.map((grant) => {
            const cfg = statusConfig[grant.status]
            const spentPct = (grant.spent / grant.awardAmount) * 100
            const remaining = grant.awardAmount - grant.spent
            const paceGap = spentPct - pacePct

            return (
              <div
                key={grant.id}
                className={`bg-white rounded-lg border p-5 ${
                  grant.status === 'underspend-risk' ? 'border-orange-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-gray-800 text-sm leading-snug pr-2">
                    {grant.name}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${cfg.badge}`}
                  >
                    {cfg.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div>
                    <p className="text-xs text-gray-400">Award</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">
                      ${grant.awardAmount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Spent</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">
                      ${grant.spent.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Remaining</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">
                      ${remaining.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>Spend rate</span>
                    <span className="font-medium text-gray-700">{spentPct.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 relative">
                    <div
                      className="absolute top-0 h-2 w-0.5 bg-gray-400 rounded"
                      style={{ left: `${pacePct}%` }}
                      title={`Expected: ${pacePct}%`}
                    />
                    <div
                      className={`h-2 rounded-full transition-all ${cfg.bar}`}
                      style={{ width: `${Math.min(spentPct, 100)}%` }}
                    />
                  </div>
                  {grant.status === 'underspend-risk' && (
                    <p className="text-xs text-orange-700 mt-2">
                      {Math.abs(paceGap).toFixed(0)}% below expected pace — verify allowable expenses
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-xs text-gray-400">
          Pace marker (│) shows expected spend rate at current point in the fiscal year.
        </p>
      </section>

      {/* ── Other Grants & Philanthropic Funding ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Other Grants &amp; Philanthropic Funding
        </h2>

        {otherGrants.length === 0 ? (
          <div className="bg-white rounded-lg border border-dashed border-gray-300 px-5 py-8 text-center">
            <p className="text-sm text-gray-400">
              No other grants added yet.{' '}
              <a href="/settings" className="text-[#1e3a5f] underline">
                Add them in Settings.
              </a>
            </p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 flex items-center justify-between">
              <div className="flex gap-8">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Total Awards</p>
                  <p className="text-lg font-bold text-gray-800 mt-0.5">
                    ${otherTotal.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Total Spent</p>
                  <p className="text-lg font-bold text-gray-800 mt-0.5">
                    ${otherTotalSpent.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Remaining</p>
                  <p className="text-lg font-bold text-gray-800 mt-0.5">
                    ${(otherTotal - otherTotalSpent).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Other grant cards */}
            <div className="grid grid-cols-2 gap-4">
              {otherGrants.map((grant) => {
                const cfg = restrictionConfig[grant.restrictions]
                const spentPct =
                  grant.awardAmount > 0 ? (grant.spentToDate / grant.awardAmount) * 100 : 0
                const remaining = grant.awardAmount - grant.spentToDate

                // Compute how far through the grant's own timeline we are
                const start = new Date(grant.startDate + 'T12:00:00')
                const end = new Date(grant.endDate + 'T12:00:00')
                const totalMs = end.getTime() - start.getTime()
                const elapsedMs = Math.max(0, Math.min(now.getTime() - start.getTime(), totalMs))
                const grantPacePct = totalMs > 0 ? Math.round((elapsedMs / totalMs) * 100) : 0

                const isLow = spentPct < grantPacePct - 10

                return (
                  <div
                    key={grant.id}
                    className={`bg-white rounded-lg border p-5 ${
                      isLow ? 'border-amber-200' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-semibold text-gray-800 text-sm leading-snug pr-2">
                        {grant.name}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${cfg.badge}`}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-4">{grant.funder}</p>

                    <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                      <div>
                        <p className="text-xs text-gray-400">Award</p>
                        <p className="text-sm font-bold text-gray-800 mt-0.5">
                          ${grant.awardAmount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Spent</p>
                        <p className="text-sm font-bold text-gray-800 mt-0.5">
                          ${grant.spentToDate.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Remaining</p>
                        <p className="text-sm font-bold text-gray-800 mt-0.5">
                          ${remaining.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                        <span>Spend rate vs. grant timeline</span>
                        <span className="font-medium text-gray-700">{spentPct.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 relative">
                        <div
                          className="absolute top-0 h-2 w-0.5 bg-gray-400 rounded"
                          style={{ left: `${Math.min(grantPacePct, 99)}%` }}
                          title={`Grant timeline: ${grantPacePct}% elapsed`}
                        />
                        <div
                          className={`h-2 rounded-full transition-all ${
                            isLow ? 'bg-amber-500' : 'bg-[#1e3a5f]'
                          }`}
                          style={{ width: `${Math.min(spentPct, 100)}%` }}
                        />
                      </div>
                      {isLow && (
                        <p className="text-xs text-amber-700 mt-2">
                          {(grantPacePct - spentPct).toFixed(0)}% below grant-timeline pace — review
                          spending plan
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-gray-400 mt-3">
                      {fmtMonth(grant.startDate)} – {fmtMonth(grant.endDate)}
                    </p>
                    {grant.notes && (
                      <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{grant.notes}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
