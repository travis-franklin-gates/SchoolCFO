'use client'

import Link from 'next/link'

interface AuthFormProps {
  title: string
  subtitle?: string
  submitLabel: string
  loadingLabel: string
  footerText: string
  footerLinkHref: string
  footerLinkText: string
  passwordMinLength?: number
  passwordPlaceholder?: string
  error: string | null
  loading: boolean
  email: string
  password: string
  onEmailChange: (v: string) => void
  onPasswordChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
}

export default function AuthForm({
  title,
  subtitle,
  submitLabel,
  loadingLabel,
  footerText,
  footerLinkHref,
  footerLinkText,
  passwordMinLength,
  passwordPlaceholder,
  error,
  loading,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: AuthFormProps) {
  return (
    <div className="w-full max-w-sm">
      {/* Branding */}
      <div className="text-center mb-8">
        <div className="text-3xl font-bold tracking-tight" style={{ color: '#1e3a5f' }}>
          SchoolCFO
        </div>
        <p className="text-gray-500 text-sm mt-1">Financial management for charter leaders</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h1 className={`text-lg font-semibold text-gray-900 ${subtitle ? 'mb-2' : 'mb-6'}`}>
          {title}
        </h1>
        {subtitle && <p className="text-sm text-gray-500 mb-6">{subtitle}</p>}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              placeholder="you@school.org"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={passwordMinLength}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              placeholder={passwordPlaceholder ?? '••••••••'}
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
            {loading ? loadingLabel : submitLabel}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          {footerText}{' '}
          <Link href={footerLinkHref} className="font-medium" style={{ color: '#1e3a5f' }}>
            {footerLinkText}
          </Link>
        </p>
      </div>
    </div>
  )
}
