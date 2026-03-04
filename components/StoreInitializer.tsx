'use client'

import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'

interface Props {
  userId: string
  schoolId: string
}

export default function StoreInitializer({ userId, schoolId }: Props) {
  const initialized = useRef(false)
  const { setSchoolContext, loadFromSupabase } = useStore()
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    setSchoolContext(userId, schoolId)
    loadFromSupabase(userId, schoolId).catch((err) => {
      console.error('[StoreInitializer] loadFromSupabase failed', err)
      setLoadError(true)
      // Prevent pages from hanging indefinitely on the loading spinner
      useStore.setState({ isLoaded: true })
    })
  }, [userId, schoolId, setSchoolContext, loadFromSupabase])

  if (loadError) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 shadow-sm max-w-sm">
        Unable to load your data. Please refresh the page.
      </div>
    )
  }

  return null
}
