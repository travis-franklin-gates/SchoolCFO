'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Upload,
  BarChart2,
  Award,
  FileText,
  ClipboardCheck,
  MessageCircle,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/upload', icon: Upload, label: 'Upload Data' },
  { href: '/budget-analysis', icon: BarChart2, label: 'Budget Analysis' },
  { href: '/grant-tracker', icon: Award, label: 'Grant Tracker' },
  { href: '/board-packet', icon: FileText, label: 'Board Packet' },
  { href: '/fpf-scorecard', icon: ShieldCheck, label: 'FPF Scorecard' },
  { href: '/audit-prep', icon: ClipboardCheck, label: 'Audit Prep' },
  { href: '/ask-cfo', icon: MessageCircle, label: 'Ask Your CFO' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { schoolProfile } = useStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    useStore.getState().clearSession()
    router.push('/login')
    router.refresh()
  }

  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      {/* Mobile hamburger button */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-50 lg:hidden rounded-lg p-2 shadow-lg text-white"
          style={{ backgroundColor: 'var(--brand-700)' }}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Backdrop (mobile only) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-64 flex flex-col z-40 transition-transform duration-300 ease-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'linear-gradient(180deg, #1e3a5f 0%, #152d4b 50%, #0f1f33 100%)',
          boxShadow: '4px 0 24px rgba(15, 31, 51, 0.15)',
        }}
      >
        {/* Logo / close row */}
        <div className="px-6 py-5 border-b border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold"
              style={{
                background: 'linear-gradient(135deg, #2ec4b6 0%, #14a3a3 100%)',
                color: '#ffffff',
                fontFamily: 'var(--font-display), system-ui, sans-serif',
                boxShadow: '0 2px 8px rgba(46, 196, 182, 0.3)',
              }}
            >
              S
            </div>
            <div>
              <div
                className="text-white text-lg tracking-tight"
                style={{
                  fontFamily: 'var(--font-display), system-ui, sans-serif',
                  fontWeight: 700,
                }}
              >
                School<span style={{ color: '#2ec4b6' }}>CFO</span>
              </div>
              <div
                className="text-xs mt-px tracking-wider uppercase"
                style={{
                  color: 'rgba(139, 176, 212, 0.7)',
                  fontFamily: 'var(--font-display), system-ui, sans-serif',
                  fontWeight: 500,
                  fontSize: '0.6rem',
                  letterSpacing: '0.12em',
                }}
              >
                Financial Management
              </div>
            </div>
          </div>
          <button
            onClick={closeMobile}
            className="lg:hidden text-blue-300/60 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={closeMobile}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  active
                    ? 'bg-white/95 shadow-md'
                    : 'hover:bg-white/10'
                }`}
                style={active ? {
                  color: 'var(--brand-700)',
                  fontFamily: 'var(--font-display), system-ui, sans-serif',
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                } : {
                  color: 'rgba(189, 212, 236, 0.85)',
                  fontFamily: 'var(--font-display), system-ui, sans-serif',
                  fontWeight: 500,
                }}
              >
                <Icon
                  size={17}
                  className={active ? '' : 'group-hover:text-white transition-colors'}
                  style={active ? { color: 'var(--accent-600)' } : undefined}
                />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-5 py-4 border-t border-white/8">
          <div
            className="text-sm mb-3 truncate"
            style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontFamily: 'var(--font-display), system-ui, sans-serif',
              fontWeight: 600,
            }}
          >
            {schoolProfile.name}
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: 'rgba(139, 176, 212, 0.6)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(139, 176, 212, 0.6)')}
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </div>
    </>
  )
}
