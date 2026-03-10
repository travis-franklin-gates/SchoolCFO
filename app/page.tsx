import Link from 'next/link'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Home() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: 'var(--surface-bg)' }}
    >
      {/* Branding */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center text-base font-extrabold text-white"
          style={{
            background: 'linear-gradient(135deg, #2ec4b6 0%, #14a3a3 100%)',
            fontFamily: 'var(--font-display), system-ui, sans-serif',
            boxShadow: '0 2px 8px rgba(46, 196, 182, 0.3)',
          }}
        >
          S
        </div>
        <div
          className="text-3xl tracking-tight"
          style={{
            color: 'var(--brand-700)',
            fontFamily: 'var(--font-display), system-ui, sans-serif',
            fontWeight: 700,
          }}
        >
          School<span style={{ color: 'var(--accent-500)' }}>CFO</span>
        </div>
      </div>

      <p
        className="text-base mb-8 text-center max-w-md"
        style={{ color: 'var(--text-secondary)' }}
      >
        Financial management built for charter school leaders &mdash; no accounting background needed.
      </p>

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Link
          href="/signup"
          className="flex-1 text-center py-2.5 px-5 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
          style={{
            background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-800) 100%)',
            fontFamily: 'var(--font-display), system-ui, sans-serif',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          Get Started
        </Link>
        <Link
          href="/login"
          className="flex-1 text-center py-2.5 px-5 text-sm font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          style={{
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-display), system-ui, sans-serif',
          }}
        >
          Sign In
        </Link>
      </div>
    </div>
  )
}
