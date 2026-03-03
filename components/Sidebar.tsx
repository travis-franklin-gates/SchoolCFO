'use client'

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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div
      className="fixed left-0 top-0 h-full w-64 flex flex-col"
      style={{ backgroundColor: '#1e3a5f' }}
    >
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="text-white font-bold text-xl tracking-tight">SchoolCFO</div>
        <div className="text-blue-300 text-xs mt-0.5 font-medium uppercase tracking-wider">
          Financial Management
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-white text-[#1e3a5f]'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
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
        <div className="text-blue-200 text-xs mb-3 truncate font-medium">
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
  )
}
