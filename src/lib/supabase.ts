import { createClient } from '@supabase/supabase-js'
import { fetchWithTimeout } from '../utils/requestTimeout'
import { TIMEOUT_REFRESH_MESSAGE } from '../utils/errorHandler'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

const supabaseFetch = (input: RequestInfo | URL, init?: RequestInit) =>
  fetchWithTimeout(input, { ...init, timeoutMessage: TIMEOUT_REFRESH_MESSAGE })

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: supabaseFetch
  }
})
