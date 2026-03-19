import { create } from 'zustand'
import type { MappedCategory, MappedGrant } from './uploadPipeline'
import {
  labelFromKey,
  paceFromKey,
  fiscalIndexFromKey,
  calculateCashPosition,
} from './fiscalYear'
import { type FinancialAssumptions, DEFAULT_FINANCIAL_ASSUMPTIONS, mergeAssumptions } from './financialAssumptions'

export type AlertSeverity = 'info' | 'warning' | 'critical'
export type GrantStatus = 'on-pace' | 'watch' | 'underspend-risk'
export type BudgetAlertStatus = 'ok' | 'watch' | 'concern' | 'action'
export type PacketStatus = 'not-started' | 'draft' | 'finalized'

export interface SchoolProfile {
  name: string
  authorizer: string
  gradesCurrentFirst: string
  gradesCurrentLast: string
  gradesBuildoutFirst: string
  gradesBuildoutLast: string
  currentFTES: number
  priorYearFTES: number
  nextBoardMeeting: string
  nextFinanceCommittee: string
  openingCashBalance: number
  operatingYear: number  // Year of operation (1-2 = Stage 1, 3+ = Stage 2 for FPF)
  // Student demographics for revenue model
  headcount: number
  spedPct: number
  frlPct: number
  ellPct: number
  hicapPct: number
  iepPct: number
}

/** Format a grade span pair as "K-5" style string */
export function formatGradeSpan(first: string, last: string): string {
  if (!first && !last) return ''
  if (first === last) return first
  return `${first}-${last}`
}

/** Parse a legacy "K-5" style grade config into first/last */
export function parseGradeConfig(config: string): { first: string; last: string } {
  if (!config) return { first: '', last: '' }
  const parts = config.split('-')
  if (parts.length === 2) return { first: parts[0], last: parts[1] }
  return { first: config, last: config }
}

export type AccountType = 'revenue' | 'expense'

export interface BudgetCategory {
  name: string
  budget: number
  ytdActuals: number
  burnRate: number
  projectedYearEnd: number
  alertStatus: BudgetAlertStatus
  accountType: AccountType
  narrative?: string
}

export interface FinancialSnapshot {
  totalBudget: number       // expense-only budget total
  revenueBudget: number     // revenue-only budget total
  ytdSpending: number
  ytdRevenue: number
  ytdExpenses: number
  cashOnHand: number
  daysOfReserves: number
  variancePercent: number
  categories: BudgetCategory[]
  monthlySpend: { month: string; amount: number; budget: number }[]
}

export interface Grant {
  id: string
  name: string
  description?: string
  awardAmount: number
  spent: number
  status: GrantStatus
}

/** Standard WA categorical grants seeded for every new school. */
export const WA_DEFAULT_GRANTS: { name: string; description: string }[] = [
  { name: 'Title I Part A', description: 'Federal funding for schools with high percentages of low-income students' },
  { name: 'Title II Part A', description: 'Teacher and principal training and recruitment' },
  { name: 'Title IV Part A', description: 'Student support and academic enrichment' },
  { name: 'IDEA (Special Education)', description: 'Federal funding for students with disabilities' },
  { name: 'LAP (Learning Assistance)', description: 'State supplemental instruction for underperforming students' },
  { name: 'TBIP (Transitional Bilingual)', description: 'State funding for English learner programs' },
  { name: 'HiCap (Highly Capable)', description: 'State funding for gifted and talented programs' },
  { name: 'MSOC (Materials, Supplies & Operating Costs)', description: 'State per-pupil allocation for materials and supplies' },
  { name: 'Lunch Program / Food Service', description: 'Federal National School Lunch Program reimbursement' },
]

/**
 * Maps WA categorical grant names to budget category name prefixes (case-insensitive).
 * When a grant has matching budget categories, their ytdActuals are summed as spent.
 */
const GRANT_CATEGORY_PREFIXES: Record<string, string[]> = {
  'Title I Part A':          ['title i part a', 'federal title i revenue'],
  'Title II Part A':         ['title ii part a'],
  'Title IV Part A':         ['title iv part a'],
  'IDEA (Special Education)':['idea special education', 'federal idea revenue'],
  'LAP (Learning Assistance)':['lap -', 'state lap revenue'],
  'TBIP (Transitional Bilingual)':['tbip -', 'state tbip revenue'],
  'HiCap (Highly Capable)':  ['hicap -', 'state hicap revenue'],
  'MSOC (Materials, Supplies & Operating Costs)': ['msoc -', 'msoc '],
  'Lunch Program / Food Service': ['lunch program', 'food service', 'national school lunch'],
}

/** Sum ytdActuals from expense budget categories whose names match any prefix for the given grant. */
function computeGrantSpentFromCategories(grantName: string, categories: BudgetCategory[]): number {
  const prefixes = GRANT_CATEGORY_PREFIXES[grantName]
  if (!prefixes || prefixes.length === 0) return 0
  let total = 0
  for (const cat of categories) {
    if (cat.accountType !== 'expense') continue
    const lower = cat.name.toLowerCase()
    if (prefixes.some((p) => lower.startsWith(p))) {
      total += Math.abs(cat.ytdActuals)
    }
  }
  return total
}

export type OtherGrantRestrictions = 'unrestricted' | 'restricted' | 'multi-year'

export interface OtherGrant {
  id: string
  name: string
  funder: string
  awardAmount: number
  startDate: string   // "YYYY-MM-DD"
  endDate: string     // "YYYY-MM-DD"
  spentToDate: number
  restrictions: OtherGrantRestrictions
  notes: string
}

export interface Alert {
  id: string
  message: string
  severity: AlertSeverity
}

export interface MonthlySnapshot {
  month: string        // "2026-02"
  label: string        // "February 2026"
  uploadedAt: string   // ISO timestamp
  filename: string
  rowCount: number
  budgetCategories: BudgetCategory[]
  grants: Grant[]
  alerts: Alert[]
  financialSummary: {
    totalBudget: number       // expense-only budget total
    revenueBudget: number     // revenue-only budget total
    totalActuals: number
    ytdRevenue: number
    ytdExpenses: number
    cashOnHand: number
    daysOfReserves: number
    variancePercent: number
  }
  monthlySpend: { month: string; amount: number; budget: number }[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface BoardPacketContent {
  financialNarrative: string
  varianceExplanations: { category: string; explanation: string }[]
  cashFlowNotes: string
}

export interface BoardPacket {
  id: string
  month: string       // "February 2026"
  monthKey: string    // "2026-02"
  status: PacketStatus
  generatedAt?: string
  content?: BoardPacketContent
}

export type SchoolContextType = 'guided' | 'freeform' | 'event_flag' | 'notification_prefs'

export interface SchoolContextEntry {
  id: string
  contextType: SchoolContextType
  key: string
  value: Record<string, unknown>
  expiresAt: string | null  // "YYYY-MM-DD" or null
}

export interface AuditChecklist {
  category: string
  checkedItems: string[]
  reviewedAt: string | null
  reviewerNote: string
}

export type AgentName = 'budget_analyst' | 'cash_sentinel' | 'grants_officer' | 'board_prep' | 'audit_compliance' | 'audit_federal' | 'audit_coordinator'
export type FindingType = 'variance' | 'cash_risk' | 'grant_underspend' | 'grant_overspend' | 'braiding_opportunity' | 'board_action_required' | 'audit_verified' | 'audit_gap' | 'audit_manual' | 'federal_risk'
export type FindingSeverity = 'info' | 'watch' | 'concern' | 'action'

export interface AgentFinding {
  id: string
  agentName: AgentName
  findingType: FindingType
  severity: FindingSeverity
  title: string
  summary: string
  detail: Record<string, unknown>
  expiresAt: string | null
  createdAt: string
}

interface AppState {
  // ── Auth / persistence ──
  schoolId: string | null
  userId: string | null
  isLoaded: boolean

  // ── Data ──
  schoolProfile: SchoolProfile
  financialData: FinancialSnapshot
  grantAwards: Grant[]         // master list from grants DB table (Settings); award amounts are source of truth
  grants: Grant[]              // merged view: award from grantAwards + spent from active snapshot
  otherGrants: OtherGrant[]
  alerts: Alert[]
  monthlySnapshots: Record<string, MonthlySnapshot>
  activeMonth: string
  chatMessages: ChatMessage[]
  boardPackets: BoardPacket[]
  schoolContextEntries: SchoolContextEntry[]
  auditChecklists: AuditChecklist[]
  agentFindings: AgentFinding[]
  lastAgentRunAt: string | null
  auditAgentsLastRun: string | null
  auditReadinessScore: number | null
  auditReadinessGrade: string | null
  financialAssumptions: FinancialAssumptions

  // ── Actions ──
  setSchoolContext: (userId: string, schoolId: string) => void
  loadFromSupabase: (userId: string, schoolId: string) => Promise<void>
  updateSchoolProfile: (profile: Partial<SchoolProfile>) => void
  setActiveMonth: (month: string) => void
  addChatMessage: (message: ChatMessage) => void
  updateChatMessage: (id: string, content: string) => void
  clearChat: () => void
  addGrant: (grant: Grant) => void
  updateGrant: (id: string, updates: Pick<Grant, 'name' | 'awardAmount'>) => void
  removeGrant: (id: string) => void
  seedDefaultGrants: () => void
  addOtherGrant: (grant: OtherGrant) => void
  removeOtherGrant: (id: string) => void
  updateOtherGrant: (id: string, updates: Partial<OtherGrant>) => void
  saveBoardPacket: (monthKey: string, content: BoardPacketContent) => void
  finalizeBoardPacket: (monthKey: string) => void
  updateBoardPacketContent: (monthKey: string, content: Partial<BoardPacketContent>) => void
  importFinancialData: (
    categories: MappedCategory[],
    month: string,
    fileName: string,
    rowCount: number,
    importedGrants?: MappedGrant[],
  ) => void
  upsertSchoolContextEntry: (entry: SchoolContextEntry) => void
  removeSchoolContextEntry: (id: string) => void
  updateAuditChecklist: (category: string, checkedItems: string[], reviewerNote?: string) => void
  markAuditReviewed: (category: string) => void
  deleteSnapshot: (monthKey: string) => void
  setAgentFindings: (findings: AgentFinding[]) => void
  setLastAgentRunAt: (ts: string) => void
  setAuditMeta: (meta: { lastRun: string; score?: number; grade?: string }) => void
  updateFinancialAssumptions: (assumptions: Partial<FinancialAssumptions>) => void
  clearSession: () => void
}

// ── Seed data ─────────────────────────────────────────────────────────────────

// Seed data reflects WA State fiscal year (Sep 1 – Aug 31).
// Active month: March 2026 = fiscal month 7 of 12, expected pace 58%.
const SEED_CATEGORIES: BudgetCategory[] = [
  {
    name: 'Personnel',
    budget: 3100000,
    ytdActuals: 2294000,
    burnRate: 74.0,
    projectedYearEnd: 3933000,  // ytdActuals / (7/12)
    alertStatus: 'concern',     // +16pp over 58% pace
    accountType: 'expense',
    narrative:
      "Personnel is tracking 16 percentage points ahead of pace at 74% of the annual budget (expected 58% through March). At the current rate, costs are projected to reach $3.93M against a $3.1M budget. Investigate substitute and overtime usage before Q4 staffing decisions are finalized.",
  },
  {
    name: 'Benefits',
    budget: 620000,
    ytdActuals: 440200,
    burnRate: 71.0,
    projectedYearEnd: 754600,   // ytdActuals / (7/12)
    alertStatus: 'concern',     // +13pp over 58% pace
    accountType: 'expense',
    narrative:
      "Benefits costs are running 13 percentage points ahead of pace at 71% of budget (expected 58% through March). At this trajectory, benefits are projected to reach $755K against a $620K budget. Verify whether benefit elections or employer contributions changed mid-year and confirm the full-year impact.",
  },
  {
    name: 'Contracted Services',
    budget: 485000,
    ytdActuals: 383150,
    burnRate: 79.0,
    projectedYearEnd: 656800,   // ytdActuals / (7/12)
    alertStatus: 'action',      // +21pp over 58% pace
    accountType: 'expense',
    narrative:
      "Contracted services require immediate attention — at 79% of budget with 5 months remaining, you're 21 percentage points over pace (expected 58%). At the current rate, you're projected to exceed this line by $172K. Review all active vendor contracts and suspend any discretionary engagements that can be deferred to next fiscal year.",
  },
  {
    name: 'Supplies',
    budget: 198000,
    ytdActuals: 160380,
    burnRate: 81.0,
    projectedYearEnd: 274900,   // ytdActuals / (7/12)
    alertStatus: 'action',      // +23pp over 58% pace
    accountType: 'expense',
    narrative:
      "Supplies spending requires immediate action — at 81% of budget with 5 months remaining (expected 58%), you're projected to overspend by $77K. Implement a purchase freeze on non-essential supplies today and redirect any remaining classroom budgets to priority items only.",
  },
  {
    name: 'Facilities',
    budget: 312000,
    ytdActuals: 202800,
    burnRate: 65.0,
    projectedYearEnd: 347700,   // ytdActuals / (7/12)
    alertStatus: 'watch',       // +7pp over 58% pace
    accountType: 'expense',
    narrative:
      "Facilities is running 7 percentage points ahead of pace at 65% of budget (expected 58% through March). At the current run rate, facilities spending is projected to reach $348K against a $312K budget. Review maintenance contracts and defer any discretionary work through year-end.",
  },
  {
    name: 'Transportation',
    budget: 148000,
    ytdActuals: 90280,
    burnRate: 61.0,
    projectedYearEnd: 154800,   // ytdActuals / (7/12)
    alertStatus: 'ok',          // +3pp — within normal range
    accountType: 'expense',
    narrative: undefined,
  },
  {
    name: 'Food Services',
    budget: 185000,
    ytdActuals: 116550,
    burnRate: 63.0,
    projectedYearEnd: 199800,   // ytdActuals / (7/12)
    alertStatus: 'ok',          // +5pp — at threshold, ok
    accountType: 'expense',
    narrative: undefined,
  },
  {
    name: 'Administrative',
    budget: 102000,
    ytdActuals: 59160,
    burnRate: 58.0,
    projectedYearEnd: 101400,   // ytdActuals / (7/12)
    alertStatus: 'ok',          // exactly at pace
    accountType: 'expense',
    narrative: undefined,
  },
]

const SEED_GRANTS: Grant[] = [
  { id: '1', name: 'Title I Part A', awardAmount: 198000, spent: 128000, status: 'on-pace' },
  { id: '2', name: 'IDEA / Special Education', awardAmount: 112000, spent: 55000, status: 'underspend-risk' },
  { id: '3', name: 'LAP', awardAmount: 89000, spent: 58000, status: 'on-pace' },
  { id: '4', name: 'TBIP', awardAmount: 67000, spent: 44000, status: 'on-pace' },
  { id: '5', name: 'HiCap', awardAmount: 28000, spent: 17000, status: 'on-pace' },
  { id: '6', name: 'ELL', awardAmount: 22000, spent: 14000, status: 'on-pace' },
]

const SEED_ALERTS: Alert[] = [
  {
    id: '1',
    message: 'Contracted Services requires immediate action — at 79% of budget with 5 months remaining (expected 58%), projected to exceed budget by $172K. Suspend discretionary vendor contracts today.',
    severity: 'warning',
  },
  {
    id: '2',
    message: 'Supplies is at 81% of budget with 5 months remaining (expected 58%). Projected to overspend by ~$77K. Implement a purchase freeze on non-essential supplies today.',
    severity: 'warning',
  },
  {
    id: '3',
    message: 'Personnel is 16 percentage points ahead of pace (74% spent vs. 58% expected). At this trajectory, costs are projected to exceed budget by $833K. Investigate overtime and substitute usage before Q4.',
    severity: 'warning',
  },
  {
    id: '4',
    message: 'IDEA / Special Education grant is only 49% spent at month 7 of 12 (expected 58%). Underspend may affect your future allocation — confirm expenditure plans with your special education coordinator.',
    severity: 'warning',
  },
]

// WA State fiscal year — monthly spend starts September 1. Update when adding multi-state support.
// Budget column uses OSPI-weighted monthly allocation; amounts show above-pace spending pattern.
const SEED_MONTHLY_SPEND = [
  { month: 'Sep', amount: 524000, budget: 464000 },  // 9% OSPI
  { month: 'Oct', amount: 498000, budget: 412000 },  // 8% OSPI
  { month: 'Nov', amount: 340000, budget: 258000 },  // 5% OSPI (low month)
  { month: 'Dec', amount: 547000, budget: 464000 },  // 9% OSPI
  { month: 'Jan', amount: 615000, budget: 438000 },  // 8.5% OSPI
  { month: 'Feb', amount: 612000, budget: 464000 },  // 9% OSPI
  { month: 'Mar', amount: 612000, budget: 464000 },  // 9% OSPI
]

const SEED_SNAPSHOT: MonthlySnapshot = {
  month: '2026-03',
  label: 'March 2026',
  uploadedAt: '2026-03-04T09:00:00.000Z',
  filename: 'cascade_charter_budget_mar2026.xlsx',
  rowCount: 8,
  budgetCategories: SEED_CATEGORIES,
  grants: SEED_GRANTS,
  alerts: SEED_ALERTS,
  financialSummary: {
    totalBudget: 5150000,
    revenueBudget: 0,
    totalActuals: 3746520,
    ytdRevenue: 0,
    ytdExpenses: 3746520,
    cashOnHand: 892000,
    daysOfReserves: 50,
    variancePercent: 24.7,  // (totalActuals − expected) / expected × 100 at 58% pace
  },
  monthlySpend: SEED_MONTHLY_SPEND,
}

const SEED_BOARD_PACKETS: BoardPacket[] = [
  { id: '1', month: 'February 2026', monthKey: '2026-02', status: 'finalized', generatedAt: '2026-02-19' },
  { id: '2', month: 'March 2026',    monthKey: '2026-03', status: 'not-started' },
]

// ── Write-through helper ───────────────────────────────────────────────────────

function writeThrough(fn: (supabase: import('@supabase/supabase-js').SupabaseClient) => Promise<void>) {
  import('@/lib/supabase').then(({ supabase }) => {
    fn(supabase).catch((err) => console.error('[store write-through]', err))
  })
}

/**
 * Merge grant award data (from Settings / DB table) with spent data.
 * Awards are the source of truth for which grants to show and their amounts.
 * Spent is derived from budget categories via GRANT_CATEGORY_PREFIXES mapping,
 * falling back to snapshot grants JSONB when no category matches are found.
 */
function mergeGrantsWithSnapshot(awards: Grant[], snapshotGrants: Grant[], budgetCategories?: BudgetCategory[]): Grant[] {
  // Build lookup: lowercase name → spent, and id → spent (fallback)
  const spentByName = new Map<string, number>()
  const spentById = new Map<string, number>()
  const statusByName = new Map<string, GrantStatus>()
  for (const sg of snapshotGrants) {
    spentByName.set(sg.name.toLowerCase(), sg.spent)
    spentById.set(sg.id, sg.spent)
    statusByName.set(sg.name.toLowerCase(), sg.status)
  }

  return awards.map((award) => {
    // Prefer spent derived from budget category mapping
    const catSpent = budgetCategories ? computeGrantSpentFromCategories(award.name, budgetCategories) : 0
    const snapshotSpent = spentById.get(award.id) ?? spentByName.get(award.name.toLowerCase()) ?? 0
    const spent = catSpent > 0 ? catSpent : snapshotSpent
    const status = statusByName.get(award.name.toLowerCase()) ?? award.status
    return { ...award, spent, status }
  })
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>((set, get) => ({
  // ── Auth / persistence ──
  schoolId: null,
  userId: null,
  isLoaded: false,

  // ── Data (seed) ──
  schoolProfile: {
    name: 'Cascade Charter School',
    authorizer: 'WA Charter School Commission',
    gradesCurrentFirst: 'K',
    gradesCurrentLast: '8',
    gradesBuildoutFirst: 'K',
    gradesBuildoutLast: '8',
    currentFTES: 432,
    priorYearFTES: 418,
    nextBoardMeeting: '2026-03-26',
    nextFinanceCommittee: '2026-03-19',
    openingCashBalance: 338000,
    operatingYear: 3,
    headcount: 450,
    spedPct: 14,
    frlPct: 52,
    ellPct: 12,
    hicapPct: 5,
    iepPct: 14,
  },
  financialData: {
    totalBudget: 5150000,
    revenueBudget: 0,
    ytdSpending: 3746520,
    ytdRevenue: 0,
    ytdExpenses: 3746520,
    cashOnHand: 892000,
    daysOfReserves: 50,
    variancePercent: 9.1,
    categories: SEED_CATEGORIES,
    monthlySpend: SEED_MONTHLY_SPEND,
  },
  grantAwards: SEED_GRANTS,
  grants: SEED_GRANTS,
  otherGrants: [],
  alerts: SEED_ALERTS,
  monthlySnapshots: { '2026-03': SEED_SNAPSHOT },
  activeMonth: '2026-03',
  chatMessages: [],
  boardPackets: SEED_BOARD_PACKETS,
  schoolContextEntries: [],
  auditChecklists: [],
  agentFindings: [],
  lastAgentRunAt: null,
  auditAgentsLastRun: null,
  auditReadinessScore: null,
  auditReadinessGrade: null,
  financialAssumptions: { ...DEFAULT_FINANCIAL_ASSUMPTIONS },

  // ── Auth actions ──

  setSchoolContext: (userId, schoolId) => set({ userId, schoolId }),

  loadFromSupabase: async (userId, schoolId) => {
    if (get().isLoaded) return

    const { supabase } = await import('@/lib/supabase')

    // 1. Load school profile
    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .single()

    if (school) {
      // Fix demo data: rename Cedar Grove → Cascade Charter School and persist to DB
      const schoolName = school.name === 'Cedar Grove' ? 'Cascade Charter School' : school.name
      if (school.name === 'Cedar Grove') {
        writeThrough(async (sb) => {
          const { error } = await sb.from('schools').update({ name: 'Cascade Charter School' }).eq('id', schoolId)
          if (error) console.error('[store] fixSchoolName', error)
        })
      }
      // Fall back to existing store values (seed) for fields not yet saved by the user
      const existing = get().schoolProfile
      set({
        schoolProfile: {
          name: schoolName,
          authorizer: school.authorizer || existing.authorizer,
          gradesCurrentFirst: school.grades_current_first || existing.gradesCurrentFirst,
          gradesCurrentLast: school.grades_current_last || existing.gradesCurrentLast,
          gradesBuildoutFirst: school.grades_buildout_first || existing.gradesBuildoutFirst,
          gradesBuildoutLast: school.grades_buildout_last || existing.gradesBuildoutLast,
          currentFTES: Number(school.current_ftes) || existing.currentFTES,
          priorYearFTES: Number(school.prior_year_ftes) || existing.priorYearFTES,
          nextBoardMeeting: school.next_board_meeting || existing.nextBoardMeeting,
          nextFinanceCommittee: school.next_finance_committee || existing.nextFinanceCommittee,
          openingCashBalance: school.opening_cash_balance != null ? Number(school.opening_cash_balance) : existing.openingCashBalance,
          operatingYear: Number(school.operating_year) || existing.operatingYear,
          headcount: Number(school.headcount) || existing.headcount,
          spedPct: Number(school.sped_pct) || existing.spedPct,
          frlPct: Number(school.frl_pct) || existing.frlPct,
          ellPct: Number(school.ell_pct) || existing.ellPct,
          hicapPct: Number(school.hicap_pct) || existing.hicapPct,
          iepPct: Number(school.iep_pct) || existing.iepPct,
        },
        auditAgentsLastRun: school.audit_agents_last_run ?? null,
        auditReadinessScore: school.audit_readiness_score ?? null,
        auditReadinessGrade: school.audit_readiness_grade ?? null,
        financialAssumptions: mergeAssumptions(school.financial_assumptions as Partial<FinancialAssumptions> | null),
      })
    }

    // 2. Load monthly snapshots
    const { data: snapshotRows } = await supabase
      .from('monthly_snapshots')
      .select('*')
      .eq('school_id', schoolId)
      .order('month_key', { ascending: true })

    if (snapshotRows && snapshotRows.length > 0) {
      const monthlySnapshots: Record<string, MonthlySnapshot> = {}
      for (const row of snapshotRows) {
        const summary = row.financial_summary as {
          totalBudget: number
          revenueBudget?: number
          totalActuals: number
          ytdRevenue?: number
          ytdExpenses?: number
          cashOnHand: number
          daysOfReserves: number
          variancePercent: number
          monthlySpend?: { month: string; amount: number; budget: number }[]
          grants?: Grant[]
          alerts?: Alert[]
        }
        // Backwards compat: older snapshots may not have ytdRevenue/ytdExpenses.
        // Fall back to 0 revenue and totalActuals as expenses.
        const ytdRevenue = summary.ytdRevenue ?? 0
        const ytdExpenses = summary.ytdExpenses ?? summary.totalActuals
        // Backwards compat: older snapshots stored revenue+expense in totalBudget.
        // If revenueBudget is missing, derive expense-only totalBudget from categories.
        const cats = (row.budget_categories as BudgetCategory[]) ?? []
        let totalBudget = summary.totalBudget
        let revenueBudget = summary.revenueBudget ?? 0
        if (summary.revenueBudget == null && cats.length > 0) {
          totalBudget = cats
            .filter((c) => c.accountType === 'expense')
            .reduce((s, c) => s + c.budget, 0)
          revenueBudget = cats
            .filter((c) => c.accountType === 'revenue')
            .reduce((s, c) => s + c.budget, 0)
        }
        monthlySnapshots[row.month_key] = {
          month: row.month_key,
          label: row.label,
          uploadedAt: row.uploaded_at,
          filename: row.filename,
          rowCount: row.row_count,
          budgetCategories: cats,
          grants: summary.grants ?? [],
          alerts: summary.alerts ?? [],
          financialSummary: {
            totalBudget,
            revenueBudget,
            totalActuals: summary.totalActuals,
            ytdRevenue,
            ytdExpenses,
            cashOnHand: summary.cashOnHand,
            daysOfReserves: summary.daysOfReserves,
            variancePercent: summary.variancePercent,
          },
          monthlySpend: summary.monthlySpend ?? [],
        }
      }

      const latestKey = snapshotRows[snapshotRows.length - 1].month_key
      const latestSnap = monthlySnapshots[latestKey]
      const existingFinancial = get().financialData
      // Calculate cash position: opening + ytdRevenue - ytdExpenses
      const openingCash = get().schoolProfile.openingCashBalance
      const latestFiscalIdx = fiscalIndexFromKey(latestKey)
      const latestMonthlyBurn = latestFiscalIdx > 0 ? latestSnap.financialSummary.ytdExpenses / latestFiscalIdx : 0
      const { cashOnHand: calcCash, daysOfReserves: calcDays } = calculateCashPosition(
        openingCash,
        latestSnap.financialSummary.ytdRevenue,
        latestSnap.financialSummary.ytdExpenses,
        latestMonthlyBurn,
      )
      set({
        monthlySnapshots,
        activeMonth: latestKey,
        financialData: {
          totalBudget: latestSnap.financialSummary.totalBudget,
          revenueBudget: latestSnap.financialSummary.revenueBudget,
          ytdSpending: latestSnap.financialSummary.totalActuals,
          ytdRevenue: latestSnap.financialSummary.ytdRevenue,
          ytdExpenses: latestSnap.financialSummary.ytdExpenses,
          cashOnHand: calcCash,
          daysOfReserves: calcDays,
          variancePercent: latestSnap.financialSummary.variancePercent,
          categories: latestSnap.budgetCategories,
          monthlySpend: latestSnap.monthlySpend,
        },
        grants: latestSnap.grants,
        alerts: latestSnap.alerts,
      })
    } else {
      // No data yet — clear seed
      set({
        monthlySnapshots: {},
        grantAwards: [],
        grants: [],
        alerts: [],
        financialData: {
          totalBudget: 0,
          revenueBudget: 0,
          ytdSpending: 0,
          ytdRevenue: 0,
          ytdExpenses: 0,
          cashOnHand: 0,
          daysOfReserves: 0,
          variancePercent: 0,
          categories: [],
          monthlySpend: [],
        },
      })
    }

    // 3. Load grants
    const { data: grantRows } = await supabase
      .from('grants')
      .select('*')
      .eq('school_id', schoolId)
      .order('sort_order', { ascending: true })

    // Deduplicate categorical grants by name — keep the one with the highest award amount.
    // Duplicates arise when a grant is added manually in Settings and also imported from a file.
    // Build description lookup from WA defaults (DB doesn't store descriptions)
    const defaultDescByName = new Map(
      WA_DEFAULT_GRANTS.map((d) => [d.name.toLowerCase(), d.description])
    )
    const rawCategorical = (grantRows ?? [])
      .filter((g) => g.grant_type === 'categorical')
      .map((g) => ({
        id: g.id as string,
        name: g.name as string,
        description: defaultDescByName.get((g.name as string).toLowerCase()),
        awardAmount: Number(g.award_amount),
        spent: 0,  // spent comes from snapshot, not DB
        status: (g.restrictions as GrantStatus) ?? 'on-pace',
      }))
    const grantByName = new Map<string, Grant>()
    for (const g of rawCategorical) {
      const key = g.name.toLowerCase()
      const existing = grantByName.get(key)
      if (!existing || g.awardAmount > existing.awardAmount) grantByName.set(key, g)
    }
    const categoricalGrants: Grant[] = Array.from(grantByName.values())

    const otherGrantList: OtherGrant[] = (grantRows ?? [])
      .filter((g) => g.grant_type === 'other')
      .map((g) => ({
        id: g.id,
        name: g.name,
        funder: g.funder ?? '',
        awardAmount: Number(g.award_amount),
        startDate: g.start_date ?? '',
        endDate: g.end_date ?? '',
        spentToDate: Number(g.spent_to_date),
        restrictions: (g.restrictions as OtherGrantRestrictions) ?? 'unrestricted',
        notes: g.notes ?? '',
      }))

    // grantAwards = DB table (Settings) as source of truth for award amounts.
    // grants = merged view joining awards with spent from the active snapshot.
    const activeSnap = get().monthlySnapshots[get().activeMonth]
    const snapshotGrants = activeSnap?.grants ?? []

    if (categoricalGrants.length > 0) {
      const merged = mergeGrantsWithSnapshot(categoricalGrants, snapshotGrants, activeSnap?.budgetCategories)
      set({ grantAwards: categoricalGrants, grants: merged, otherGrants: otherGrantList })
    } else {
      // No categorical grants in DB — clear grantAwards so seedDefaultGrants can run
      set({ grantAwards: [], grants: [], otherGrants: otherGrantList })
    }

    // 4. Load board packets
    const { data: packetRows } = await supabase
      .from('board_packets')
      .select('*')
      .eq('school_id', schoolId)
      .order('month_key', { ascending: false })

    if (packetRows && packetRows.length > 0) {
      const boardPackets: BoardPacket[] = packetRows.map((p) => ({
        id: p.id,
        month: p.month_label,
        monthKey: p.month_key,
        status: p.status as PacketStatus,
        generatedAt: p.generated_at ?? undefined,
        content: p.content as BoardPacketContent | undefined,
      }))
      set({ boardPackets })
    } else {
      set({ boardPackets: [] })
    }

    // 5. Load school context entries
    const { data: ctxRows } = await supabase
      .from('school_context')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: true })

    if (ctxRows && ctxRows.length > 0) {
      set({
        schoolContextEntries: ctxRows.map((r) => ({
          id: r.id,
          contextType: r.context_type as SchoolContextType,
          key: r.key,
          value: (r.value as Record<string, unknown>) ?? {},
          expiresAt: r.expires_at ?? null,
        })),
      })
    }

    // 6. Load audit checklists
    const { data: auditRows } = await supabase
      .from('audit_checklists')
      .select('*')
      .eq('school_id', schoolId)

    if (auditRows && auditRows.length > 0) {
      set({
        auditChecklists: auditRows.map((r) => ({
          category: r.category,
          checkedItems: (r.checked_items as string[]) ?? [],
          reviewedAt: r.reviewed_at ?? null,
          reviewerNote: r.reviewer_note ?? '',
        })),
      })
    }

    // 7. Load agent findings (last 7 days for regular agents, all time for audit agents)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const today = new Date().toISOString().slice(0, 10)
    const auditAgentNames = ['audit_compliance', 'audit_federal', 'audit_coordinator']
    const [{ data: recentRows }, { data: auditFindingRows }] = await Promise.all([
      supabase
        .from('agent_findings')
        .select('*')
        .eq('school_id', schoolId)
        .not('agent_name', 'in', `(${auditAgentNames.join(',')})`)
        .gte('created_at', sevenDaysAgo)
        .or(`expires_at.is.null,expires_at.gte.${today}`)
        .order('created_at', { ascending: false }),
      supabase
        .from('agent_findings')
        .select('*')
        .eq('school_id', schoolId)
        .in('agent_name', auditAgentNames)
        .order('created_at', { ascending: false }),
    ])
    const findingRows = [...(recentRows ?? []), ...(auditFindingRows ?? [])]

    if (findingRows && findingRows.length > 0) {
      set({
        agentFindings: findingRows.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          agentName: r.agent_name as AgentName,
          findingType: r.finding_type as FindingType,
          severity: r.severity as FindingSeverity,
          title: r.title as string,
          summary: r.summary as string,
          detail: (r.detail as Record<string, unknown>) ?? {},
          expiresAt: (r.expires_at as string) ?? null,
          createdAt: r.created_at as string,
        })),
      })
    }

    // Seed default WA categorical grants if the school has none yet
    const currentAwards = get().grantAwards
    if (currentAwards.length === 0) {
      const defaults: Grant[] = WA_DEFAULT_GRANTS.map((g) => ({
        id: crypto.randomUUID(),
        name: g.name,
        description: g.description,
        awardAmount: 0,
        spent: 0,
        status: 'on-pace' as GrantStatus,
      }))
      const snap = get().monthlySnapshots[get().activeMonth]
      set({
        grantAwards: defaults,
        grants: mergeGrantsWithSnapshot(defaults, snap?.grants ?? [], snap?.budgetCategories),
      })
      const seedRows = defaults.map((g, i) => ({
        id: g.id,
        school_id: schoolId,
        grant_type: 'categorical',
        name: g.name,
        award_amount: 0,
        spent_to_date: 0,
        restrictions: 'on-pace',
        sort_order: i,
      }))
      const { error: seedErr } = await supabase.from('grants').insert(seedRows)
      if (seedErr) {
        console.error('[store] seed grants insert failed:', seedErr.message, seedErr.code, seedErr.details, seedErr.hint)
      }
    }

    set({ isLoaded: true })
  },

  // ── Profile ──

  updateSchoolProfile: (profile) => {
    set((state) => ({ schoolProfile: { ...state.schoolProfile, ...profile } }))
    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        const updated = { ...get().schoolProfile, ...profile }
        const { error } = await supabase
          .from('schools')
          .update({
            name: updated.name,
            authorizer: updated.authorizer,
            grades_current_first: updated.gradesCurrentFirst,
            grades_current_last: updated.gradesCurrentLast,
            grades_buildout_first: updated.gradesBuildoutFirst,
            grades_buildout_last: updated.gradesBuildoutLast,
            current_ftes: updated.currentFTES,
            prior_year_ftes: updated.priorYearFTES,
            next_board_meeting: updated.nextBoardMeeting || null,
            next_finance_committee: updated.nextFinanceCommittee || null,
            opening_cash_balance: updated.openingCashBalance ?? 0,
            operating_year: updated.operatingYear ?? 3,
            headcount: updated.headcount ?? 0,
            sped_pct: updated.spedPct ?? 0,
            frl_pct: updated.frlPct ?? 0,
            ell_pct: updated.ellPct ?? 0,
            hicap_pct: updated.hicapPct ?? 0,
            iep_pct: updated.iepPct ?? 0,
          })
          .eq('id', schoolId)
        if (error) console.error('[store] updateSchoolProfile', error)
      })
    }
  },

  updateFinancialAssumptions: (assumptions) => {
    const merged = { ...get().financialAssumptions, ...assumptions }
    set({ financialAssumptions: merged })
    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        const { error } = await supabase
          .from('schools')
          .update({ financial_assumptions: merged })
          .eq('id', schoolId)
        if (error) console.error('[store] updateFinancialAssumptions', error)
      })
    }
  },

  // ── Month ──

  setActiveMonth: (month) => {
    const snap = get().monthlySnapshots[month]
    if (!snap) return
    const openingCash = get().schoolProfile.openingCashBalance
    const monthFiscalIdx = fiscalIndexFromKey(month)
    const monthlyBurn = monthFiscalIdx > 0 ? snap.financialSummary.ytdExpenses / monthFiscalIdx : 0
    const { cashOnHand, daysOfReserves } = calculateCashPosition(
      openingCash,
      snap.financialSummary.ytdRevenue,
      snap.financialSummary.ytdExpenses,
      monthlyBurn,
    )
    set({
      activeMonth: month,
      financialData: {
        totalBudget: snap.financialSummary.totalBudget,
        revenueBudget: snap.financialSummary.revenueBudget,
        ytdSpending: snap.financialSummary.totalActuals,
        ytdRevenue: snap.financialSummary.ytdRevenue,
        ytdExpenses: snap.financialSummary.ytdExpenses,
        cashOnHand,
        daysOfReserves,
        variancePercent: snap.financialSummary.variancePercent,
        categories: snap.budgetCategories,
        monthlySpend: snap.monthlySpend,
      },
      // Re-merge grants: award amounts from grantAwards (Settings), spent from this month's snapshot.
      grants: mergeGrantsWithSnapshot(get().grantAwards, snap.grants, snap.budgetCategories),
      alerts: snap.alerts,
    })
  },

  deleteSnapshot: (monthKey) => {
    const { monthlySnapshots, activeMonth, schoolId } = get()
    const updated = { ...monthlySnapshots }
    delete updated[monthKey]

    // If deleting the active month, switch to the most recent remaining month
    const remainingKeys = Object.keys(updated)
    const newActive = monthKey === activeMonth && remainingKeys.length > 0
      ? remainingKeys.sort().reverse()[0]
      : activeMonth

    const newSnap = updated[newActive]
    const newState: Partial<AppState> = { monthlySnapshots: updated, activeMonth: newActive }

    if (newSnap) {
      const openingCash = get().schoolProfile.openingCashBalance
      const newFiscalIdx = fiscalIndexFromKey(newActive)
      const newMonthlyBurn = newFiscalIdx > 0 ? newSnap.financialSummary.ytdExpenses / newFiscalIdx : 0
      const { cashOnHand, daysOfReserves } = calculateCashPosition(
        openingCash,
        newSnap.financialSummary.ytdRevenue,
        newSnap.financialSummary.ytdExpenses,
        newMonthlyBurn,
      )
      newState.financialData = {
        totalBudget: newSnap.financialSummary.totalBudget,
        revenueBudget: newSnap.financialSummary.revenueBudget,
        ytdSpending: newSnap.financialSummary.totalActuals,
        ytdRevenue: newSnap.financialSummary.ytdRevenue,
        ytdExpenses: newSnap.financialSummary.ytdExpenses,
        cashOnHand,
        daysOfReserves,
        variancePercent: newSnap.financialSummary.variancePercent,
        categories: newSnap.budgetCategories,
        monthlySpend: newSnap.monthlySpend,
      }
      newState.grants = mergeGrantsWithSnapshot(get().grantAwards, newSnap.grants, newSnap.budgetCategories)
      newState.alerts = newSnap.alerts
    }

    set(newState)

    if (schoolId) {
      writeThrough(async (supabase) => {
        const { error } = await supabase
          .from('monthly_snapshots')
          .delete()
          .eq('school_id', schoolId)
          .eq('month_key', monthKey)
        if (error) console.error('[store] deleteSnapshot', error)
      })
    }
  },

  // ── Chat ──

  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),

  updateChatMessage: (id, content) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((m) => (m.id === id ? { ...m, content } : m)),
    })),

  clearChat: () => set({ chatMessages: [] }),

  // ── Grants ──

  addGrant: (grant) => {
    // Deduplicate by name — if a grant with the same name exists, update it instead of adding a duplicate.
    set((state) => {
      const existingIdx = state.grantAwards.findIndex(
        (g) => g.name.toLowerCase() === grant.name.toLowerCase()
      )
      let newAwards: Grant[]
      if (existingIdx >= 0) {
        newAwards = [...state.grantAwards]
        newAwards[existingIdx] = { ...newAwards[existingIdx], ...grant }
      } else {
        newAwards = [...state.grantAwards, grant]
      }
      const snap = state.monthlySnapshots[state.activeMonth]
      return { grantAwards: newAwards, grants: mergeGrantsWithSnapshot(newAwards, snap?.grants ?? [], snap?.budgetCategories) }
    })
    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        const { error } = await supabase.from('grants').insert({
          id: grant.id,
          school_id: schoolId,
          grant_type: 'categorical',
          name: grant.name,
          award_amount: grant.awardAmount,
          spent_to_date: grant.spent,
          restrictions: grant.status,
        })
        if (error) console.error('[store] addGrant', error)
      })
    }
  },

  updateGrant: (id, updates) => {
    set((state) => {
      const newAwards = state.grantAwards.map((g) => (g.id === id ? { ...g, ...updates } : g))
      const snap = state.monthlySnapshots[state.activeMonth]
      return { grantAwards: newAwards, grants: mergeGrantsWithSnapshot(newAwards, snap?.grants ?? [], snap?.budgetCategories) }
    })
    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        const grant = get().grants.find((g) => g.id === id)
        if (!grant) return
        const { error } = await supabase
          .from('grants')
          .update({
            name: grant.name,
            award_amount: grant.awardAmount,
            spent_to_date: grant.spent,
            restrictions: grant.status,
          })
          .eq('id', id)
          .eq('school_id', schoolId)
        if (error) console.error('[store] updateGrant', { message: error.message, code: error.code, details: error.details, hint: error.hint })
      })
    }
  },

  removeGrant: (id) => {
    set((state) => {
      const newAwards = state.grantAwards.filter((g) => g.id !== id)
      const snap = state.monthlySnapshots[state.activeMonth]
      return { grantAwards: newAwards, grants: mergeGrantsWithSnapshot(newAwards, snap?.grants ?? [], snap?.budgetCategories) }
    })
    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        const { error } = await supabase.from('grants').delete().eq('id', id)
        if (error) console.error('[store] removeGrant', error)
      })
    }
  },

  seedDefaultGrants: () => {
    const { grantAwards, schoolId, monthlySnapshots, activeMonth } = get()
    // Only seed if no categorical grants exist yet
    if (grantAwards.length > 0) return
    if (!schoolId) {
      console.warn('[store] seedDefaultGrants: no schoolId, skipping DB insert')
      return
    }

    const defaults: Grant[] = WA_DEFAULT_GRANTS.map((g) => ({
      id: crypto.randomUUID(),
      name: g.name,
      description: g.description,
      awardAmount: 0,
      spent: 0,
      status: 'on-pace' as GrantStatus,
    }))

    const snap = monthlySnapshots[activeMonth]
    set({
      grantAwards: defaults,
      grants: mergeGrantsWithSnapshot(defaults, snap?.grants ?? [], snap?.budgetCategories),
    })

    writeThrough(async (supabase) => {
      const rows = defaults.map((g, i) => ({
        id: g.id,
        school_id: schoolId,
        grant_type: 'categorical',
        name: g.name,
        award_amount: 0,
        spent_to_date: 0,
        restrictions: 'on-pace',
        sort_order: i,
      }))
      const { error } = await supabase.from('grants').insert(rows)
      if (error) {
        console.error('[store] seedDefaultGrants insert failed:', error.message, error.code, error.details, error.hint)
      }
    })
  },

  addOtherGrant: (grant) => {
    set((state) => ({ otherGrants: [...state.otherGrants, grant] }))
    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        const { error } = await supabase.from('grants').insert({
          id: grant.id,
          school_id: schoolId,
          grant_type: 'other',
          name: grant.name,
          funder: grant.funder,
          award_amount: grant.awardAmount,
          spent_to_date: grant.spentToDate,
          restrictions: grant.restrictions,
          start_date: grant.startDate || null,
          end_date: grant.endDate || null,
          notes: grant.notes,
        })
        if (error) console.error('[store] addOtherGrant', error)
      })
    }
  },

  removeOtherGrant: (id) => {
    set((state) => ({ otherGrants: state.otherGrants.filter((g) => g.id !== id) }))
    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        const { error } = await supabase.from('grants').delete().eq('id', id)
        if (error) console.error('[store] removeOtherGrant', error)
      })
    }
  },

  updateOtherGrant: (id, updates) => {
    set((state) => ({
      otherGrants: state.otherGrants.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    }))
    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        const grant = get().otherGrants.find((g) => g.id === id)
        if (!grant) return
        const { error } = await supabase
          .from('grants')
          .update({
            name: grant.name,
            funder: grant.funder,
            award_amount: grant.awardAmount,
            spent_to_date: grant.spentToDate,
            start_date: grant.startDate || null,
            end_date: grant.endDate || null,
            restrictions: grant.restrictions,
            notes: grant.notes,
          })
          .eq('id', id)
          .eq('school_id', schoolId)
        if (error) console.error('[store] updateOtherGrant', { message: error.message, code: error.code, details: error.details, hint: error.hint })
      })
    }
  },

  // ── Financial Data Import ──

  importFinancialData: (categories, month, fileName, rowCount, importedGrants) => {
    const pace = paceFromKey(month)
    const fiscalIdx = fiscalIndexFromKey(month)
    const monthsLeft = 12 - fiscalIdx

    function deriveNarrative(
      name: string,
      budget: number,
      ytdActuals: number,
      burnRate: number,
      projectedYearEnd: number,
      alertStatus: BudgetAlertStatus
    ): string | undefined {
      if (alertStatus === 'ok') return undefined
      const overage = projectedYearEnd - budget
      const overageStr =
        overage >= 0
          ? `exceed the budget by $${overage.toLocaleString()}`
          : `come in $${Math.abs(overage).toLocaleString()} under budget`
      const expectedPct = Math.round(pace * 100)
      const burnFmt = Math.round(burnRate)
      if (alertStatus === 'action') {
        return `${name} spending requires immediate attention — ${burnFmt}% of the annual budget has been spent with ${monthsLeft} months remaining (expected ${expectedPct}%). At this pace, you're projected to ${overageStr}.`
      }
      if (alertStatus === 'concern') {
        return `${name} is running ahead of pace at ${burnFmt}% of budget (expected ${expectedPct}%). You're on track to ${overageStr}. Review recent expenses to determine if this is a timing issue or a structural shortfall.`
      }
      const isUnderspend = ytdActuals / budget < pace - 0.1
      if (isUnderspend) {
        return `${name} spending is below pace at ${burnFmt}% of budget (expected ${expectedPct}%). Confirm that all planned expenses are captured and not miscoded to another category.`
      }
      return `${name} is slightly ahead of pace at ${burnFmt}% of budget. Monitor closely over the coming months.`
    }

    const newCategories: BudgetCategory[] = categories.map((cat) => {
      const burnRate = cat.budget > 0 ? (cat.ytdActuals / cat.budget) * 100 : 0
      // Percentage-point difference: burnRate% minus expected pace% (e.g. 74% − 67% = +7pp)
      const variance = burnRate - pace * 100
      let alertStatus: BudgetAlertStatus
      if (variance > 20) alertStatus = 'action'
      else if (variance > 10) alertStatus = 'concern'
      else if (variance > 5) alertStatus = 'watch'
      else if (variance < -20) alertStatus = 'watch'
      else alertStatus = 'ok'

      const projectedYearEnd = pace > 0 ? Math.round(cat.ytdActuals / pace) : cat.budget
      return {
        name: cat.category,
        budget: cat.budget,
        ytdActuals: cat.ytdActuals,
        burnRate: Math.round(burnRate * 10) / 10,
        projectedYearEnd,
        alertStatus,
        accountType: cat.accountType ?? 'expense' as const,
        narrative: deriveNarrative(
          cat.category, cat.budget, cat.ytdActuals, burnRate, projectedYearEnd, alertStatus
        ),
      }
    })

    const totalActuals = newCategories.reduce((s, c) => s + c.ytdActuals, 0)
    const ytdRevenue = newCategories
      .filter((c) => c.accountType === 'revenue')
      .reduce((s, c) => s + c.ytdActuals, 0)
    const ytdExpenses = newCategories
      .filter((c) => c.accountType === 'expense')
      .reduce((s, c) => s + c.ytdActuals, 0)
    const totalBudget = newCategories
      .filter((c) => c.accountType === 'expense')
      .reduce((s, c) => s + c.budget, 0)
    const revenueBudget = newCategories
      .filter((c) => c.accountType === 'revenue')
      .reduce((s, c) => s + c.budget, 0)
    const expectedSpending = totalBudget * pace
    const variancePercent = expectedSpending > 0
      ? parseFloat((((ytdExpenses - expectedSpending) / expectedSpending) * 100).toFixed(1))
      : 0

    const existingAlerts = get().alerts
    const cashAlert = existingAlerts.find((a) => a.severity === 'critical')
    const newAlerts: Alert[] = cashAlert ? [cashAlert] : []

    if (Math.abs(variancePercent) > 3) {
      newAlerts.push({
        id: (Date.now() + 1).toString(),
        message: `YTD spending is ${Math.abs(variancePercent).toFixed(1)}% ${
          variancePercent > 0 ? 'ahead of' : 'below'
        } budget pace based on imported data.`,
        severity: 'warning',
      })
    }
    newCategories
      .filter((c) => c.alertStatus === 'action')
      .forEach((c, i) => {
        newAlerts.push({
          id: (Date.now() + 2 + i).toString(),
          message: `${c.name} is at ${c.burnRate.toFixed(0)}% of budget with ${monthsLeft} months remaining.`,
          severity: 'warning',
        })
      })

    // Cash position: opening balance + actual revenue received - actual expenses
    const openingCash = get().schoolProfile.openingCashBalance
    const monthlyExpenseBurn = fiscalIdx > 0 ? ytdExpenses / fiscalIdx : 0
    const { cashOnHand, daysOfReserves } = calculateCashPosition(
      openingCash, ytdRevenue, ytdExpenses, monthlyExpenseBurn
    )

    // Capture existing grants before modifying state — used for name-matching and UUID reuse.
    const existingGrants = get().grants

    // Derive Grant[] from uploaded grant rows (if any), otherwise keep existing.
    let snapshotGrants: Grant[]
    if (importedGrants && importedGrants.length > 0) {
      snapshotGrants = importedGrants.map((g) => {
        const spentPct = g.awardAmount > 0 ? g.spent / g.awardAmount : 0
        let status: GrantStatus
        if (spentPct < pace - 0.15) status = 'underspend-risk'
        else if (spentPct > pace + 0.10) status = 'watch'
        else status = 'on-pace'
        // Reuse the existing Supabase UUID when the grant name matches; otherwise mint a new one.
        const existing = existingGrants.find(
          (eg) => eg.name.toLowerCase() === g.name.toLowerCase()
        )
        return {
          id: existing?.id ?? crypto.randomUUID(),
          name: g.name,
          awardAmount: g.awardAmount,
          spent: g.spent > 0 ? g.spent : (existing?.spent ?? 0),
          status,
        }
      })
    } else {
      snapshotGrants = existingGrants
    }

    const newSnapshot: MonthlySnapshot = {
      month,
      label: labelFromKey(month),
      uploadedAt: new Date().toISOString(),
      filename: fileName,
      rowCount,
      budgetCategories: newCategories,
      grants: snapshotGrants,
      alerts: newAlerts,
      financialSummary: {
        totalBudget,
        revenueBudget,
        totalActuals,
        ytdRevenue,
        ytdExpenses,
        cashOnHand,
        daysOfReserves,
        variancePercent,
      },
      monthlySpend: [],
    }

    set((state) => {
      // When imports bring grants, update grantAwards (the master list) with new award amounts.
      // Then merge with snapshot spent data to produce the display grants.
      const newAwards = importedGrants && importedGrants.length > 0
        ? snapshotGrants.map((sg) => ({ ...sg, spent: 0 }))  // awards store base data, spent=0
        : state.grantAwards
      return {
        monthlySnapshots: { ...state.monthlySnapshots, [month]: newSnapshot },
        activeMonth: month,
        financialData: {
          ...state.financialData,
          totalBudget,
          revenueBudget,
          ytdSpending: totalActuals,
          ytdRevenue,
          ytdExpenses,
          cashOnHand,
          daysOfReserves,
          variancePercent,
          categories: newCategories,
          monthlySpend: [],
        },
        grantAwards: newAwards,
        grants: mergeGrantsWithSnapshot(newAwards, snapshotGrants, newCategories),
        alerts: newAlerts,
      }
    })

    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        // Update or create each grant from the upload in the grants table.
        if (importedGrants && importedGrants.length > 0) {
          for (const grant of snapshotGrants) {
            const wasExisting = existingGrants.some((eg) => eg.id === grant.id)
            if (wasExisting) {
              const updatePayload: Record<string, unknown> = {
                award_amount: grant.awardAmount,
                restrictions: grant.status,
              }
              // Only update spent_to_date when the import has a real value — don't clobber
              // existing spent data with 0 when the CSV had no grant-spent column.
              if (grant.spent > 0) updatePayload.spent_to_date = grant.spent
              const { error } = await supabase
                .from('grants')
                .update(updatePayload)
                .eq('id', grant.id)
                .eq('school_id', schoolId)
              if (error) console.error('[store] importFinancialData update grant', { message: error.message, code: error.code, details: error.details, hint: error.hint })
            } else {
              const { error } = await supabase
                .from('grants')
                .insert({
                  id: grant.id,
                  school_id: schoolId,
                  grant_type: 'categorical',
                  name: grant.name,
                  award_amount: grant.awardAmount,
                  spent_to_date: grant.spent,
                  restrictions: grant.status,
                })
              if (error) console.error('[store] importFinancialData insert grant', { message: error.message, code: error.code, details: error.details, hint: error.hint })
            }
          }
        }

        // Save the snapshot with grants embedded as a point-in-time record.
        const financialSummary = {
          totalBudget,
          totalActuals,
          ytdRevenue,
          ytdExpenses,
          cashOnHand,
          daysOfReserves,
          variancePercent,
          monthlySpend: [],
          grants: snapshotGrants,
          alerts: newAlerts,
        }
        const { error } = await supabase
          .from('monthly_snapshots')
          .upsert(
            {
              school_id: schoolId,
              month_key: month,
              label: labelFromKey(month),
              uploaded_at: newSnapshot.uploadedAt,
              filename: fileName,
              row_count: rowCount,
              budget_categories: newCategories,
              financial_summary: financialSummary,
            },
            { onConflict: 'school_id,month_key' }
          )
        if (error) console.error('[store] importFinancialData snapshot', error)
      })
    }
  },

  // ── Board Packets ──

  saveBoardPacket: (monthKey, content) => {
    const label = labelFromKey(monthKey)
    const now = new Date().toISOString().split('T')[0]
    set((state) => {
      const existing = state.boardPackets.find((p) => p.monthKey === monthKey)
      if (existing) {
        return {
          boardPackets: state.boardPackets.map((p) =>
            p.monthKey === monthKey
              ? { ...p, content, status: 'draft' as const, generatedAt: now }
              : p
          ),
        }
      }
      return {
        boardPackets: [
          ...state.boardPackets,
          { id: Date.now().toString(), month: label, monthKey, status: 'draft' as const, generatedAt: now, content },
        ],
      }
    })
    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        // Try update first; if no rows matched (new packet), insert instead.
        // Avoids relying on a unique constraint for upsert conflict resolution.
        const payload = {
          month_label: label,
          status: 'draft' as const,
          generated_at: now,
          content,
        }
        const { data: updated, error: updateError } = await supabase
          .from('board_packets')
          .update(payload)
          .eq('school_id', schoolId)
          .eq('month_key', monthKey)
          .select('id')
        if (updateError) {
          console.error('[store] saveBoardPacket update', updateError)
          return
        }
        if (!updated || updated.length === 0) {
          // No existing row — insert
          const { error: insertError } = await supabase
            .from('board_packets')
            .insert({
              school_id: schoolId,
              month_key: monthKey,
              ...payload,
            })
          if (insertError) console.error('[store] saveBoardPacket insert', insertError)
        }
      })
    }
  },

  finalizeBoardPacket: (monthKey) => {
    set((state) => ({
      boardPackets: state.boardPackets.map((p) =>
        p.monthKey === monthKey ? { ...p, status: 'finalized' as const } : p
      ),
    }))
    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        const { error } = await supabase
          .from('board_packets')
          .update({ status: 'finalized', finalized_at: new Date().toISOString() })
          .eq('school_id', schoolId)
          .eq('month_key', monthKey)
        if (error) console.error('[store] finalizeBoardPacket', error)
      })
    }
  },

  updateBoardPacketContent: (monthKey, partial) => {
    set((state) => ({
      boardPackets: state.boardPackets.map((p) =>
        p.monthKey === monthKey && p.content
          ? { ...p, content: { ...p.content, ...partial } }
          : p
      ),
    }))
  },

  // ── School Context ──

  upsertSchoolContextEntry: (entry) => {
    set((state) => {
      const idx = state.schoolContextEntries.findIndex((e) => e.id === entry.id)
      if (idx >= 0) {
        const updated = [...state.schoolContextEntries]
        updated[idx] = entry
        return { schoolContextEntries: updated }
      }
      return { schoolContextEntries: [...state.schoolContextEntries, entry] }
    })
    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        const { error } = await supabase.from('school_context').upsert({
          id: entry.id,
          school_id: schoolId,
          context_type: entry.contextType,
          key: entry.key,
          value: entry.value,
          expires_at: entry.expiresAt || null,
        })
        if (error) console.error('[store] upsertSchoolContextEntry', error)
      })
    }
  },

  removeSchoolContextEntry: (id) => {
    set((state) => ({
      schoolContextEntries: state.schoolContextEntries.filter((e) => e.id !== id),
    }))
    writeThrough(async (supabase) => {
      const { error } = await supabase.from('school_context').delete().eq('id', id)
      if (error) console.error('[store] removeSchoolContextEntry', error)
    })
  },

  // ── Audit Checklists ──

  updateAuditChecklist: (category, checkedItems, reviewerNote) => {
    set((state) => {
      const idx = state.auditChecklists.findIndex((c) => c.category === category)
      const entry: AuditChecklist = {
        category,
        checkedItems,
        reviewedAt: state.auditChecklists[idx]?.reviewedAt ?? null,
        reviewerNote: reviewerNote ?? state.auditChecklists[idx]?.reviewerNote ?? '',
      }
      if (idx >= 0) {
        const updated = [...state.auditChecklists]
        updated[idx] = entry
        return { auditChecklists: updated }
      }
      return { auditChecklists: [...state.auditChecklists, entry] }
    })
    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        const existing = get().auditChecklists.find((c) => c.category === category)
        const { error } = await supabase.from('audit_checklists').upsert({
          school_id: schoolId,
          category,
          checked_items: checkedItems,
          reviewed_at: existing?.reviewedAt || null,
          reviewer_note: reviewerNote ?? existing?.reviewerNote ?? '',
        }, { onConflict: 'school_id,category' })
        if (error) console.error('[store] updateAuditChecklist', error)
      })
    }
  },

  markAuditReviewed: (category) => {
    const now = new Date().toISOString()
    set((state) => {
      const idx = state.auditChecklists.findIndex((c) => c.category === category)
      if (idx >= 0) {
        const updated = [...state.auditChecklists]
        updated[idx] = { ...updated[idx], reviewedAt: now }
        return { auditChecklists: updated }
      }
      return {
        auditChecklists: [
          ...state.auditChecklists,
          { category, checkedItems: [], reviewedAt: now, reviewerNote: '' },
        ],
      }
    })
    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        const { error } = await supabase.from('audit_checklists').upsert({
          school_id: schoolId,
          category,
          checked_items: get().auditChecklists.find((c) => c.category === category)?.checkedItems ?? [],
          reviewed_at: now,
        }, { onConflict: 'school_id,category' })
        if (error) console.error('[store] markAuditReviewed', error)
      })
    }
  },

  setAgentFindings: (findings) => set({ agentFindings: findings }),
  setLastAgentRunAt: (ts) => set({ lastAgentRunAt: ts }),

  setAuditMeta: (meta) => {
    set({
      auditAgentsLastRun: meta.lastRun,
      auditReadinessScore: meta.score ?? null,
      auditReadinessGrade: meta.grade ?? null,
    })
    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        const update: Record<string, unknown> = { audit_agents_last_run: meta.lastRun }
        if (meta.score != null) update.audit_readiness_score = meta.score
        if (meta.grade != null) update.audit_readiness_grade = meta.grade
        const { error } = await supabase.from('schools').update(update).eq('id', schoolId)
        if (error) console.error('[store] setAuditMeta', error)
      })
    }
  },

  clearSession: () => set({
    schoolId: null,
    userId: null,
    isLoaded: false,
    schoolProfile: {
      name: '',
      authorizer: 'WA Charter School Commission',
      gradesCurrentFirst: '',
      gradesCurrentLast: '',
      gradesBuildoutFirst: '',
      gradesBuildoutLast: '',
      currentFTES: 0,
      priorYearFTES: 0,
      nextBoardMeeting: '',
      nextFinanceCommittee: '',
      openingCashBalance: 0,
      operatingYear: 3,
      headcount: 0,
      spedPct: 0,
      frlPct: 0,
      ellPct: 0,
      hicapPct: 0,
      iepPct: 0,
    },
    financialData: {
      totalBudget: 0,
      revenueBudget: 0,
      ytdSpending: 0,
      ytdRevenue: 0,
      ytdExpenses: 0,
      cashOnHand: 0,
      daysOfReserves: 0,
      variancePercent: 0,
      categories: [],
      monthlySpend: [],
    },
    grantAwards: [],
    grants: [],
    otherGrants: [],
    alerts: [],
    monthlySnapshots: {},
    activeMonth: '',
    chatMessages: [],
    boardPackets: [],
    schoolContextEntries: [],
    auditChecklists: [],
    agentFindings: [],
    lastAgentRunAt: null,
    auditAgentsLastRun: null,
    auditReadinessScore: null,
    auditReadinessGrade: null,
    financialAssumptions: { ...DEFAULT_FINANCIAL_ASSUMPTIONS },
  }),
}))
