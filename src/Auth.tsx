import { useState } from 'react'
import { supabase } from './supabase'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tickerItems = ['Log Your Can Every Day', 'Make Sleep Nervous', 'Climb The Fridge', 'Farm The Aura']

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
    <main className="app-shell">
      <section className="landing-frame">
        <nav className="landing-nav" aria-label="Primary">
          <a className="brand-mark" href="/" aria-label="DrinkDie home">
            <span className="brand-logo">DD</span>
            <span className="brand-name">drinkdie</span>
          </a>
          <button className="nav-cta" type="button" onClick={signInWithGoogle} disabled={loading}>
            Sign in
          </button>
        </nav>

        <div className="area-hero auth-hero">
          <div className="area-left">
            <div className="area-panel">
              <div>
                <p className="section-kicker">Liquid damage club</p>
                <h1 className="area-title">
                  Drink <span className="area-mark area-mark-red">cans.</span>
                  <br />
                  Farm <span className="area-mark">aura.</span>
                </h1>
              </div>

              <p className="area-desc">
                Sign in to log your damage, climb the fridge, and keep your caffeine crimes publicly ranked.
              </p>

              {error && <p className="error-line auth-error">{error}</p>}

              <button
                className="primary-button google-login"
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
                {loading ? 'Redirecting...' : 'Continue with Google'}
              </button>

            </div>
          </div>

          <div className="area-image">
            <img src="/assets/can-damage-hero.png" alt="Stylized energy drink can" />
            <span className="area-badge badge-live">Public leaderboard</span>
            <span className="area-badge badge-total">Caffeine stats</span>
            <span className="area-badge badge-user">Aura farming</span>
          </div>
        </div>

        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {Array.from({ length: 4 }).map((_, group) => (
              <div key={group} className="ticker-group">
                {tickerItems.map((item) => (
                  <span key={`${group}-${item}`}>{item}<b>*</b></span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <footer className="site-footer auth-footer" aria-label="Footer">
          <nav className="footer-links" aria-label="Footer links">
            <a href="https://github.com/Dawn-Fighter/DrinkDie" target="_blank" rel="noopener">GitHub</a>
            <a href="https://www.instagram.com/chethas.dileep?igsh=MWZpem5wNXk3YjcyYw%3D%3D&utm_source=qr" target="_blank" rel="noopener">Instagram</a>
            <a href="https://www.linkedin.com/in/chethasdileep/" target="_blank" rel="noopener">LinkedIn</a>
          </nav>
          <strong aria-hidden="true">DRINKDIE</strong>
        </footer>
      </section>
    </main>
  )
}
