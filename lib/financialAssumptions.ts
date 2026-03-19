// Configurable financial assumptions stored per-school in the `schools.financial_assumptions` JSONB column.
// The defaults match the migration and are used as fallback when a school hasn't customized a value.

export interface FinancialAssumptions {
  // ── Personnel ──
  benefits_load_pct: number      // % above base salary for benefits (SEBB)
  fica_rate_pct: number          // employer FICA rate
  personnel_healthy_min_pct: number  // healthy range lower bound (% of total budget)
  personnel_healthy_max_pct: number  // healthy range upper bound
  personnel_concern_pct: number      // concern threshold

  // ── Revenue ──
  salary_escalator_pct: number   // annual salary step increase assumption
  cola_rate_pct: number          // cost-of-living adjustment assumption
  operations_escalator_pct: number // annual ops cost increase assumption
  aafte_pct: number              // AAFTE as % of headcount for revenue projection
  authorizer_fee_pct: number     // authorizer admin fee as % of state revenue

  // ── Cash Flow ──
  cash_healthy_days: number      // days of reserves considered healthy
  cash_watch_days: number        // watch threshold
  cash_concern_days: number      // concern threshold
  cash_crisis_days: number       // crisis / action threshold

  // ── Operations ──
  interest_rate_pct: number      // assumed interest rate on cash reserves
}

export const DEFAULT_FINANCIAL_ASSUMPTIONS: FinancialAssumptions = {
  benefits_load_pct: 30,
  fica_rate_pct: 7.65,
  personnel_healthy_min_pct: 72,
  personnel_healthy_max_pct: 78,
  personnel_concern_pct: 80,
  salary_escalator_pct: 2.5,
  cola_rate_pct: 3.0,
  operations_escalator_pct: 2.0,
  aafte_pct: 95,
  authorizer_fee_pct: 3.0,
  cash_healthy_days: 60,
  cash_watch_days: 45,
  cash_concern_days: 30,
  cash_crisis_days: 15,
  interest_rate_pct: 2.0,
}

/**
 * Merge a partial JSONB value (from DB) with defaults.
 * Any key missing from `partial` gets the default value.
 */
export function mergeAssumptions(partial?: Partial<FinancialAssumptions> | null): FinancialAssumptions {
  if (!partial) return { ...DEFAULT_FINANCIAL_ASSUMPTIONS }
  return { ...DEFAULT_FINANCIAL_ASSUMPTIONS, ...partial }
}
