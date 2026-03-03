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

  return (
    <div className="w-full max-w-lg">
      {/* Branding */}
      <div className="text-center mb-8">
        <div className="text-3xl font-bold tracking-tight" style={{ color: '#1e3a5f' }}>
          SchoolCFO
        </div>
        <p className="text-gray-500 text-sm mt-1">Let&apos;s set up your school profile</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Tell us about your school</h1>
        <p className="text-sm text-gray-500 mb-6">
          This information helps us tailor your financial dashboards and reports.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              School name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              placeholder="e.g. Cascade Charter Elementary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Authorizer
            </label>
            <input
              type="text"
              value={authorizer}
              onChange={(e) => setAuthorizer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Grade configuration
            </label>
            <select
              value={gradeConfig}
              onChange={(e) => setGradeConfig(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] bg-white"
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current FTES (full-time equivalent students)
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={currentFtes}
              onChange={(e) => setCurrentFtes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              placeholder="e.g. 187"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Next board meeting date
            </label>
            <input
              type="date"
              value={nextBoardMeeting}
              onChange={(e) => setNextBoardMeeting(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 text-sm font-medium text-white rounded-lg disabled:opacity-60 transition-colors"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            {loading ? 'Setting up your school…' : 'Continue to upload data'}
          </button>
        </form>
      </div>
    </div>
  )
}
