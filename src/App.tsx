import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import './App.css'
import {
  buildLeaderboard,
  buildScanInsertRows,
  calculateStats,
  parseCanQr,
  scoreScan,
  type DrinkBrand,
  type ScanRecord,
} from './drinks'
import { supabase } from './supabase'
import type { ScanRow } from './database.types'
import type { Session } from '@supabase/supabase-js'

type ChaosStyle = CSSProperties & { '--chaos': number }

function rowToRecord(row: ScanRow): ScanRecord {
  return {
    id: row.id,
    user: row.handle,
    scannedAt: row.scanned_at,
    can: {
      brand: row.brand as DrinkBrand,
      label: row.label,
      ml: row.ml,
      caffeineMg: row.caffeine_mg,
      accent: row.brand === 'monster' ? 'green' : 'red',
    },
    score: { chaos: row.chaos, sleepDebtMinutes: row.sleep_debt },
  }
}

function App({ session }: { session: Session }) {
  const defaultHandle = session.user.user_metadata?.full_name?.split(' ')[0]?.toLowerCase() ?? session.user.email?.split('@')[0] ?? 'you'
  const [user, setUser] = useState(defaultHandle)
  const [intakeDrink, setIntakeDrink] = useState<DrinkBrand>('monster')
  const [showcaseDrink, setShowcaseDrink] = useState<DrinkBrand>('monster')
  const [quantity, setQuantity] = useState(1)
  const [scans, setScans] = useState<ScanRecord[]>([])
  const [scansLoading, setScansLoading] = useState(true)
  const [logging, setLogging] = useState(false)
  const [logStatus, setLogStatus] = useState('pick your can. log the damage.')
  const [logError, setLogError] = useState<string | null>(null)
  const [lastLogged, setLastLogged] = useState<DrinkBrand | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const handleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase
      .from('scans')
      .select('*')
      .order('scanned_at', { ascending: false })
      .then(({ data }) => {
        if (data) setScans(data.map(rowToRecord))
        setScansLoading(false)
      })

    channelRef.current = supabase
      .channel('scans-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scans' }, (payload) => {
        setScans((prev) => [rowToRecord(payload.new as ScanRow), ...prev])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'scans' }, (payload) => {
        setScans((prev) => prev.filter((s) => s.id !== (payload.old as ScanRow).id))
      })
      .subscribe()

    return () => { channelRef.current?.unsubscribe() }
  }, [])

  useEffect(() => {
    supabase.from('profiles').select('handle').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => { if (data?.handle) setUser(data.handle) })
  }, [session.user.id])

  useEffect(() => {
    const timer = setInterval(() => {
      setShowcaseDrink((current) => (current === 'monster' ? 'diet-coke' : 'monster'))
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  function handleUserChange(value: string) {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20)
    setUser(sanitized)
    if (handleSaveTimer.current) clearTimeout(handleSaveTimer.current)
    handleSaveTimer.current = setTimeout(() => {
      const handle = sanitized.trim() || defaultHandle
      supabase.from('profiles').upsert({ id: session.user.id, handle, updated_at: new Date().toISOString() })
    }, 800)
  }

  async function logDrink() {
    if (logging) return
    setLogging(true)
    setLogError(null)

    const payload = intakeDrink === 'monster' ? 'CAN:MONSTER:500' : 'CAN:DIET_COKE:330'
    const can = parseCanQr(payload)
    const score = scoreScan(can)
    const now = new Date().toISOString()
    const handle = user.trim() || defaultHandle

    const rows = buildScanInsertRows({
      can,
      score,
      quantity,
      userId: session.user.id,
      handle,
      scannedAt: now,
      createId: () => crypto.randomUUID(),
    })

    const { error } = await supabase.from('scans').insert(rows)
    setLogging(false)
    if (error) {
      setLogError(error.message.includes('rate_limit') ? 'slow down - max 20 cans per minute.' : error.message)
    } else {
      setLastLogged(can.brand)
      setLogStatus(`${quantity} ${can.label.toLowerCase()} logged. +${can.caffeineMg * quantity}mg aura.`)
    }
  }

  function handleCardClick(brand: DrinkBrand) {
    setShowcaseDrink(showcaseDrink === brand ? (brand === 'monster' ? 'diet-coke' : 'monster') : brand)
  }

  const normalizedUser = user.trim() || defaultHandle
  const stats = useMemo(() => calculateStats(scans, new Date(), normalizedUser), [scans, normalizedUser])
  const leaderboard = useMemo(() => buildLeaderboard(scans), [scans])
  const myScans = useMemo(() => scans.filter((scan) => scan.user === normalizedUser), [scans, normalizedUser])
  const currentChaos = myScans[0]?.score.chaos ?? 0
  const selectedCan = parseCanQr(intakeDrink === 'monster' ? 'CAN:MONSTER:500' : 'CAN:DIET_COKE:330')
  const selectedTotal = selectedCan.caffeineMg * quantity
  const podiumOrder = [leaderboard[1], leaderboard[0], leaderboard[2]]
  const feedItems = scans.slice(0, 10)
  const tickerItems = ['Log Your Can Every Day', 'Make Sleep Nervous', 'Climb The Fridge', 'Farm The Aura']

  const logButtonClass = `primary-button log-button ${intakeDrink === 'monster' ? 'log-button-green' : 'log-button-red'}`
  const mobileLogButtonClass = `rounded-2xl border-2 border-zinc-950 font-black uppercase tracking-[0.18em] transition active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2 h-16 w-full text-sm ${
    intakeDrink === 'monster'
      ? 'bg-lime-300 text-zinc-950 shadow-[0_7px_0_#18181b]'
      : 'bg-red-500 text-white shadow-[0_7px_0_#18181b]'
  }`

  return (
    <main className="app-shell logged-in-shell">
      <div className="mobile-app lg:hidden overflow-x-hidden">
        <section className="hero-section relative overflow-hidden px-3 pt-8 pb-0 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="hero-badges mb-6 flex flex-wrap justify-center gap-2 sm:mb-8">
              <span className="hero-badge bg-zinc-950 text-white">☕ liquid damage</span>
              <span className="hero-badge bg-red-500 text-white">🥤 aspartame gang</span>
              <span className="hero-badge bg-lime-300 text-zinc-950">⚡ taurine speedrun</span>
              <span className="hero-badge border-2 border-zinc-950 bg-transparent text-zinc-950">v2.1 live</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-full text-center">
                <h1 className="hero-headline text-center">
                  <span className="hero-word hero-word-1 block">drink</span>
                  <span className="hero-word hero-word-2 block text-red-500">cans.</span>
                  <span className="hero-word hero-word-3 block">farm</span>
                  <span className="hero-word hero-word-4 block text-lime-500">aura.</span>
                </h1>

                <div className="mt-4 flex flex-col items-center gap-4">
                  <p className="hero-sub max-w-sm text-base font-bold leading-6 text-zinc-600 sm:text-lg">
                    log every can. stack caffeine. climb the fridge. flex completely unnecessary stats on your friends.
                  </p>
                  <a
                    href="#scanner"
                    className="hero-cta shrink-0 rounded-2xl border-2 border-zinc-950 bg-zinc-950 px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_6px_0_rgba(163,230,53,0.9)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_0_rgba(163,230,53,0.9)] active:translate-y-1 active:shadow-none"
                  >
                    log the damage ↓
                  </a>
                </div>

                <div className="hero-ticker mt-6 flex flex-wrap justify-center gap-3">
                  <div className="ticker-chip">
                    <span className="ticker-label">my mg today</span>
                    <strong className="ticker-value">{stats.todayCaffeineMg}</strong>
                  </div>
                  <div className="ticker-chip ticker-chip-red">
                    <span className="ticker-label">sleep debt</span>
                    <strong className="ticker-value">{stats.sleepDebtMinutes}m</strong>
                  </div>
                  <div className="ticker-chip ticker-chip-lime">
                    <span className="ticker-label">my chaos</span>
                    <strong className="ticker-value">{currentChaos}/10</strong>
                  </div>
                </div>
              </div>

              <div className="hero-visual-wrap mt-10 flex justify-center">
                <div className="hero-can-stack">
                  <button
                    className={`hero-can-card hero-can-card-diet-coke ${showcaseDrink === 'diet-coke' ? 'hero-can-card-front' : 'hero-can-card-back'}`}
                    type="button"
                    onClick={() => handleCardClick('diet-coke')}
                  >
                    <span className="hcc-letter">DC</span>
                    <span className="hcc-brand">Diet Coke</span>
                    <span className="hcc-mg">46mg</span>
                  </button>
                  <button
                    className={`hero-can-card hero-can-card-monster ${showcaseDrink === 'monster' ? 'hero-can-card-front' : 'hero-can-card-back'}`}
                    type="button"
                    onClick={() => handleCardClick('monster')}
                  >
                    <span className="hcc-letter">M</span>
                    <span className="hcc-brand">Monster</span>
                    <span className="hcc-mg">160mg</span>
                  </button>
                  <div className="hero-float-badge">⚡ peak aura</div>
                  <div className="hero-chaos-badge">chaos {currentChaos}/10</div>
                </div>
              </div>
            </div>

            <div className="hero-img-wrap mt-8 sm:mt-10">
              <img className="hero-img" src="/assets/can-damage-hero.png" alt="Stylized Diet Coke and Monster cans" />
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden py-3 sm:py-4">
          <div className="marquee-strip border-y-4 border-zinc-950 bg-zinc-950 py-3 text-white shadow-[0_12px_0_rgba(24,24,27,0.08)] sm:py-4">
            <div className="marquee-ltr flex w-max gap-8 whitespace-nowrap text-2xl font-black uppercase sm:text-5xl">
              {Array.from({ length: 2 }).map((_, group) => (
                <div key={group} className="flex min-w-max gap-8">
                  <span>log the can</span>
                  <span className="text-lime-300">rank the damage</span>
                  <span className="text-red-400">protect the streak</span>
                  <span>farm the aura</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="scanner" className="px-3 pt-6 pb-12 sm:px-6 sm:pb-16">
          <div className="mx-auto grid gap-5">
            <div className="rounded-[1.6rem] border-[3px] border-zinc-950 bg-white p-3 shadow-[6px_6px_0_#18181b] sm:rounded-[2rem] sm:p-6 sm:shadow-[10px_10px_0_#18181b]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">manual intake</p>
                  <h2 className="mt-1 text-4xl font-black uppercase sm:text-6xl">can drop</h2>
                </div>
                <span className={`rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] ${intakeDrink === 'monster' ? 'bg-lime-300 text-zinc-950' : 'bg-red-500 text-white'}`}>
                  {selectedCan.caffeineMg}mg
                </span>
              </div>

              <div className={`can-drop-card my-4 overflow-hidden rounded-[1.55rem] border-2 border-zinc-950 p-4 text-white sm:my-5 sm:p-5 ${intakeDrink === 'monster' ? 'bg-zinc-950' : 'bg-red-500'}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-950">@{normalizedUser}</span>
                  <span className="rounded-full border border-white/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]">{quantity}x can</span>
                </div>

                <div className="grid min-h-64 place-items-center py-5">
                  <div className={`can-token ${lastLogged === intakeDrink ? 'can-token-pop' : ''} ${intakeDrink === 'monster' ? 'monster-token' : 'diet-token'}`}>
                    <span>{intakeDrink === 'monster' ? 'M' : 'DC'}</span>
                    <strong>{selectedCan.label}</strong>
                    <small>{selectedCan.caffeineMg}mg each</small>
                  </div>
                </div>

                <div className="rounded-[1.25rem] bg-white p-3 text-zinc-950">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">this drop</span>
                    <strong className="text-2xl font-black">{selectedTotal}mg</strong>
                  </div>
                  <p className="mt-1 text-xs font-bold lowercase text-zinc-500">{logStatus}</p>
                  {logError && <p className="mt-1 text-xs font-bold text-red-500">{logError}</p>}
                </div>
              </div>

              <div className="grid gap-3">
                <label className="grid gap-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                  handle
                  <input
                    className="h-12 rounded-2xl border-2 border-zinc-950 bg-[#faf7ef] px-4 text-base font-bold normal-case tracking-normal text-zinc-950 outline-none focus:ring-4 focus:ring-lime-300"
                    value={user}
                    onChange={(event) => handleUserChange(event.target.value)}
                    placeholder={defaultHandle}
                    maxLength={20}
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`h-14 rounded-2xl border-2 border-zinc-950 text-xs font-black uppercase tracking-[0.14em] transition active:translate-y-0.5 ${intakeDrink === 'monster' ? 'bg-lime-300 text-zinc-950 shadow-[0_5px_0_#18181b]' : 'bg-white text-zinc-500'}`}
                    type="button"
                    onClick={() => setIntakeDrink('monster')}
                  >
                    Monster
                  </button>
                  <button
                    className={`h-14 rounded-2xl border-2 border-zinc-950 text-xs font-black uppercase tracking-[0.14em] transition active:translate-y-0.5 ${intakeDrink === 'diet-coke' ? 'bg-red-500 text-white shadow-[0_5px_0_#18181b]' : 'bg-white text-zinc-500'}`}
                    type="button"
                    onClick={() => setIntakeDrink('diet-coke')}
                  >
                    Diet Coke
                  </button>
                </div>

                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border-2 border-zinc-950 bg-[#faf7ef] p-2">
                  <button
                    className="grid size-10 place-items-center rounded-xl bg-zinc-950 text-xl font-black text-white disabled:opacity-30"
                    type="button"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    disabled={quantity === 1}
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">quantity</p>
                    <p className="text-2xl font-black">{quantity}</p>
                  </div>
                  <button
                    className="grid size-10 place-items-center rounded-xl bg-zinc-950 text-xl font-black text-white"
                    type="button"
                    onClick={() => setQuantity((current) => Math.min(9, current + 1))}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <button className={mobileLogButtonClass} type="button" onClick={logDrink} disabled={logging}>
                  {logging && <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />}
                  {logging ? 'logging…' : 'log the damage'}
                </button>
              </div>
            </div>

            <section className="mobile-podium-wrap" aria-labelledby="mobile-podium-title">
              <div className="leaderboard-copy">
                <h2 id="mobile-podium-title">Can podium</h2>
                <p>The weekly table for people who turned caffeine into a ranked sporting event.</p>
              </div>
              {leaderboard.length ? (
                <div className="podium-stage" aria-label="Can leaderboard podium">
                  {podiumOrder.map((entry, visualIndex) => {
                    if (!entry) return <div key={`mobile-empty-${visualIndex}`} className="podium-spacer" />
                    const rank = visualIndex === 0 ? 2 : visualIndex === 1 ? 1 : 3
                    const className = visualIndex === 0 ? 'second' : visualIndex === 1 ? 'first' : 'third'
                    return (
                      <article key={entry.user} className={`podium-person ${className}`}>
                        <div className={rank === 1 ? 'avatar-head champion' : 'avatar-head'}>
                          {entry.user.trim().charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="stick-body" aria-hidden="true"><span /></div>
                        <div className="podium-block">
                          <strong>{rank}</strong>
                          <span>@{entry.user}</span>
                          <small>{entry.caffeineMg}mg stacked</small>
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="podium-empty">
                  <strong>No rankings yet</strong>
                  <span>Drop the first can and claim the fridge.</span>
                </div>
              )}
            </section>

            <div className="stat-cards-grid grid grid-cols-2 gap-3">
              <div className="stat-card rounded-[1.6rem] border-4 border-zinc-950 bg-zinc-950 p-5 text-white shadow-[6px_6px_0_rgba(163,230,53,0.8)]">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">my mg today</p>
                <p className="mt-1 text-4xl font-black leading-none">{stats.todayCaffeineMg}<span className="text-lg text-lime-300">mg</span></p>
                <p className="mt-2 text-xs font-bold text-zinc-500">{stats.monsterCans}⚡m · {stats.dietCokeCans}🥤dc</p>
              </div>
              <div className="stat-card rounded-[1.6rem] border-4 border-zinc-950 bg-red-500 p-5 text-white shadow-[6px_6px_0_#18181b]">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-200">sleep debt</p>
                <p className="mt-1 text-4xl font-black leading-none">{stats.sleepDebtMinutes}<span className="text-lg">m</span></p>
                <p className="mt-2 text-xs font-bold text-red-200">lost tonight</p>
              </div>
              <div className="stat-card col-span-2 rounded-[1.6rem] border-4 border-zinc-950 bg-white p-5 shadow-[6px_6px_0_#18181b]">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">my chaos index</p>
                <div className="mt-2 flex items-end gap-2">
                  <div className="chaos-bar-wrap flex-1">
                    {myScans.slice(0, 7).map((scan) => (
                      <div
                        key={scan.id}
                        className="chaos-bar"
                        style={{ '--chaos': scan.score.chaos } as ChaosStyle}
                        title={`chaos ${scan.score.chaos}/10`}
                      />
                    ))}
                    {!myScans.length && <span className="empty-mini">No chaos yet</span>}
                  </div>
                  <p className="text-2xl font-black">
                    {currentChaos}
                    <span className="text-xs font-bold text-zinc-400">/10</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="mobile-footer">
          <p>© {new Date().getFullYear()} can damage. all rights stack.</p>
          <nav aria-label="Mobile footer links">
            <a href="https://www.instagram.com/chethas.dileep?igsh=MWZpem5wNXk3YjcyYw%3D%3D&utm_source=qr" target="_blank" rel="noopener">instagram</a>
            <span>•</span>
            <a href="https://www.linkedin.com/in/chethasdileep/" target="_blank" rel="noopener">linkedin</a>
            <span>•</span>
            <a href="https://github.com/Dawn-Fighter/DrinkDie" target="_blank" rel="noopener">github</a>
            <span>•</span>
            <button type="button" onClick={() => supabase.auth.signOut()}>sign out</button>
          </nav>
        </footer>
      </div>

      <div className="desktop-app hidden lg:block">
      <section className="landing-frame">
        <nav className="landing-nav" aria-label="Primary">
          <a className="brand-mark" href="/" aria-label={`${normalizedUser} home`}>
            <span className="brand-logo">{normalizedUser.slice(0, 2).toUpperCase()}</span>
            <span className="brand-name">@{normalizedUser}</span>
          </a>
          <div className="nav-actions">
            <a className="nav-link" href="#podium">Podium</a>
            <a className="nav-link" href="#feed">Feed</a>
            <button className="nav-cta" type="button" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </div>
        </nav>

        <div className="area-hero">
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
                Log every can, stack caffeine, climb the fridge, and flex completely unnecessary stats on your friends.
              </p>

              <div className="quick-log-card hidden lg:grid" id="scanner">
                <div className="quick-log-head">
                  <div>
                    <p className="section-kicker">Manual intake</p>
                    <h2>Can drop</h2>
                  </div>
                  <strong>{selectedTotal}mg</strong>
                </div>

                <label className="field">
                  <span>Handle</span>
                  <input
                    value={user}
                    onChange={(event) => handleUserChange(event.target.value)}
                    placeholder={defaultHandle}
                    maxLength={20}
                  />
                </label>

                <div className="choice-grid" aria-label="Choose drink">
                  <button
                    className={intakeDrink === 'monster' ? 'choice-button is-active-green' : 'choice-button'}
                    type="button"
                    onClick={() => setIntakeDrink('monster')}
                  >
                    Monster
                  </button>
                  <button
                    className={intakeDrink === 'diet-coke' ? 'choice-button is-active-red' : 'choice-button'}
                    type="button"
                    onClick={() => setIntakeDrink('diet-coke')}
                  >
                    Diet Coke
                  </button>
                </div>

                <div className="stepper" aria-label="Quantity">
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    disabled={quantity === 1}
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <div>
                    <span>Quantity</span>
                    <strong>{quantity}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.min(9, current + 1))}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <button className={logButtonClass} type="button" onClick={logDrink} disabled={logging}>
                  {logging ? 'Logging...' : 'Log damage'}
                </button>

                <p className="status-line">{logStatus}</p>
                {logError && <p className="error-line">{logError}</p>}
              </div>

            </div>

            <div className="area-stat">
              <div className="area-stat-copy">
                <strong>{leaderboard.length || 1}</strong>
                <span>Aura farmers</span>
              </div>
              <div className="mini-stat-row" aria-label="Your stats">
                <span>{stats.todayCaffeineMg}mg today</span>
                <span>{stats.sleepDebtMinutes}m debt</span>
                <span>{currentChaos}/10 chaos</span>
              </div>
            </div>
          </div>

          <div className="area-image">
            <img src="/assets/can-damage-hero.png" alt="Stylized energy drink can" />
            <span className="area-badge badge-live">Live fridge</span>
            <span className="area-badge badge-total">{selectedTotal}mg queued</span>
            <span className="area-badge badge-user">@{normalizedUser}</span>
          </div>
        </div>

      </section>

      <section className="showcase-section">
        <div className="aura-copy">
          <p className="section-kicker">Interactive aura</p>
          <h2>Pick the damage</h2>
          <p>
            Tap a can to flip the focus. The logger stays ready, the numbers stay live, and the chaos stays visible.
          </p>
        </div>
        <div className="aura-stage" aria-label="Interactive can cards">
          <div className="hero-can-stack">
            <button
              className={`hero-can-card hero-can-card-diet-coke ${showcaseDrink === 'diet-coke' ? 'hero-can-card-front' : 'hero-can-card-back'}`}
              type="button"
              onClick={() => handleCardClick('diet-coke')}
            >
              <span className="hcc-letter">DC</span>
              <span className="hcc-brand">Diet Coke</span>
              <span className="hcc-mg">46mg</span>
            </button>
            <button
              className={`hero-can-card hero-can-card-monster ${showcaseDrink === 'monster' ? 'hero-can-card-front' : 'hero-can-card-back'}`}
              type="button"
              onClick={() => handleCardClick('monster')}
            >
              <span className="hcc-letter">M</span>
              <span className="hcc-brand">Monster</span>
              <span className="hcc-mg">160mg</span>
            </button>
            <div className="floating-chip chip-aura">Peak aura</div>
            <div className="floating-chip chip-chaos">Chaos {currentChaos}/10</div>
          </div>
        </div>
      </section>

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

      <section id="podium" className="leaderboard-section" aria-labelledby="leaderboard-title">
        <div className="leaderboard-copy">
          <h2 id="leaderboard-title">Can podium</h2>
          <p>The weekly table for people who turned caffeine into a ranked sporting event.</p>
        </div>

        {leaderboard.length ? (
          <div className="podium-stage" aria-label="Can leaderboard podium">
            {podiumOrder.map((entry, visualIndex) => {
              if (!entry) return <div key={`empty-${visualIndex}`} className="podium-spacer" />
              const rank = visualIndex === 0 ? 2 : visualIndex === 1 ? 1 : 3
              const className = visualIndex === 0 ? 'second' : visualIndex === 1 ? 'first' : 'third'
              return (
                <article key={entry.user} className={`podium-person ${className}`}>
                  <div className={rank === 1 ? 'avatar-head champion' : 'avatar-head'}>
                    {entry.user.trim().charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="stick-body" aria-hidden="true"><span /></div>
                  <div className="podium-block">
                    <strong>{rank}</strong>
                    <span>@{entry.user}</span>
                    <small>{entry.caffeineMg}mg stacked</small>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="podium-empty">
            <strong>No rankings yet</strong>
            <span>Drop the first can and claim the fridge.</span>
          </div>
        )}
      </section>

      <section className="dashboard-section" aria-label="Your drink dashboard">
        <div className="stats-grid">
          <article className="life-card">
            <span className="stat-label">My mg today</span>
            <strong>{stats.todayCaffeineMg}mg</strong>
            <em>{stats.monsterCans} monster / {stats.dietCokeCans} diet coke</em>
          </article>
          <article>
            <span className="stat-label">Sleep debt</span>
            <strong>{stats.sleepDebtMinutes}m</strong>
          </article>
          <article>
            <span className="stat-label">Chaos score</span>
            <strong>{currentChaos}/10</strong>
          </article>
          <article>
            <span className="stat-label">Fridge scans</span>
            <strong>{scans.length}</strong>
          </article>
        </div>

        <div className="activity-card">
          <div>
            <p className="section-kicker">Chaos timeline</p>
            <h3>Your latest drops</h3>
          </div>
          <div className="chaos-bar-wrap">
            {myScans.slice(0, 14).map((scan) => (
              <div
                key={scan.id}
                className="chaos-bar"
                style={{ '--chaos': scan.score.chaos } as ChaosStyle}
                title={`chaos ${scan.score.chaos}/10`}
              />
            ))}
            {!myScans.length && <span className="empty-mini">No chaos yet</span>}
          </div>
        </div>

        <div id="feed" className="history">
          <div className="history-head">
            <h3>Live damage feed</h3>
            <span>{scans.length} total</span>
          </div>

          {scansLoading ? (
            <div className="feed-skeleton">
              <span />
              <span />
              <span />
            </div>
          ) : scans.length === 0 ? (
            <div className="empty-state">
              <strong>No damage logged yet</strong>
              <span>The fridge is clean. Suspiciously clean.</span>
            </div>
          ) : (
            <ul>
              {feedItems.map((scan) => (
                <li key={scan.id}>
                  <div>
                    <strong>@{scan.user} logged {scan.can.label}</strong>
                    <span>
                      {new Date(scan.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <b className={scan.can.brand === 'monster' ? 'green-text' : 'red-text'}>
                    +{scan.can.caffeineMg}mg
                  </b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="site-footer" aria-label="Footer">
        <nav className="footer-links" aria-label="Footer links">
          <a href="https://github.com/Dawn-Fighter/DrinkDie" target="_blank" rel="noopener">GitHub</a>
          <a href="https://www.instagram.com/chethas.dileep?igsh=MWZpem5wNXk3YjcyYw%3D%3D&utm_source=qr" target="_blank" rel="noopener">Instagram</a>
          <a href="https://www.linkedin.com/in/chethasdileep/" target="_blank" rel="noopener">LinkedIn</a>
          <button type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </nav>
        <strong aria-hidden="true">DRINKDIE</strong>
      </footer>
      </div>
    </main>
  )
}

export default App
