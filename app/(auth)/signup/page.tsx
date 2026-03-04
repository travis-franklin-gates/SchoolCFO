'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AuthForm from '@/components/AuthForm'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
    })
  }, [router])

  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/onboarding')
  }

  return (
    <AuthForm
      title="Create your account"
      subtitle="You'll set up your school profile in the next step."
      submitLabel="Create account"
      loadingLabel="Creating account…"
      footerText="Already have an account?"
      footerLinkHref="/login"
      footerLinkText="Sign in"
      passwordMinLength={8}
      passwordPlaceholder="At least 8 characters"
      error={error}
      loading={loading}
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
    />
  )
}
