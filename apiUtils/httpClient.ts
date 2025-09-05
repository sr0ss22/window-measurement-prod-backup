/**
 * Base HTTP client for making API requests
 * Handles authentication, error handling, and response parsing
 */

import { API_CONFIG, ApiError, NetworkError } from './config'

class HttpClient {
  private static instance: HttpClient
  private authToken: string | null = null
  private baseURL: string
  private defaultHeaders: Record<string, string>

  private constructor(baseUrl?: string) {
    this.baseURL = baseUrl || API_CONFIG.BASE_URL
    this.defaultHeaders = {
      ...API_CONFIG.HEADERS,
    }
  }

  public static getInstance(baseUrl?: string): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient(baseUrl)
    }
    return HttpClient.instance
  }

  setToken(token: string | null) {
    this.authToken = token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // For CPQ API, we need to construct the full URL with version
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    }

    // Add authentication token if available
    let token = this.authToken;
    
    // If no token was set via setToken, try to get from localStorage
    if (!token && typeof window !== 'undefined') {
      token = localStorage.getItem('auth_token');
    }
    
    if (token) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`,
      }
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT)

      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        let errorData: any = {}
        
        try {
          errorData = JSON.parse(errorText)
        } catch (e) {
          // If parsing fails, use the raw text
          errorData = { message: errorText }
        }

        throw new ApiError(
          response.status,
          errorData.message || `HTTP error! status: ${response.status}`,
          errorData
        )
      }

      const data = await response.json()
      return data
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new NetworkError('Request timeout')
      }
      
      if (error instanceof ApiError) {
        throw error
      }
      
      if (error.message.includes('Failed to fetch')) {
        throw new NetworkError('Network error: Unable to connect to the server. Please check your internet connection.')
      }
      
      throw new NetworkError(error.message || 'An unexpected error occurred')
    }
  }

  public async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`)
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          url.searchParams.append(key, params[key].toString())
        }
      })
    }
    
    return this.request<T>(url.toString(), { method: 'GET' })
  }

  public async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  public async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  public async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  public async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

export const httpClient = HttpClient.getInstance()
export default httpClient
