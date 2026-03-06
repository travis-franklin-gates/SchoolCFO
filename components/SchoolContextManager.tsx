'use client'

import { useState, FormEvent } from 'react'
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  StickyNote,
  Flag,
  HelpCircle,
  Calendar,
  X,
} from 'lucide-react'
import { useStore, type SchoolContextEntry } from '@/lib/store'
import { getFiscalMonths } from '@/lib/fiscalYear'

const FISCAL_MONTHS = getFiscalMonths()

// ── Guided Prompts ──────────────────────────────────────────────────────────

interface GuidedPrompt {
  key: string
  question: string
  description: string
}

const GUIDED_PROMPTS: GuidedPrompt[] = [
  {
    key: 'staffing_ratio',
    question: 'Do you intentionally staff above the typical para-to-teacher ratio?',
    description: 'If yes, the AI will adjust personnel cost expectations.',
  },
  {
    key: 'capital_outlays',
    question: 'Do you have planned large capital outlays this fiscal year?',
    description: 'Helps the AI understand one-time spending spikes.',
  },
  {
    key: 'variance_events',
    question: 'Are any variance alerts currently explained by a known one-time event?',
    description: 'Suppresses or downgrades alerts for known temporary variances.',
  },
  {
    key: 'additional_revenue',
    question: 'Do you receive any revenue streams not reflected in your standard apportionment?',
    description: 'Helps the AI understand your full funding picture.',
  },
  {
    key: 'salary_braiding',
    question: 'Are any staff salaries split across multiple funding sources (braiding)?',
    description: 'Affects how the AI interprets grant spend rates and personnel costs.',
  },
]

function GuidedPromptCard({
  prompt,
  entry,
  onSave,
  onRemove,
}: {
  prompt: GuidedPrompt
  entry: SchoolContextEntry | undefined
  onSave: (entry: SchoolContextEntry) => void
  onRemove: (id: string) => void
}) {
  const isActive = !!entry
  const [expanded, setExpanded] = useState(false)
  const [formData, setFormData] = useState<Record<string, unknown>>(entry?.value ?? {})

  const toggle = () => {
    if (isActive) {
      onRemove(entry!.id)
    } else {
      setExpanded(true)
      setFormData({})
    }
  }

  const save = () => {
    onSave({
      id: entry?.id ?? crypto.randomUUID(),
      contextType: 'guided',
      key: prompt.key,
      value: formData,
      expiresAt: null,
    })
    setExpanded(false)
  }

  const renderForm = () => {
    switch (prompt.key) {
      case 'staffing_ratio':
        return (
          <div className="space-y-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Explanation</label>
              <textarea
                value={String(formData.explanation ?? '')}
                onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                placeholder="e.g. We employ 4 paras for our inclusion model..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Personnel cost threshold (default 80%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={Number(formData.threshold ?? 80)}
                  onChange={(e) => setFormData({ ...formData, threshold: Number(e.target.value) })}
                  min={50}
                  max={90}
                  className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <span className="text-xs text-gray-400">% (max 90%)</span>
              </div>
            </div>
          </div>
        )
      case 'capital_outlays': {
        const outlays = Array.isArray(formData.outlays) ? formData.outlays as Record<string, unknown>[] : []
        return (
          <div className="space-y-3 mt-3">
            {outlays.map((outlay, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  type="text"
                  value={String(outlay.description ?? '')}
                  onChange={(e) => {
                    const updated = [...outlays]
                    updated[i] = { ...outlay, description: e.target.value }
                    setFormData({ ...formData, outlays: updated })
                  }}
                  placeholder="Description"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="number"
                  value={Number(outlay.amount ?? '')}
                  onChange={(e) => {
                    const updated = [...outlays]
                    updated[i] = { ...outlay, amount: Number(e.target.value) }
                    setFormData({ ...formData, outlays: updated })
                  }}
                  placeholder="Amount"
                  className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <select
                  value={String(outlay.month ?? '')}
                  onChange={(e) => {
                    const updated = [...outlays]
                    updated[i] = { ...outlay, month: e.target.value }
                    setFormData({ ...formData, outlays: updated })
                  }}
                  className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="">Month</option>
                  {FISCAL_MONTHS.map((fm) => (
                    <option key={fm.key} value={fm.label}>{fm.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const updated = outlays.filter((_, j) => j !== i)
                    setFormData({ ...formData, outlays: updated })
                  }}
                  className="p-2 text-gray-300 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setFormData({ ...formData, outlays: [...outlays, { description: '', amount: 0, month: '' }] })}
              className="flex items-center gap-1.5 text-xs font-medium hover:opacity-75 transition-opacity"
              style={{ color: 'var(--brand-600)' }}
            >
              <Plus size={12} /> Add outlay
            </button>
          </div>
        )
      }
      case 'variance_events': {
        const events = Array.isArray(formData.events) ? formData.events as Record<string, unknown>[] : []
        return (
          <div className="space-y-3 mt-3">
            {events.map((ev, i) => (
              <div key={i} className="flex gap-2 items-start flex-wrap">
                <input
                  type="text"
                  value={String(ev.category ?? '')}
                  onChange={(e) => {
                    const updated = [...events]
                    updated[i] = { ...ev, category: e.target.value }
                    setFormData({ ...formData, events: updated })
                  }}
                  placeholder="Budget category"
                  className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={String(ev.description ?? '')}
                  onChange={(e) => {
                    const updated = [...events]
                    updated[i] = { ...ev, description: e.target.value }
                    setFormData({ ...formData, events: updated })
                  }}
                  placeholder="Description"
                  className="flex-1 min-w-[150px] px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <select
                  value={String(ev.expirationMonth ?? '')}
                  onChange={(e) => {
                    const updated = [...events]
                    updated[i] = { ...ev, expirationMonth: e.target.value }
                    setFormData({ ...formData, events: updated })
                  }}
                  className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="">Expires</option>
                  {FISCAL_MONTHS.map((fm) => (
                    <option key={fm.key} value={fm.label}>{fm.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const updated = events.filter((_, j) => j !== i)
                    setFormData({ ...formData, events: updated })
                  }}
                  className="p-2 text-gray-300 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setFormData({ ...formData, events: [...events, { category: '', description: '', expirationMonth: '' }] })}
              className="flex items-center gap-1.5 text-xs font-medium hover:opacity-75 transition-opacity"
              style={{ color: 'var(--brand-600)' }}
            >
              <Plus size={12} /> Add event
            </button>
          </div>
        )
      }
      case 'additional_revenue':
        return (
          <div className="mt-3">
            <textarea
              value={String(formData.explanation ?? '')}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              placeholder="Describe additional revenue streams..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
            />
          </div>
        )
      case 'salary_braiding':
        return (
          <div className="mt-3">
            <textarea
              value={String(formData.positions ?? '')}
              onChange={(e) => setFormData({ ...formData, positions: e.target.value })}
              placeholder="e.g. SPED Coordinator — 60% General Fund, 40% IDEA..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
            />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="card-static overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1">
          <div className="flex items-start gap-2">
            <HelpCircle size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--brand-500)' }} />
            <div>
              <p className="text-sm font-medium text-gray-800">{prompt.question}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{prompt.description}</p>
            </div>
          </div>
        </div>
        <button
          onClick={toggle}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isActive
              ? 'bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-600'
              : 'bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-700'
          }`}
        >
          {isActive ? 'Yes ✓' : 'No'}
        </button>
      </div>
      {(isActive || expanded) && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3" style={{ background: 'var(--surface-subtle)' }}>
          {renderForm()}
          <div className="flex gap-2 mt-3">
            <button
              onClick={save}
              className="px-3 py-1.5 text-white text-xs font-medium rounded-lg"
              style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)' }}
            >
              Save
            </button>
            {expanded && !isActive && (
              <button
                onClick={() => setExpanded(false)}
                className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Free-form Notes ─────────────────────────────────────────────────────────

function FreeformNotes() {
  const { schoolContextEntries, upsertSchoolContextEntry, removeSchoolContextEntry } = useStore()
  const notes = schoolContextEntries.filter((e) => e.contextType === 'freeform')

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    upsertSchoolContextEntry({
      id: crypto.randomUUID(),
      contextType: 'freeform',
      key: title.trim(),
      value: { title: title.trim(), body: body.trim() },
      expiresAt: expiresAt || null,
    })
    setTitle('')
    setBody('')
    setExpiresAt('')
    setShowForm(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote size={15} style={{ color: 'var(--brand-500)' }} />
          <h3 className="text-sm font-semibold text-gray-700" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            Context Notes
          </h3>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-xs font-medium hover:opacity-75 transition-opacity"
            style={{ color: 'var(--brand-600)' }}
          >
            <Plus size={13} /> Add Note
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card-static p-4 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            required
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Context details..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
          />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-gray-400" />
              <label className="text-xs text-gray-500">Expires</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="px-2 py-1 border border-gray-200 rounded text-xs"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3 py-1.5 text-white text-xs font-medium rounded-lg"
              style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)' }}
            >
              Add Note
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {notes.length === 0 && !showForm && (
        <p className="text-xs text-gray-400">No context notes yet.</p>
      )}
      {notes.map((note) => (
        <div key={note.id} className="card-static p-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">{String(note.value.title ?? note.key)}</p>
            {!!note.value.body && (
              <p className="text-xs text-gray-500 mt-1">{String(note.value.body)}</p>
            )}
            {note.expiresAt && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Calendar size={10} /> Expires {note.expiresAt}
              </p>
            )}
          </div>
          <button
            onClick={() => removeSchoolContextEntry(note.id)}
            className="text-gray-300 hover:text-red-400 transition-colors p-1 shrink-0"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Event Flags ─────────────────────────────────────────────────────────────

function EventFlags() {
  const { schoolContextEntries, upsertSchoolContextEntry, removeSchoolContextEntry } = useStore()
  const flags = schoolContextEntries.filter((e) => e.contextType === 'event_flag')

  const [showForm, setShowForm] = useState(false)
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [startMonth, setStartMonth] = useState('')
  const [expirationMonth, setExpirationMonth] = useState('')

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!category.trim() || !description.trim()) return
    const expKey = FISCAL_MONTHS.find((fm) => fm.label === expirationMonth)?.key
    const expDate = expKey ? `${expKey}-28` : null
    upsertSchoolContextEntry({
      id: crypto.randomUUID(),
      contextType: 'event_flag',
      key: `${category.trim()}-${Date.now()}`,
      value: { category: category.trim(), description: description.trim(), startMonth },
      expiresAt: expDate,
    })
    setCategory('')
    setDescription('')
    setStartMonth('')
    setExpirationMonth('')
    setShowForm(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag size={15} style={{ color: 'var(--accent-500)' }} />
          <h3 className="text-sm font-semibold text-gray-700" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
            Event Flags
          </h3>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-xs font-medium hover:opacity-75 transition-opacity"
            style={{ color: 'var(--brand-600)' }}
          >
            <Plus size={13} /> Add Flag
          </button>
        )}
      </div>
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        Active event flags suppress or downgrade variance alerts for the specified category.
      </p>

      {showForm && (
        <form onSubmit={handleAdd} className="card-static p-4 space-y-3">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Budget category (e.g. Contracted Services)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            required
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (e.g. One-time HVAC replacement)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            required
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Start month</label>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="">Select</option>
                {FISCAL_MONTHS.map((fm) => (
                  <option key={fm.key} value={fm.label}>{fm.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Expiration month</label>
              <select
                value={expirationMonth}
                onChange={(e) => setExpirationMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                required
              >
                <option value="">Select</option>
                {FISCAL_MONTHS.map((fm) => (
                  <option key={fm.key} value={fm.label}>{fm.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3 py-1.5 text-white text-xs font-medium rounded-lg"
              style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)' }}
            >
              Add Flag
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {flags.length === 0 && !showForm && (
        <p className="text-xs text-gray-400">No event flags active.</p>
      )}
      {flags.map((flag) => {
        const v = flag.value
        return (
          <div key={flag.id} className="card-static p-4 flex items-start gap-3 border-l-4" style={{ borderLeftColor: 'var(--accent-400)' }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {String(v.category ?? '')}
                </span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{String(v.description ?? '')}</p>
              <p className="text-xs text-gray-400 mt-1">
                {v.startMonth ? `${v.startMonth} – ` : ''}{flag.expiresAt ?? 'Ongoing'}
              </p>
            </div>
            <button
              onClick={() => removeSchoolContextEntry(flag.id)}
              className="text-gray-300 hover:text-red-400 transition-colors p-1 shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function SchoolContextManager() {
  const { schoolContextEntries, upsertSchoolContextEntry, removeSchoolContextEntry } = useStore()
  const [expanded, setExpanded] = useState(true)

  const guidedEntries = schoolContextEntries.filter((e) => e.contextType === 'guided')
  const activeCount = schoolContextEntries.length

  return (
    <div className="card-static p-6 space-y-6">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h2
            className="text-base font-semibold text-gray-800"
            style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}
          >
            School Context
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            Help the AI understand your school better — {activeCount} item{activeCount !== 1 ? 's' : ''} active
          </p>
        </div>
        {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </div>

      {expanded && (
        <div className="space-y-6">
          {/* Guided Prompts */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>
              Guided Prompts
            </h3>
            {GUIDED_PROMPTS.map((prompt) => (
              <GuidedPromptCard
                key={prompt.key}
                prompt={prompt}
                entry={guidedEntries.find((e) => e.key === prompt.key)}
                onSave={upsertSchoolContextEntry}
                onRemove={removeSchoolContextEntry}
              />
            ))}
          </div>

          {/* Free-form Notes */}
          <FreeformNotes />

          {/* Event Flags */}
          <EventFlags />
        </div>
      )}
    </div>
  )
}
