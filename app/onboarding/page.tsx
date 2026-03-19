'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  School,
  Users,
  PieChart,
  UserPlus,
  Calculator,
  CheckCircle,
  UploadCloud,
  X,
  Plus,
  Lock,
  ArrowRight,
  ArrowLeft,
  BarChart3,
  MessageSquare,
  Clipboard,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { currentMonthKey } from '@/lib/fiscalYear'
import {
  POSITION_BENCHMARKS,
  type PositionCategory,
} from '@/lib/positionBenchmarks'
import {
  DEFAULT_FINANCIAL_ASSUMPTIONS,
  mergeAssumptions,
  type FinancialAssumptions,
} from '@/lib/financialAssumptions'
import {
  parseSchoolLaunchProfile,
  parseBudgetCSV,
  type SchoolLaunchProfile,
  type ImportResult,
  type ImportedBudgetLine,
  type ImportedSchoolProfile,
} from '@/lib/schoollaunchImport'
import { buildRevenueModel } from '@/lib/revenueModel'
import type { SchoolProfile } from '@/lib/store'

// ── Types ────────────────────────────────────────────────────────────────────

interface StaffRow {
  id: string
  title: string
  category: PositionCategory
  fte: number
  salary: number
}

// ── Constants ────────────────────────────────────────────────────────────────

const TEAL = '#2ec4b6'

const ALL_GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

const STEP_META = [
  { label: 'Identity', icon: School },
  { label: 'Enrollment', icon: Users },
  { label: 'Demographics', icon: PieChart },
  { label: 'Staffing', icon: UserPlus },
  { label: 'Operations', icon: Calculator },
] as const

const WA_REGIONS = [
  'King County',
  'Pierce County',
  'Spokane County',
  'Clark County',
  'Snohomish County',
  'Thurston County',
  'Yakima County',
  'Other',
]

// Generate school year options from 2020-2021 through current year
const CURRENT_CALENDAR_YEAR = new Date().getFullYear()
// WA school year: if we're before September, current school year started last calendar year
const CURRENT_SCHOOL_YEAR_START = new Date().getMonth() >= 8 ? CURRENT_CALENDAR_YEAR : CURRENT_CALENDAR_YEAR - 1
const OPENING_YEAR_OPTIONS = Array.from(
  { length: CURRENT_SCHOOL_YEAR_START - 2020 + 1 },
  (_, i) => {
    const startYear = 2020 + i
    return {
      value: `${startYear}-${startYear + 1}`,
      label: `${startYear}-${startYear + 1} School Year`,
    }
  },
)

/** Calculate operating year number from opening year string like "2023-2024" */
function calcOperatingYear(openingYear: string): number {
  const startYear = parseInt(openingYear.split('-')[0], 10)
  if (isNaN(startYear)) return 1
  const yearsOperating = CURRENT_SCHOOL_YEAR_START - startYear + 1
  return Math.max(1, yearsOperating)
}

const BENEFITS_RATE = 0.30

const inputCls =
  'w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2ec4b6]/20 focus:border-[#2ec4b6]'

const HEADING_FONT: React.CSSProperties = {
  fontFamily: 'var(--font-display), system-ui, sans-serif',
  fontWeight: 700,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDollars(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function gradeIndex(g: string): number {
  if (g === 'PK') return -1
  if (g === 'K') return 0
  return parseInt(g, 10)
}

function gradesInRange(first: string, last: string): string[] {
  const f = gradeIndex(first)
  const l = gradeIndex(last)
  return ALL_GRADES.filter((g) => gradeIndex(g) >= f && gradeIndex(g) <= l)
}

function hasElementary(grades: string[]): boolean {
  return grades.some((g) => gradeIndex(g) >= 0 && gradeIndex(g) <= 5)
}

function hasMiddle(grades: string[]): boolean {
  return grades.some((g) => gradeIndex(g) >= 6 && gradeIndex(g) <= 8)
}

function hasHigh(grades: string[]): boolean {
  return grades.some((g) => gradeIndex(g) >= 9 && gradeIndex(g) <= 12)
}

function generateStaffingDefaults(headcount: number, foundingGrades: string[]): StaffRow[] {
  const rows: StaffRow[] = []
  let nextId = 1

  for (const pb of POSITION_BENCHMARKS) {
    let fte = 0

    if (pb.driverType === 'fixed') {
      fte = pb.typicalFteMin
    } else {
      // per_pupil logic
      switch (pb.id) {
        case 'teacher_k5':
          if (hasElementary(foundingGrades)) {
            const elemCount = Math.round(headcount * (foundingGrades.filter((g) => gradeIndex(g) >= 0 && gradeIndex(g) <= 5).length / foundingGrades.length))
            fte = Math.max(1, Math.round((elemCount / 24) * 10) / 10)
          }
          break
        case 'teacher_68':
          if (hasMiddle(foundingGrades)) {
            const midCount = Math.round(headcount * (foundingGrades.filter((g) => gradeIndex(g) >= 6 && gradeIndex(g) <= 8).length / foundingGrades.length))
            fte = Math.max(1, Math.round((midCount / 25) * 10) / 10)
          }
          break
        case 'teacher_912':
          if (hasHigh(foundingGrades)) {
            const hiCount = Math.round(headcount * (foundingGrades.filter((g) => gradeIndex(g) >= 9 && gradeIndex(g) <= 12).length / foundingGrades.length))
            fte = Math.max(1, Math.round((hiCount / 25) * 10) / 10)
          }
          break
        case 'sped_teacher':
          fte = Math.max(0.5, Math.round((headcount * 0.14 / 14) * 10) / 10)
          break
        case 'ell_teacher':
          fte = Math.max(0.5, Math.round((headcount * 0.12 / 30) * 10) / 10)
          break
        case 'counselor':
          fte = Math.max(0.5, Math.round((headcount / 250) * 10) / 10)
          break
        case 'psychologist':
          fte = Math.max(0.2, Math.round((headcount * 0.14 / 60) * 10) / 10)
          break
        case 'slp':
          fte = Math.round((headcount * 0.05 / 40) * 10) / 10
          break
        case 'para_instructional':
          fte = Math.max(0.5, Math.round((headcount / 50) * 10) / 10)
          break
        case 'para_sped':
          fte = Math.max(0.5, Math.round((headcount * 0.14 / 10) * 10) / 10)
          break
        case 'food_service':
          fte = headcount >= 100 ? Math.max(0.5, Math.round((headcount / 200) * 10) / 10) : 0
          break
        case 'afterschool':
          fte = 0
          break
        default:
          fte = pb.typicalFteMin
          break
      }
    }

    if (fte > 0) {
      // Skip some positions for smaller schools
      if (headcount < 200 && ['asst_director', 'dean_students', 'hr_coordinator', 'development_director', 'communications_coord'].includes(pb.id)) {
        continue
      }
      if (headcount < 300 && ['instructional_coach', 'librarian'].includes(pb.id)) {
        continue
      }

      rows.push({
        id: String(nextId++),
        title: pb.title,
        category: pb.category,
        fte: Math.round(fte * 10) / 10,
        salary: pb.benchmarkSalary,
      })
    }
  }

  return rows
}

// ── StepIndicator ────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEP_META.map((s, i) => {
          const Icon = s.icon
          const done = i < currentStep
          const active = i === currentStep
          return (
            <div key={s.label} className="flex flex-col items-center relative" style={{ flex: 1 }}>
              {/* Connecting line */}
              {i > 0 && (
                <div
                  className="absolute top-4 -translate-y-1/2 h-0.5"
                  style={{
                    left: '-50%',
                    right: '50%',
                    backgroundColor: done || active ? TEAL : '#e5e7eb',
                  }}
                />
              )}
              {/* Circle */}
              <div className="relative z-10">
                {done ? (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: TEAL }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ) : active ? (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white"
                    style={{ border: `2px solid ${TEAL}`, color: TEAL }}
                  >
                    <Icon size={14} />
                    <div
                      className="absolute inset-0 rounded-full animate-pulse"
                      style={{
                        border: `2px solid ${TEAL}`,
                        opacity: 0.4,
                        margin: '-3px',
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-400">
                    <Icon size={14} />
                  </div>
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
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()

  // ── Core state ──
  const [step, setStep] = useState(-1)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Mode ──
  const [mode, setMode] = useState<'wizard' | 'import'>('wizard')
  const [importStep, setImportStep] = useState<'upload' | 'parsing' | 'confirm' | 'complete'>('upload')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importProfile, setImportProfile] = useState<ImportedSchoolProfile | null>(null)
  const [importBudgetLines, setImportBudgetLines] = useState<ImportedBudgetLine[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const importFileRef = useRef<HTMLInputElement>(null)

  // ── Step 0: School Identity ──
  const [name, setName] = useState('')
  const [region, setRegion] = useState('King County')
  const [foundingGrades, setFoundingGrades] = useState<string[]>([])
  const [buildoutGrades, setBuildoutGrades] = useState<string[]>([])
  const [openingYear, setOpeningYear] = useState(OPENING_YEAR_OPTIONS[OPENING_YEAR_OPTIONS.length - 1]?.value || `${CURRENT_SCHOOL_YEAR_START}-${CURRENT_SCHOOL_YEAR_START + 1}`)

  // ── Step 1: Enrollment & Demographics ──
  const [headcount, setHeadcount] = useState('')
  const [aaftePct, setAaftePct] = useState(95)
  const [currentFtes, setCurrentFtes] = useState('')
  const [priorYearFtes, setPriorYearFtes] = useState('')
  const [frlPct, setFrlPct] = useState(45)
  const [iepPct, setIepPct] = useState(14)
  const [ellPct, setEllPct] = useState(12)
  const [hicapPct, setHicapPct] = useState(5)

  // ── Step 2: Staffing ──
  const [staffing, setStaffing] = useState<StaffRow[]>([])
  const [staffingInitialized, setStaffingInitialized] = useState(false)

  // ── Step 3: Operations ──
  const [facilityCost, setFacilityCost] = useState('')
  const [hasFoodProgram, setHasFoodProgram] = useState(false)
  const [grantsDonations, setGrantsDonations] = useState('')
  const [loans, setLoans] = useState('')
  const [suppliesPerPupil, setSuppliesPerPupil] = useState(300)
  const [techPerPupil, setTechPerPupil] = useState(200)
  const [contractedPerPupil, setContractedPerPupil] = useState(150)
  const [pdPerPupil, setPdPerPupil] = useState(100)

  // ── Financial Assumptions ──
  const [assumptions, setAssumptions] = useState<FinancialAssumptions>({
    ...DEFAULT_FINANCIAL_ASSUMPTIONS,
  })

  // ── Computed ──
  const hc = parseInt(headcount) || 0

  const grantEstimates = {
    titleI: frlPct >= 40 ? Math.round(hc * (frlPct / 100) * 880) : 0,
    idea: Math.round(hc * (iepPct / 100) * 2200),
    lap: Math.round(hc * (frlPct / 100) * 400),
    tbip: Math.round(hc * (ellPct / 100) * 1800),
    hicap: Math.round(hc * (hicapPct / 100) * 500),
  }
  const totalGrants = grantEstimates.titleI + grantEstimates.idea + grantEstimates.lap + grantEstimates.tbip + grantEstimates.hicap

  // Base revenue from headcount (regular ed + sped + facilities)
  const aafte = Math.round(hc * aaftePct / 100)
  const baseRevenue = Math.round(aafte * assumptions.regular_ed_per_pupil) +
    Math.round(Math.round(aafte * iepPct / 100) * assumptions.sped_per_pupil) +
    Math.round(aafte * assumptions.facilities_per_pupil)
  const totalRevenue = baseRevenue + totalGrants

  // Personnel cost from staffing
  const totalSalaries = staffing.reduce((s, r) => s + r.fte * r.salary, 0)
  const totalBenefits = Math.round(totalSalaries * BENEFITS_RATE)
  const totalPersonnelCost = totalSalaries + totalBenefits
  const totalFte = staffing.reduce((s, r) => s + r.fte, 0)

  const teacherCount = staffing
    .filter((r) => r.title.toLowerCase().includes('classroom teacher'))
    .reduce((s, r) => s + r.fte, 0)
  const studentTeacherRatio = teacherCount > 0 ? Math.round(hc / teacherCount * 10) / 10 : 0

  const personnelPctOfRevenue = totalRevenue > 0 ? Math.round(totalPersonnelCost / totalRevenue * 1000) / 10 : 0

  // Operations cost
  const monthlyFacility = parseFloat(facilityCost) || 0
  const annualFacility = monthlyFacility * 12
  const foodCost = hasFoodProgram ? hc * 5 * 180 : 0
  const suppliesCost = hc * suppliesPerPupil
  const techCost = hc * techPerPupil
  const contractedCost = hc * contractedPerPupil
  const pdCost = hc * pdPerPupil
  const totalOperationsCost = annualFacility + foodCost + suppliesCost + techCost + contractedCost + pdCost
  const totalExpenses = totalPersonnelCost + totalOperationsCost
  const additionalFunding = (parseFloat(grantsDonations) || 0) + (parseFloat(loans) || 0)
  const netPosition = totalRevenue - totalExpenses

  // ── On mount: check for existing school ──
  useEffect(() => {
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: school } = await supabase
          .from('schools')
          .select(
            'id, name, region, grades_current_first, grades_current_last, grades_buildout_first, grades_buildout_last, current_ftes, prior_year_ftes, headcount, opening_year, operating_year, onboarding_completed, financial_assumptions, frl_pct, iep_pct, ell_pct, hicap_pct, sped_pct',
          )
          .eq('user_id', user.id)
          .single()

        if (school?.onboarding_completed) {
          router.push('/dashboard')
          return
        }

        if (school) {
          setSchoolId(school.id)
          if (school.name) setName(school.name)
          if (school.region) setRegion(school.region)
          if (school.headcount) setHeadcount(String(school.headcount))
          if (school.current_ftes) setCurrentFtes(String(school.current_ftes))
          if (school.prior_year_ftes) setPriorYearFtes(String(school.prior_year_ftes))
          if (school.opening_year) setOpeningYear(school.opening_year)
          if (school.frl_pct != null) setFrlPct(school.frl_pct)
          if (school.iep_pct != null) setIepPct(school.iep_pct)
          if (school.ell_pct != null) setEllPct(school.ell_pct)
          if (school.hicap_pct != null) setHicapPct(school.hicap_pct)
          if (school.financial_assumptions) {
            setAssumptions(mergeAssumptions(school.financial_assumptions))
            if (school.financial_assumptions.aafte_pct != null) setAaftePct(school.financial_assumptions.aafte_pct)
          }

          // Build founding/buildout grades from first/last
          if (school.grades_current_first && school.grades_current_last) {
            setFoundingGrades(gradesInRange(school.grades_current_first, school.grades_current_last))
          }
          if (school.grades_buildout_first && school.grades_buildout_last) {
            setBuildoutGrades(gradesInRange(school.grades_buildout_first, school.grades_buildout_last))
          }

          // Resume detection
          if (!school.name) {
            setStep(0)
          } else if (school.headcount == null || school.frl_pct == null) {
            setStep(1)
          } else {
            setStep(2)
          }
        }
      } catch {
        // Silently handle
      }
      setLoading(false)
    })()
  }, [router])

  // Initialize staffing when entering step 2
  useEffect(() => {
    if (step === 2 && !staffingInitialized && hc > 0) {
      setStaffing(generateStaffingDefaults(hc, foundingGrades))
      setStaffingInitialized(true)
    }
  }, [step, staffingInitialized, hc, foundingGrades])

  // ── Grade toggle helpers ──
  const toggleFoundingGrade = (g: string) => {
    setFoundingGrades((prev) => {
      const next = prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].sort((a, b) => gradeIndex(a) - gradeIndex(b))
      // Ensure buildout includes all founding
      setBuildoutGrades((bo) => {
        const merged = Array.from(new Set([...bo, ...next])).sort((a, b) => gradeIndex(a) - gradeIndex(b))
        return merged
      })
      return next
    })
  }

  const toggleBuildoutGrade = (g: string) => {
    // Cannot deselect founding grades
    if (foundingGrades.includes(g)) return
    setBuildoutGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].sort((a, b) => gradeIndex(a) - gradeIndex(b)),
    )
  }

  // ── Navigation ──
  const canGoNext = (): boolean => {
    if (step === 0) return name.trim().length > 0
    return true
  }

  const saveStep = useCallback(async (currentStep: number) => {
    setError(null)
    setSaving(true)

    try {
      if (currentStep === 0) {
        // Save school identity
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setError('Session expired. Please sign in again.')
          setSaving(false)
          return false
        }

        const sortedFounding = [...foundingGrades].sort((a, b) => gradeIndex(a) - gradeIndex(b))
        const sortedBuildout = [...buildoutGrades].sort((a, b) => gradeIndex(a) - gradeIndex(b))

        const payload = {
          user_id: user.id,
          name: name.trim(),
          authorizer: 'Washington State Charter School Commission',
          region,
          grades_current_first: sortedFounding[0] || null,
          grades_current_last: sortedFounding[sortedFounding.length - 1] || null,
          grades_buildout_first: sortedBuildout[0] || null,
          grades_buildout_last: sortedBuildout[sortedBuildout.length - 1] || null,
          opening_year: openingYear,
          operating_year: calcOperatingYear(openingYear),
        }

        const { data: upserted, error: upsertErr } = await supabase
          .from('schools')
          .upsert(payload, { onConflict: 'user_id' })
          .select('id')
          .single()
        if (upsertErr) {
          setError(upsertErr.message)
          setSaving(false)
          return false
        }
        if (!schoolId) setSchoolId(upserted.id)
      }

      if (currentStep === 1 && schoolId) {
        const { error: updateErr } = await supabase
          .from('schools')
          .update({
            headcount: parseInt(headcount) || 0,
            current_ftes: parseFloat(currentFtes) || 0,
            prior_year_ftes: parseFloat(priorYearFtes) || 0,
            frl_pct: frlPct,
            iep_pct: iepPct,
            sped_pct: iepPct,
            ell_pct: ellPct,
            hicap_pct: hicapPct,
            financial_assumptions: { ...assumptions, aafte_pct: aaftePct },
          })
          .eq('id', schoolId)
        if (updateErr) {
          setError(updateErr.message)
          setSaving(false)
          return false
        }
        setAssumptions((prev) => ({ ...prev, aafte_pct: aaftePct }))
      }

      // Steps 2 and 3 don't save individually to DB — everything saves on completion
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
      setSaving(false)
      return false
    }

    setSaving(false)
    return true
  }, [name, region, foundingGrades, buildoutGrades, openingYear, schoolId, headcount, currentFtes, priorYearFtes, frlPct, iepPct, ellPct, hicapPct, assumptions, aaftePct])

  const goNext = async () => {
    if (!canGoNext()) return
    const ok = await saveStep(step)
    if (ok) setStep((s) => s + 1)
  }

  const goBack = () => {
    setError(null)
    setStep((s) => Math.max(s - 1, step <= 0 ? -1 : 0))
  }

  // ── Completion (Step 4 on mount) ──
  const finishSetup = async () => {
    setSaving(true)
    setError(null)

    let resolvedSchoolId = schoolId
    if (!resolvedSchoolId) {
      const { data: { user } } = await supabase.auth.getUser()
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
      setError('No school profile found. Please go back to Step 1.')
      setSaving(false)
      return
    }

    const { error: completeErr } = await supabase
      .from('schools')
      .update({
        onboarding_completed: true,
        financial_assumptions: { ...assumptions, aafte_pct: aaftePct },
      })
      .eq('id', resolvedSchoolId)

    if (completeErr) {
      setError('Failed to complete onboarding. Please try again.')
      setSaving(false)
      return
    }

    setSaving(false)
    setStep(4)
  }

  // ── Staffing helpers ──
  const updateStaffRow = (id: string, field: keyof StaffRow, value: string | number) => {
    setStaffing((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    )
  }

  const addStaffRow = () => {
    const newId = String(Date.now())
    setStaffing((prev) => [
      ...prev,
      { id: newId, title: 'New Position', category: 'Classified', fte: 1.0, salary: 50000 },
    ])
  }

  const removeStaffRow = (id: string) => {
    setStaffing((prev) => prev.filter((r) => r.id !== id))
  }

  const resetStaffing = () => {
    setStaffing(generateStaffingDefaults(hc, foundingGrades))
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
      const { data: { user } } = await supabase.auth.getUser()
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

  // ── Revenue model for completion ──
  const completionRevenue = (() => {
    if (hc === 0) return 0
    const profile: SchoolProfile = {
      name,
      authorizer: 'Washington State Charter School Commission',
      gradesCurrentFirst: foundingGrades[0] || 'K',
      gradesCurrentLast: foundingGrades[foundingGrades.length - 1] || '5',
      gradesBuildoutFirst: buildoutGrades[0] || 'K',
      gradesBuildoutLast: buildoutGrades[buildoutGrades.length - 1] || '5',
      currentFTES: parseFloat(currentFtes) || 0,
      priorYearFTES: parseFloat(priorYearFtes) || 0,
      nextBoardMeeting: '',
      nextFinanceCommittee: '',
      openingCashBalance: 0,
      operatingYear: calcOperatingYear(openingYear),
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

  // ── Render: Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="w-10 h-10 border-[3px] rounded-full animate-spin"
          style={{ borderColor: '#e5e7eb', borderTopColor: TEAL }}
        />
      </div>
    )
  }

  // ── Render: SchoolLaunch Import ──
  if (mode === 'import') {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900" style={HEADING_FONT}>
            Import from SchoolLaunch
          </h1>
        </div>

        <div
          className="bg-white rounded-xl p-6"
          style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          {importStep === 'upload' && (
            <div>
              <p className="text-sm mb-4 text-gray-600">
                Upload your SchoolLaunch export files. You can upload a <strong>zip file</strong> or select individual files:
              </p>
              <ul className="text-xs mb-4 space-y-1 text-gray-500">
                <li>&bull; <strong>Profile JSON</strong> (required) — your school profile and financial assumptions</li>
                <li>&bull; <strong>Budget CSV</strong> (optional) — projected budget lines</li>
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
                <UploadCloud size={28} className="mx-auto mb-2 text-gray-400" />
                <p className="text-sm font-medium text-gray-700">Click to select files</p>
                <p className="text-xs mt-1 text-gray-400">JSON, CSV, ZIP, or PDF</p>
              </button>

              {importErrors.length > 0 && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  {importErrors.map((err, i) => (
                    <p key={i} className="text-xs text-red-700">{err}</p>
                  ))}
                </div>
              )}

              <button
                onClick={() => { setMode('wizard'); setError(null) }}
                className="mt-4 text-xs font-medium text-gray-400 hover:underline"
              >
                &larr; Switch to manual setup
              </button>
            </div>
          )}

          {importStep === 'parsing' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2ec4b6] mx-auto mb-3" />
              <p className="text-sm text-gray-600">Parsing SchoolLaunch data...</p>
            </div>
          )}

          {importStep === 'confirm' && importProfile && importResult && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={18} className="text-green-500" />
                <h2 className="text-sm font-semibold text-gray-800" style={HEADING_FONT}>Import Preview</h2>
              </div>

              {importResult.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                  {importResult.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700">{w}</p>
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
                    <label className="block text-gray-400 mb-0.5">Enrollment</label>
                    <input
                      type="number"
                      value={importProfile.headcount}
                      onChange={(e) =>
                        setImportProfile({ ...importProfile, headcount: Number(e.target.value), currentFTES: Number(e.target.value) })
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-0.5">FRL %</label>
                    <input
                      type="number"
                      value={importProfile.frlPct}
                      onChange={(e) => setImportProfile({ ...importProfile, frlPct: Number(e.target.value) })}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {importBudgetLines.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Budget Lines ({importBudgetLines.length})
                  </h3>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left py-1.5 px-3 font-medium text-gray-500">Category</th>
                          <th className="text-right py-1.5 px-3 font-medium text-gray-500">Budget</th>
                          <th className="text-left py-1.5 px-3 font-medium text-gray-500">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importBudgetLines.map((line, i) => (
                          <tr key={i} className="border-b last:border-0 border-gray-100">
                            <td className="py-1.5 px-3 text-gray-700">{line.category}</td>
                            <td className="py-1.5 px-3 text-right tabular-nums text-gray-700">${line.budget.toLocaleString()}</td>
                            <td className="py-1.5 px-3">
                              <span
                                className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  line.accountType === 'revenue' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
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
                  style={{ backgroundColor: TEAL }}
                >
                  {saving ? 'Importing...' : 'Confirm & Import'}
                </button>
                <button
                  onClick={() => { setImportStep('upload'); setImportResult(null) }}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-600"
                >
                  Back
                </button>
              </div>

              <button
                onClick={() => { setMode('wizard'); setError(null) }}
                className="mt-3 text-xs font-medium text-gray-400 hover:underline block"
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
    <div className="w-full max-w-4xl mx-auto">
      {/* Step Indicator */}
      <StepIndicator currentStep={step} />

      {/* Card */}
      <div
        className="p-8"
        style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
        }}
      >
        {/* ═══════════ STEP -1: WELCOME ═══════════ */}
        {step === -1 && (
          <div className="text-center">
            <h1 className="text-2xl text-gray-900 mb-2" style={HEADING_FONT}>
              Welcome to SchoolCFO
            </h1>
            <p className="text-sm mb-5 text-gray-600">
              Let&apos;s set up your school&apos;s financial management
            </p>
            <p className="text-sm leading-relaxed mb-4 text-gray-500">
              We&apos;ll walk you through 5 quick steps: your school identity, enrollment and demographics,
              staffing plan, operations budget, and a final review.
            </p>
            <p className="text-xs mb-8 italic text-gray-400">
              You can change any of these answers later in Settings.
            </p>

            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <button
                onClick={() => setStep(0)}
                className="py-2.5 px-6 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: TEAL, fontFamily: 'var(--font-display), system-ui, sans-serif' }}
              >
                Get Started
              </button>
              <button
                onClick={() => setMode('import')}
                className="py-2.5 px-6 text-sm font-semibold rounded-lg border-2 hover:shadow-sm transition-all"
                style={{ borderColor: TEAL, color: TEAL, fontFamily: 'var(--font-display), system-ui, sans-serif' }}
              >
                Import from SchoolLaunch
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 0: SCHOOL IDENTITY ═══════════ */}
        {step === 0 && (
          <div>
            <h1 className="text-lg text-gray-900 mb-1" style={HEADING_FONT}>School Identity</h1>
            <p className="text-sm mb-6 text-gray-600">
              Basic information about your school. This helps us tailor dashboards and reports.
            </p>

            <div className="space-y-5">
              {/* School Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700">
                  School Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. Cascade Charter Elementary"
                />
              </div>

              {/* Region + Opening Year */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700">WA Region</label>
                  <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls}>
                    {WA_REGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700">School Opened</label>
                  <select value={openingYear} onChange={(e) => setOpeningYear(e.target.value)} className={inputCls}>
                    {OPENING_YEAR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Year {calcOperatingYear(openingYear)} of operation — FPF Stage {calcOperatingYear(openingYear) <= 2 ? '1' : '2'}
                  </p>
                </div>
              </div>

              {/* Founding Grades */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Founding Grades</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_GRADES.map((g) => {
                    const selected = foundingGrades.includes(g)
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleFoundingGrade(g)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          selected ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        style={selected ? { backgroundColor: TEAL } : {}}
                      >
                        {g}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Full Buildout Grades */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Full Buildout Grades</label>
                <p className="text-xs text-gray-400 mb-2">Founding grades are locked. Select additional grades for your buildout plan.</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_GRADES.map((g) => {
                    const isFounding = foundingGrades.includes(g)
                    const selected = buildoutGrades.includes(g)
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleBuildoutGrade(g)}
                        disabled={isFounding}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                          isFounding
                            ? 'text-white opacity-70 cursor-not-allowed'
                            : selected
                              ? 'text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        style={isFounding || selected ? { backgroundColor: TEAL } : {}}
                      >
                        {isFounding && <Lock size={10} />}
                        {g}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Authorizer — hardcoded, shown as info */}
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Authorizer</span>
                <p className="mt-0.5">Washington State Charter School Commission</p>
              </div>

              {/* Dynamic summary */}
              {foundingGrades.length > 0 && (
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700">
                  Currently serving <strong>{foundingGrades.join(', ')}</strong>
                  {buildoutGrades.length > foundingGrades.length && (
                    <> &rarr; Growing to <strong>{buildoutGrades.join(', ')}</strong></>
                  )}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={goNext}
                disabled={!canGoNext() || saving}
                className="flex items-center gap-2 py-2.5 px-6 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
              >
                {saving ? 'Saving...' : 'Continue'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 1: ENROLLMENT & DEMOGRAPHICS ═══════════ */}
        {step === 1 && (
          <div>
            <h1 className="text-lg text-gray-900 mb-1" style={HEADING_FONT}>Enrollment &amp; Demographics</h1>
            <p className="text-sm mb-6 text-gray-600">
              Your enrollment numbers and student demographics help us estimate grants and revenue.
            </p>

            {/* Enrollment */}
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Enrollment</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-600">Current Headcount <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={headcount}
                    onChange={(e) => setHeadcount(e.target.value)}
                    className={inputCls}
                    placeholder="200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-600">AAFTE %</label>
                  <input
                    type="number"
                    value={aaftePct}
                    onChange={(e) => setAaftePct(Number(e.target.value))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-600">Current FTES</label>
                  <input
                    type="number"
                    value={currentFtes}
                    onChange={(e) => setCurrentFtes(e.target.value)}
                    className={inputCls}
                    placeholder={String(Math.round(hc * aaftePct / 100))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-600">Prior Year FTES</label>
                  <input
                    type="number"
                    value={priorYearFtes}
                    onChange={(e) => setPriorYearFtes(e.target.value)}
                    className={inputCls}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Demographics + Grant Estimates */}
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Demographics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sliders */}
              <div className="space-y-5">
                {[
                  { label: 'Free/Reduced Lunch (FRL)', value: frlPct, set: setFrlPct, max: 100, avg: 48 },
                  { label: 'IEP / Special Ed', value: iepPct, set: setIepPct, max: 30, avg: 14 },
                  { label: 'English Language Learners', value: ellPct, set: setEllPct, max: 40, avg: 12 },
                  { label: 'Highly Capable', value: hicapPct, set: setHicapPct, max: 15, avg: 5 },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-medium text-gray-600">{s.label}</label>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: TEAL }}>{s.value}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={s.max}
                      value={s.value}
                      onChange={(e) => s.set(Number(e.target.value))}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${TEAL} 0%, ${TEAL} ${(s.value / s.max) * 100}%, #e5e7eb ${(s.value / s.max) * 100}%, #e5e7eb 100%)`,
                      }}
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">Regional average: ~{s.avg}%</p>
                  </div>
                ))}
              </div>

              {/* Grant Estimates Card */}
              <div
                className="bg-gray-50 rounded-xl p-5"
                style={{ border: '1px solid #e5e7eb' }}
              >
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Estimated Grants</h3>
                <div className="space-y-2.5">
                  {frlPct >= 40 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Title I</span>
                      <span className="font-medium tabular-nums text-gray-800">{fmtDollars(grantEstimates.titleI)}</span>
                    </div>
                  )}
                  {frlPct < 40 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Title I</span>
                      <span className="text-xs text-gray-400">FRL below 40%</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IDEA</span>
                    <span className="font-medium tabular-nums text-gray-800">{fmtDollars(grantEstimates.idea)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">LAP</span>
                    <span className="font-medium tabular-nums text-gray-800">{fmtDollars(grantEstimates.lap)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">TBIP</span>
                    <span className="font-medium tabular-nums text-gray-800">{fmtDollars(grantEstimates.tbip)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">HiCap</span>
                    <span className="font-medium tabular-nums text-gray-800">{fmtDollars(grantEstimates.hicap)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between text-sm">
                    <span className="font-semibold text-gray-800">Total Estimated Grants</span>
                    <span className="font-bold tabular-nums" style={{ color: TEAL }}>{fmtDollars(totalGrants)}</span>
                  </div>
                </div>
                {hc === 0 && (
                  <p className="text-xs text-gray-400 mt-3 italic">Enter headcount above to see estimates.</p>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-6 flex justify-between">
              <button
                onClick={goBack}
                className="flex items-center gap-2 py-2.5 px-5 text-sm font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <button
                onClick={goNext}
                disabled={saving}
                className="flex items-center gap-2 py-2.5 px-6 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
              >
                {saving ? 'Saving...' : 'Continue'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 2: STAFFING ═══════════ */}
        {step === 2 && (
          <div>
            <h1 className="text-lg text-gray-900 mb-1" style={HEADING_FONT}>Staffing Plan</h1>
            <p className="text-sm mb-4 text-gray-600">
              We pre-populated positions based on your enrollment. Adjust FTE and salary as needed.
            </p>

            {/* Summary bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total Personnel Cost', value: fmtDollars(totalPersonnelCost) },
                { label: 'Personnel % of Revenue', value: `${personnelPctOfRevenue}%` },
                { label: 'Total FTE', value: totalFte.toFixed(1) },
                { label: 'Student:Teacher', value: studentTeacherRatio > 0 ? `${studentTeacherRatio}:1` : 'N/A' },
              ].map((m) => (
                <div key={m.label} className="bg-gray-50 rounded-lg p-3 text-center" style={{ border: '1px solid #e5e7eb' }}>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{m.label}</p>
                  <p className="text-lg font-bold text-gray-800 mt-0.5" style={HEADING_FONT}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">Position</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs w-24">Category</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-500 text-xs w-20">FTE</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-500 text-xs w-28">Salary</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-500 text-xs w-24">Benefits</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-500 text-xs w-28">Total Cost</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {staffing.map((row) => {
                    const benefits = Math.round(row.salary * BENEFITS_RATE)
                    const totalCost = Math.round(row.fte * (row.salary + benefits))
                    const catColor = row.category === 'Administrative' ? 'bg-blue-50 text-blue-700' :
                      row.category === 'Certificated' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                    return (
                      <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            value={row.title}
                            onChange={(e) => updateStaffRow(row.id, 'title', e.target.value)}
                            className="w-full text-sm bg-transparent border-0 p-0 focus:outline-none focus:ring-0 text-gray-800"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${catColor}`}>
                            {row.category}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={row.fte}
                            onChange={(e) => updateStaffRow(row.id, 'fte', parseFloat(e.target.value) || 0)}
                            className="w-16 text-sm text-right bg-transparent border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#2ec4b6]/30"
                          />
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <div className="flex items-center justify-end">
                            <span className="text-gray-400 text-xs mr-0.5">$</span>
                            <input
                              type="number"
                              step="1000"
                              min="0"
                              value={row.salary}
                              onChange={(e) => updateStaffRow(row.id, 'salary', parseInt(e.target.value) || 0)}
                              className="w-20 text-sm text-right bg-transparent border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#2ec4b6]/30"
                            />
                          </div>
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-gray-500 text-xs">
                          {fmtDollars(benefits)}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums font-medium text-gray-800 text-xs">
                          {fmtDollars(totalCost)}
                        </td>
                        <td className="py-1.5 px-1">
                          <button
                            onClick={() => removeStaffRow(row.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mb-2">
              <button
                onClick={addStaffRow}
                className="flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity"
                style={{ color: TEAL }}
              >
                <Plus size={14} />
                Add Position
              </button>
              <button
                onClick={resetStaffing}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Reset to Defaults
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-6 flex justify-between">
              <button
                onClick={goBack}
                className="flex items-center gap-2 py-2.5 px-5 text-sm font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <button
                onClick={goNext}
                disabled={saving}
                className="flex items-center gap-2 py-2.5 px-6 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
              >
                {saving ? 'Saving...' : 'Continue'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 3: OPERATIONS ═══════════ */}
        {step === 3 && (
          <div>
            <h1 className="text-lg text-gray-900 mb-1" style={HEADING_FONT}>Operations</h1>
            <p className="text-sm mb-6 text-gray-600">
              Facility costs, food service, and per-pupil operating expenses.
            </p>

            <div className="space-y-6">
              {/* Facilities */}
              <div>
                <h2 className="text-sm font-semibold text-gray-800 mb-2">Facilities</h2>
                <label className="block text-xs font-medium mb-1 text-gray-600">Monthly Facility Cost</label>
                <p className="text-[10px] text-gray-400 mb-1.5">Rent, utilities, maintenance</p>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    value={facilityCost}
                    onChange={(e) => setFacilityCost(e.target.value)}
                    className={inputCls}
                    style={{ maxWidth: '200px' }}
                    placeholder="15000"
                  />
                  <span className="text-xs text-gray-400">/month</span>
                </div>
              </div>

              {/* Food Program */}
              <div>
                <h2 className="text-sm font-semibold text-gray-800 mb-2">Food Program</h2>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasFoodProgram}
                    onChange={(e) => setHasFoodProgram(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#2ec4b6]"
                  />
                  <span className="text-sm text-gray-700">School operates a food service program</span>
                </label>
                {hasFoodProgram && hc > 0 && (
                  <p className="text-xs text-gray-500 mt-1.5 ml-6">
                    Estimated annual cost: <strong>{fmtDollars(foodCost)}</strong> ({hc} students x $5/day x 180 days)
                  </p>
                )}
              </div>

              {/* Additional Funding */}
              <div>
                <h2 className="text-sm font-semibold text-gray-800 mb-2">Additional Funding</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">Grants / Donations</label>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        value={grantsDonations}
                        onChange={(e) => setGrantsDonations(e.target.value)}
                        className={inputCls}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">Loans</label>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        value={loans}
                        onChange={(e) => setLoans(e.target.value)}
                        className={inputCls}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-Pupil Operational Costs */}
              <div>
                <h2 className="text-sm font-semibold text-gray-800 mb-2">Per-Pupil Operational Costs</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Supplies', value: suppliesPerPupil, set: setSuppliesPerPupil, default_: 300 },
                    { label: 'Technology', value: techPerPupil, set: setTechPerPupil, default_: 200 },
                    { label: 'Contracted Services', value: contractedPerPupil, set: setContractedPerPupil, default_: 150 },
                    { label: 'Professional Dev.', value: pdPerPupil, set: setPdPerPupil, default_: 100 },
                  ].map((item) => (
                    <div key={item.label}>
                      <label className="block text-xs font-medium mb-1 text-gray-600">{item.label}</label>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 text-xs">$</span>
                        <input
                          type="number"
                          value={item.value}
                          onChange={(e) => item.set(Number(e.target.value))}
                          className={inputCls}
                        />
                        <span className="text-[10px] text-gray-400">/student</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Year 1 Financial Summary */}
              <div
                className="rounded-xl p-5"
                style={{ backgroundColor: '#f8fafa', border: '1px solid #e5e7eb' }}
              >
                <h3 className="text-sm font-semibold text-gray-800 mb-3" style={HEADING_FONT}>Year 1 Financial Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Revenue</span>
                    <span className="font-medium tabular-nums text-gray-800">{fmtDollars(totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Personnel Cost</span>
                    <span className="font-medium tabular-nums text-gray-800">{fmtDollars(totalPersonnelCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Operations Cost</span>
                    <span className="font-medium tabular-nums text-gray-800">{fmtDollars(totalOperationsCost)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                    <span className="text-gray-600">Total Expenses</span>
                    <span className="font-semibold tabular-nums text-gray-800">{fmtDollars(totalExpenses)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-800">Net Position</span>
                    <span
                      className="font-bold tabular-nums"
                      style={{ color: netPosition >= 0 ? '#16a34a' : '#dc2626' }}
                    >
                      {fmtDollars(netPosition)}
                    </span>
                  </div>
                  {additionalFunding > 0 && (
                    <div className="flex justify-between text-sm pt-1">
                      <span className="text-gray-500">Additional Funding</span>
                      <span className="font-medium tabular-nums text-gray-600">+{fmtDollars(additionalFunding)}</span>
                    </div>
                  )}
                </div>

                {/* Complete Setup button */}
                <button
                  onClick={finishSetup}
                  disabled={saving}
                  className="mt-5 w-full py-3 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: TEAL, fontFamily: 'var(--font-display), system-ui, sans-serif' }}
                >
                  {saving ? 'Saving...' : 'Complete Setup'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-6 flex justify-start">
              <button
                onClick={goBack}
                className="flex items-center gap-2 py-2.5 px-5 text-sm font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP 4: COMPLETION ═══════════ */}
        {step === 4 && (
          <div className="text-center">
            {/* Animated checkmark */}
            <div className="mb-4 inline-flex items-center justify-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#dcfce7' }}
              >
                <CheckCircle size={40} className="text-green-500" />
              </div>
            </div>

            <h1 className="text-2xl text-gray-900 mb-2" style={HEADING_FONT}>
              Your School is Ready!
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              {name} has been configured. Here&apos;s your Year 1 snapshot.
            </p>

            {/* Metric cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {[
                { label: 'Year 1 Revenue', value: fmtDollars(completionRevenue || totalRevenue) },
                { label: 'Personnel Cost', value: fmtDollars(totalPersonnelCost) },
                { label: 'Total FTE', value: totalFte.toFixed(1) },
                { label: 'Personnel %', value: `${personnelPctOfRevenue}%` },
              ].map((m) => (
                <div key={m.label} className="bg-gray-50 rounded-lg p-4" style={{ border: '1px solid #e5e7eb' }}>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{m.label}</p>
                  <p className="text-xl font-bold text-gray-800 mt-1" style={HEADING_FONT}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* What happens next */}
            <div className="text-left bg-gray-50 rounded-xl p-5 mb-6" style={{ border: '1px solid #e5e7eb' }}>
              <h3 className="text-sm font-semibold text-gray-800 mb-3" style={HEADING_FONT}>What happens next</h3>
              <div className="space-y-3">
                {[
                  { icon: UploadCloud, text: 'Upload your financial data' },
                  { icon: BarChart3, text: 'Explore your Dashboard' },
                  { icon: MessageSquare, text: 'Review the AI Briefing' },
                  { icon: Clipboard, text: 'Generate your first Board Packet' },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: '#f0fdfa', color: TEAL }}
                    >
                      <item.icon size={14} />
                    </div>
                    <span className="text-sm text-gray-700">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                router.push('/dashboard')
                router.refresh()
              }}
              className="py-3 px-8 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: TEAL, fontFamily: 'var(--font-display), system-ui, sans-serif' }}
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
