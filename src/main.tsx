import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Auth from './Auth.tsx'
import { supabase } from './supabase.ts'
import type { Session } from '@supabase/supabase-js'

function Root() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

    if (code) {
      // PKCE: exchange the code for a session
      supabase.auth.exchangeCodeForSession(code).then(({ data }) => {
        window.history.replaceState(null, '', window.location.pathname)
        setSession(data.session)
      })
      return
    }

    const timeout = setTimeout(() => setSession(null), 3000)
    supabase.auth.getSession().then(({ data }) => {
      clearTimeout(timeout)
      setSession(data.session)
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
      <div className="min-h-svh bg-[#faf7ef] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 rounded-full border-4 border-zinc-950 border-t-lime-300 animate-spin" />
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">loading…</p>
        </div>
      </div>
    )
  }

  return session ? <App session={session} /> : <Auth />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
