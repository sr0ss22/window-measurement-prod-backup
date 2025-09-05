'use client'

import { useParams } from 'next/navigation'
import WorkOrderDetailContent from '@/app/work-order/content'

export default function WorkOrderDetailPage() {
  const params = useParams()
  const workOrderId = params?.id as string

  if (!workOrderId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No work order ID provided</p>
        </div>
      </div>
    )
  }

  return <WorkOrderDetailContent projectId={workOrderId} />
}
