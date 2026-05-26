import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wcjanyxjrqehfxanjfcn.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_6YFAYq3DQcEu7NEQz5uvqQ_1K0F4yh7'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient<any>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'pkce',
  },
})
