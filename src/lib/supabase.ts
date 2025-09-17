import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables not found. Please ensure your Supabase integration is properly configured.')
  throw new Error('Supabase configuration is missing. Please check your Supabase integration.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)