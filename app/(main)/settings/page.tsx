'use client'

import { useState, FormEvent } from 'react'
import { Plus, Trash2, Check, Zap, Pencil, X, Bell, RotateCcw } from 'lucide-react'
import { useStore, type OtherGrant, type OtherGrantRestrictions } from '@/lib/store'
import { type FinancialAssumptions, DEFAULT_FINANCIAL_ASSUMPTIONS } from '@/lib/financialAssumptions'
import SchoolContextManager from '@/components/SchoolContextManager'
import GradeSpanSelector from '@/components/GradeSpanSelector'

// ── Quick-add presets for common philanthropic/federal grants ──────────────────

const QUICK_ADD_PRESETS = [
  { label: 'CSP', name: 'Charter Schools Program (CSP)', funder: 'U.S. Department of Education' },
  { label: 'CSGF', name: 'CSGF SEED Grant', funder: 'Charter School Growth Fund' },
  { label: 'NewSchools', name: 'NewSchools Grant', funder: 'NewSchools Venture Fund' },
  { label: 'Gates', name: 'Gates Foundation Grant', funder: 'Bill & Melinda Gates Foundation' },
  { label: 'Walton', name: 'Walton Family Foundation Grant', funder: 'Walton Family Foundation' },
  { label: 'Community', name: 'Community Foundation Grant', funder: '' },
]

const RESTRICTION_OPTIONS: { value: OtherGrantRestrictions; label: string }[] = [
  { value: 'unrestricted', label: 'Unrestricted' },
  { value: 'restricted', label: 'Restricted — specific purpose' },
  { value: 'multi-year', label: 'Multi-year installment' },
]

const BLANK_OTHER_GRANT = {
  name: '',
  funder: '',
  awardAmount: '',
  startDate: '',
  endDate: '',
  spentToDate: '',
  restrictions: 'unrestricted' as OtherGrantRestrictions,
  notes: '',
}

type OtherGrantFormState = typeof BLANK_OTHER_GRANT

const inputCls =
  'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/12 focus:border-[#1e3a5f] bg-white'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5'

// ── Shared form for adding or editing an Other Grant ─────────────────────────

function OtherGrantFormFields({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  form: OtherGrantFormState
  onChange: (updates: Partial<OtherGrantFormState>) => void
  onSubmit: (e: FormEvent) => void
  onCancel: () => void
  submitLabel: string
}) {
  return (
    <form onSubmit={onSubmit} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Grant Name <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Charter Schools Program (CSP)"
            className={inputCls}
            required
          />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Funder / Organization</label>
          <input
            type="text"
            value={form.funder}
            onChange={(e) => onChange({ funder: e.target.value })}
            placeholder="e.g. Bill & Melinda Gates Foundation"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Award Amount <span className="text-red-400">*</span></label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              value={form.awardAmount}
              onChange={(e) => onChange({ awardAmount: e.target.value })}
              placeholder="0"
              className={`${inputCls} pl-6`}
              min="0"
              required
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Spent to Date</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              value={form.spentToDate}
              onChange={(e) => onChange({ spentToDate: e.target.value })}
              placeholder="0"
              className={`${inputCls} pl-6`}
              min="0"
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Start Date</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>End Date</label>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Restriction Type</label>
          <select
            value={form.restrictions}
            onChange={(e) => onChange({ restrictions: e.target.value as OtherGrantRestrictions })}
            className={inputCls}
          >
            {RESTRICTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Notes <span className="text-gray-300">(optional)</span></label>
          <textarea
            value={form.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Reporting requirements, contact info, installment schedule..."
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="px-4 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors"
          style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Financial Assumptions ─────────────────────────────────────────────────────

type AssumptionKey = keyof FinancialAssumptions

interface FieldDef {
  key: AssumptionKey
  label: string
  unit: string
  step?: number
}

const ASSUMPTION_GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Personnel',
    fields: [
      { key: 'benefits_load_pct', label: 'Benefits load (SEBB)', unit: '%' },
      { key: 'fica_rate_pct', label: 'Employer FICA rate', unit: '%', step: 0.01 },
      { key: 'personnel_healthy_min_pct', label: 'Healthy range — minimum', unit: '% of budget' },
      { key: 'personnel_healthy_max_pct', label: 'Healthy range — maximum', unit: '% of budget' },
      { key: 'personnel_concern_pct', label: 'Concern threshold', unit: '% of budget' },
    ],
  },
  {
    title: 'Revenue',
    fields: [
      { key: 'salary_escalator_pct', label: 'Annual salary step increase', unit: '%', step: 0.1 },
      { key: 'cola_rate_pct', label: 'COLA assumption', unit: '%', step: 0.1 },
      { key: 'aafte_pct', label: 'AAFTE as % of headcount', unit: '%' },
      { key: 'authorizer_fee_pct', label: 'Authorizer admin fee', unit: '% of state revenue', step: 0.1 },
    ],
  },
  {
    title: 'Per-Pupil Rates',
    fields: [
      { key: 'regular_ed_per_pupil', label: 'Regular Ed per pupil', unit: '$' },
      { key: 'sped_per_pupil', label: 'SPED per pupil', unit: '$' },
      { key: 'facilities_per_pupil', label: 'Facilities per pupil', unit: '$' },
      { key: 'levy_equity_per_pupil', label: 'Levy Equity per pupil', unit: '$' },
      { key: 'title_i_per_pupil', label: 'Title I per pupil', unit: '$' },
      { key: 'idea_per_pupil', label: 'IDEA per pupil', unit: '$' },
      { key: 'lap_per_pupil', label: 'LAP per pupil', unit: '$' },
      { key: 'tbip_per_pupil', label: 'TBIP per pupil', unit: '$' },
      { key: 'hicap_per_pupil', label: 'HiCap per pupil', unit: '$' },
    ],
  },
  {
    title: 'Cash Flow',
    fields: [
      { key: 'cash_healthy_days', label: 'Healthy reserves', unit: 'days' },
      { key: 'cash_watch_days', label: 'Watch threshold', unit: 'days' },
      { key: 'cash_concern_days', label: 'Concern threshold', unit: 'days' },
      { key: 'cash_crisis_days', label: 'Crisis threshold', unit: 'days' },
    ],
  },
  {
    title: 'Operations',
    fields: [
      { key: 'operations_escalator_pct', label: 'Annual ops cost increase', unit: '%', step: 0.1 },
      { key: 'interest_rate_pct', label: 'Interest rate on reserves', unit: '%', step: 0.1 },
    ],
  },
]

function FinancialAssumptionsEditor() {
  const { financialAssumptions, updateFinancialAssumptions } = useStore()
  const [local, setLocal] = useState<FinancialAssumptions>({ ...financialAssumptions })
  const [saved, setSaved] = useState(false)

  const handleChange = (key: AssumptionKey, value: string) => {
    setLocal((prev) => ({ ...prev, [key]: value === '' ? 0 : Number(value) }))
  }

  const resetField = (key: AssumptionKey) => {
    setLocal((prev) => ({ ...prev, [key]: DEFAULT_FINANCIAL_ASSUMPTIONS[key] }))
  }

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    updateFinancialAssumptions(local)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const isModified = (key: AssumptionKey) => local[key] !== DEFAULT_FINANCIAL_ASSUMPTIONS[key]

  return (
    <form onSubmit={handleSave} className="card-static p-6">
      <h2 className="text-base font-semibold text-gray-800 mb-1" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
        Financial Assumptions
      </h2>
      <p className="text-xs text-gray-400 mb-5">
        These thresholds are used by the AI CFO when analyzing your data. Adjust them to match your school&apos;s situation.
      </p>

      <div className="space-y-6">
        {ASSUMPTION_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{group.title}</h3>
            <div className="space-y-2.5">
              {group.fields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <label className="text-sm text-gray-700 w-52 shrink-0">{field.label}</label>
                  <div className="relative flex-1 max-w-[140px]">
                    <input
                      type="number"
                      value={local[field.key]}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      step={field.step ?? 1}
                      min={0}
                      className={`${inputCls} pr-14 text-right ${isModified(field.key) ? 'ring-1 ring-[#1e3a5f]/20' : ''}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                      {field.unit}
                    </span>
                  </div>
                  {isModified(field.key) && (
                    <button
                      type="button"
                      onClick={() => resetField(field.key)}
                      className="text-gray-300 hover:text-[#1e3a5f] transition-colors p-1"
                      title={`Reset to default (${DEFAULT_FINANCIAL_ASSUMPTIONS[field.key]})`}
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button
          type="submit"
          className="px-5 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors"
          style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}
        >
          Save Assumptions
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <Check size={14} /> Saved
          </span>
        )}
      </div>
    </form>
  )
}

// ── Notification Preferences ──────────────────────────────────────────────────

function NotificationPreferences() {
  const { schoolId, upsertSchoolContextEntry, schoolContextEntries } = useStore()

  const existing = schoolContextEntries.find(
    (e) => e.contextType === 'notification_prefs' && e.key === 'email'
  )
  const savedPrefs = existing?.value as { action_alerts_enabled?: boolean; daily_digest_enabled?: boolean; email_address?: string } | undefined

  const [actionAlerts, setActionAlerts] = useState(savedPrefs?.action_alerts_enabled ?? true)
  const [dailyDigest, setDailyDigest] = useState(savedPrefs?.daily_digest_enabled ?? true)
  const [email, setEmail] = useState(savedPrefs?.email_address ?? '')
  const [saved, setSaved] = useState(false)

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    if (!schoolId) return

    upsertSchoolContextEntry({
      id: existing?.id ?? crypto.randomUUID(),
      contextType: 'notification_prefs',
      key: 'email',
      value: {
        action_alerts_enabled: actionAlerts,
        daily_digest_enabled: dailyDigest,
        email_address: email,
      },
      expiresAt: null,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const toggleCls = (enabled: boolean) =>
    `relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
      enabled ? 'bg-[#1e3a5f]' : 'bg-gray-300'
    }`

  const dotCls = (enabled: boolean) =>
    `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
      enabled ? 'translate-x-6' : 'translate-x-1'
    }`

  return (
    <form onSubmit={handleSave} className="card-static p-6">
      <div className="flex items-center gap-2 mb-5">
        <Bell size={16} className="text-[#1e3a5f]" />
        <h2 className="text-base font-semibold text-gray-800" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
          Email Notifications
        </h2>
      </div>

      <div className="space-y-5">
        {/* Action Required toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Email me Action Required alerts immediately</p>
            <p className="text-xs text-gray-400 mt-0.5">Get notified right away when urgent issues are found</p>
          </div>
          <button
            type="button"
            onClick={() => setActionAlerts(!actionAlerts)}
            className={toggleCls(actionAlerts)}
          >
            <span className={dotCls(actionAlerts)} />
          </button>
        </div>

        {/* Daily digest toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Send daily digest of Concern alerts</p>
            <p className="text-xs text-gray-400 mt-0.5">Get a once-daily summary of active concerns</p>
          </div>
          <button
            type="button"
            onClick={() => setDailyDigest(!dailyDigest)}
            className={toggleCls(dailyDigest)}
          >
            <span className={dotCls(dailyDigest)} />
          </button>
        </div>

        {/* Email address */}
        <div>
          <label className={labelCls}>Notification Email Address</label>
          <p className="text-xs text-gray-400 mb-1.5">Leave blank to use your login email</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ceo@myschool.org (defaults to login email)"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button
          type="submit"
          className="px-5 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors"
          style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}
        >
          Save Preferences
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <Check size={14} /> Saved
          </span>
        )}
      </div>
    </form>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const {
    schoolProfile,
    grants,
    otherGrants,
    updateSchoolProfile,
    addGrant,
    updateGrant,
    removeGrant,
    addOtherGrant,
    removeOtherGrant,
    updateOtherGrant,
  } = useStore()

  // ── School Profile ────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({ ...schoolProfile })
  const [profileSaved, setProfileSaved] = useState(false)

  const saveProfile = (e: FormEvent) => {
    e.preventDefault()
    updateSchoolProfile({
      name: profile.name,
      authorizer: profile.authorizer,
      gradesCurrentFirst: profile.gradesCurrentFirst,
      gradesCurrentLast: profile.gradesCurrentLast,
      gradesBuildoutFirst: profile.gradesBuildoutFirst,
      gradesBuildoutLast: profile.gradesBuildoutLast,
      currentFTES: Number(profile.currentFTES),
      priorYearFTES: Number(profile.priorYearFTES),
      operatingYear: Number(profile.operatingYear),
      openingCashBalance: Number(profile.openingCashBalance),
      headcount: Number(profile.headcount),
      spedPct: Number(profile.spedPct),
      frlPct: Number(profile.frlPct),
      ellPct: Number(profile.ellPct),
      hicapPct: Number(profile.hicapPct),
      iepPct: Number(profile.iepPct),
      currentAssets: Number(profile.currentAssets),
      currentLiabilities: Number(profile.currentLiabilities),
      totalAssets: Number(profile.totalAssets),
      totalLiabilities: Number(profile.totalLiabilities),
      annualDepreciation: Number(profile.annualDepreciation),
      annualDebtService: Number(profile.annualDebtService),
      interestExpense: Number(profile.interestExpense),
    })
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2500)
  }

  // ── Important Dates ───────────────────────────────────────────────────────────
  const [dates, setDates] = useState({
    nextBoardMeeting: schoolProfile.nextBoardMeeting,
    nextFinanceCommittee: schoolProfile.nextFinanceCommittee,
  })
  const [datesSaved, setDatesSaved] = useState(false)

  const saveDates = (e: FormEvent) => {
    e.preventDefault()
    updateSchoolProfile(dates)
    setDatesSaved(true)
    setTimeout(() => setDatesSaved(false), 2500)
  }

  // ── Categorical Grants ────────────────────────────────────────────────────────
  const [showGrantForm, setShowGrantForm] = useState(false)
  const [newGrant, setNewGrant] = useState({ name: '', awardAmount: '' })
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editCatForm, setEditCatForm] = useState({ name: '', awardAmount: '' })

  const handleAddGrant = (e: FormEvent) => {
    e.preventDefault()
    if (!newGrant.name || !newGrant.awardAmount) return
    addGrant({
      id: crypto.randomUUID(),
      name: newGrant.name,
      awardAmount: Number(newGrant.awardAmount),
      spent: 0,
      status: 'on-pace',
    })
    setNewGrant({ name: '', awardAmount: '' })
    setShowGrantForm(false)
  }

  const startEditCat = (grant: (typeof grants)[number]) => {
    setShowGrantForm(false)
    setEditingCatId(grant.id)
    setEditCatForm({ name: grant.name, awardAmount: String(grant.awardAmount) })
  }

  const saveEditCat = (e: FormEvent) => {
    e.preventDefault()
    if (!editingCatId || !editCatForm.name || !editCatForm.awardAmount) return
    updateGrant(editingCatId, {
      name: editCatForm.name,
      awardAmount: Number(editCatForm.awardAmount),
    })
    setEditingCatId(null)
  }

  const cancelEditCat = () => setEditingCatId(null)

  // ── Other Grants ──────────────────────────────────────────────────────────────
  const [showOtherForm, setShowOtherForm] = useState(false)
  const [otherForm, setOtherForm] = useState<OtherGrantFormState>({ ...BLANK_OTHER_GRANT })
  const [editingOtherId, setEditingOtherId] = useState<string | null>(null)
  const [editOtherForm, setEditOtherForm] = useState<OtherGrantFormState>({ ...BLANK_OTHER_GRANT })

  const applyPreset = (preset: (typeof QUICK_ADD_PRESETS)[number]) => {
    setOtherForm((f) => ({ ...f, name: preset.name, funder: preset.funder }))
    setShowOtherForm(true)
  }

  const handleAddOtherGrant = (e: FormEvent) => {
    e.preventDefault()
    if (!otherForm.name || !otherForm.awardAmount) return
    const grant: OtherGrant = {
      id: crypto.randomUUID(),
      name: otherForm.name,
      funder: otherForm.funder,
      awardAmount: Number(otherForm.awardAmount),
      startDate: otherForm.startDate,
      endDate: otherForm.endDate,
      spentToDate: Number(otherForm.spentToDate) || 0,
      restrictions: otherForm.restrictions,
      notes: otherForm.notes,
    }
    addOtherGrant(grant)
    setOtherForm({ ...BLANK_OTHER_GRANT })
    setShowOtherForm(false)
  }

  const cancelOtherForm = () => {
    setOtherForm({ ...BLANK_OTHER_GRANT })
    setShowOtherForm(false)
  }

  const startEditOther = (grant: OtherGrant) => {
    setShowOtherForm(false)
    setEditingOtherId(grant.id)
    setEditOtherForm({
      name: grant.name,
      funder: grant.funder,
      awardAmount: String(grant.awardAmount),
      startDate: grant.startDate,
      endDate: grant.endDate,
      spentToDate: String(grant.spentToDate),
      restrictions: grant.restrictions,
      notes: grant.notes,
    })
  }

  const saveEditOther = (e: FormEvent) => {
    e.preventDefault()
    if (!editingOtherId || !editOtherForm.name || !editOtherForm.awardAmount) return
    updateOtherGrant(editingOtherId, {
      name: editOtherForm.name,
      funder: editOtherForm.funder,
      awardAmount: Number(editOtherForm.awardAmount),
      startDate: editOtherForm.startDate,
      endDate: editOtherForm.endDate,
      spentToDate: Number(editOtherForm.spentToDate) || 0,
      restrictions: editOtherForm.restrictions,
      notes: editOtherForm.notes,
    })
    setEditingOtherId(null)
  }

  const cancelEditOther = () => setEditingOtherId(null)

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Settings</h1>
        <p className="text-gray-500 mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Manage your school profile and preferences
        </p>
      </div>

      {/* ── School Profile ── */}
      <form onSubmit={saveProfile} className="card-static p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-5" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>School Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>School Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Authorizer</label>
            <input
              type="text"
              value={profile.authorizer}
              onChange={(e) => setProfile({ ...profile, authorizer: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="col-span-2">
            <GradeSpanSelector
              label="Grades Currently Served"
              firstGrade={profile.gradesCurrentFirst}
              lastGrade={profile.gradesCurrentLast}
              onFirstChange={(v) => setProfile({ ...profile, gradesCurrentFirst: v })}
              onLastChange={(v) => setProfile({ ...profile, gradesCurrentLast: v })}
              inputCls={inputCls}
            />
          </div>
          <div className="col-span-2">
            <GradeSpanSelector
              label="Grades at Full Build-out"
              firstGrade={profile.gradesBuildoutFirst}
              lastGrade={profile.gradesBuildoutLast}
              onFirstChange={(v) => setProfile({ ...profile, gradesBuildoutFirst: v })}
              onLastChange={(v) => setProfile({ ...profile, gradesBuildoutLast: v })}
              inputCls={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Current Year FTES</label>
            <input
              type="number"
              value={profile.currentFTES}
              onChange={(e) => setProfile({ ...profile, currentFTES: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Prior Year FTES</label>
            <input
              type="number"
              value={profile.priorYearFTES}
              onChange={(e) => setProfile({ ...profile, priorYearFTES: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Operating Year</label>
            <select
              value={profile.operatingYear}
              onChange={(e) => setProfile({ ...profile, operatingYear: Number(e.target.value) })}
              className={inputCls}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((y) => (
                <option key={y} value={y}>Year {y}{y <= 2 ? ' (FPF Stage 1)' : ' (FPF Stage 2)'}</option>
              ))}
            </select>
          </div>
          {/* ── Enrollment & Demographics ── */}
          <div className="col-span-2 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Enrollment &amp; Demographics</p>
          </div>
          <div>
            <label className={labelCls}>Headcount (enrolled)</label>
            <input type="number" min="0" value={profile.headcount} onChange={(e) => setProfile({ ...profile, headcount: Number(e.target.value) })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>SPED %</label>
            <input type="number" min="0" max="100" step="0.1" value={profile.spedPct} onChange={(e) => setProfile({ ...profile, spedPct: Number(e.target.value) })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>FRL %</label>
            <input type="number" min="0" max="100" step="0.1" value={profile.frlPct} onChange={(e) => setProfile({ ...profile, frlPct: Number(e.target.value) })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>ELL %</label>
            <input type="number" min="0" max="100" step="0.1" value={profile.ellPct} onChange={(e) => setProfile({ ...profile, ellPct: Number(e.target.value) })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>HiCap %</label>
            <input type="number" min="0" max="100" step="0.1" value={profile.hicapPct} onChange={(e) => setProfile({ ...profile, hicapPct: Number(e.target.value) })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>IEP %</label>
            <input type="number" min="0" max="100" step="0.1" value={profile.iepPct} onChange={(e) => setProfile({ ...profile, iepPct: Number(e.target.value) })} className={inputCls} />
          </div>

          {/* ── Balance Sheet (for FPF Scorecard) ── */}
          <div className="col-span-2 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Balance Sheet (for FPF Scorecard)</p>
          </div>
          <div>
            <label className={labelCls}>Current Assets</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min="0" value={profile.currentAssets} onChange={(e) => setProfile({ ...profile, currentAssets: Number(e.target.value) })} className={`${inputCls} pl-6`} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Current Liabilities</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min="0" value={profile.currentLiabilities} onChange={(e) => setProfile({ ...profile, currentLiabilities: Number(e.target.value) })} className={`${inputCls} pl-6`} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Total Assets</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min="0" value={profile.totalAssets} onChange={(e) => setProfile({ ...profile, totalAssets: Number(e.target.value) })} className={`${inputCls} pl-6`} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Total Liabilities</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min="0" value={profile.totalLiabilities} onChange={(e) => setProfile({ ...profile, totalLiabilities: Number(e.target.value) })} className={`${inputCls} pl-6`} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Annual Depreciation</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min="0" value={profile.annualDepreciation} onChange={(e) => setProfile({ ...profile, annualDepreciation: Number(e.target.value) })} className={`${inputCls} pl-6`} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Annual Debt Service</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min="0" value={profile.annualDebtService} onChange={(e) => setProfile({ ...profile, annualDebtService: Number(e.target.value) })} className={`${inputCls} pl-6`} />
            </div>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Interest Expense</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min="0" value={profile.interestExpense} onChange={(e) => setProfile({ ...profile, interestExpense: Number(e.target.value) })} className={`${inputCls} pl-6`} />
            </div>
          </div>

          <div className="col-span-2">
            <label className={labelCls}>Opening Cash Balance (September 1)</label>
            <p className="text-xs text-gray-500 mb-1">Your cash on hand at the start of this fiscal year — used as the starting point for all cash position calculations</p>
            <input
              type="number"
              value={profile.openingCashBalance}
              onChange={(e) => setProfile({ ...profile, openingCashBalance: Number(e.target.value) })}
              placeholder="e.g. 750000"
              className={inputCls}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-5">
          <button type="submit" className="px-5 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors" style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            Save Changes
          </button>
          {profileSaved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <Check size={14} /> Saved
            </span>
          )}
        </div>
      </form>

      {/* ── Important Dates ── */}
      <form onSubmit={saveDates} className="card-static p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-5" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Important Dates</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Next Board Meeting</label>
            <input
              type="date"
              value={dates.nextBoardMeeting}
              onChange={(e) => setDates({ ...dates, nextBoardMeeting: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Next Finance Committee</label>
            <input
              type="date"
              value={dates.nextFinanceCommittee}
              onChange={(e) => setDates({ ...dates, nextFinanceCommittee: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-5">
          <button type="submit" className="px-5 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors" style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            Update Dates
          </button>
          {datesSaved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <Check size={14} /> Saved
            </span>
          )}
        </div>
      </form>

      {/* ── Financial Assumptions ── */}
      <FinancialAssumptionsEditor />

      {/* ── Categorical Grants ── */}
      <div className="card-static p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-800" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Categorical Grants</h2>
            <p className="text-xs text-gray-400 mt-0.5">WA state and federal categorical funding</p>
          </div>
          <button
            onClick={() => { setEditingCatId(null); setShowGrantForm((s) => !s) }}
            className="flex items-center gap-1.5 text-sm text-[#1e3a5f] font-medium hover:opacity-75 transition-opacity"
          >
            <Plus size={15} />
            Add Grant
          </button>
        </div>

        {showGrantForm && (
          <form
            onSubmit={handleAddGrant}
            className="flex gap-2 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200"
          >
            <input
              type="text"
              placeholder="Grant name"
              value={newGrant.name}
              onChange={(e) => setNewGrant({ ...newGrant, name: e.target.value })}
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              required
            />
            <input
              type="number"
              placeholder="Award amount"
              value={newGrant.awardAmount}
              onChange={(e) => setNewGrant({ ...newGrant, awardAmount: e.target.value })}
              className="w-36 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              required
            />
            <button type="submit" className="px-4 py-1.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors" style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
              Add
            </button>
            <button type="button" onClick={() => setShowGrantForm(false)} className="px-3 py-1.5 text-gray-500 text-sm hover:text-gray-700 transition-colors">
              Cancel
            </button>
          </form>
        )}

        <div className="divide-y divide-gray-100">
          {grants.map((grant) => (
            <div key={grant.id}>
              {editingCatId === grant.id ? (
                /* ── Inline edit row ── */
                <form
                  onSubmit={saveEditCat}
                  className="flex gap-2 py-3 items-center"
                >
                  <input
                    type="text"
                    value={editCatForm.name}
                    onChange={(e) => setEditCatForm({ ...editCatForm, name: e.target.value })}
                    className="flex-1 px-3 py-1.5 border border-[#1e3a5f]/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
                    required
                    autoFocus
                  />
                  <input
                    type="number"
                    value={editCatForm.awardAmount}
                    onChange={(e) => setEditCatForm({ ...editCatForm, awardAmount: e.target.value })}
                    className="w-36 px-3 py-1.5 border border-[#1e3a5f]/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
                    required
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors"
                    style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditCat}
                    className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Cancel"
                  >
                    <X size={14} />
                  </button>
                </form>
              ) : (
                /* ── Normal row ── */
                <div className="flex items-center py-3 gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{grant.name}</p>
                    {grant.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{grant.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5 font-medium">
                      {grant.awardAmount > 0 ? `$${grant.awardAmount.toLocaleString()} award` : '$0 — enter your allocation'}
                    </p>
                  </div>
                  <button
                    onClick={() => startEditCat(grant)}
                    className="text-gray-300 hover:text-[#1e3a5f] transition-colors p-1"
                    title="Edit grant"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => removeGrant(grant.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors p-1"
                    title="Remove grant"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Notification Preferences ── */}
      <NotificationPreferences />

      {/* ── School Context for AI ── */}
      <SchoolContextManager />

      {/* ── Other Grants & Philanthropic Funding ── */}
      <div className="card-static p-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-base font-semibold text-gray-800" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Other Grants &amp; Philanthropic Funding</h2>
            <p className="text-xs text-gray-400 mt-0.5">Federal discretionary grants, foundations, and multi-year awards</p>
          </div>
          {!showOtherForm && (
            <button
              onClick={() => { setEditingOtherId(null); setShowOtherForm(true) }}
              className="flex items-center gap-1.5 text-sm text-[#1e3a5f] font-medium hover:opacity-75 transition-opacity"
            >
              <Plus size={15} />
              Add Grant
            </button>
          )}
        </div>

        {/* Quick Add presets */}
        {!showOtherForm && !editingOtherId && (
          <div className="flex flex-wrap gap-1.5 mt-4 mb-5">
            <span className="flex items-center gap-1 text-xs text-gray-400 font-medium mr-1">
              <Zap size={11} />
              Quick add:
            </span>
            {QUICK_ADD_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                className="text-xs px-2.5 py-1 border border-gray-200 rounded-full text-gray-600 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}

        {/* Add grant form */}
        {showOtherForm && (
          <div className="mt-4 mb-5">
            <OtherGrantFormFields
              form={otherForm}
              onChange={(updates) => setOtherForm((f) => ({ ...f, ...updates }))}
              onSubmit={handleAddOtherGrant}
              onCancel={cancelOtherForm}
              submitLabel="Add Grant"
            />
          </div>
        )}

        {/* Grant list */}
        <div className="divide-y divide-gray-100">
          {otherGrants.length === 0 && !showOtherForm && (
            <p className="text-sm text-gray-400 py-4">No other grants added yet.</p>
          )}
          {otherGrants.map((grant) => {
            const restrictionBadge =
              grant.restrictions === 'unrestricted'
                ? 'bg-green-50 text-green-700'
                : grant.restrictions === 'multi-year'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-amber-50 text-amber-700'
            const restrictionLabel =
              grant.restrictions === 'unrestricted'
                ? 'Unrestricted'
                : grant.restrictions === 'multi-year'
                ? 'Multi-year'
                : 'Restricted'

            return (
              <div key={grant.id}>
                {editingOtherId === grant.id ? (
                  /* ── Inline edit form ── */
                  <div className="py-3">
                    <OtherGrantFormFields
                      form={editOtherForm}
                      onChange={(updates) => setEditOtherForm((f) => ({ ...f, ...updates }))}
                      onSubmit={saveEditOther}
                      onCancel={cancelEditOther}
                      submitLabel="Save Changes"
                    />
                  </div>
                ) : (
                  /* ── Normal row ── */
                  <div className="flex items-start py-3.5 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-800">{grant.name}</p>
                        <span className={`inline-flex text-xs px-3 py-1 rounded-full font-medium ${restrictionBadge}`}>
                          {restrictionLabel}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {grant.funder && <span>{grant.funder} · </span>}
                        ${grant.awardAmount.toLocaleString()} award
                        {grant.startDate && grant.endDate && (
                          <span> · {grant.startDate} – {grant.endDate}</span>
                        )}
                      </p>
                      {grant.notes && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">{grant.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => startEditOther(grant)}
                      className="text-gray-300 hover:text-[#1e3a5f] transition-colors p-1 shrink-0"
                      title="Edit grant"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => removeOtherGrant(grant.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors p-1 shrink-0"
                      title="Remove grant"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
