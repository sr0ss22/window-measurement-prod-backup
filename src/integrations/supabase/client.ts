import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase environment variables NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY are not set!");
    // In a production app, you might want to handle this more gracefully,
    // but for development, this console error helps diagnose missing env vars.
  }

  return createBrowserClient(
    supabaseUrl!, 
    supabaseAnonKey!
  )
}