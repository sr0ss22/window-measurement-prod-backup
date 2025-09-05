'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function WorkOrderPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const projectId = searchParams?.get('id')

  useEffect(() => {
    if (projectId) {
      // Redirect to the new work orders route
      router.replace(`/work-orders/${projectId}`)
    } else {
      // Redirect to projects if no ID provided
      router.replace('/projects')
    }
  }, [projectId, router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  )
}