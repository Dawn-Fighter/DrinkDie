import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const SUPABASE_URL = 'https://wcjanyxjrqehfxanjfcn.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjamFueXhqcnFlaGZ4YW5qZmNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzY5MDEsImV4cCI6MjA5NTM1MjkwMX0._L785WtYi1f33WQnZ_DnUvPSB-Fhfz-XbwxZqUgWMjs'

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: false,
  },
})
