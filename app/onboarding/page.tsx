'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const GRADE_OPTIONS = ['K-5', 'K-8', '6-8', '9-12', 'K-12']

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [authorizer, setAuthorizer] = useState('Washington State Charter School Commission')
  const [gradeConfig, setGradeConfig] = useState('K-5')
  const [currentFtes, setCurrentFtes] = useState('')
  const [nextBoardMeeting, setNextBoardMeeting] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setError('Session expired. Please sign in again.')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('schools').insert({
      user_id: user.id,
      name,
      authorizer,
      grade_config: gradeConfig,
      current_ftes: parseFloat(currentFtes) || 0,
      next_board_meeting: nextBoardMeeting || null,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    router.push('/upload')
    router.refresh()
  }

  const inputCls = 'w-full px-3.5 py-2.5 text-sm bg-white'
  const inputStyle = { border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)' }

  return (
    <div className="w-full max-w-lg">
      {/* Branding */}
      <div className="text-center mb-8">
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
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Let&apos;s set up your school profile
        </p>
      </div>

      <div
        className="p-8"
        style={{
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <h1
          className="text-lg text-gray-900 mb-2"
          style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', fontWeight: 700 }}
        >
          Tell us about your school
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          This information helps us tailor your financial dashboards and reports.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <input
              type="text"
              value={authorizer}
              onChange={(e) => setAuthorizer(e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Grade configuration
            </label>
            <select
              value={gradeConfig}
              onChange={(e) => setGradeConfig(e.target.value)}
              className={inputCls}
              style={inputStyle}
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Current FTES (full-time equivalent students)
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

          {error && (
            <p
              className="text-sm px-3.5 py-2.5"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-display), system-ui, sans-serif',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {loading ? 'Setting up your school…' : 'Continue to upload data'}
          </button>
        </form>
      </div>
    </div>
  )
}
