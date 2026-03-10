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
  confirmPassword?: string
  onConfirmPasswordChange?: (v: string) => void
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
  confirmPassword,
  onConfirmPasswordChange,
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
          Financial management for charter leaders
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
          className={`text-lg text-gray-900 ${subtitle ? 'mb-2' : 'mb-6'}`}
          style={{ fontFamily: 'var(--font-display), system-ui, sans-serif', fontWeight: 700 }}
        >
          {title}
        </h1>
        {subtitle && <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white"
              style={{
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
              }}
              placeholder="you@school.org"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              required
              minLength={passwordMinLength}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white"
              style={{
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
              }}
              placeholder={passwordPlaceholder ?? '••••••••'}
            />
          </div>

          {onConfirmPasswordChange !== undefined && (
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Confirm password
              </label>
              <input
                type="password"
                required
                minLength={passwordMinLength}
                value={confirmPassword ?? ''}
                onChange={(e) => onConfirmPasswordChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white"
                style={{
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                }}
                placeholder="Re-enter your password"
              />
            </div>
          )}

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
            {loading ? loadingLabel : submitLabel}
          </button>
        </form>

        <p className="text-center text-sm mt-5" style={{ color: 'var(--text-tertiary)' }}>
          {footerText}{' '}
          <Link
            href={footerLinkHref}
            className="font-semibold"
            style={{ color: 'var(--brand-600)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}
          >
            {footerLinkText}
          </Link>
        </p>
      </div>
    </div>
  )
}
