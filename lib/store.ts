import { create } from 'zustand'
import type { MappedCategory, MappedGrant } from './uploadPipeline'
import {
  labelFromKey,
  paceFromKey,
  fiscalIndexFromKey,
} from './fiscalYear'

export type AlertSeverity = 'info' | 'warning' | 'critical'
export type GrantStatus = 'on-pace' | 'watch' | 'underspend-risk'
export type BudgetAlertStatus = 'ok' | 'watch' | 'concern' | 'action'
export type PacketStatus = 'not-started' | 'draft' | 'finalized'

export interface SchoolProfile {
  name: string
  authorizer: string
  gradeConfig: string
  currentFTES: number
  priorYearFTES: number
  nextBoardMeeting: string
  nextFinanceCommittee: string
}

export interface BudgetCategory {
  name: string
  budget: number
  ytdActuals: number
  burnRate: number
  projectedYearEnd: number
  alertStatus: BudgetAlertStatus
  narrative?: string
}

export interface FinancialSnapshot {
  totalBudget: number
  ytdSpending: number
  cashOnHand: number
  daysOfReserves: number
  variancePercent: number
  categories: BudgetCategory[]
  monthlySpend: { month: string; amount: number; budget: number }[]
}

export interface Grant {
  id: string
  name: string
  awardAmount: number
  spent: number
  status: GrantStatus
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
    totalBudget: number
    totalActuals: number
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

interface AppState {
  // ── Auth / persistence ──
  schoolId: string | null
  userId: string | null
  isLoaded: boolean

  // ── Data ──
  schoolProfile: SchoolProfile
  financialData: FinancialSnapshot
  grants: Grant[]
  otherGrants: OtherGrant[]
  alerts: Alert[]
  monthlySnapshots: Record<string, MonthlySnapshot>
  activeMonth: string
  chatMessages: ChatMessage[]
  boardPackets: BoardPacket[]

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
  addOtherGrant: (grant: OtherGrant) => void
  removeOtherGrant: (id: string) => void
  updateOtherGrant: (id: string, updates: Partial<OtherGrant>) => void
  generatePacket: () => void
  saveBoardPacket: (monthKey: string, content: BoardPacketContent) => void
  finalizeBoardPacket: (monthKey: string) => void
  updateBoardPacketContent: (monthKey: string, content: Partial<BoardPacketContent>) => void
  importFinancialData: (
    categories: MappedCategory[],
    month: string,
    fileName: string,
    rowCount: number,
    importedGrants?: MappedGrant[]
  ) => void
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED_CATEGORIES: BudgetCategory[] = [
  {
    name: 'Personnel',
    budget: 3100000,
    ytdActuals: 2294000,
    burnRate: 74.0,
    projectedYearEnd: 3441000,
    alertStatus: 'concern',
    narrative:
      "Personnel spending is tracking ahead of pace at 74% of the annual budget (expected 67% through February). At the current rate, personnel costs are projected to reach $3.44M against a $3.1M budget — a potential overage of $341K. Review open position fill timelines and substitute or overtime usage before the end of Q3.",
  },
  {
    name: 'Benefits',
    budget: 620000,
    ytdActuals: 440200,
    burnRate: 71.0,
    projectedYearEnd: 660300,
    alertStatus: 'watch',
    narrative:
      "Benefits spending is slightly above pace, tracking with the personnel overspend. If staffing levels stabilize in the second half of the year, benefits costs should follow. Monitor closely given the personnel budget pressure.",
  },
  {
    name: 'Contracted Services',
    budget: 485000,
    ytdActuals: 383150,
    burnRate: 79.0,
    projectedYearEnd: 574700,
    alertStatus: 'concern',
    narrative:
      "Contracted services are running 12% ahead of budget pace. At this trajectory you're projected to exceed this line by approximately $90K. Review active vendor contracts and consider deferring any discretionary service engagements through year-end.",
  },
  {
    name: 'Supplies',
    budget: 198000,
    ytdActuals: 160380,
    burnRate: 81.0,
    projectedYearEnd: 240570,
    alertStatus: 'action',
    narrative:
      "Supplies spending requires immediate attention — 81% of the annual budget has been spent with 4 months remaining. At the current rate, supplies will overspend by approximately $43K. Implement a purchase freeze on non-essential supplies for the remainder of the year.",
  },
  {
    name: 'Facilities',
    budget: 312000,
    ytdActuals: 202800,
    burnRate: 65.0,
    projectedYearEnd: 304200,
    alertStatus: 'ok',
    narrative: undefined,
  },
  {
    name: 'Transportation',
    budget: 148000,
    ytdActuals: 90280,
    burnRate: 61.0,
    projectedYearEnd: 135420,
    alertStatus: 'ok',
    narrative: undefined,
  },
  {
    name: 'Food Services',
    budget: 185000,
    ytdActuals: 116550,
    burnRate: 63.0,
    projectedYearEnd: 174825,
    alertStatus: 'ok',
    narrative: undefined,
  },
  {
    name: 'Administrative',
    budget: 102000,
    ytdActuals: 59160,
    burnRate: 58.0,
    projectedYearEnd: 88740,
    alertStatus: 'ok',
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
    message: 'Personnel spending is 7% ahead of pace — projected to exceed the annual budget by $341K at the current trajectory. Review staffing costs and overtime before Q3 ends.',
    severity: 'critical',
  },
  {
    id: '2',
    message: 'Supplies is at 81% of budget with 4 months remaining. A spending freeze on non-essential purchases is recommended immediately.',
    severity: 'critical',
  },
  {
    id: '3',
    message: 'Contracted services are 12% ahead of budget pace. Review active vendor contracts for opportunities to defer discretionary engagements.',
    severity: 'warning',
  },
  {
    id: '4',
    message: 'IDEA / Special Education grant is only 49% spent at month 8 of 12. Underspend may affect your future allocation — confirm expenditure plans with your special education coordinator.',
    severity: 'warning',
  },
]

const SEED_MONTHLY_SPEND = [
  { month: 'Jul', amount: 388000, budget: 429000 },
  { month: 'Aug', amount: 426000, budget: 429000 },
  { month: 'Sep', amount: 462000, budget: 429000 },
  { month: 'Oct', amount: 472000, budget: 429000 },
  { month: 'Nov', amount: 451000, budget: 429000 },
  { month: 'Dec', amount: 448000, budget: 429000 },
  { month: 'Jan', amount: 524000, budget: 429000 },
]

const SEED_SNAPSHOT: MonthlySnapshot = {
  month: '2026-02',
  label: 'February 2026',
  uploadedAt: '2026-02-19T09:00:00.000Z',
  filename: 'cascade_charter_budget_feb2026.xlsx',
  rowCount: 8,
  budgetCategories: SEED_CATEGORIES,
  grants: SEED_GRANTS,
  alerts: SEED_ALERTS,
  financialSummary: {
    totalBudget: 5150000,
    totalActuals: 3746520,
    cashOnHand: 892000,
    daysOfReserves: 63,
    variancePercent: 9.1,
  },
  monthlySpend: SEED_MONTHLY_SPEND,
}

const SEED_BOARD_PACKETS: BoardPacket[] = [
  { id: '1', month: 'January 2026', monthKey: '2026-01', status: 'finalized', generatedAt: '2026-01-23' },
  { id: '2', month: 'February 2026', monthKey: '2026-02', status: 'draft', generatedAt: '2026-02-19' },
]

// ── Write-through helper ───────────────────────────────────────────────────────

function writeThrough(fn: (supabase: import('@supabase/supabase-js').SupabaseClient) => Promise<void>) {
  import('@/lib/supabase').then(({ supabase }) => {
    fn(supabase).catch((err) => console.error('[store write-through]', err))
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
    gradeConfig: 'K-8',
    currentFTES: 432,
    priorYearFTES: 418,
    nextBoardMeeting: '2026-03-26',
    nextFinanceCommittee: '2026-03-19',
  },
  financialData: {
    totalBudget: 5150000,
    ytdSpending: 3746520,
    cashOnHand: 892000,
    daysOfReserves: 63,
    variancePercent: 9.1,
    categories: SEED_CATEGORIES,
    monthlySpend: SEED_MONTHLY_SPEND,
  },
  grants: [],
  otherGrants: [],
  alerts: SEED_ALERTS,
  monthlySnapshots: { '2026-02': SEED_SNAPSHOT },
  activeMonth: '2026-02',
  chatMessages: [],
  boardPackets: SEED_BOARD_PACKETS,

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
      set({
        schoolProfile: {
          name: school.name,
          authorizer: school.authorizer,
          gradeConfig: school.grade_config,
          currentFTES: Number(school.current_ftes),
          priorYearFTES: Number(school.prior_year_ftes ?? 0),
          nextBoardMeeting: school.next_board_meeting ?? '',
          nextFinanceCommittee: school.next_finance_committee ?? '',
        },
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
          totalActuals: number
          cashOnHand: number
          daysOfReserves: number
          variancePercent: number
          monthlySpend?: { month: string; amount: number; budget: number }[]
          grants?: Grant[]
          alerts?: Alert[]
        }
        monthlySnapshots[row.month_key] = {
          month: row.month_key,
          label: row.label,
          uploadedAt: row.uploaded_at,
          filename: row.filename,
          rowCount: row.row_count,
          budgetCategories: (row.budget_categories as BudgetCategory[]) ?? [],
          grants: summary.grants ?? [],
          alerts: summary.alerts ?? [],
          financialSummary: {
            totalBudget: summary.totalBudget,
            totalActuals: summary.totalActuals,
            cashOnHand: summary.cashOnHand,
            daysOfReserves: summary.daysOfReserves,
            variancePercent: summary.variancePercent,
          },
          monthlySpend: summary.monthlySpend ?? [],
        }
      }

      const latestKey = snapshotRows[snapshotRows.length - 1].month_key
      const latestSnap = monthlySnapshots[latestKey]
      set({
        monthlySnapshots,
        activeMonth: latestKey,
        financialData: {
          totalBudget: latestSnap.financialSummary.totalBudget,
          ytdSpending: latestSnap.financialSummary.totalActuals,
          cashOnHand: latestSnap.financialSummary.cashOnHand,
          daysOfReserves: latestSnap.financialSummary.daysOfReserves,
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
        grants: [],
        alerts: [],
        financialData: {
          totalBudget: 0,
          ytdSpending: 0,
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

    const categoricalGrants: Grant[] = (grantRows ?? [])
      .filter((g) => g.grant_type === 'categorical')
      .map((g) => ({
        id: g.id,
        name: g.name,
        awardAmount: Number(g.award_amount),
        spent: Number(g.spent_to_date),
        status: (g.restrictions as GrantStatus) ?? 'on-pace',
      }))

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

    set({ grants: categoricalGrants, otherGrants: otherGrantList })

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
            grade_config: updated.gradeConfig,
            current_ftes: updated.currentFTES,
            prior_year_ftes: updated.priorYearFTES,
            next_board_meeting: updated.nextBoardMeeting || null,
            next_finance_committee: updated.nextFinanceCommittee || null,
          })
          .eq('id', schoolId)
        if (error) console.error('[store] updateSchoolProfile', error)
      })
    }
  },

  // ── Month ──

  setActiveMonth: (month) => {
    const snap = get().monthlySnapshots[month]
    if (!snap) return
    set({
      activeMonth: month,
      financialData: {
        totalBudget: snap.financialSummary.totalBudget,
        ytdSpending: snap.financialSummary.totalActuals,
        cashOnHand: snap.financialSummary.cashOnHand,
        daysOfReserves: snap.financialSummary.daysOfReserves,
        variancePercent: snap.financialSummary.variancePercent,
        categories: snap.budgetCategories,
        monthlySpend: snap.monthlySpend,
      },
      grants: snap.grants,
      alerts: snap.alerts,
    })
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
    set((state) => ({ grants: [...state.grants, grant] }))
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
    set((state) => ({
      grants: state.grants.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    }))
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
    set((state) => ({ grants: state.grants.filter((g) => g.id !== id) }))
    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        const { error } = await supabase.from('grants').delete().eq('id', id)
        if (error) console.error('[store] removeGrant', error)
      })
    }
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
      const variance = burnRate - pace * 100
      let alertStatus: BudgetAlertStatus
      if (variance > 15) alertStatus = 'action'
      else if (variance > 10) alertStatus = 'concern'
      else if (variance > 5) alertStatus = 'watch'
      else if (variance < -20) alertStatus = 'watch'
      else alertStatus = 'ok'

      const projectedYearEnd = pace > 0 ? Math.round(cat.ytdActuals / pace) : cat.budget
      return {
        name: cat.category,
        budget: cat.budget,
        ytdActuals: cat.ytdActuals,
        burnRate: parseFloat(burnRate.toFixed(1)),
        projectedYearEnd,
        alertStatus,
        narrative: deriveNarrative(
          cat.category, cat.budget, cat.ytdActuals, burnRate, projectedYearEnd, alertStatus
        ),
      }
    })

    const totalBudget = newCategories.reduce((s, c) => s + c.budget, 0)
    const totalActuals = newCategories.reduce((s, c) => s + c.ytdActuals, 0)
    const expectedSpending = totalBudget * pace
    const variancePercent = parseFloat(
      (((totalActuals - expectedSpending) / expectedSpending) * 100).toFixed(1)
    )

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

    const currentFinancialData = get().financialData

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
          spent: g.spent,
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
        totalActuals,
        cashOnHand: currentFinancialData.cashOnHand,
        daysOfReserves: currentFinancialData.daysOfReserves,
        variancePercent,
      },
      monthlySpend: [],
    }

    set((state) => ({
      monthlySnapshots: { ...state.monthlySnapshots, [month]: newSnapshot },
      activeMonth: month,
      financialData: {
        ...state.financialData,
        totalBudget,
        ytdSpending: totalActuals,
        variancePercent,
        categories: newCategories,
        monthlySpend: [],
      },
      grants: snapshotGrants,
      alerts: newAlerts,
    }))

    const { schoolId } = get()
    if (schoolId) {
      writeThrough(async (supabase) => {
        // Update or create each grant from the upload in the grants table.
        if (importedGrants && importedGrants.length > 0) {
          for (const grant of snapshotGrants) {
            const wasExisting = existingGrants.some((eg) => eg.id === grant.id)
            if (wasExisting) {
              const { error } = await supabase
                .from('grants')
                .update({
                  award_amount: grant.awardAmount,
                  spent_to_date: grant.spent,
                  restrictions: grant.status,
                })
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
          cashOnHand: currentFinancialData.cashOnHand,
          daysOfReserves: currentFinancialData.daysOfReserves,
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

  generatePacket: () => {
    const { boardPackets } = get()
    const now = new Date().toISOString().split('T')[0]
    const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const existing = boardPackets.find((p) => p.month === month)
    if (existing) {
      set((state) => ({
        boardPackets: state.boardPackets.map((p) =>
          p.id === existing.id ? { ...p, status: 'finalized', generatedAt: now } : p
        ),
      }))
    } else {
      set((state) => ({
        boardPackets: [
          ...state.boardPackets,
          { id: Date.now().toString(), month, monthKey: '', status: 'draft', generatedAt: now },
        ],
      }))
    }
  },

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
        const packet = get().boardPackets.find((p) => p.monthKey === monthKey)
        const { error } = await supabase
          .from('board_packets')
          .upsert(
            {
              id: packet?.id ?? undefined,
              school_id: schoolId,
              month_key: monthKey,
              month_label: label,
              status: 'draft',
              generated_at: now,
              content,
            },
            { onConflict: 'school_id,month_key' }
          )
        if (error) console.error('[store] saveBoardPacket', error)
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
}))
