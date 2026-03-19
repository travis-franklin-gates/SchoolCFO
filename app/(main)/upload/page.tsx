'use client'

import { useState, useRef, DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  UploadCloud,
  CheckCircle,
  FileSpreadsheet,
  ArrowLeft,
  ArrowRight,
  Zap,
  AlertTriangle,
  Info,
  Download,
  RotateCcw,
  Award,
  Trash2,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { getFiscalMonths, currentMonthKey, paceFromKey, labelFromKey } from '@/lib/fiscalYear'
import {
  autoMapColumns,
  applyMappings,
  extractGrants,
  isFullyMapped,
  type ColumnMappingResult,
  type MappedCategory,
  type MappedGrant,
  type ParseWarning,
  type SchoolCFOField,
} from '@/lib/uploadPipeline'

interface Toast {
  id: string
  type: 'info' | 'warning' | 'error'
  message: string
  action?: { label: string; onClick: () => void }
}

interface DuplicateGrant {
  name: string
  existingAmount: number
  newAmount: number
  newSpent: number
}

type Step = 'drop' | 'preview' | 'mapping' | 'confirmation'

const STEP_ORDER: Step[] = ['drop', 'preview', 'mapping', 'confirmation']
const STEP_LABELS: Record<Step, string> = {
  drop: 'Upload',
  preview: 'Preview',
  mapping: 'Map Columns',
  confirmation: 'Import',
}

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

const STATUS_CONFIG = {
  ok: { label: 'On Track', badge: 'bg-green-100 text-green-800' },
  watch: { label: 'Watch', badge: 'bg-yellow-100 text-yellow-800' },
  concern: { label: 'Concern', badge: 'bg-orange-100 text-orange-800' },
  action: { label: 'Action Required', badge: 'bg-red-100 text-red-800' },
} as const

function fmt(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}K`
  return `$${n}`
}

function fmtTimestamp(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function deriveAlertStatus(budget: number, ytdActuals: number, expectedPct: number) {
  if (budget === 0 || expectedPct === 0) return 'ok' as const
  const burnRate = (ytdActuals / budget) * 100
  // Relative % over expected pace (consistent with store and budget-analysis display)
  const variance = burnRate - expectedPct
  if (variance > 20) return 'action' as const
  if (variance > 10) return 'concern' as const
  if (variance > 5) return 'watch' as const
  if (variance < -20) return 'watch' as const
  return 'ok' as const
}

const FISCAL_MONTHS = getFiscalMonths()

export default function UploadPage() {
  const { monthlySnapshots, importFinancialData, deleteSnapshot } = useStore()
  const router = useRouter()

  const [step, setStep] = useState<Step>('drop')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey())

  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [allDataRows, setAllDataRows] = useState<string[][]>([])
  const [columnMappings, setColumnMappings] = useState<ColumnMappingResult[]>([])
  const [skippedMapping, setSkippedMapping] = useState(false)
  const [mappedData, setMappedData] = useState<MappedCategory[]>([])
  const [mappedGrants, setMappedGrants] = useState<MappedGrant[]>([])
  const [parseWarnings, setParseWarnings] = useState<ParseWarning[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [duplicateGrants, setDuplicateGrants] = useState<DuplicateGrant[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  // expectedPct derived from selectedMonth — used in confirmation step
  const expectedPct = Math.round(paceFromKey(selectedMonth) * 100)

  const reset = () => {
    setStep('drop')
    setFileName('')
    setHeaders([])
    setPreviewRows([])
    setAllDataRows([])
    setColumnMappings([])
    setMappedData([])
    setMappedGrants([])
    setParseWarnings([])
    setError(null)
    setSkippedMapping(false)
    setDuplicateGrants([])
  }

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { ...toast, id }])
    if (!toast.action) setTimeout(() => dismissToast(id), 10000)
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

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

      setFileName(file.name)
      setHeaders(headerRow)
      setPreviewRows(dataRows.slice(0, 5))
      setAllDataRows(dataRows)
      setColumnMappings(mappings)
      setStep('preview')
    } catch (err) {
      console.error(err)
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

  const runMappingAndCollectWarnings = (mappings: ColumnMappingResult[]) => {
    const warnings: ParseWarning[] = []
    const { categories, cashBalanceRowsSkipped } = applyMappings(mappings, allDataRows, warnings)
    const grants = extractGrants(mappings, allDataRows, warnings)
    setMappedData(categories)
    if (cashBalanceRowsSkipped > 0) {
      addToast({
        type: 'info',
        message: 'Opening cash balance is managed in your school profile settings, not through uploads. That row was skipped.',
      })
    }
    setMappedGrants(grants)
    setParseWarnings(warnings)
    if (warnings.length > 0) {
      const rowNums = [...new Set(warnings.map((w) => w.row))].sort((a, b) => a - b)
      const rowList = rowNums.length > 5
        ? rowNums.slice(0, 5).join(', ') + ` and ${rowNums.length - 5} more`
        : rowNums.join(', ')
      addToast({
        type: 'warning',
        message: `Some values couldn't be read: row${rowNums.length > 1 ? 's' : ''} ${rowList}. These were treated as $0 — check your export for these rows.`,
      })
    }
  }

  const handleProceedFromPreview = () => {
    if (isFullyMapped(columnMappings)) {
      runMappingAndCollectWarnings(columnMappings)
      setSkippedMapping(true)
      setStep('confirmation')
    } else {
      setSkippedMapping(false)
      setStep('mapping')
    }
  }

  const updateMapping = (colIndex: number, field: SchoolCFOField) => {
    setColumnMappings((prev) =>
      prev.map((m) =>
        m.columnIndex === colIndex ? { ...m, mappedField: field, confident: true } : m
      )
    )
  }

  const handleConfirmMapping = () => {
    const hasCategory = columnMappings.some((m) => m.mappedField === 'category')
    const hasBudget = columnMappings.some((m) => m.mappedField === 'budget')
    const hasYtd = columnMappings.some((m) => m.mappedField === 'ytdActuals')
    if (!hasCategory || !hasBudget || !hasYtd) {
      setError('Please map Category, Budget Amount, and YTD Actuals before continuing.')
      return
    }
    setError(null)
    runMappingAndCollectWarnings(columnMappings)
    setStep('confirmation')
  }

  const fireAgent = async (
    name: string,
    url: string,
    body: Record<string, unknown>,
  ) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`${res.status}`)
    return { name, url, body }
  }

  const fireAgentsWithRetry = (month: string) => {
    const state = useStore.getState()
    const schoolId = state.schoolId
    if (!schoolId) return

    const pacePercent = Math.round(paceFromKey(month) * 100)
    const fd = state.financialData

    const agents: { name: string; url: string; body: Record<string, unknown> }[] = [
      {
        name: 'Budget Analyst',
        url: '/api/agents/budget-analyst',
        body: { schoolId, activeMonth: month, pacePercent, categories: fd.categories, totalBudget: fd.totalBudget, ytdSpending: fd.ytdExpenses, financialAssumptions: state.financialAssumptions },
      },
      {
        name: 'Cash Sentinel',
        url: '/api/agents/cash-sentinel',
        body: {
          schoolId, activeMonth: month, cashOnHand: fd.cashOnHand, daysOfReserves: fd.daysOfReserves,
          totalBudget: fd.totalBudget, ytdSpending: fd.ytdExpenses,
          snapshotCount: Object.keys(state.monthlySnapshots).length,
          categories: fd.categories.map((c) => ({ name: c.name, budget: c.budget, ytdActuals: c.ytdActuals, accountType: c.accountType })),
          financialAssumptions: state.financialAssumptions,
        },
      },
      {
        name: 'Grants Officer',
        url: '/api/agents/grants-officer',
        body: { schoolId, activeMonth: month, pacePercent, grants: state.grants, otherGrants: state.otherGrants },
      },
      {
        name: 'Audit Compliance',
        url: '/api/agents/audit-compliance',
        body: { schoolId, activeMonth: month },
      },
      {
        name: 'Audit Federal',
        url: '/api/agents/audit-federal',
        body: { schoolId, activeMonth: month, grants: state.grants, totalBudget: fd.totalBudget, ytdSpending: fd.ytdExpenses },
      },
    ]

    const settled = agents.map(async (agent) => {
      try {
        await fireAgent(agent.name, agent.url, agent.body)
      } catch (err) {
        console.error(`[agents] ${agent.name} failed:`, err)
        addToast({
          type: 'error',
          message: `Your data was saved. ${agent.name} couldn't complete analysis — tap to retry.`,
          action: {
            label: 'Retry',
            onClick: () => {
              fireAgent(agent.name, agent.url, agent.body).catch((retryErr) => {
                console.error(`[agents] ${agent.name} retry failed:`, retryErr)
              })
            },
          },
        })
      }
    })

    Promise.all(settled).then(() => {
      const now = new Date().toISOString()
      useStore.getState().setLastAgentRunAt(now)
      useStore.getState().setAuditMeta({ lastRun: now })

      // Trigger email notifications for concern/action findings
      if (schoolId) {
        fetch('/api/notifications/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolId }),
        }).catch((err) => console.error('[email-notifications] Failed:', err))
      }
    })
  }

  const handleImport = () => {
    // Check for duplicate grants before importing
    if (mappedGrants.length > 0) {
      const existingGrants = useStore.getState().grants
      const dupes: DuplicateGrant[] = []
      for (const mg of mappedGrants) {
        const existing = existingGrants.find(
          (g) => g.name.toLowerCase() === mg.name.toLowerCase()
        )
        if (existing) {
          dupes.push({
            name: mg.name,
            existingAmount: existing.awardAmount,
            newAmount: mg.awardAmount,
            newSpent: mg.spent,
          })
        }
      }
      if (dupes.length > 0 && duplicateGrants.length === 0) {
        setDuplicateGrants(dupes)
        return // show dialog, don't import yet
      }
    }

    doImport()
  }

  const handleDuplicateDecision = (grantName: string, action: 'update' | 'keep') => {
    if (action === 'keep') {
      // Remove this grant from mappedGrants so it won't overwrite
      setMappedGrants((prev) => prev.filter((g) => g.name.toLowerCase() !== grantName.toLowerCase()))
    }
    // Remove from pending duplicates
    setDuplicateGrants((prev) => {
      const remaining = prev.filter((d) => d.name.toLowerCase() !== grantName.toLowerCase())
      // If that was the last one, auto-proceed with import
      if (remaining.length === 0) {
        setTimeout(() => doImport(), 0)
      }
      return remaining
    })
  }

  const doImport = () => {
    setImporting(true)
    importFinancialData(
      mappedData,
      selectedMonth,
      fileName,
      allDataRows.length,
      mappedGrants.length > 0 ? mappedGrants : undefined,
    )

    fireAgentsWithRetry(selectedMonth)
    router.push('/dashboard')
  }

  const handleReupload = (monthKey: string) => {
    setSelectedMonth(monthKey)
    reset()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Step indicator
  const visibleSteps = skippedMapping
    ? STEP_ORDER.filter((s) => s !== 'mapping')
    : STEP_ORDER
  const currentStepIndex = visibleSteps.indexOf(step)

  // History: months with data, in WA State fiscal year order (September first)
  const historyMonths = FISCAL_MONTHS.filter((fm) => monthlySnapshots[fm.key])

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>Upload Data</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Import your financial data from CSV or Excel files
          </p>
        </div>
        <a
          href="/cascade-charter-sample.csv"
          download
          className="flex items-center gap-1.5 text-sm text-[#1e3a5f] font-medium hover:opacity-75 transition-opacity"
        >
          <Download size={14} />
          Download sample CSV
        </a>
      </div>

      {/* Step indicator */}
      {step !== 'drop' && (
        <div className="flex items-center gap-2">
          {visibleSteps.map((s, i) => {
            const done = i < currentStepIndex
            const active = i === currentStepIndex
            return (
              <div key={s} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      done
                        ? 'bg-green-500 text-white'
                        : active
                        ? 'text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                    {...(active && !done ? { style: { background: 'var(--brand-700)' } } : {})}
                  >
                    {done ? <CheckCircle size={13} /> : i + 1}
                  </div>
                  <span
                    className={`text-sm ${
                      active ? 'font-semibold text-gray-800' : 'text-gray-400'
                    }`}
                  >
                    {STEP_LABELS[s]}
                  </span>
                </div>
                {i < visibleSteps.length - 1 && (
                  <div className="w-8 h-px bg-gray-300" />
                )}
              </div>
            )
          })}
          {skippedMapping && step === 'confirmation' && (
            <span className="ml-2 flex items-center gap-1 text-xs text-green-600 font-medium">
              <Zap size={12} />
              Columns auto-detected
            </span>
          )}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button
            onClick={reset}
            className="shrink-0 text-red-600 underline hover:no-underline text-xs font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {/* ── STEP: DROP ── */}
      {step === 'drop' && (
        <>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !parsing && fileInputRef.current?.click()}
          className={`bg-white rounded-xl border-2 border-dashed p-12 flex flex-col items-center justify-center cursor-pointer transition-colors ${
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
              <p className="text-sm text-gray-500">Reading file…</p>
            </div>
          ) : (
            <>
              <UploadCloud size={40} className={dragging ? 'text-[#1e3a5f]' : 'text-gray-400'} />
              <p className="mt-4 text-base font-medium text-gray-700">Drop your file here</p>
              <p className="text-sm text-gray-400 mt-1">Accepts CSV and Excel (.xlsx) files</p>
              <button
                type="button"
                className="mt-5 px-5 py-2 text-white text-sm font-medium hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}
              >
                Browse Files
              </button>
            </>
          )}
        </div>
        <p className="text-center text-xs text-gray-400 mt-3">
          Not sure of the format?{' '}
          <a
            href="/cascade-charter-sample.csv"
            download
            className="text-[#1e3a5f] font-medium hover:opacity-75 transition-opacity"
          >
            Download a sample file
          </a>{' '}
          to see the expected columns.
        </p>
        </>
      )}

      {/* ── STEP: PREVIEW ── */}
      {step === 'preview' && (
        <div className="card-static">
          {/* File info bar */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <FileSpreadsheet size={18} className="text-gray-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{fileName}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {allDataRows.length} data row{allDataRows.length !== 1 ? 's' : ''} detected
              </p>
            </div>
            {isFullyMapped(columnMappings) ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                <Zap size={11} />
                All columns recognized
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                <AlertTriangle size={11} />
                Some columns need mapping
              </span>
            )}
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto">
            <p className="px-5 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              First {previewRows.length} rows
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {headers.map((h, i) => {
                    const mapping = columnMappings[i]
                    return (
                      <th key={i} className="text-left px-4 py-2.5">
                        <div className="text-xs font-semibold text-gray-700">{h}</div>
                        {mapping && mapping.mappedField !== 'ignore' ? (
                          <div className="text-xs text-green-600 font-medium mt-0.5">
                            → {FIELD_OPTIONS.find((o) => o.value === mapping.mappedField)?.label}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 mt-0.5">→ unmapped</div>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, ri) => (
                  <tr key={ri} className="border-b border-gray-50 hover:bg-gray-50/50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-4 py-2 text-gray-700 whitespace-nowrap">
                        {cell || <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft size={14} />
              Choose a different file
            </button>
            <button
              onClick={handleProceedFromPreview}
              className="flex items-center gap-1.5 px-5 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)' }}
            >
              Continue
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: MAPPING ── */}
      {step === 'mapping' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2.5 text-sm text-amber-800">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>
              We couldn&apos;t automatically identify all columns. Tell us what each one contains.
            </span>
          </div>

          {/* Ambiguous column warning */}
          {(() => {
            const unmatched = columnMappings.filter((m) => m.confidenceScore < 70 && m.mappedField === 'ignore')
            if (unmatched.length === 0) return null
            return (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-3 text-sm text-yellow-900">
                <p className="font-medium mb-1">
                  We couldn&apos;t match these columns:{' '}
                  {unmatched.map((m) => m.sourceColumn).join(', ')}
                </p>
                <p className="text-yellow-700 text-xs">
                  Try renaming them in your accounting software to: Account, Account Type, Budget Amount, YTD Actuals, Month.
                </p>
              </div>
            )
          })()}

          {columnMappings.map((m) => (
            <div key={m.columnIndex} className="card-static p-5">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800 mb-0.5">
                    &ldquo;{m.sourceColumn}&rdquo;
                  </p>
                  {m.sampleValues.length > 0 && (
                    <p className="text-xs text-gray-400">
                      Sample values:{' '}
                      <span className="font-mono text-gray-600">
                        {m.sampleValues.slice(0, 3).join(', ')}
                      </span>
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  <select
                    value={m.mappedField}
                    onChange={(e) => updateMapping(m.columnIndex, e.target.value as SchoolCFOField)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] bg-white"
                  >
                    {FIELD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {m.confident && (
                <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                  <CheckCircle size={11} />
                  Auto-detected
                </p>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => { setError(null); setStep('preview') }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <button
              onClick={handleConfirmMapping}
              className="flex items-center gap-1.5 px-5 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)' }}
            >
              Confirm Mapping
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: CONFIRMATION ── */}
      {step === 'confirmation' && (
        <div className="space-y-5">
          {/* Month selector + summary */}
          <div className="card-static p-5 space-y-4">
            {/* Month selector */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Which month does this data represent?
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] bg-white"
              >
                {FISCAL_MONTHS.map((fm) => (
                  <option key={fm.key} value={fm.key}>
                    {fm.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Overwrite warning */}
            {monthlySnapshots[selectedMonth] && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>
                  You already have data for{' '}
                  <strong>{labelFromKey(selectedMonth)}</strong>. Importing will replace it. Other months will not be affected.
                </span>
              </div>
            )}

            {/* Summary */}
            <div>
              <h2 className="font-semibold text-gray-800 mb-1">Ready to Import</h2>
              <p className="text-sm text-gray-500">
                Found{' '}
                <span className="font-medium text-gray-800">{allDataRows.length} rows</span> across{' '}
                <span className="font-medium text-gray-800">{mappedData.length} categories</span>.
                Here&apos;s what I mapped:
              </p>

              {/* Mapped columns */}
              <div className="mt-3 flex flex-wrap gap-2">
                {columnMappings
                  .filter((m) => m.mappedField !== 'ignore')
                  .map((m) => (
                    <span
                      key={m.columnIndex}
                      className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded-full font-medium"
                    >
                      <span className="text-blue-400">{m.sourceColumn}</span>
                      <ArrowRight size={10} className="text-blue-400" />
                      {FIELD_OPTIONS.find((o) => o.value === m.mappedField)?.label}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* Preview table of mapped data */}
          <div className="card-static overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] bg-gray-50 border-b border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <div>Category</div>
              <div className="text-right">Budget</div>
              <div className="text-right">YTD Actuals</div>
              <div className="text-right">Burn Rate</div>
              <div className="text-center">Status</div>
            </div>
            {mappedData.map((row) => {
              const burnRate = row.budget > 0 ? (row.ytdActuals / row.budget) * 100 : 0
              const alertStatus = deriveAlertStatus(row.budget, row.ytdActuals, expectedPct)
              const cfg = STATUS_CONFIG[alertStatus]
              return (
                <div
                  key={row.category}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] px-4 py-3 border-b border-gray-50 text-sm"
                >
                  <div className="font-medium text-gray-800">{row.category}</div>
                  <div className="text-right text-gray-600">{fmt(row.budget)}</div>
                  <div className="text-right text-gray-600">{fmt(row.ytdActuals)}</div>
                  <div className="text-right">
                    <span
                      className={`font-medium ${
                        burnRate > expectedPct + 5 ? 'text-red-600' : 'text-gray-700'
                      }`}
                    >
                      {burnRate.toFixed(0)}%
                    </span>
                    <span className="text-gray-400 text-xs ml-1">(exp. {expectedPct}%)</span>
                  </div>
                  <div className="flex justify-center">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${cfg.badge}`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                </div>
              )
            })}

            {/* Totals row */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] px-4 py-3 bg-gray-50 border-t-2 border-gray-200 text-sm font-semibold text-gray-800">
              <div>Total</div>
              <div className="text-right">
                {fmt(mappedData.reduce((s, r) => s + r.budget, 0))}
              </div>
              <div className="text-right">
                {fmt(mappedData.reduce((s, r) => s + r.ytdActuals, 0))}
              </div>
              <div className="text-right">
                {(() => {
                  const totalBudget = mappedData.filter((r) => (r.accountType ?? 'expense') === 'expense').reduce((s, r) => s + r.budget, 0)
                  const totalYtd = mappedData.filter((r) => (r.accountType ?? 'expense') === 'expense').reduce((s, r) => s + r.ytdActuals, 0)
                  return totalBudget > 0
                    ? `${((totalYtd / totalBudget) * 100).toFixed(0)}%`
                    : '—'
                })()}
              </div>
              <div />
            </div>
          </div>

          {/* Grant preview — only shown when grant columns were detected */}
          {mappedGrants.length > 0 && (
            <div className="card-static overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Award size={14} className="text-[#1e3a5f]" />
                <span className="text-sm font-semibold text-gray-800">
                  {mappedGrants.length} Grant{mappedGrants.length !== 1 ? 's' : ''} Detected
                </span>
              </div>
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] bg-gray-50 border-b border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <div>Grant Name</div>
                <div className="text-right">Award</div>
                <div className="text-right">Spent</div>
                <div className="text-right">Spend Rate</div>
              </div>
              {mappedGrants.map((g) => {
                const spentPct = g.awardAmount > 0 ? (g.spent / g.awardAmount) * 100 : 0
                return (
                  <div
                    key={g.name}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr] px-4 py-3 border-b border-gray-50 text-sm"
                  >
                    <div className="font-medium text-gray-800">{g.name}</div>
                    <div className="text-right text-gray-600">{fmt(g.awardAmount)}</div>
                    <div className="text-right text-gray-600">{fmt(g.spent)}</div>
                    <div className="text-right">
                      <span
                        className={`font-medium ${
                          spentPct > expectedPct + 10
                            ? 'text-red-600'
                            : spentPct < expectedPct - 15
                            ? 'text-orange-600'
                            : 'text-gray-700'
                        }`}
                      >
                        {spentPct.toFixed(0)}%
                      </span>
                      <span className="text-gray-400 text-xs ml-1">(exp. {expectedPct}%)</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => { setError(null); setStep(skippedMapping ? 'preview' : 'mapping') }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={reset}
                className="px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-2 px-5 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60 transition-opacity"
                style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)' }}
              >
                {importing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importing…
                  </>
                ) : monthlySnapshots[selectedMonth] ? (
                  <>
                    <CheckCircle size={15} />
                    Replace {labelFromKey(selectedMonth)} Data
                  </>
                ) : (
                  <>
                    <CheckCircle size={15} />
                    Import Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload History ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Upload History</h2>
        {historyMonths.length === 0 ? (
          <div className="card-static px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No uploads yet</p>
          </div>
        ) : (
          <div className="card-static divide-y divide-gray-100">
            {historyMonths.map((fm) => {
              const snap = monthlySnapshots[fm.key]!
              const isConfirming = confirmDelete === fm.key
              return (
                <div key={fm.key} className="flex items-center gap-4 px-5 py-4">
                  <FileSpreadsheet size={18} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{fm.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {snap.filename} · {fmtTimestamp(snap.uploadedAt)} · {snap.rowCount.toLocaleString()} records
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full shrink-0">
                    <CheckCircle size={12} />
                    Imported
                  </span>
                  <button
                    onClick={() => handleReupload(fm.key)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#1e3a5f] transition-colors"
                  >
                    <RotateCcw size={13} />
                    Re-upload
                  </button>
                  {isConfirming ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          deleteSnapshot(fm.key)
                          setConfirmDelete(null)
                        }}
                        className="text-xs font-medium text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-md transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(fm.key)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Duplicate Grant Dialog ── */}
      {duplicateGrants.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Duplicate Grants Found</h3>
              <p className="text-sm text-gray-500 mt-1">
                {duplicateGrants.length === 1
                  ? 'This grant is already in your system.'
                  : `${duplicateGrants.length} grants are already in your system.`}
              </p>
            </div>
            <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {duplicateGrants.map((dg) => (
                <div key={dg.name} className="px-5 py-4">
                  <p className="text-sm font-medium text-gray-800 mb-1">
                    We found <strong>{dg.name}</strong> in your upload. This grant is already in your system.
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Current award: {fmt(dg.existingAmount)} → New award: {fmt(dg.newAmount)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDuplicateDecision(dg.name, 'update')}
                      className="px-3 py-1.5 text-xs font-medium text-white rounded-md hover:opacity-90 transition-opacity"
                      style={{ background: 'var(--brand-700)' }}
                    >
                      Update to {fmt(dg.newAmount)}
                    </button>
                    <button
                      onClick={() => handleDuplicateDecision(dg.name, 'keep')}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Keep Existing
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts ── */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-lg border px-4 py-3 shadow-lg text-sm ${
                toast.type === 'info'
                  ? 'bg-blue-50 border-blue-300 text-blue-900'
                  : toast.type === 'warning'
                  ? 'bg-yellow-50 border-yellow-300 text-yellow-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              <div className="flex items-start gap-2">
                {toast.type === 'info'
                  ? <Info size={14} className="shrink-0 mt-0.5" />
                  : <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                }
                <div className="flex-1">
                  <p>{toast.message}</p>
                  {toast.action && (
                    <button
                      onClick={() => { toast.action!.onClick(); dismissToast(toast.id) }}
                      className="mt-2 text-xs font-semibold underline hover:no-underline"
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="shrink-0 text-xs opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
