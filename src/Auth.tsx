import { useState } from 'react'
import { supabase } from './supabase'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signInWithGoogle() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}`,
        queryParams: {
          prompt: 'select_account',  // always show account picker
          access_type: 'online',
        },
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh bg-[#faf7ef] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[2rem] border-4 border-zinc-950 bg-white p-8 shadow-[10px_10px_0_#18181b]">
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="hero-badge bg-zinc-950 text-white">☕ liquid damage</span>
          <span className="hero-badge bg-lime-300 text-zinc-950">⚡ taurine speedrun</span>
        </div>

        <h1 className="text-5xl font-black uppercase tracking-[-0.05em] leading-[0.85] text-zinc-950">
          drink<br />
          <span className="text-red-500">cans.</span><br />
          farm<br />
          <span className="text-lime-500">aura.</span>
        </h1>

        <p className="mt-4 text-sm font-bold text-zinc-500 leading-relaxed">
          sign in to log your damage and climb the fridge.
        </p>

        {error && (
          <p className="mt-4 rounded-xl border-2 border-red-500 bg-red-50 px-4 py-2 text-xs font-bold text-red-600">
            {error}
          </p>
        )}

        <button
          className="mt-6 w-full h-14 rounded-2xl border-2 border-zinc-950 bg-zinc-950 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_6px_0_rgba(163,230,53,0.9)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_0_rgba(163,230,53,0.9)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:translate-y-0 disabled:shadow-[0_4px_0_rgba(163,230,53,0.6)] flex items-center justify-center gap-3"
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {loading ? 'redirecting…' : 'continue with google'}
        </button>

        <p className="mt-4 text-center text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
          farm aura responsibly
        </p>
      </div>
    </div>
  )
}
