import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase.js'

// Thin wrapper around Supabase Auth for the shop's single admin surface. The
// session is kept by supabase-js (in localStorage), so a refresh keeps the owner
// signed in. Authorisation itself is decided by Row Level Security, not here —
// this hook only reports what the session claims.
export function useAdminSession() {
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState(supabaseConfigured ? 'loading' : 'unavailable')

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return undefined
    let cancelled = false

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return
        setSession(data?.session ?? null)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('ready')
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null)
      setStatus('ready')
    })

    return () => {
      cancelled = true
      listener?.subscription?.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  // Creates the owner's account, then signs in so setup finishes in one step.
  const claim = useCallback(async (email, password) => {
    const { error } = await supabase.rpc('claim_admin_account', {
      p_email: email,
      p_password: password,
    })
    if (error) throw error

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError
  }, [])

  return {
    session,
    status,
    isAdmin: session?.user?.app_metadata?.role === 'admin',
    email: session?.user?.email ?? null,
    configured: supabaseConfigured,
    signIn,
    signOut,
    claim,
  }
}
