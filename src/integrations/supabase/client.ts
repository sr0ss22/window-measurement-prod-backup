import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Provide fallback values for build time to prevent build failures
  const url = supabaseUrl || 'https://placeholder.supabase.co'
  const key = supabaseAnonKey || 'placeholder-key'

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase environment variables not set. Using placeholder values for build.");
  }

  return createBrowserClient(url, key)
}