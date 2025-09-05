export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://dev.api.hdbrite.com'

export const API_ENDPOINTS = {
  WORK_ORDERS: '/v1/work-order-service/work-orders',
  WORK_ORDER_DETAIL: (id: string) => `/v1/work-order-service/work-orders/${id}`,
  WORK_ORDER_ACTIONS: (id: string) => `/v1/work-order-service/work-orders/${id}/actions`,
} as const

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  VERSION: 'v1',
  TIMEOUT: 10000,
  ENDPOINTS: API_ENDPOINTS,
  HEADERS: {
    'Content-Type': 'application/json',
  },
}

export const getApiUrl = (endpoint: string, version: string = API_CONFIG.VERSION): string => {
  // If the endpoint already starts with http:// or https://, return it as is
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint
  }

  // Remove any leading slashes from endpoint and version
  const cleanEndpoint = endpoint.replace(/^\/+/, '')
  const cleanVersion = version.replace(/^\/+/, '')

  // Combine the parts with single slashes
  return `${API_CONFIG.BASE_URL}/${cleanVersion}/${cleanEndpoint}`
}

export class ApiError extends Error {
  status: number
  data?: Record<string, any>

  constructor(status: number, message: string, data?: Record<string, any>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

export type ApiResponse<T> = {
  data: T
  error?: string
  status: number
  message?: string
}
