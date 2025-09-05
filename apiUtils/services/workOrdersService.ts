import { httpClient } from '@/apiUtils/httpClient'
import { API_ENDPOINTS, API_BASE_URL } from '@/apiUtils/config'

export interface WorkOrder {
  id: string
  workOrderNumber: string
  name: string
  customerName?: string
  status: string
  scheduleDate?: string
  sellerName?: string
  address?: string
  phone?: string
  followUpDate?: string
  workType?: string
  details: {
    summary?: string
    instructions?: string
    work_no?: string
    field_ops_rep?: string
    service_order?: string
    work_type?: string
    additional_visit_needed?: boolean
    brand?: string
    arrival_window_start?: string
    arrival_window_end?: string
    duration?: number
    duration_type?: string
    date_service_delayed?: string
    reason_for_delay?: string
    contact_attempt_counter?: number
    time_service_delayed?: string
    date_scheduled?: string
  }
  customer_contact_info: {
    account?: string
    contact_name?: string
    home_phone?: string
    mobile_phone?: string
    email?: string
  }
  seller_contact_info: {
    company?: string
    contact_name?: string
    phone?: string
    email?: string
    secondary_email?: string
    address?: string
  }
  payment_info: {
    billed_surcharges?: string
    payment_status?: string
  }
  related_items: {
    related_work_orders?: Array<{ id: string; name: string }>
    linked_files?: Array<{ name: string; url: string }>
    service_calls?: any
  }
  createdAt: string
  updatedAt: string
}

export interface ListWorkOrdersResponse {
  workOrders: WorkOrder[]
  totalCount: number
  page: number
  pageSize: number
}

export interface APIQueryParams {
  page?: number
  pageSize?: number
  status?: string
  includes?: string[]
  installerEmail?: string
}

class WorkOrdersService {
  public async getWorkOrders(queryParams?: APIQueryParams, token?: string): Promise<ListWorkOrdersResponse> {
    try {
      // Call the local API route to avoid CORS issues
      const url = '/api/work-orders'
      console.log('Fetching work orders from local API:', url)
      
      const config: RequestInit = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session authentication
      }
      
      // Add query parameters
      const searchParams = new URLSearchParams()
      if (queryParams?.page) searchParams.append('page', queryParams.page.toString())
      if (queryParams?.pageSize) searchParams.append('pageSize', queryParams.pageSize.toString())
      if (queryParams?.status) searchParams.append('status', queryParams.status)
      if (queryParams?.installerEmail) searchParams.append('installerEmail', queryParams.installerEmail)
      
      // Add includes parameter for related data
      searchParams.append('includes', JSON.stringify(['Dealer', 'Consumer', 'Installer', 'ConditionalAction', 'ActionContext']))
      
      const fullUrl = `${url}?${searchParams.toString()}`
      console.log('Full URL:', fullUrl)
      
      const response = await fetch(fullUrl, config)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      }
      
      const data = await response.json()
      console.log('Successfully fetched work orders:', data.workOrders?.length || 0, 'items')
      
      // Transform the work orders to match the measurement app's expected format
      const transformedWorkOrders = data.workOrders?.map((workOrder: any) => transformWorkOrder(workOrder)) || []
      
      return {
        workOrders: transformedWorkOrders,
        totalCount: data.totalCount || transformedWorkOrders.length,
        page: data.page || 1,
        pageSize: data.pageSize || transformedWorkOrders.length
      }
    } catch (error: any) {
      console.error('Failed to fetch work orders:', error)
      
      // Re-throw with more context
      if (error.message.includes('Network error')) {
        throw new Error(`Unable to connect to CPQ API. Please ensure you are authenticated and the API is accessible.`)
      }
      
      throw error
    }
  }

  public async getWorkOrder(id: string, token?: string): Promise<WorkOrder> {
    try {
      // Call the local API route to avoid CORS issues
      const url = `/api/work-orders/${id}`
      console.log('Fetching work order detail from local API:', url)
      
      const config: RequestInit = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session authentication
      }
      
      // Add includes parameter for related data
      const searchParams = new URLSearchParams()
      searchParams.append('includes', JSON.stringify(['Dealer', 'Consumer', 'Installer', 'ConditionalAction', 'ActionContext', 'LineItems', 'Notes', 'Attachments', 'Relations']))
      
      const fullUrl = `${url}?${searchParams.toString()}`
      console.log('Full URL:', fullUrl)
      
      const response = await fetch(fullUrl, config)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      }
      
      const data = await response.json()
      console.log('Successfully fetched work order detail:', data)
      console.log('Work order ID from response:', data.id)
      
      // The API returns the work order data wrapped in a 'workOrder' property
      const workOrderData = data.workOrder || data
      console.log('Extracted work order data:', workOrderData)
      
      // Transform the work order to match the measurement app's expected format
      return transformWorkOrder(workOrderData)
    } catch (error: any) {
      console.error('Failed to fetch work order:', error)
      throw error
    }
  }

  public async updateWorkOrderStatus(
    workOrderId: string,
    action: string,
    payload: any,
    token?: string
  ): Promise<any> {
    try {
      const url = `${API_BASE_URL}/v1/work-order-service/work-orders/${workOrderId}/actions`
      
      const config: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          action,
          ...payload,
        }),
      }
      
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      }
      
      return await response.json()
    } catch (error: any) {
      console.error('Failed to update work order status:', error)
      throw error
    }
  }
}

function transformWorkOrder(workOrder: any): WorkOrder {
  console.log('Transforming work order:', workOrder);
  
  // Handle both 'consumer' and 'customer' properties from different API endpoints
  const consumer = workOrder.consumer || workOrder.customer;
  const dealer = workOrder.dealer;
  
  console.log('Consumer data:', consumer);
  console.log('Dealer data:', dealer);
  console.log('Service type:', workOrder.serviceType);
  console.log('Consumer firstName:', consumer?.firstName);
  console.log('Consumer lastName:', consumer?.lastName);
  console.log('Dealer name:', dealer?.name);
  console.log('Due date from API:', workOrder.dueDate);
  console.log('Follow up date from API:', workOrder.followUpDate);
  console.log('Update due by date from API:', workOrder.updateDueByDate);
  
  const result = {
    id: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber || workOrder.id,
    name: consumer?.name || `${consumer?.firstName || ''} ${consumer?.lastName || ''}`.trim() || workOrder.workOrderNumber || `Work Order ${workOrder.id}`,
    customerName: consumer?.name || `${consumer?.firstName || ''} ${consumer?.lastName || ''}`.trim() || null,
    scheduleDate: workOrder.scheduledDate ? workOrder.scheduledDate.split('T')[0] : null,
    sellerName: dealer?.name || null,
    status: mapWorkOrderStatus(workOrder.status?.name),
    address: workOrder.consumerLocations?.[0]?.location?.address || null,
    phone: consumer?.phoneNumbers?.[0]?.phoneNumber || null,
    followUpDate: workOrder.followUpDate || workOrder.updateDueByDate || workOrder.dueDate || null,
    workType: workOrder.serviceType?.name || null,
    details: {
      summary: workOrder.summary || null,
      instructions: workOrder.notes?.[0]?.note || null,
      work_no: workOrder.briteOrderNumber || null,
      field_ops_rep: workOrder.installer ? `${workOrder.installer.firstName || ''} ${workOrder.installer.lastName || ''}`.trim() : null,
      service_order: workOrder.erpOrderNumber || null,
      work_type: workOrder.serviceType?.name || null,
      additional_visit_needed: workOrder.additionalVisitNeeded || false,
      brand: workOrder.lineItems?.[0]?.brand || null,
      arrival_window_start: workOrder.arrivalWindowStart || null,
      arrival_window_end: workOrder.arrivalWindowEnd || null,
      duration: workOrder.duration || null,
      duration_type: workOrder.durationType || null,
      date_service_delayed: workOrder.dateServiceDelayed || null,
      reason_for_delay: workOrder.reasonForDelay || null,
      contact_attempt_counter: workOrder.contactAttemptCounter || 0,
      time_service_delayed: workOrder.timeServiceDelayed || null,
      date_scheduled: workOrder.scheduledDate || null,
    },
    customer_contact_info: {
      account: consumer?.originalRecordId || null,
      contact_name: consumer?.name || `${consumer?.firstName || ''} ${consumer?.lastName || ''}`.trim() || null,
      home_phone: consumer?.phoneNumbers?.find((p: any) => p?.type === 'HOME')?.phoneNumber || null,
      mobile_phone: consumer?.phoneNumbers?.find((p: any) => p?.type === 'MOBILE')?.phoneNumber || null,
      email: consumer?.emails?.[0]?.email || null,
    },
    seller_contact_info: {
      company: dealer?.name || null,
      contact_name: dealer?.users?.[0] ? `${dealer.users[0].firstName || ''} ${dealer.users[0].lastName || ''}`.trim() : null,
      phone: dealer?.phone || null,
      email: dealer?.email || null,
      secondary_email: dealer?.users?.[0]?.email || null,
      address: dealer?.dealerLocations?.[0]?.location?.address || null,
    },
    payment_info: {
      billed_surcharges: workOrder.billedSurcharges || null,
      payment_status: workOrder.paymentStatus || null,
    },
    related_items: {
      related_work_orders: (workOrder.relations || []).filter((r: any) => r?.relation).map((r: any) => ({ 
        id: r.relation.relatedWorkOrderId, 
        name: r.relatedServiceType?.name 
      })),
      linked_files: (workOrder.attachments || []).filter((a: any) => a).map((a: any) => ({ 
        name: a.name, 
        url: a.url 
      })),
      service_calls: null,
    },
    createdAt: workOrder.createdAt || new Date().toISOString(),
    updatedAt: workOrder.updatedAt || new Date().toISOString(),
  };
  
  console.log('Transformed work order result:', result);
  console.log('Final customer name:', result.customerName);
  console.log('Final customer contact name:', result.customer_contact_info.contact_name);
  console.log('Final seller name:', result.sellerName);
  console.log('Final seller company:', result.seller_contact_info.company);
  console.log('Final follow up date:', result.followUpDate);
  return result;
}

function mapWorkOrderStatus(statusName: string): string {
  const statusMap: Record<string, string> = {
    "New": "Pending Acceptance",
    "Accepted": "Pending Schedule", 
    "Scheduled": "Scheduled",
    "On-Site Complete": "On-Site Complete",
    "Completed": "Complete",
    "Pending Acceptance": "Pending Acceptance",
    "Pending Schedule": "Pending Schedule",
  };
  
  return statusMap[statusName] || "Pending Acceptance";
}

export const workOrdersService = new WorkOrdersService()
export default workOrdersService
