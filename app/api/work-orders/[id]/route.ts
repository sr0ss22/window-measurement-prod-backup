import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the session to access the access token
    const session = await getServerSession(authOptions)
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workOrderId = params.id

    // Construct the CPQ API URL
    const cpqUrl = new URL(`https://dev.api.hdbrite.com/v1/work-order-service/work-orders/${workOrderId}`)
    cpqUrl.searchParams.set('includes', '["WorkOrder","Consumer","Dealer","Installer","ConditionalAction","ActionContext","LineItems","Notes","Attachments","Relations"]')

    // Make the request to the CPQ API
    const response = await fetch(cpqUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('CPQ API Error:', response.status, errorText)
      return NextResponse.json(
        { error: `CPQ API Error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('CPQ API Response for work order', workOrderId, ':', JSON.stringify(data, null, 2))
    console.log('Work order data structure:', {
      hasWorkOrder: !!data.workOrder,
      hasConsumer: !!data.workOrder?.consumer,
      hasDealer: !!data.workOrder?.dealer,
      consumerData: data.workOrder?.consumer,
      dealerData: data.workOrder?.dealer
    })
    return NextResponse.json(data)

  } catch (error) {
    console.error('API Route Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
