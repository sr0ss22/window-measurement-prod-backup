import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'

export async function GET(request: NextRequest) {
  try {
    // Get the session to access the access token
    const session = await getServerSession(authOptions)
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters from the request
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const pageSize = searchParams.get('pageSize') || '10'
    const includes = searchParams.get('includes') || '["WorkOrder","Consumer","Dealer","Installer","ConditionalAction","ActionContext"]'

    // Construct the CPQ API URL
    const cpqUrl = new URL('https://dev.api.hdbrite.com/v1/work-order-service/work-orders')
    cpqUrl.searchParams.set('page', page)
    cpqUrl.searchParams.set('pageSize', pageSize)
    cpqUrl.searchParams.set('includes', includes)

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
    return NextResponse.json(data)

  } catch (error) {
    console.error('API Route Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
