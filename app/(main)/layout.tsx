import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import Sidebar from '@/components/Sidebar'
import StoreInitializer from '@/components/StoreInitializer'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: school } = await supabase
    .from('schools')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!school) redirect('/onboarding')

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#f8f9fa' }}>
      <StoreInitializer userId={user.id} schoolId={school.id} />
      <Sidebar />
      <main className="ml-0 lg:ml-64 flex-1 px-4 py-6 lg:px-8 lg:py-8 min-w-0">{children}</main>
    </div>
  )
}
