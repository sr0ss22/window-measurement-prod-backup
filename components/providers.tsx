'use client'

import { SessionProvider } from 'next-auth/react'
import { UnifiedAuthProvider } from '@/context/unified-auth-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <UnifiedAuthProvider>
        {children}
      </UnifiedAuthProvider>
    </SessionProvider>
  )
}
