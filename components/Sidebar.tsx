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
  MessageCircle,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/upload', icon: Upload, label: 'Upload Data' },
  { href: '/budget-analysis', icon: BarChart2, label: 'Budget Analysis' },
  { href: '/grant-tracker', icon: Award, label: 'Grant Tracker' },
  { href: '/board-packet', icon: FileText, label: 'Board Packet' },
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
          style={{ backgroundColor: '#1e3a5f' }}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Backdrop (mobile only) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-64 flex flex-col z-40 transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'linear-gradient(180deg, #1e3a5f 0%, #152d4b 100%)' }}
      >
        {/* Logo / close row */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-white font-bold text-xl tracking-tight">SchoolCFO</div>
            <div className="text-blue-300 text-xs mt-0.5 font-medium uppercase tracking-wider">
              Financial Management
            </div>
          </div>
          <button
            onClick={closeMobile}
            className="lg:hidden text-blue-300 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={closeMobile}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-white text-[#1e3a5f] shadow-sm'
                    : 'text-blue-100 hover:bg-white/15 hover:text-white'
                }`}
              >
                <Icon size={17} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-5 py-4 border-t border-white/10">
          <div className="text-white text-sm mb-3 truncate font-semibold">
            {schoolProfile.name}
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-blue-300 hover:text-white text-sm transition-colors"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </div>
    </>
  )
}
