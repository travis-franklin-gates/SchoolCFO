'use client'

import { useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'

interface Props {
  userId: string
  schoolId: string
}

export default function StoreInitializer({ userId, schoolId }: Props) {
  const initialized = useRef(false)
  const { setSchoolContext, loadFromSupabase } = useStore()

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    setSchoolContext(userId, schoolId)
    loadFromSupabase(userId, schoolId)
  }, [userId, schoolId, setSchoolContext, loadFromSupabase])

  return null
}
