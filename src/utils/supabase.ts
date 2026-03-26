import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[Finance Home] Missing Supabase env vars. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local and Vercel settings.'
  )
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseKey ?? 'placeholder',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
)

export type { User, Session } from '@supabase/supabase-js'
