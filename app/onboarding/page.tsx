'use client'

import { useState, useRef, useEffect, DragEvent, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  CheckCircle,
  MessageCircle,
  Send,
  Download,
  School,
  CalendarDays,
  FileSpreadsheet,
  Sparkles,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  type SchoolCFOField,
} from '@/lib/uploadPipeline'
import { currentMonthKey } from '@/lib/fiscalYear'
import GradeSpanSelector from '@/components/GradeSpanSelector'

const STEPS = [
  { key: 'profile', label: 'School Profile', icon: School },
  { key: 'dates', label: 'Dates & Cash', icon: CalendarDays },
  { key: 'upload', label: 'First Upload', icon: FileSpreadsheet },
  { key: 'ask', label: 'Ask Your CFO', icon: Sparkles },
] as const

type StepKey = (typeof STEPS)[number]['key']

const AUTHORIZER_OPTIONS = [
  'Washington State Charter School Commission',
  'Seattle School District',
  'Spokane Public Schools',
  'Tacoma Public Schools',
  'Other',
]

const FIELD_OPTIONS: { value: SchoolCFOField; label: string }[] = [
  { value: 'category', label: 'Category' },
  { value: 'budget', label: 'Budget Amount' },
  { value: 'ytdActuals', label: 'YTD Actuals' },
  { value: 'fund', label: 'Fund / Program' },
  { value: 'accountType', label: 'Account Type' },
  { value: 'grantName', label: 'Grant Name' },
  { value: 'grantAmount', label: 'Grant Award Amount' },
  { value: 'grantSpent', label: 'Grant Spent to Date' },
  { value: 'ignore', label: 'Ignore this column' },
]

const STARTER_QUESTIONS = [
  'What should I focus on financially this month?',
  'Are we on track to end the year with a balanced budget?',
  'How is our cash position looking?',
]

const inputCls = 'w-full px-3.5 py-2.5 text-sm bg-white'
const inputStyle = { border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)' }

export default function GuidedOnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Step 1: School Profile ──
  const [name, setName] = useState('')
  const [authorizer, setAuthorizer] = useState(AUTHORIZER_OPTIONS[0])
  const [gradesCurrentFirst, setGradesCurrentFirst] = useState('K')
  const [gradesCurrentLast, setGradesCurrentLast] = useState('5')
  const [gradesBuildoutFirst, setGradesBuildoutFirst] = useState('K')
  const [gradesBuildoutLast, setGradesBuildoutLast] = useState('5')
  const [currentFtes, setCurrentFtes] = useState('')
  const [priorYearFtes, setPriorYearFtes] = useState('')

  // ── Step 2: Dates & Cash ──
  const [nextBoardMeeting, setNextBoardMeeting] = useState('')
  const [nextFinanceCommittee, setNextFinanceCommittee] = useState('')
  const [openingCashBalance, setOpeningCashBalance] = useState('')

  // ── Step 3: Upload ──
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [uploadFileName, setUploadFileName] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [allDataRows, setAllDataRows] = useState<string[][]>([])
  const [columnMappings, setColumnMappings] = useState<ColumnMappingResult[]>([])
  const [mappedData, setMappedData] = useState<MappedCategory[]>([])
  const [mappedGrants, setMappedGrants] = useState<MappedGrant[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Step 4: Ask CFO ──
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // School ID — saved after step 1
  const [schoolId, setSchoolId] = useState<string | null>(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Check if user already has a school row (returning user who hasn't finished onboarding)
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: school } = await supabase
        .from('schools')
        .select('id, name, authorizer, grades_current_first, grades_current_last, grades_buildout_first, grades_buildout_last, current_ftes, prior_year_ftes, next_board_meeting, next_finance_committee, opening_cash_balance, onboarding_completed')
        .eq('user_id', user.id)
        .single()

      if (school?.onboarding_completed) {
        router.push('/dashboard')
        return
      }

      if (school) {
        setSchoolId(school.id)
        setName(school.name || '')
        setAuthorizer(school.authorizer || AUTHORIZER_OPTIONS[0])
        setGradesCurrentFirst(school.grades_current_first || 'K')
        setGradesCurrentLast(school.grades_current_last || '5')
        setGradesBuildoutFirst(school.grades_buildout_first || 'K')
        setGradesBuildoutLast(school.grades_buildout_last || '5')
        setCurrentFtes(school.current_ftes ? String(school.current_ftes) : '')
        setPriorYearFtes(school.prior_year_ftes ? String(school.prior_year_ftes) : '')
        setNextBoardMeeting(school.next_board_meeting || '')
        setNextFinanceCommittee(school.next_finance_committee || '')
        setOpeningCashBalance(school.opening_cash_balance ? String(school.opening_cash_balance) : '')
      }
    })()
  }, [router])

  const stepKey = STEPS[currentStep].key

  // ── Navigation ──
  const canGoNext = () => {
    if (stepKey === 'profile') return name.trim().length > 0
    return true // steps 2-4 are always navigable
  }

  const goNext = async () => {
    setError(null)

    // Save profile on step 1 → 2
    if (stepKey === 'profile') {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Session expired. Please sign in again.'); setSaving(false); return }

      const payload = {
        user_id: user.id,
        name: name.trim(),
        authorizer,
        grades_current_first: gradesCurrentFirst,
        grades_current_last: gradesCurrentLast,
        grades_buildout_first: gradesBuildoutFirst,
        grades_buildout_last: gradesBuildoutLast,
        current_ftes: parseFloat(currentFtes) || 0,
        prior_year_ftes: parseFloat(priorYearFtes) || 0,
      }

      const { data: upserted, error: upsertErr } = await supabase
        .from('schools')
        .upsert(payload, { onConflict: 'user_id' })
        .select('id')
        .single()
      if (upsertErr) { setError(upsertErr.message); setSaving(false); return }
      if (!schoolId) setSchoolId(upserted.id)
      setSaving(false)
    }

    // Save dates/cash on step 2 → 3
    if (stepKey === 'dates' && schoolId) {
      setSaving(true)
      const { error: updateErr } = await supabase.from('schools').update({
        next_board_meeting: nextBoardMeeting || null,
        next_finance_committee: nextFinanceCommittee || null,
      }).eq('id', schoolId)
      if (updateErr) { setError(updateErr.message); setSaving(false); return }

      // Always write opening cash balance (even if 0 or empty)
      await supabase.from('schools').update({
        opening_cash_balance: parseFloat(openingCashBalance) || 0,
      }).eq('id', schoolId)
      setSaving(false)
    }

    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const goBack = () => {
    setError(null)
    setCurrentStep((s) => Math.max(s - 1, 0))
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
      setHeaders(headerRow)
      setAllDataRows(dataRows)
      setColumnMappings(mappings)

      // Auto-apply mappings
      const { categories: mapped, cashBalanceRowsSkipped } = applyMappings(mappings, dataRows)
      const grants = extractGrants(mappings, dataRows)
      setMappedData(mapped)
      setMappedGrants(grants)
      setUploadSuccess(true)

      if (cashBalanceRowsSkipped > 0) {
        setInfo('Opening cash balance is managed in your school profile settings, not through uploads. That row was skipped.')
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

  // ── Chat (Step 4) ──
  const sendChat = async (message: string) => {
    if (!message.trim() || chatLoading) return
    setChatInput('')
    setChatLoading(true)

    const newMessages = [...chatMessages, { role: 'user' as const, content: message }]
    setChatMessages([...newMessages, { role: 'assistant' as const, content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          schoolProfile: {
            name,
            authorizer,
            gradesCurrentFirst,
            gradesCurrentLast,
            gradesBuildoutFirst,
            gradesBuildoutLast,
            currentFTES: parseFloat(currentFtes) || 0,
            priorYearFTES: parseFloat(priorYearFtes) || 0,
            nextBoardMeeting,
            nextFinanceCommittee,
            openingCashBalance: parseFloat(openingCashBalance) || 0,
          },
          financialData: mappedData.length > 0 ? {
            totalBudget: mappedData.filter((r) => (r.accountType ?? 'expense') === 'expense').reduce((s, r) => s + r.budget, 0),
            ytdSpending: mappedData.reduce((s, r) => s + r.ytdActuals, 0),
            categories: mappedData.map((r) => ({
              name: r.category,
              budget: r.budget,
              ytdActuals: r.ytdActuals,
              burnRate: r.budget > 0 ? (r.ytdActuals / r.budget) * 100 : 0,
            })),
          } : undefined,
          grants: mappedGrants.length > 0 ? mappedGrants : undefined,
          alerts: [],
          activeMonth: currentMonthKey(),
        }),
      })

      if (!res.ok || !res.body) {
        setChatMessages([...newMessages, { role: 'assistant', content: 'Sorry, something went wrong. You can try again after setup.' }])
        setChatLoading(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setChatMessages([...newMessages, { role: 'assistant', content: accumulated }])
      }
    } catch {
      setChatMessages([...newMessages, { role: 'assistant', content: 'Connection error. You can try again from the dashboard.' }])
    }

    setChatLoading(false)
  }

  // ── Finish Setup ──
  const finishSetup = async () => {
    setSaving(true)
    setError(null)

    // Resolve the school ID — use state if available, otherwise look up by user_id
    let resolvedSchoolId = schoolId
    if (!resolvedSchoolId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Session expired. Please sign in again.'); setSaving(false); return }
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('user_id', user.id)
        .single()
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

    // If they uploaded data, import it via the store
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

    // Mark onboarding complete — await and check for errors
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

  const progressPct = ((currentStep + 1) / STEPS.length) * 100

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Branding */}
      <div className="text-center mb-6">
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
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const done = i < currentStep
            const active = i === currentStep
            return (
              <div key={s.key} className="flex items-center gap-1.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    done
                      ? 'bg-green-500 text-white'
                      : active
                      ? 'text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                  {...(active ? { style: { background: 'var(--brand-700)' } } : {})}
                >
                  {done ? <CheckCircle size={13} /> : <Icon size={13} />}
                </div>
                <span
                  className={`text-xs hidden sm:inline ${
                    active ? 'font-semibold text-gray-800' : done ? 'text-gray-600' : 'text-gray-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--accent-500) 100%)' }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          Step {currentStep + 1} of {STEPS.length}
        </p>
      </div>

      {/* Card */}
      <div
        className="p-8"
        style={{
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* ── STEP 1: School Profile ── */}
        {stepKey === 'profile' && (
          <div>
            <h1
              className="text-lg text-gray-900 mb-1"
              style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', fontWeight: 700 }}
            >
              Welcome to SchoolCFO
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Let&apos;s get your school set up. This information helps us tailor your financial dashboards and reports.
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
                    <option key={a} value={a}>{a}</option>
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

              <div className="grid grid-cols-2 gap-4">
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
            </div>
          </div>
        )}

        {/* ── STEP 2: Dates & Cash ── */}
        {stepKey === 'dates' && (
          <div>
            <h1
              className="text-lg text-gray-900 mb-1"
              style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', fontWeight: 700 }}
            >
              Important Dates & Cash
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              We&apos;ll use these dates to prepare reports and reminders ahead of time.
            </p>

            <div className="space-y-4">
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
                  Opening cash balance
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingCashBalance}
                  onChange={(e) => setOpeningCashBalance(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="e.g. 250000"
                />
                <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  Your school&apos;s cash balance at the start of this fiscal year &mdash; found on your prior year financial statements.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: First Upload ── */}
        {stepKey === 'upload' && (
          <div>
            <h1
              className="text-lg text-gray-900 mb-1"
              style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', fontWeight: 700 }}
            >
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
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
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
                    <div className="w-10 h-10 border-[3px] rounded-full animate-spin" style={{ borderColor: 'var(--brand-200)', borderTopColor: 'var(--brand-600)' }} />
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
                  onClick={() => { setUploadSuccess(false); setUploadFileName(''); setMappedData([]); setMappedGrants([]) }}
                  className="mt-3 text-xs font-medium hover:underline"
                  style={{ color: 'var(--brand-700)' }}
                >
                  Upload a different file
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 4: Ask Your CFO ── */}
        {stepKey === 'ask' && (
          <div>
            <h1
              className="text-lg text-gray-900 mb-1"
              style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', fontWeight: 700 }}
            >
              Ask Your First Question
            </h1>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
              Try asking a question about your school&apos;s finances. You can always come back to this later.
            </p>

            {chatMessages.length === 0 ? (
              <div className="space-y-2 mb-5">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendChat(q)}
                    disabled={chatLoading}
                    className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-all leading-snug hover:shadow-sm disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4 mb-5 max-h-64 overflow-y-auto">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5" style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--accent-500) 100%)' }}>
                        <MessageCircle size={11} className="text-white" />
                      </div>
                    )}
                    <div
                      className={`rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'max-w-[85%] px-4 py-3 text-white rounded-br-sm'
                          : 'w-full px-4 py-3 bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                      }`}
                      style={msg.role === 'user'
                        ? { background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)' }
                        : {}
                      }
                    >
                      {msg.content === '' && msg.role === 'assistant' ? (
                        <span className="flex gap-1 items-center text-gray-400 py-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:300ms]" />
                        </span>
                      ) : msg.role === 'assistant' ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
            )}

            <form
              onSubmit={(e: FormEvent) => { e.preventDefault(); sendChat(chatInput) }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a question about your finances..."
                disabled={chatLoading}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] disabled:opacity-50 bg-white"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
                className="px-4 py-2.5 text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                style={{ background: 'var(--brand-700)', borderRadius: 'var(--radius-sm)' }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}

        {/* Error */}
        {error && (
          <p
            className="text-sm px-3.5 py-2.5 mt-5"
            style={{
              color: 'var(--danger-700)',
              background: 'var(--danger-50)',
              border: '1px solid var(--danger-100)',
              borderRadius: 'var(--radius-sm)',
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
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {info}
          </p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-100">
          <div>
            {currentStep > 0 && (
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
            {/* Skip on steps 3 and 4 */}
            {(stepKey === 'upload' || stepKey === 'ask') && (
              <button
                onClick={stepKey === 'ask' ? finishSetup : () => setCurrentStep((s) => s + 1)}
                disabled={saving}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                {stepKey === 'ask' ? 'Skip & finish' : 'Skip for now'}
              </button>
            )}

            {stepKey === 'ask' ? (
              <button
                onClick={finishSetup}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
                style={{
                  background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-display), system-ui, sans-serif',
                }}
              >
                {saving ? 'Setting up...' : 'Finish Setup'}
                {!saving && <CheckCircle size={15} />}
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={!canGoNext() || saving}
                className="flex items-center gap-1.5 px-5 py-2.5 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
                style={{
                  background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-display), system-ui, sans-serif',
                }}
              >
                {saving ? 'Saving...' : 'Next'}
                {!saving && <ArrowRight size={14} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
