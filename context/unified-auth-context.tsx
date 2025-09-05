'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react'
import { createClient } from '@/integrations/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

interface UnifiedAuthContextType {
  user: any
  supabase: SupabaseClient | null // Now properly typed and available
  isLoading: boolean
  session: any
  accessToken: string | null
  signOut: () => Promise<void>
}

const UnifiedAuthContext = createContext<UnifiedAuthContextType | undefined>(undefined)

export function UnifiedAuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(true)
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    // Set a timeout to prevent infinite loading
    const timer = setTimeout(() => {
      if (status === 'loading') {
        console.warn('Auth session check timed out. Proceeding as logged out.')
        setIsLoading(false)
      }
    }, 5000)

    if (status !== 'loading') {
      clearTimeout(timer)
      setIsLoading(false)
    }

    return () => clearTimeout(timer)
  }, [status])

  const signOut = async () => {
    try {
      await nextAuthSignOut({ callbackUrl: '/login' })
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const value: UnifiedAuthContextType = {
    user: session?.user || null,
    supabase, // Now providing Supabase client
    isLoading,
    session,
    accessToken: session?.accessToken || null,
    signOut,
  }


  return (
    <UnifiedAuthContext.Provider value={value}>
      {children}
    </UnifiedAuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(UnifiedAuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within a UnifiedAuthProvider')
  }
  return context
}
