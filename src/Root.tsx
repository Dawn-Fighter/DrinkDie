import { useEffect, useState } from 'react'
import App from './App.tsx'
import Auth from './Auth.tsx'
import { completeAuthRedirect } from './authFlow.ts'
import { supabase } from './supabase.ts'
import type { Session } from '@supabase/supabase-js'

export default function Root() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

    const timeout = setTimeout(() => setSession(null), 3000)
    completeAuthRedirect({
      code,
      pathname: window.location.pathname,
      exchangeCodeForSession: supabase.auth.exchangeCodeForSession.bind(supabase.auth),
      getSession: supabase.auth.getSession.bind(supabase.auth),
      replaceUrl: (url) => window.history.replaceState(null, '', url),
    }).then((nextSession) => {
      clearTimeout(timeout)
      setSession(nextSession)
    }).catch(() => {
      clearTimeout(timeout)
      setSession(null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' && window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    })
    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  if (session === undefined) {
    return (
      <div className="app-shell loading-shell">
        <div className="loading-card">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Checking the fridge...</p>
        </div>
      </div>
    )
  }

  return session ? <App session={session} /> : <Auth />
}
