'use client'

import { useState, useRef, useEffect, DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  CheckCircle,
  Download,
  School,
  Users,
  CalendarDays,
  FileSpreadsheet,
  Settings2,
} from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import {
  autoMapColumns,
  applyMappings,
  extractGrants,
  isFullyMapped,
  type ColumnMappingResult,
  type MappedCategory,
  type MappedGrant,
} from '@/lib/uploadPipeline'
import { currentMonthKey, fiscalIndexFromKey } from '@/lib/fiscalYear'
import {
  parseSchoolLaunchProfile,
  parseBudgetCSV,
  type SchoolLaunchProfile,
  type ImportResult,
  type ImportedBudgetLine,
  type ImportedSchoolProfile,
} from '@/lib/schoollaunchImport'
import {
  DEFAULT_FINANCIAL_ASSUMPTIONS,
  mergeAssumptions,
  type FinancialAssumptions,
} from '@/lib/financialAssumptions'
import { buildRevenueModel } from '@/lib/revenueModel'
import type { SchoolProfile } from '@/lib/store'
import GradeSpanSelector from '@/components/GradeSpanSelector'

// ── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'School Identity', icon: School },
  { label: 'Enrollment', icon: Users },
  { label: 'Dates & Cash', icon: CalendarDays },
  { label: 'First Upload', icon: FileSpreadsheet },
  { label: 'Assumptions', icon: Settings2 },
] as const

const AUTHORIZER_OPTIONS = [
  'Washington State Charter School Commission',
  'Seattle School District',
  'Spokane Public Schools',
  'Tacoma Public Schools',
  'Other',
]

const OPERATING_YEAR_OPTIONS = [
  { value: 1, label: 'Year 1 (Stage 1)' },
  { value: 2, label: 'Year 2 (Stage 1)' },
  { value: 3, label: 'Year 3 (Stage 2)' },
  { value: 4, label: 'Year 4 (Stage 2)' },
  { value: 5, label: 'Year 5 (Stage 2)' },
  { value: 6, label: 'Year 6 (Stage 2)' },
  { value: 7, label: 'Year 7 (Stage 2)' },
  { value: 8, label: 'Year 8 (Stage 2)' },
  { value: 9, label: 'Year 9 (Stage 2)' },
  { value: 10, label: 'Year 10+ (Stage 2)' },
]

const inputCls =
  'w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/12 focus:border-[#1e3a5f]'

const inputStyle: React.CSSProperties = {}

const HEADING_FONT: React.CSSProperties = {
  fontFamily: 'var(--font-display), system-ui, sans-serif',
  fontWeight: 700,
}

const PRIMARY_BTN: React.CSSProperties = {
  background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)',
  fontFamily: 'var(--font-display), system-ui, sans-serif',
}

// ── Assumption field metadata ───────────────────────────────────────────────

interface AssumptionField {
  key: keyof FinancialAssumptions
  label: string
  suffix?: string
  prefix?: string
  step?: number
}

const ASSUMPTION_GROUPS: { title: string; fields: AssumptionField[] }[] = [
  {
    title: 'Personnel',
    fields: [
      { key: 'benefits_load_pct', label: 'Benefits load (SEBB)', suffix: '%' },
      { key: 'fica_rate_pct', label: 'Employer FICA rate', suffix: '%', step: 0.01 },
      { key: 'personnel_healthy_min_pct', label: 'Healthy range (min)', suffix: '%' },
      { key: 'personnel_healthy_max_pct', label: 'Healthy range (max)', suffix: '%' },
      { key: 'personnel_concern_pct', label: 'Concern threshold', suffix: '%' },
    ],
  },
  {
    title: 'Revenue',
    fields: [
      { key: 'salary_escalator_pct', label: 'Salary step increase', suffix: '%', step: 0.1 },
      { key: 'cola_rate_pct', label: 'COLA adjustment', suffix: '%', step: 0.1 },
      { key: 'operations_escalator_pct', label: 'Ops cost increase', suffix: '%', step: 0.1 },
      { key: 'aafte_pct', label: 'AAFTE % of headcount', suffix: '%' },
      { key: 'authorizer_fee_pct', label: 'Authorizer fee', suffix: '%', step: 0.1 },
      { key: 'regular_ed_per_pupil', label: 'Regular Ed per-pupil', prefix: '$' },
      { key: 'sped_per_pupil', label: 'SPED per-pupil', prefix: '$' },
      { key: 'facilities_per_pupil', label: 'Facilities per-pupil', prefix: '$' },
      { key: 'levy_equity_per_pupil', label: 'Levy Equity per-pupil', prefix: '$' },
      { key: 'title_i_per_pupil', label: 'Title I per-pupil', prefix: '$' },
      { key: 'idea_per_pupil', label: 'IDEA per-pupil', prefix: '$' },
      { key: 'lap_per_pupil', label: 'LAP per-pupil', prefix: '$' },
      { key: 'tbip_per_pupil', label: 'TBIP per-pupil', prefix: '$' },
      { key: 'hicap_per_pupil', label: 'HiCap per-pupil', prefix: '$' },
    ],
  },
  {
    title: 'Cash Flow',
    fields: [
      { key: 'cash_healthy_days', label: 'Healthy reserves', suffix: ' days' },
      { key: 'cash_watch_days', label: 'Watch threshold', suffix: ' days' },
      { key: 'cash_concern_days', label: 'Concern threshold', suffix: ' days' },
      { key: 'cash_crisis_days', label: 'Crisis threshold', suffix: ' days' },
    ],
  },
  {
    title: 'Operations',
    fields: [
      { key: 'interest_rate_pct', label: 'Interest rate on reserves', suffix: '%', step: 0.1 },
    ],
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDollars(n: number): string {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function getCurrentFiscalMonth(): string {
  const now = new Date()
  const m = now.getMonth() + 1 // 1-indexed
  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const idx = fiscalIndexFromKey(currentMonthKey())
  return `${monthNames[m]} (Month ${idx} of 12)`
}

// ── Component ───────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()

  // ── Core state ──
  const [step, setStep] = useState(-1)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Mode for SchoolLaunch import ──
  const [mode, setMode] = useState<'wizard' | 'import'>('wizard')
  const [importStep, setImportStep] = useState<'upload' | 'parsing' | 'confirm' | 'complete'>('upload')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importProfile, setImportProfile] = useState<ImportedSchoolProfile | null>(null)
  const [importBudgetLines, setImportBudgetLines] = useState<ImportedBudgetLine[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const importFileRef = useRef<HTMLInputElement>(null)

  // ── Step 0: School Identity ──
  const [name, setName] = useState('')
  const [authorizer, setAuthorizer] = useState('Washington State Charter School Commission')
  const [gradesCurrentFirst, setGradesCurrentFirst] = useState('')
  const [gradesCurrentLast, setGradesCurrentLast] = useState('')
  const [gradesBuildoutFirst, setGradesBuildoutFirst] = useState('')
  const [gradesBuildoutLast, setGradesBuildoutLast] = useState('')
  const [headcount, setHeadcount] = useState('')
  const [currentFtes, setCurrentFtes] = useState('')
  const [priorYearFtes, setPriorYearFtes] = useState('')
  const [operatingYear, setOperatingYear] = useState(1)

  // ── Step 1: Enrollment & Demographics ──
  const [aaftePct, setAaftePct] = useState(95)
  const [frlPct, setFrlPct] = useState(45)
  const [iepPct, setIepPct] = useState(14)
  const [ellPct, setEllPct] = useState(12)
  const [hicapPct, setHicapPct] = useState(5)

  // ── Step 2: Dates & Financials ──
  const [nextBoardMeeting, setNextBoardMeeting] = useState('')
  const [boardMeetingFrequency, setBoardMeetingFrequency] = useState('Monthly')
  const [nextFinanceCommittee, setNextFinanceCommittee] = useState('')
  const [openingCashBalance, setOpeningCashBalance] = useState('')

  // ── Step 3: First Upload ──
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadFileName, setUploadFileName] = useState('')
  const [allDataRows, setAllDataRows] = useState<string[][]>([])
  const [columnMappings, setColumnMappings] = useState<ColumnMappingResult[]>([])
  const [mappedData, setMappedData] = useState<MappedCategory[]>([])
  const [mappedGrants, setMappedGrants] = useState<MappedGrant[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Step 4: Financial Assumptions ──
  const [assumptions, setAssumptions] = useState<FinancialAssumptions>({
    ...DEFAULT_FINANCIAL_ASSUMPTIONS,
  })

  // ── On mount: check for existing school ──
  useEffect(() => {
    ;(async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: school } = await supabase
          .from('schools')
          .select(
            'id, name, authorizer, grades_current_first, grades_current_last, grades_buildout_first, grades_buildout_last, current_ftes, prior_year_ftes, headcount, operating_year, next_board_meeting, next_finance_committee, opening_cash_balance, onboarding_completed, financial_assumptions, frl_pct, iep_pct, ell_pct, hicap_pct, sped_pct, board_meeting_frequency',
          )
          .eq('user_id', user.id)
          .single()

        if (school?.onboarding_completed) {
          router.push('/dashboard')
          return
        }

        if (school) {
          setSchoolId(school.id)
          // Populate fields from existing record
          if (school.name) setName(school.name)
          if (school.authorizer) setAuthorizer(school.authorizer)
          if (school.grades_current_first) setGradesCurrentFirst(school.grades_current_first)
          if (school.grades_current_last) setGradesCurrentLast(school.grades_current_last)
          if (school.grades_buildout_first) setGradesBuildoutFirst(school.grades_buildout_first)
          if (school.grades_buildout_last) setGradesBuildoutLast(school.grades_buildout_last)
          if (school.headcount) setHeadcount(String(school.headcount))
          if (school.current_ftes) setCurrentFtes(String(school.current_ftes))
          if (school.prior_year_ftes) setPriorYearFtes(String(school.prior_year_ftes))
          if (school.operating_year) setOperatingYear(school.operating_year)
          if (school.next_board_meeting) setNextBoardMeeting(school.next_board_meeting)
          if (school.next_finance_committee) setNextFinanceCommittee(school.next_finance_committee)
          if (school.opening_cash_balance != null) setOpeningCashBalance(String(school.opening_cash_balance))
          if (school.board_meeting_frequency) setBoardMeetingFrequency(school.board_meeting_frequency)
          if (school.frl_pct != null) setFrlPct(school.frl_pct)
          if (school.iep_pct != null) setIepPct(school.iep_pct)
          if (school.ell_pct != null) setEllPct(school.ell_pct)
          if (school.hicap_pct != null) setHicapPct(school.hicap_pct)
          if (school.financial_assumptions) {
            setAssumptions(mergeAssumptions(school.financial_assumptions))
            if (school.financial_assumptions.aafte_pct != null) setAaftePct(school.financial_assumptions.aafte_pct)
          }

          // Detect resume step: find the first step that isn't filled
          if (!school.name) {
            setStep(0)
          } else if (school.headcount == null || school.frl_pct == null) {
            setStep(1)
          } else if (school.opening_cash_balance == null) {
            setStep(2)
          } else {
            setStep(3)
          }
        }
      } catch {
        // Silently handle — user will see the welcome screen
      }
      setLoading(false)
    })()
  }, [router])

  // ── Navigation ──
  const canGoNext = (): boolean => {
    if (step === 0) return name.trim().length > 0
    if (step === 1) return true
    if (step === 2) return openingCashBalance.trim().length > 0
    if (step === 3) return true
    if (step === 4) return true
    return true
  }

  const goNext = async () => {
    setError(null)
    setInfo(null)

    // Save on step 0 → 1
    if (step === 0) {
      setSaving(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('Session expired. Please sign in again.')
        setSaving(false)
        return
      }

      const payload = {
        user_id: user.id,
        name: name.trim(),
        authorizer,
        grades_current_first: gradesCurrentFirst || null,
        grades_current_last: gradesCurrentLast || null,
        grades_buildout_first: gradesBuildoutFirst || null,
        grades_buildout_last: gradesBuildoutLast || null,
        headcount: parseInt(headcount) || 0,
        current_ftes: parseFloat(currentFtes) || 0,
        prior_year_ftes: parseFloat(priorYearFtes) || 0,
        operating_year: operatingYear,
      }

      const { data: upserted, error: upsertErr } = await supabase
        .from('schools')
        .upsert(payload, { onConflict: 'user_id' })
        .select('id')
        .single()
      if (upsertErr) {
        setError(upsertErr.message)
        setSaving(false)
        return
      }
      if (!schoolId) setSchoolId(upserted.id)
      setSaving(false)
    }

    // Save on step 1 → 2
    if (step === 1 && schoolId) {
      setSaving(true)
      const { error: updateErr } = await supabase
        .from('schools')
        .update({
          frl_pct: frlPct,
          iep_pct: iepPct,
          sped_pct: iepPct, // alias
          ell_pct: ellPct,
          hicap_pct: hicapPct,
          financial_assumptions: { ...assumptions, aafte_pct: aaftePct },
        })
        .eq('id', schoolId)
      if (updateErr) {
        setError(updateErr.message)
        setSaving(false)
        return
      }
      setAssumptions((prev) => ({ ...prev, aafte_pct: aaftePct }))
      setSaving(false)
    }

    // Save on step 2 → 3
    if (step === 2 && schoolId) {
      setSaving(true)
      const { error: updateErr } = await supabase
        .from('schools')
        .update({
          next_board_meeting: nextBoardMeeting || null,
          board_meeting_frequency: boardMeetingFrequency,
          next_finance_committee: nextFinanceCommittee || null,
          opening_cash_balance: parseFloat(openingCashBalance) || 0,
        })
        .eq('id', schoolId)
      if (updateErr) {
        setError(updateErr.message)
        setSaving(false)
        return
      }
      setSaving(false)
    }

    // Save on step 4 → 5 (assumptions)
    if (step === 4 && schoolId) {
      setSaving(true)
      const { error: updateErr } = await supabase
        .from('schools')
        .update({ financial_assumptions: assumptions })
        .eq('id', schoolId)
      if (updateErr) {
        setError(updateErr.message)
        setSaving(false)
        return
      }
      setSaving(false)
    }

    setStep((s) => s + 1)
  }

  const goBack = () => {
    setError(null)
    setInfo(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  // ── Upload handling (Step 3) ──
  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      setError('Please upload a CSV or Excel (.xlsx) file.')
      return
    }

    setParsing(true)
    setError(null)

    try {
      let allRows: string[][]
      if (ext === 'csv') {
        const text = await file.text()
        const result = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true })
        allRows = (result.data as string[][]).map((row) => row.map((c) => String(c ?? '').trim()))
      } else {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        allRows = (
          XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '' }) as (string | number)[][]
        ).map((row) => row.map((c) => String(c ?? '').trim()))
      }

      if (allRows.length < 2) {
        setError('The file appears to be empty or has fewer than 2 rows.')
        setParsing(false)
        return
      }

      const headerRow = allRows[0]
      const dataRows = allRows.slice(1).filter((row) => row.some((c) => c !== ''))
      const mappings = autoMapColumns(headerRow, dataRows)

      setUploadFileName(file.name)
      setAllDataRows(dataRows)
      setColumnMappings(mappings)

      const { categories: mapped, cashBalanceRowsSkipped } = applyMappings(mappings, dataRows)
      const grants = extractGrants(mappings, dataRows)
      setMappedData(mapped)
      setMappedGrants(grants)
      setUploadSuccess(true)

      if (cashBalanceRowsSkipped > 0) {
        setInfo(
          'Opening cash balance is managed in your school profile settings, not through uploads. That row was skipped.',
        )
      }
    } catch {
      setError('Failed to parse the file. Please check the format and try again.')
    }

    setParsing(false)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  // ── Step 5: Finish (mark onboarding complete, go to dashboard) ──
  const finishSetup = async () => {
    setSaving(true)
    setError(null)

    let resolvedSchoolId = schoolId
    if (!resolvedSchoolId) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('Session expired. Please sign in again.')
        setSaving(false)
        return
      }
      const { data: school } = await supabase.from('schools').select('id').eq('user_id', user.id).single()
      if (school) {
        resolvedSchoolId = school.id
        setSchoolId(school.id)
      }
    }

    if (!resolvedSchoolId) {
      setError('No school profile found. Please go back to Step 1 and save your school info.')
      setSaving(false)
      return
    }

    // If they uploaded data, import via the store
    if (uploadSuccess && mappedData.length > 0) {
      const { useStore } = await import('@/lib/store')
      const currentUser = (await supabase.auth.getUser()).data.user
      if (currentUser) {
        useStore.getState().setSchoolContext(currentUser.id, resolvedSchoolId)
        useStore.getState().importFinancialData(
          mappedData,
          currentMonthKey(),
          uploadFileName,
          allDataRows.length,
          mappedGrants.length > 0 ? mappedGrants : undefined,
        )
      }
    }

    // Mark onboarding complete
    const { error: completeErr } = await supabase
      .from('schools')
      .update({ onboarding_completed: true })
      .eq('id', resolvedSchoolId)

    if (completeErr) {
      setError('Failed to save onboarding status. Please try again.')
      setSaving(false)
      return
    }

    setSaving(false)
    router.push('/dashboard')
    router.refresh()
  }

  // ── SchoolLaunch Import Handlers ──

  const handleImportFiles = async (files: FileList) => {
    setImportErrors([])
    setImportStep('parsing')

    let profileJson: SchoolLaunchProfile | null = null
    let budgetCsvText: string | null = null
    const warnings: string[] = []

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'json') {
        try {
          const text = await file.text()
          profileJson = JSON.parse(text) as SchoolLaunchProfile
        } catch {
          warnings.push(`Failed to parse ${file.name} as JSON.`)
        }
      } else if (ext === 'csv') {
        budgetCsvText = await file.text()
      } else if (ext === 'zip') {
        try {
          const JSZip = (await import('jszip')).default
          const zip = await JSZip.loadAsync(file)
          for (const [zipName, entry] of Object.entries(zip.files)) {
            if (zipName.endsWith('.json') && !profileJson) {
              const text = await entry.async('text')
              profileJson = JSON.parse(text) as SchoolLaunchProfile
            } else if (zipName.endsWith('.csv') && !budgetCsvText) {
              budgetCsvText = await entry.async('text')
            }
          }
        } catch {
          warnings.push(`Failed to extract ${file.name}. Make sure it's a valid zip file.`)
        }
      }
    }

    if (!profileJson) {
      setImportErrors(['No school profile JSON found. Please upload a JSON file from SchoolLaunch.'])
      setImportStep('upload')
      return
    }

    try {
      const result = parseSchoolLaunchProfile(profileJson)
      if (budgetCsvText) {
        const { lines, warnings: csvWarnings } = parseBudgetCSV(budgetCsvText)
        result.budgetLines = [...result.budgetLines, ...lines]
        result.warnings.push(...csvWarnings)
      }
      result.warnings.push(...warnings)
      setImportResult(result)
      setImportProfile({ ...result.profile })
      setImportBudgetLines([...result.budgetLines])
      setImportStep('confirm')
    } catch (err) {
      setImportErrors([
        `Import parsing failed: ${err instanceof Error ? err.message : 'Unknown error'}. You can fall back to manual setup.`,
      ])
      setImportStep('upload')
    }
  }

  const finishImport = async () => {
    if (!importProfile || !importResult) return
    setSaving(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('Session expired.')
        setSaving(false)
        return
      }

      const mergedAssumptions = mergeAssumptions(importResult.assumptions)

      const payload = {
        user_id: user.id,
        name: importProfile.name,
        authorizer: importProfile.authorizer,
        grades_current_first: importProfile.gradesCurrentFirst,
        grades_current_last: importProfile.gradesCurrentLast,
        grades_buildout_first: importProfile.gradesBuildoutFirst,
        grades_buildout_last: importProfile.gradesBuildoutLast,
        current_ftes: importProfile.currentFTES,
        prior_year_ftes: importProfile.priorYearFTES,
        headcount: importProfile.headcount,
        operating_year: importProfile.operatingYear,
        opening_cash_balance: importProfile.openingCashBalance,
        sped_pct: importProfile.spedPct,
        frl_pct: importProfile.frlPct,
        ell_pct: importProfile.ellPct,
        hicap_pct: importProfile.hicapPct,
        iep_pct: importProfile.iepPct,
        financial_assumptions: mergedAssumptions,
        imported_from_schoollaunch: true,
        schoollaunch_import_date: new Date().toISOString(),
        onboarding_completed: true,
      }

      const { data: upserted, error: upsertErr } = await supabase
        .from('schools')
        .upsert(payload, { onConflict: 'user_id' })
        .select('id')
        .single()

      if (upsertErr) {
        setError(upsertErr.message)
        setSaving(false)
        return
      }

      const newSchoolId = upserted.id

      if (importBudgetLines.length > 0) {
        const { useStore } = await import('@/lib/store')
        useStore.getState().setSchoolContext(user.id, newSchoolId)
        const mappedCategories = importBudgetLines.map((l) => ({
          category: l.category,
          budget: l.budget,
          ytdActuals: l.ytdActuals,
          accountType: l.accountType,
        }))
        useStore.getState().importFinancialData(mappedCategories, currentMonthKey(), 'SchoolLaunch Import', mappedCategories.length)
      }

      setImportStep('complete')
      setSaving(false)
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
      setSaving(false)
    }
  }

  // ── Computed values ──

  const hc = parseInt(headcount) || 0

  // Grant estimates for Step 1
  const aafte = Math.round(hc * aaftePct / 100)
  const grantEstimates = {
    regularEd: Math.round(aafte * assumptions.regular_ed_per_pupil),
    sped: Math.round(Math.round(aafte * iepPct / 100) * assumptions.sped_per_pupil),
    facilities: Math.round(aafte * assumptions.facilities_per_pupil),
    titleI: frlPct >= 40 ? Math.round(Math.round(hc * frlPct / 100) * assumptions.title_i_per_pupil) : 0,
    idea: Math.round(Math.round(hc * iepPct / 100) * assumptions.idea_per_pupil),
    lap: Math.round(Math.round(hc * frlPct / 100) * assumptions.lap_per_pupil),
    tbip: Math.round(Math.round(hc * ellPct / 100) * assumptions.tbip_per_pupil),
    hicap: Math.round(Math.round(hc * hicapPct / 100) * assumptions.hicap_per_pupil),
  }
  const totalEstimatedRevenue =
    grantEstimates.regularEd +
    grantEstimates.sped +
    grantEstimates.facilities +
    grantEstimates.titleI +
    grantEstimates.idea +
    grantEstimates.lap +
    grantEstimates.tbip +
    grantEstimates.hicap

  // Revenue model for completion screen
  const completionRevenue = (() => {
    if (hc === 0) return 0
    const profile: SchoolProfile = {
      name,
      authorizer,
      gradesCurrentFirst,
      gradesCurrentLast,
      gradesBuildoutFirst,
      gradesBuildoutLast,
      currentFTES: parseFloat(currentFtes) || 0,
      priorYearFTES: parseFloat(priorYearFtes) || 0,
      nextBoardMeeting: nextBoardMeeting,
      nextFinanceCommittee: nextFinanceCommittee,
      openingCashBalance: parseFloat(openingCashBalance) || 0,
      operatingYear,
      headcount: hc,
      spedPct: iepPct,
      frlPct,
      ellPct,
      hicapPct,
      iepPct,
      currentAssets: 0,
      currentLiabilities: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      annualDepreciation: 0,
      annualDebtService: 0,
      interestExpense: 0,
    }
    const lines = buildRevenueModel(profile, assumptions, [])
    return lines.reduce((s, l) => s + l.expected, 0)
  })()

  // ── Render helpers ──

  const renderLogo = () => (
    <div className="flex items-center justify-center gap-2.5 mb-2">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-extrabold text-white"
        style={{
          background: 'linear-gradient(135deg, #2ec4b6 0%, #14a3a3 100%)',
          fontFamily: 'var(--font-display), system-ui, sans-serif',
          boxShadow: '0 2px 8px rgba(46, 196, 182, 0.3)',
        }}
      >
        S
      </div>
      <div
        className="text-2xl tracking-tight"
        style={{
          color: 'var(--brand-700)',
          fontFamily: 'var(--font-display), system-ui, sans-serif',
          fontWeight: 700,
        }}
      >
        School<span style={{ color: 'var(--accent-500)' }}>CFO</span>
      </div>
    </div>
  )

  const renderStepper = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const done = i < step
          const active = i === step
          return (
            <div key={s.label} className="flex flex-col items-center relative" style={{ flex: 1 }}>
              {/* Connecting line */}
              {i > 0 && (
                <div
                  className="absolute top-4 -translate-y-1/2 h-0.5"
                  style={{
                    left: '-50%',
                    right: '50%',
                    background: i <= step ? 'var(--brand-700)' : '#e5e7eb',
                  }}
                />
              )}
              {/* Circle */}
              <div className="relative z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    done
                      ? 'bg-green-500 text-white'
                      : active
                        ? 'text-white'
                        : 'bg-gray-200 text-gray-400'
                  }`}
                  style={active ? { background: 'var(--brand-700)' } : {}}
                >
                  {done ? <CheckCircle size={14} /> : <Icon size={14} />}
                </div>
                {active && (
                  <div
                    className="absolute inset-0 rounded-full animate-pulse"
                    style={{
                      border: '2px solid var(--brand-700)',
                      opacity: 0.4,
                      margin: '-3px',
                    }}
                  />
                )}
              </div>
              {/* Label */}
              <span
                className={`text-[11px] mt-1.5 text-center leading-tight ${
                  active ? 'font-semibold text-gray-800' : done ? 'text-gray-600' : 'text-gray-400'
                }`}
              >
                {s.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="w-10 h-10 border-[3px] rounded-full animate-spin"
          style={{ borderColor: 'var(--brand-200)', borderTopColor: 'var(--brand-600)' }}
        />
      </div>
    )
  }

  // ── SchoolLaunch Import Flow ──
  if (mode === 'import') {
    return (
      <div className="w-full max-w-2xl mx-auto px-4">
        <div className="text-center mb-6">
          {renderLogo()}
          <h1 className="text-lg font-bold text-gray-900 mt-3" style={HEADING_FONT}>
            Import from SchoolLaunch
          </h1>
        </div>

        <div
          className="bg-white rounded-xl p-6"
          style={{ border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}
        >
          {importStep === 'upload' && (
            <div>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Upload your SchoolLaunch export files. You can upload a <strong>zip file</strong> or select individual
                files:
              </p>
              <ul className="text-xs mb-4 space-y-1" style={{ color: 'var(--text-tertiary)' }}>
                <li>
                  &bull; <strong>Profile JSON</strong> (required) &mdash; your school profile and financial assumptions
                </li>
                <li>
                  &bull; <strong>Budget CSV</strong> (optional) &mdash; projected budget lines
                </li>
                <li>
                  &bull; <strong>PDF Summary</strong> (optional) &mdash; ignored but accepted for convenience
                </li>
              </ul>

              <input
                ref={importFileRef}
                type="file"
                accept=".json,.csv,.zip,.pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleImportFiles(e.target.files)
                }}
              />
              <button
                onClick={() => importFileRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#2ec4b6] transition-colors text-center"
              >
                <UploadCloud size={28} className="mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm font-medium text-gray-700">Click to select files</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  JSON, CSV, ZIP, or PDF
                </p>
              </button>

              {importErrors.length > 0 && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  {importErrors.map((err, i) => (
                    <p key={i} className="text-xs text-red-700">
                      {err}
                    </p>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setMode('wizard')
                  setError(null)
                }}
                className="mt-4 text-xs font-medium hover:underline"
                style={{ color: 'var(--text-tertiary)' }}
              >
                &larr; Switch to manual setup
              </button>
            </div>
          )}

          {importStep === 'parsing' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2ec4b6] mx-auto mb-3" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Parsing SchoolLaunch data...
              </p>
            </div>
          )}

          {importStep === 'confirm' && importProfile && importResult && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={18} className="text-green-500" />
                <h2 className="text-sm font-semibold text-gray-800" style={HEADING_FONT}>
                  Import Preview
                </h2>
              </div>

              {importResult.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                  {importResult.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700">
                      {w}
                    </p>
                  ))}
                </div>
              )}

              <div className="space-y-3 mb-5">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-gray-400 mb-0.5">School Name</label>
                    <input
                      type="text"
                      value={importProfile.name}
                      onChange={(e) => setImportProfile({ ...importProfile, name: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-0.5">Grades</label>
                    <p className="text-sm text-gray-800 py-2">
                      {importProfile.gradesCurrentFirst}&ndash;{importProfile.gradesCurrentLast} &rarr;{' '}
                      {importProfile.gradesBuildoutFirst}&ndash;{importProfile.gradesBuildoutLast}
                    </p>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-0.5">Enrollment (Year 1)</label>
                    <input
                      type="number"
                      value={importProfile.headcount}
                      onChange={(e) =>
                        setImportProfile({
                          ...importProfile,
                          headcount: Number(e.target.value),
                          currentFTES: Number(e.target.value),
                        })
                      }
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-0.5">FRL %</label>
                    <input
                      type="number"
                      value={importProfile.frlPct}
                      onChange={(e) => setImportProfile({ ...importProfile, frlPct: Number(e.target.value) })}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {importBudgetLines.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Budget Lines ({importBudgetLines.length})
                  </h3>
                  <div
                    className="max-h-48 overflow-y-auto border rounded-lg"
                    style={{ borderColor: 'var(--border-default)' }}
                  >
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b" style={{ borderColor: 'var(--border-default)' }}>
                          <th className="text-left py-1.5 px-3 font-medium text-gray-500">Category</th>
                          <th className="text-right py-1.5 px-3 font-medium text-gray-500">Budget</th>
                          <th className="text-left py-1.5 px-3 font-medium text-gray-500">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importBudgetLines.map((line, i) => (
                          <tr key={i} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                            <td className="py-1.5 px-3 text-gray-700">{line.category}</td>
                            <td className="py-1.5 px-3 text-right tabular-nums text-gray-700">
                              ${line.budget.toLocaleString()}
                            </td>
                            <td className="py-1.5 px-3">
                              <span
                                className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  line.accountType === 'revenue'
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {line.accountType}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importResult.staffingPlan.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Staffing Plan ({importResult.staffingPlan.length} positions,{' '}
                    {importResult.staffingPlan.reduce((s, p) => s + p.fte, 0).toFixed(1)} FTE)
                  </h3>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={finishImport}
                  disabled={saving || !importProfile.name}
                  className="flex-1 py-2.5 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={PRIMARY_BTN}
                >
                  {saving ? 'Importing...' : 'Confirm & Import'}
                </button>
                <button
                  onClick={() => {
                    setImportStep('upload')
                    setImportResult(null)
                  }}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg border"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  Back
                </button>
              </div>

              <button
                onClick={() => {
                  setMode('wizard')
                  setError(null)
                }}
                className="mt-3 text-xs font-medium hover:underline block"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Switch to manual setup instead
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WIZARD FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      {/* Logo */}
      <div className="text-center mb-4">{renderLogo()}</div>

      {/* Stepper (always visible, gray on welcome) */}
      {step >= 0 ? (
        renderStepper()
      ) : (
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((s) => (
              <div key={s.label} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-400">
                  <s.icon size={14} />
                </div>
                <span className="text-[11px] mt-1.5 text-center leading-tight text-gray-400">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card */}
      <div
        className="p-8"
        style={{
          background: 'var(--surface-card, #fff)',
          borderRadius: '12px',
          border: '1px solid var(--border-default, #e5e7eb)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
        }}
      >
        {/* ═══════════════════ STEP -1: WELCOME ═══════════════════ */}
        {step === -1 && (
          <div className="text-center">
            <h1 className="text-xl text-gray-900 mb-2" style={HEADING_FONT}>
              Welcome to SchoolCFO
            </h1>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
              Let&apos;s set up your school&apos;s financial management
            </p>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-tertiary)' }}>
              We&apos;ll walk you through 5 quick steps to get your school configured: your school identity, enrollment
              and demographics, key dates and opening cash, your first financial data upload, and financial assumptions.
            </p>
            <p className="text-xs mb-8 italic" style={{ color: 'var(--text-tertiary)' }}>
              You can change any of these answers later in Settings.
            </p>

            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <button
                onClick={() => setStep(0)}
                className="py-2.5 px-6 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
                style={PRIMARY_BTN}
              >
                Get Started
              </button>
              <button
                onClick={() => setMode('import')}
                className="py-2.5 px-6 text-sm font-semibold rounded-lg border-2 hover:shadow-sm transition-all"
                style={{
                  borderColor: 'var(--brand-700)',
                  color: 'var(--brand-700)',
                  fontFamily: 'var(--font-display), system-ui, sans-serif',
                }}
              >
                Import from SchoolLaunch
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP 0: SCHOOL IDENTITY ═══════════════════ */}
        {step === 0 && (
          <div>
            <h1 className="text-lg text-gray-900 mb-1" style={HEADING_FONT}>
              School Identity
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Basic information about your school. This helps us tailor dashboards and reports.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  School name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="e.g. Cascade Charter Elementary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Authorizer
                </label>
                <select
                  value={authorizer}
                  onChange={(e) => setAuthorizer(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                >
                  {AUTHORIZER_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <GradeSpanSelector
                label="Grades currently served"
                description="The grade levels your school serves this year"
                firstGrade={gradesCurrentFirst}
                lastGrade={gradesCurrentLast}
                onFirstChange={setGradesCurrentFirst}
                onLastChange={setGradesCurrentLast}
                inputCls={inputCls}
                inputStyle={inputStyle}
              />

              <GradeSpanSelector
                label="Grades at full build-out"
                description="The grade levels your school will serve when fully grown"
                firstGrade={gradesBuildoutFirst}
                lastGrade={gradesBuildoutLast}
                onFirstChange={setGradesBuildoutFirst}
                onLastChange={setGradesBuildoutLast}
                inputCls={inputCls}
                inputStyle={inputStyle}
              />

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Headcount (enrolled)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={headcount}
                    onChange={(e) => setHeadcount(e.target.value)}
                    className={inputCls}
                    style={inputStyle}
                    placeholder="e.g. 200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Current FTES
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={currentFtes}
                    onChange={(e) => setCurrentFtes(e.target.value)}
                    className={inputCls}
                    style={inputStyle}
                    placeholder="e.g. 187"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Prior year FTES
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={priorYearFtes}
                    onChange={(e) => setPriorYearFtes(e.target.value)}
                    className={inputCls}
                    style={inputStyle}
                    placeholder="e.g. 175"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Operating year
                </label>
                <select
                  value={operatingYear}
                  onChange={(e) => setOperatingYear(Number(e.target.value))}
                  className={inputCls}
                  style={inputStyle}
                >
                  {OPERATING_YEAR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP 1: ENROLLMENT & DEMOGRAPHICS ═══════════════════ */}
        {step === 1 && (
          <div>
            <h1 className="text-lg text-gray-900 mb-1" style={HEADING_FONT}>
              Enrollment &amp; Demographics
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              These percentages drive your revenue projections. We&apos;ll show estimated grant amounts as you adjust.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Inputs */}
              <div className="space-y-5">
                {/* Headcount (read-only) + AAFTE */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      Headcount
                    </label>
                    <input type="number" value={headcount} readOnly className={inputCls + ' bg-gray-50 cursor-not-allowed'} style={inputStyle} />
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      From Step 1
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      AAFTE %
                    </label>
                    <input
                      type="number"
                      min="50"
                      max="100"
                      value={aaftePct}
                      onChange={(e) => setAaftePct(Number(e.target.value))}
                      className={inputCls}
                      style={inputStyle}
                    />
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      Default 95%
                    </p>
                  </div>
                </div>

                {/* Demographic sliders */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Free &amp; Reduced Lunch (FRL)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={frlPct}
                      onChange={(e) => setFrlPct(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-12 text-right text-sm font-medium tabular-nums">{frlPct}%</span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    WA avg ~45%
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    IEP (Special Education)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={iepPct}
                      onChange={(e) => setIepPct(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-12 text-right text-sm font-medium tabular-nums">{iepPct}%</span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    WA avg ~14%
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    English Language Learners (ELL)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="40"
                      value={ellPct}
                      onChange={(e) => setEllPct(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-12 text-right text-sm font-medium tabular-nums">{ellPct}%</span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    WA avg ~12%
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Highly Capable (HiCap)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="15"
                      value={hicapPct}
                      onChange={(e) => setHicapPct(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-12 text-right text-sm font-medium tabular-nums">{hicapPct}%</span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    WA avg ~5%
                  </p>
                </div>
              </div>

              {/* Right: Live grant estimates */}
              <div>
                <div
                  className="rounded-lg p-4"
                  style={{
                    background: 'var(--brand-50, #f0f4f8)',
                    border: '1px solid var(--border-default, #e5e7eb)',
                  }}
                >
                  <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--brand-700)' }}>
                    Estimated Annual Revenue
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Regular Ed ({aafte} AAFTE)</span>
                      <span className="font-medium tabular-nums">{fmtDollars(grantEstimates.regularEd)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>SPED ({iepPct}% IEP)</span>
                      <span className="font-medium tabular-nums">{fmtDollars(grantEstimates.sped)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Facilities</span>
                      <span className="font-medium tabular-nums">{fmtDollars(grantEstimates.facilities)}</span>
                    </div>
                    {frlPct >= 40 && (
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Title I ({frlPct}% FRL)</span>
                        <span className="font-medium tabular-nums">{fmtDollars(grantEstimates.titleI)}</span>
                      </div>
                    )}
                    {frlPct < 40 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Title I (FRL below 40%)</span>
                        <span className="text-gray-400">&mdash;</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>IDEA ({iepPct}% IEP)</span>
                      <span className="font-medium tabular-nums">{fmtDollars(grantEstimates.idea)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>LAP ({frlPct}% FRL)</span>
                      <span className="font-medium tabular-nums">{fmtDollars(grantEstimates.lap)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>TBIP ({ellPct}% ELL)</span>
                      <span className="font-medium tabular-nums">{fmtDollars(grantEstimates.tbip)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>HiCap ({hicapPct}%)</span>
                      <span className="font-medium tabular-nums">{fmtDollars(grantEstimates.hicap)}</span>
                    </div>

                    <div className="border-t pt-2 mt-2 flex justify-between" style={{ borderColor: 'var(--border-default)' }}>
                      <span className="font-semibold" style={{ color: 'var(--brand-700)' }}>
                        Total Estimated
                      </span>
                      <span className="font-bold tabular-nums" style={{ color: 'var(--brand-700)' }}>
                        {fmtDollars(totalEstimatedRevenue)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP 2: DATES & FINANCIALS ═══════════════════ */}
        {step === 2 && (
          <div>
            <h1 className="text-lg text-gray-900 mb-1" style={HEADING_FONT}>
              Dates &amp; Cash
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              We&apos;ll use these to prepare reports and reminders ahead of time.
            </p>

            <div className="space-y-4">
              {/* Fiscal year display (read-only) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Fiscal year
                  </label>
                  <div className={inputCls + ' bg-gray-50 cursor-not-allowed'} style={inputStyle}>
                    September 1 &ndash; August 31
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Current fiscal month
                  </label>
                  <div className={inputCls + ' bg-gray-50 cursor-not-allowed'} style={inputStyle}>
                    {getCurrentFiscalMonth()}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Next board meeting date
                </label>
                <input
                  type="date"
                  value={nextBoardMeeting}
                  onChange={(e) => setNextBoardMeeting(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Board meeting frequency
                </label>
                <select
                  value={boardMeetingFrequency}
                  onChange={(e) => setBoardMeetingFrequency(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Bi-Monthly">Bi-Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Next finance committee date
                </label>
                <input
                  type="date"
                  value={nextFinanceCommittee}
                  onChange={(e) => setNextFinanceCommittee(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Opening cash balance <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={openingCashBalance}
                    onChange={(e) => setOpeningCashBalance(e.target.value)}
                    className={inputCls + ' pl-7'}
                    style={inputStyle}
                    placeholder="e.g. 250000"
                  />
                </div>
                <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  Your school&apos;s cash balance at the start of this fiscal year &mdash; found on your prior year
                  financial statements.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP 3: FIRST UPLOAD ═══════════════════ */}
        {step === 3 && (
          <div>
            <h1 className="text-lg text-gray-900 mb-1" style={HEADING_FONT}>
              Upload Your Financial Data
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Drop a CSV or Excel file with your budget data. We&apos;ll automatically map columns and start analyzing.
              Not sure about the format?{' '}
              <a
                href="/cascade-charter-sample.csv"
                download
                className="font-medium hover:opacity-75 transition-opacity"
                style={{ color: 'var(--brand-700)' }}
              >
                <Download size={12} className="inline -mt-0.5 mr-0.5" />
                Download a sample file
              </a>
            </p>

            {!uploadSuccess ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => !parsing && fileInputRef.current?.click()}
                className={`rounded-xl border-2 border-dashed p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  dragging
                    ? 'border-[#1e3a5f] bg-blue-50'
                    : 'border-gray-300 hover:border-[#1e3a5f] hover:bg-gray-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={onFileChange}
                />
                {parsing ? (
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="w-10 h-10 border-[3px] rounded-full animate-spin"
                      style={{ borderColor: 'var(--brand-200)', borderTopColor: 'var(--brand-600)' }}
                    />
                    <p className="text-sm text-gray-500">Reading file...</p>
                  </div>
                ) : (
                  <>
                    <UploadCloud size={36} className={dragging ? 'text-[#1e3a5f]' : 'text-gray-400'} />
                    <p className="mt-3 text-sm font-medium text-gray-700">Drop your file here or click to browse</p>
                    <p className="text-xs text-gray-400 mt-1">CSV and Excel (.xlsx) files accepted</p>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle size={20} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800">{uploadFileName}</p>
                    <p className="text-xs text-green-600">
                      {allDataRows.length} rows &middot; {mappedData.length} budget categories
                      {mappedGrants.length > 0 && ` \u00b7 ${mappedGrants.length} grants`}
                      {isFullyMapped(columnMappings) && ' \u00b7 All columns auto-detected'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setUploadSuccess(false)
                    setUploadFileName('')
                    setMappedData([])
                    setMappedGrants([])
                  }}
                  className="mt-3 text-xs font-medium hover:underline"
                  style={{ color: 'var(--brand-700)' }}
                >
                  Upload a different file
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ STEP 4: FINANCIAL ASSUMPTIONS ═══════════════════ */}
        {step === 4 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-lg text-gray-900" style={HEADING_FONT}>
                Financial Assumptions
              </h1>
              <button
                onClick={() => setAssumptions({ ...DEFAULT_FINANCIAL_ASSUMPTIONS })}
                className="text-xs font-medium hover:underline"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Reset All to Defaults
              </button>
            </div>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Pre-populated with WA state defaults. Adjust these to match your school&apos;s situation.
            </p>

            <div className="space-y-5 max-h-[50vh] overflow-y-auto pr-1">
              {ASSUMPTION_GROUPS.map((group) => (
                <div
                  key={group.title}
                  className="rounded-lg p-4"
                  style={{
                    background: 'var(--surface-card, #fff)',
                    border: '1px solid var(--border-default, #e5e7eb)',
                  }}
                >
                  <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--brand-700)' }}>
                    {group.title}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {group.fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                          {field.label}
                        </label>
                        <div className="relative">
                          {field.prefix && (
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                              {field.prefix}
                            </span>
                          )}
                          <input
                            type="number"
                            step={field.step ?? 1}
                            value={assumptions[field.key]}
                            onChange={(e) =>
                              setAssumptions((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))
                            }
                            className={`${inputCls} text-xs ${field.prefix ? 'pl-7' : ''}`}
                            style={inputStyle}
                          />
                          {field.suffix && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                              {field.suffix}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP 5: COMPLETION ═══════════════════ */}
        {step === 5 && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-green-600" />
            </div>
            <h1 className="text-xl text-gray-900 mb-2" style={HEADING_FONT}>
              You&apos;re All Set!
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Here&apos;s a summary of your school&apos;s configuration.
            </p>

            {/* Summary metrics */}
            <div
              className="rounded-lg p-5 mb-6 text-left"
              style={{
                background: 'var(--brand-50, #f0f4f8)',
                border: '1px solid var(--border-default, #e5e7eb)',
              }}
            >
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    School
                  </span>
                  <span className="font-semibold text-gray-900">{name}</span>
                </div>
                <div>
                  <span className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Grade Configuration
                  </span>
                  <span className="font-semibold text-gray-900">
                    {gradesCurrentFirst || '?'}&ndash;{gradesCurrentLast || '?'}
                    {gradesBuildoutFirst && gradesBuildoutLast && (
                      <span className="text-gray-400 font-normal">
                        {' '}
                        &rarr; {gradesBuildoutFirst}&ndash;{gradesBuildoutLast}
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Enrollment
                  </span>
                  <span className="font-semibold text-gray-900">{hc} students</span>
                </div>
                <div>
                  <span className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Estimated Annual Revenue
                  </span>
                  <span className="font-semibold text-gray-900">{fmtDollars(completionRevenue)}</span>
                </div>
                <div>
                  <span className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Opening Cash Balance
                  </span>
                  <span className="font-semibold text-gray-900">{fmtDollars(parseFloat(openingCashBalance) || 0)}</span>
                </div>
                <div>
                  <span className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Operating Year
                  </span>
                  <span className="font-semibold text-gray-900">
                    Year {operatingYear} ({operatingYear <= 2 ? 'Stage 1' : 'Stage 2'})
                  </span>
                </div>
              </div>
            </div>

            {/* What happens next */}
            <div className="text-left mb-6">
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                What happens next
              </h3>
              <ul className="text-sm space-y-1.5" style={{ color: 'var(--text-tertiary)' }}>
                <li>&bull; Your dashboard will show a morning briefing with key metrics and alerts</li>
                <li>&bull; Upload monthly financial data as you receive it from your accounting system</li>
                <li>&bull; Board packets can be generated before each board meeting</li>
                <li>&bull; Ask Your CFO is available anytime for questions about your finances</li>
                <li>&bull; All settings can be changed later from the Settings page</li>
              </ul>
            </div>

            <button
              onClick={finishSetup}
              disabled={saving}
              className="py-2.5 px-8 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
              style={PRIMARY_BTN}
            >
              {saving ? 'Setting up...' : 'Go to Dashboard'}
            </button>
          </div>
        )}

        {/* ── Error / Info ── */}
        {error && (
          <p
            className="text-sm px-3.5 py-2.5 mt-5"
            style={{
              color: 'var(--danger-700, #b91c1c)',
              background: 'var(--danger-50, #fef2f2)',
              border: '1px solid var(--danger-100, #fee2e2)',
              borderRadius: '8px',
            }}
          >
            {error}
          </p>
        )}

        {info && (
          <p
            className="text-sm px-3.5 py-2.5 mt-5"
            style={{
              color: 'var(--brand-700)',
              background: '#eef6ff',
              border: '1px solid #c6ddf7',
              borderRadius: '8px',
            }}
          >
            {info}
          </p>
        )}

        {/* ── Navigation (not shown on welcome or completion) ── */}
        {step >= 0 && step <= 4 && (
          <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-100">
            <div>
              {step > 0 && (
                <button
                  onClick={goBack}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Skip on steps 3 (upload) */}
              {step === 3 && !uploadSuccess && (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={saving}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Skip for now
                </button>
              )}

              <button
                onClick={goNext}
                disabled={!canGoNext() || saving}
                className="flex items-center gap-1.5 px-5 py-2.5 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity rounded-lg"
                style={PRIMARY_BTN}
              >
                {saving ? 'Saving...' : 'Next'}
                {!saving && <ArrowRight size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
