// Agent caching with change detection.
// Computes a hash of key financial data points. When the hash changes,
// agents need to re-run. When it matches, cached results are served.

import type { FinancialSnapshot, Grant, SchoolProfile } from './store'

/**
 * Compute a deterministic hash string from the school's key data points.
 * Changes to any of these values invalidate the agent cache.
 */
export function computeDataHash(
  profile: SchoolProfile,
  financialData: FinancialSnapshot,
  grants: Grant[],
): string {
  // Key data points that affect agent analysis
  const inputs = {
    ytdRevenue: financialData.ytdRevenue,
    ytdExpenses: financialData.ytdExpenses,
    totalBudget: financialData.totalBudget,
    revenueBudget: financialData.revenueBudget,
    cashOnHand: financialData.cashOnHand,
    daysOfReserves: financialData.daysOfReserves,
    variancePercent: financialData.variancePercent,
    categoryCount: financialData.categories.length,
    // Hash each category's actuals (sorted for determinism)
    categories: financialData.categories
      .map((c) => `${c.name}:${c.budget}:${c.ytdActuals}:${c.accountType}`)
      .sort()
      .join('|'),
    // Grant spent amounts
    grants: grants
      .map((g) => `${g.name}:${g.spent}:${g.awardAmount}`)
      .sort()
      .join('|'),
    // Profile data that affects analysis
    ftes: profile.currentFTES,
    headcount: profile.headcount,
    openingCash: profile.openingCashBalance,
  }

  // Simple string-based hash (no crypto needed — just change detection)
  const raw = JSON.stringify(inputs)
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32-bit integer
  }
  return hash.toString(36)
}

export interface AgentCacheEntry {
  agentName: string
  dataHash: string
  status: string | null
  summary: string | null
  fullAnalysis: string | null
  recommendations: unknown | null
  cachedAt: string
}

/**
 * Check if cached results are still valid (hash matches).
 */
export function isCacheValid(cache: AgentCacheEntry[], currentHash: string): boolean {
  if (cache.length === 0) return false
  return cache.every((entry) => entry.dataHash === currentHash)
}
