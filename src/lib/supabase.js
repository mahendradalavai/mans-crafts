import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Never use the service-role key here: this code ships to the browser.
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = supabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null

if (!supabaseConfigured) {
  console.info(
    '[mans-crafts] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — serving the bundled catalogue and sending orders straight to WhatsApp.',
  )
}
