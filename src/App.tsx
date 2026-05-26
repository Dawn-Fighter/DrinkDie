import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  buildLeaderboard,
  calculateStats,
  parseCanQr,
  scoreScan,
  type DrinkBrand,
  type ScanRecord,
} from './drinks'
import { supabase } from './supabase'
import type { ScanRow } from './database.types'
import type { Session } from '@supabase/supabase-js'

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
  const [drink, setDrink] = useState<DrinkBrand>('monster')
  const [quantity, setQuantity] = useState(1)
  const [scans, setScans] = useState<ScanRecord[]>([])
  const [scansLoading, setScansLoading] = useState(true)
  const [logging, setLogging] = useState(false)
  const [logStatus, setLogStatus] = useState('pick your can. log the damage.')
  const [logError, setLogError] = useState<string | null>(null)
  const [lastLogged, setLastLogged] = useState<DrinkBrand | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const handleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load all scans + subscribe to realtime changes
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

  // Load persisted handle
  useEffect(() => {
    supabase.from('profiles').select('handle').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => { if (data?.handle) setUser(data.handle) })
  }, [session.user.id])

  const normalizedUser = user.trim() || defaultHandle
  const stats = useMemo(() => calculateStats(scans, new Date(), normalizedUser), [scans, normalizedUser])
  const leaderboard = useMemo(() => buildLeaderboard(scans), [scans])
  const podium = leaderboard.slice(0, 3)

  // Auto-rotate hero cards — no `drink` dep to avoid restart loop
  useEffect(() => {
    const timer = setInterval(() => {
      setDrink((current) => (current === 'monster' ? 'diet-coke' : 'monster'))
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  // Debounced handle persistence with sanitization
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

    const payload = drink === 'monster' ? 'CAN:MONSTER:500' : 'CAN:DIET_COKE:330'
    const can = parseCanQr(payload)
    const score = scoreScan(can)
    const now = new Date().toISOString()
    const handle = user.trim() || defaultHandle

    const rows = Array.from({ length: quantity }, (_, i) => ({
      id: `${crypto.randomUUID()}-${i}`,
      user_id: session.user.id,
      handle,
      scanned_at: now,
      brand: can.brand as string,
      label: can.label,
      ml: can.ml,
      caffeine_mg: can.caffeineMg,
      chaos: score.chaos,
      sleep_debt: score.sleepDebtMinutes,
    }))

    const { error } = await supabase.from('scans').insert(rows)
    setLogging(false)
    if (error) {
      setLogError(error.message.includes('rate_limit') ? 'slow down — max 20 cans per minute.' : 'failed to log. try again.')
    } else {
      setLastLogged(can.brand)
      setLogStatus(`${quantity} ${can.label.toLowerCase()} logged. +${can.caffeineMg * quantity}mg aura.`)
    }
  }

  function handleCardClick(brand: DrinkBrand) {
    setDrink(drink === brand ? (brand === 'monster' ? 'diet-coke' : 'monster') : brand)
  }

  const selectedCan = parseCanQr(drink === 'monster' ? 'CAN:MONSTER:500' : 'CAN:DIET_COKE:330')
  const selectedTotal = selectedCan.caffeineMg * quantity

  // Shared "log the damage" button renderer to avoid duplication
  const logBtn = (extraClass = '') => (
    <button
      className={`rounded-2xl border-2 border-zinc-950 font-black uppercase tracking-[0.18em] text-zinc-950 transition active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${drink === 'monster' ? 'bg-lime-300 shadow-[0_7px_0_#18181b]' : 'bg-red-500 text-white shadow-[0_7px_0_#18181b]'} ${extraClass}`}
      type="button"
      onClick={logDrink}
      disabled={logging}
    >
      {logging && <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />}
      {logging ? 'logging…' : 'log the damage'}
    </button>
  )

  // Loading skeleton for feed
  const feedSkeleton = (
    <div className="flex flex-col gap-2 animate-pulse">
      {[1,2,3].map(i => <div key={i} className="h-8 rounded-xl bg-zinc-100" />)}
    </div>
  )

  return (
    <div className="min-h-svh bg-[#faf7ef] text-zinc-950">
      {/* ── MOBILE LAYOUT (hidden on desktop) ── */}
      <div className="lg:hidden overflow-x-hidden">
        <main className="min-h-svh bg-[#faf7ef] text-zinc-950">
          {/* ── HERO ── */}
          <section className="hero-section relative overflow-hidden px-3 pt-8 pb-0 sm:px-6">
            {/* Animated gradient orbs */}
            <div className="hero-orb hero-orb-1" aria-hidden="true" />
            <div className="hero-orb hero-orb-2" aria-hidden="true" />
            <div className="hero-orb hero-orb-3" aria-hidden="true" />

            {/* Noise texture overlay */}
            <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03]"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
            />

            <div className="mx-auto max-w-6xl">
              {/* Pill badges row */}
              <div className="hero-badges mb-6 flex flex-wrap justify-center gap-2 sm:mb-8">
                <span className="hero-badge bg-zinc-950 text-white">☕ liquid damage</span>
                <span className="hero-badge bg-red-500 text-white">🥤 aspartame gang</span>
                <span className="hero-badge bg-lime-300 text-zinc-950">⚡ taurine speedrun</span>
                <span className="hero-badge border-2 border-zinc-950 bg-transparent text-zinc-950">v2.1 live</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-full text-center">
                  {/* Main headline — stacked oversized words */}
                  <h1 className="hero-headline text-center">
                    <span className="hero-word hero-word-1 block">drink</span>
                    <span className="hero-word hero-word-2 block text-red-500">cans.</span>
                    <span className="hero-word hero-word-3 block">farm</span>
                    <span className="hero-word hero-word-4 block text-lime-500">aura.</span>
                  </h1>

                  {/* Sub-copy + CTA row */}
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

                  {/* Live ticker stats */}
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
                      <strong className="ticker-value">{scans.find(s => s.user === normalizedUser)?.score.chaos ?? 0}/10</strong>
                    </div>
                  </div>
                </div>

                {/* Hero visual — stacked can cards */}
                <div className="hero-visual-wrap mt-10 flex justify-center">
                  <div className="hero-can-stack">
                    {/* Diet Coke Card */}
                    <div
                      className={`hero-can-card hero-can-card-diet-coke transition-all duration-300 ${drink === 'diet-coke' ? 'hero-can-card-front' : 'hero-can-card-back'}`}
                      onClick={() => handleCardClick('diet-coke')}
                    >
                      <span className="hcc-letter">DC</span>
                      <span className="hcc-brand">Diet Coke</span>
                      <span className="hcc-mg">46mg</span>
                    </div>
                    {/* Monster Card */}
                    <div
                      className={`hero-can-card hero-can-card-monster transition-all duration-300 ${drink === 'monster' ? 'hero-can-card-front' : 'hero-can-card-back'}`}
                      onClick={() => handleCardClick('monster')}
                    >
                      <span className="hcc-letter">M</span>
                      <span className="hcc-brand">Monster</span>
                      <span className="hcc-mg">160mg</span>
                      {drink === 'monster' && <div className="hcc-glow" />}
                    </div>
                    {/* Floating badge */}
                    <div className="hero-float-badge">
                      <span>⚡</span> peak aura
                    </div>
                    {/* Chaos counter */}
                    <div className="hero-chaos-badge">chaos {scans.find(s => s.user === normalizedUser)?.score.chaos ?? 0}/10</div>
                  </div>
                </div>
              </div>

              {/* Hero image — full bleed, clipped at bottom */}
              <div className="hero-img-wrap mt-8 sm:mt-10">
                <img
                  className="hero-img"
                  src="/assets/can-damage-hero.png"
                  alt="Stylized Diet Coke and Monster cans"
                />
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden py-3 sm:py-4">
            <div className="marquee-strip border-y-4 border-zinc-950 bg-zinc-950 py-3 text-white shadow-[0_12px_0_rgba(24,24,27,0.08)] sm:py-4">
              <div className="marquee-ltr flex w-max gap-8 whitespace-nowrap text-2xl font-black uppercase tracking-[-0.04em] sm:text-5xl">
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
                    <h2 className="mt-1 text-4xl font-black uppercase tracking-[-0.06em] sm:text-6xl">can drop</h2>
                  </div>
                  <span className={`rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] ${drink === 'monster' ? 'bg-lime-300 text-zinc-950' : 'bg-red-500 text-white'}`}>
                    {selectedCan.caffeineMg}mg
                  </span>
                </div>

                <div className={`can-drop-card my-4 overflow-hidden rounded-[1.55rem] border-2 border-zinc-950 p-4 text-white sm:my-5 sm:p-5 ${drink === 'monster' ? 'bg-zinc-950' : 'bg-red-500'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-950">@{normalizedUser}</span>
                    <span className="rounded-full border border-white/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]">{quantity}x can</span>
                  </div>

                  <div className="grid min-h-64 place-items-center py-5">
                    <div className={`can-token ${lastLogged === drink ? 'can-token-pop' : ''} ${drink === 'monster' ? 'monster-token' : 'diet-token'}`}>
                      <span>{drink === 'monster' ? 'M' : 'DC'}</span>
                      <strong>{selectedCan.label}</strong>
                      <small>{selectedCan.caffeineMg}mg each</small>
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] bg-white p-3 text-zinc-950">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">this drop</span>
                      <strong className="text-2xl font-black tracking-[-0.04em]">{selectedTotal}mg</strong>
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
                      onChange={(e) => handleUserChange(e.target.value)}
                      placeholder={defaultHandle}
                      maxLength={20}
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className={`h-14 rounded-2xl border-2 border-zinc-950 text-xs font-black uppercase tracking-[0.14em] transition active:translate-y-0.5 ${drink === 'monster' ? 'bg-lime-300 text-zinc-950 shadow-[0_5px_0_#18181b]' : 'bg-white text-zinc-500'}`}
                      type="button"
                      onClick={() => setDrink('monster')}
                    >
                      Monster
                    </button>
                    <button
                      className={`h-14 rounded-2xl border-2 border-zinc-950 text-xs font-black uppercase tracking-[0.14em] transition active:translate-y-0.5 ${drink === 'diet-coke' ? 'bg-red-500 text-white shadow-[0_5px_0_#18181b]' : 'bg-white text-zinc-500'}`}
                      type="button"
                      onClick={() => setDrink('diet-coke')}
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

                  {logBtn('h-16 w-full text-sm')}
                </div>
              </div>

              <div className="grid gap-5 mt-4">
                <div className="rounded-[2rem] border-4 border-zinc-950 bg-lime-300 p-5 shadow-[10px_10px_0_#18181b] sm:p-7">
                  <p className="text-xs font-black uppercase tracking-[0.18em]">weekly board</p>
                  <h2 className="mt-1 text-5xl font-black uppercase leading-[0.82] tracking-[-0.07em] sm:text-7xl">top fridge</h2>
                  <div className="mt-6 grid grid-cols-3 items-end gap-3">
                    {podium.map((entry, index) => (
                      <div
                        key={entry.user}
                        className={`rounded-t-[1.5rem] border-3 border-zinc-950 bg-white p-3 text-center shadow-sm ${index === 0 ? 'min-h-48' : index === 1 ? 'min-h-40' : 'min-h-32'}`}
                      >
                        <p className="text-4xl font-black">{index + 1}</p>
                        <p className="mt-2 truncate text-lg font-black">@{entry.user}</p>
                        <p className="text-xs font-black uppercase text-zinc-500">{entry.caffeineMg}mg</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="stat-cards-grid grid grid-cols-2 gap-3">
                  <div className="stat-card rounded-[1.6rem] border-4 border-zinc-950 bg-zinc-950 p-5 text-white shadow-[6px_6px_0_rgba(163,230,53,0.8)]">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">my mg today</p>
                    <p className="mt-1 text-4xl font-black leading-none tracking-[-0.07em]">{stats.todayCaffeineMg}<span className="text-lg text-lime-300">mg</span></p>
                    <p className="mt-2 text-xs font-bold text-zinc-500">{stats.monsterCans}⚡m · {stats.dietCokeCans}🥤dc</p>
                  </div>
                  <div className="stat-card rounded-[1.6rem] border-4 border-zinc-950 bg-red-500 p-5 text-white shadow-[6px_6px_0_#18181b]">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-200">sleep debt</p>
                    <p className="mt-1 text-4xl font-black leading-none tracking-[-0.07em]">{stats.sleepDebtMinutes}<span className="text-lg">m</span></p>
                    <p className="mt-2 text-xs font-bold text-red-200">lost tonight</p>
                  </div>
                  <div className="stat-card col-span-2 rounded-[1.6rem] border-4 border-zinc-950 bg-white p-5 shadow-[6px_6px_0_#18181b]">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">my chaos index</p>
                    <div className="mt-2 flex items-end gap-2">
                      <div className="chaos-bar-wrap flex-1">
                        {scans.filter(s => s.user === normalizedUser).slice(0, 7).map((scan) => (
                          <div
                            key={scan.id}
                            className="chaos-bar"
                            style={{ '--chaos': scan.score.chaos } as React.CSSProperties}
                            title={`chaos ${scan.score.chaos}/10`}
                          />
                        ))}
                      </div>
                      <p className="text-2xl font-black tracking-[-0.06em]">
                        {scans.find(s => s.user === normalizedUser)?.score.chaos ?? 0}
                        <span className="text-xs font-bold text-zinc-400">/10</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Mobile Footer */}
          <footer className="border-t-[3px] border-zinc-950 bg-white p-6 mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-950">
              © {new Date().getFullYear()} can damage. all rights stack.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-xs font-black uppercase tracking-[0.16em]">
              <a href="#" className="hover:text-red-500 transition-colors">instagram</a>
              <span className="text-zinc-300">•</span>
              <a href="#" className="hover:text-lime-500 transition-colors">linkedin</a>
              <span className="text-zinc-300">•</span>
              <a href="#" className="hover:text-red-500 transition-colors">github</a>
              <span className="text-zinc-300">•</span>
              <a href="#" className="hover:text-lime-500 transition-colors">portfolio</a>
              <span className="text-zinc-300">•</span>
              <button type="button" className="hover:text-red-500 transition-colors" onClick={() => supabase.auth.signOut()}>sign out</button>
            </div>
          </footer>
        </main>
      </div>

      {/* ── DESKTOP DASHBOARD LAYOUT (hidden on mobile) ── */}
      <div className="hidden lg:grid lg:grid-cols-[460px_1fr] lg:h-screen lg:overflow-hidden bg-[#faf7ef]">
        {/* LEFT COLUMN: CONTROL CONSOLE */}
        <aside className="h-screen overflow-y-auto bg-white border-r-[4px] border-zinc-950 p-8 flex flex-col justify-between select-none relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.03)]">
          <div>
            {/* Pill badges row */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="hero-badge bg-zinc-950 text-white">☕ liquid damage</span>
              <span className="hero-badge bg-red-500 text-white">🥤 aspartame gang</span>
              <span className="hero-badge bg-lime-300 text-zinc-950">⚡ taurine speedrun</span>
            </div>

            {/* Giant stacked headline */}
            <h1 className="desktop-hero-headline text-zinc-950">
              drink<br />
              <span className="text-red-500">cans.</span><br />
              farm<br />
              <span className="text-lime-500">aura.</span>
            </h1>

            <p className="mt-4 text-sm font-bold leading-relaxed text-zinc-500 max-w-sm">
              log every can. stack caffeine. climb the fridge. flex completely unnecessary stats on your friends.
            </p>

            {/* Can Drop Intake Console */}
            <div className="rounded-[1.6rem] border-[3px] border-zinc-950 bg-[#faf7ef] p-5 shadow-[6px_6px_0_#18181b] mt-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-500">manual intake</p>
                  <h2 className="text-2xl font-black uppercase tracking-[-0.04em] text-zinc-950 mt-0.5">can drop</h2>
                </div>
                <span className={`rounded-full px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] ${drink === 'monster' ? 'bg-lime-300 text-zinc-950' : 'bg-red-500 text-white'}`}>
                  {selectedCan.caffeineMg}mg
                </span>
              </div>

              <div className={`can-drop-card my-4 overflow-hidden rounded-2xl border-2 border-zinc-950 p-4 text-white ${drink === 'monster' ? 'bg-zinc-950' : 'bg-red-500'}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-950">@{normalizedUser}</span>
                  <span className="rounded-full border border-white/25 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em]">{quantity}x can</span>
                </div>

                <div className="grid min-h-40 place-items-center py-4">
                  <div className={`can-token ${lastLogged === drink ? 'can-token-pop' : ''} ${drink === 'monster' ? 'monster-token' : 'diet-token'} scale-90`}>
                    <span>{drink === 'monster' ? 'M' : 'DC'}</span>
                    <strong>{selectedCan.label}</strong>
                    <small>{selectedCan.caffeineMg}mg</small>
                  </div>
                </div>

                <div className="rounded-xl bg-white p-3 text-zinc-950">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">this drop</span>
                    <strong className="text-xl font-black tracking-[-0.04em]">{selectedTotal}mg</strong>
                  </div>
                  <p className="mt-0.5 text-[11px] font-bold lowercase text-zinc-500">{logStatus}</p>
                  {logError && <p className="mt-0.5 text-[11px] font-bold text-red-500">{logError}</p>}
                </div>
              </div>

              <div className="grid gap-3">
                <label className="grid gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                  handle
                  <input
                    className="h-11 rounded-xl border-2 border-zinc-950 bg-white px-3 text-sm font-bold normal-case text-zinc-950 outline-none focus:ring-4 focus:ring-lime-300"
                    value={user}
                    onChange={(e) => handleUserChange(e.target.value)}
                    placeholder={defaultHandle}
                    maxLength={20}
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`h-11 rounded-xl border-2 border-zinc-950 text-[10px] font-black uppercase tracking-[0.14em] transition active:translate-y-0.5 ${drink === 'monster' ? 'bg-lime-300 text-zinc-950 shadow-[0_3px_0_#18181b]' : 'bg-white text-zinc-500'}`}
                    type="button"
                    onClick={() => setDrink('monster')}
                  >
                    Monster
                  </button>
                  <button
                    className={`h-11 rounded-xl border-2 border-zinc-950 text-[10px] font-black uppercase tracking-[0.14em] transition active:translate-y-0.5 ${drink === 'diet-coke' ? 'bg-red-500 text-white shadow-[0_3px_0_#18181b]' : 'bg-white text-zinc-500'}`}
                    type="button"
                    onClick={() => setDrink('diet-coke')}
                  >
                    Diet Coke
                  </button>
                </div>

                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border-2 border-zinc-950 bg-white p-1">
                  <button
                    className="grid size-8 place-items-center rounded-lg bg-zinc-950 text-sm font-black text-white disabled:opacity-30"
                    type="button"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    disabled={quantity === 1}
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <div className="text-center">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">quantity</p>
                    <p className="text-lg font-black leading-none">{quantity}</p>
                  </div>
                  <button
                    className="grid size-8 place-items-center rounded-lg bg-zinc-950 text-sm font-black text-white"
                    type="button"
                    onClick={() => setQuantity((current) => Math.min(9, current + 1))}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                {logBtn('h-12 w-full text-xs')}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-zinc-100 text-[10px] font-bold text-zinc-400 flex items-center justify-between">
            <span>can damage console v2.0</span>
            <button
              type="button"
              className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400 hover:text-red-500 transition-colors"
              onClick={() => supabase.auth.signOut()}
            >
              sign out
            </button>
          </div>
        </aside>

        {/* RIGHT COLUMN: THE DASHBOARD COMMAND CENTER */}
        <main className="h-screen overflow-y-auto p-8 flex flex-col gap-6 relative z-0">
          {/* Dynamic Ambient Aura Glow */}
          <div className={`absolute inset-0 pointer-events-none opacity-[0.04] transition-all duration-[800ms] -z-10 ${drink === 'monster' ? 'bg-lime-500' : 'bg-red-600'}`} />
          <div className="absolute inset-0 pointer-events-none opacity-[0.025] -z-10"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
          />

          {/* Top Row: Large Live Ticker Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="ticker-chip p-5 rounded-2xl flex flex-col justify-between">
              <span className="ticker-label">my mg today</span>
              <strong className="ticker-value text-4xl mt-2">{stats.todayCaffeineMg}</strong>
            </div>
            <div className="ticker-chip ticker-chip-red p-5 rounded-2xl flex flex-col justify-between">
              <span className="ticker-label">my sleep debt</span>
              <strong className="ticker-value text-4xl mt-2">{stats.sleepDebtMinutes}m</strong>
            </div>
            <div className="ticker-chip ticker-chip-lime p-5 rounded-2xl flex flex-col justify-between">
              <span className="ticker-label">my chaos score</span>
              <strong className="ticker-value text-4xl mt-2">{scans.find(s => s.user === normalizedUser)?.score.chaos ?? 0}/10</strong>
            </div>
          </div>

          {/* Main Grid Section */}
          <div className="grid grid-cols-[1fr_1.1fr] gap-6 items-start">
            {/* Left Col: Aura Deck + Chaos Index Chart */}
            <div className="flex flex-col gap-6">
              {/* Aura Deck Frame */}
              <div className="rounded-[2rem] border-4 border-zinc-950 bg-white p-6 shadow-[10px_10px_0_#18181b] flex flex-col items-center justify-center relative min-h-[440px] overflow-hidden">
                <p className="absolute top-4 left-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">interactive aura deck</p>
                
                {/* Embedded dynamic card stack */}
                <div className="scale-95 translate-y-3">
                  <div className="hero-can-stack">
                    {/* Diet Coke Card */}
                    <div
                      className={`hero-can-card hero-can-card-diet-coke transition-all duration-300 ${drink === 'diet-coke' ? 'hero-can-card-front' : 'hero-can-card-back'}`}
                      onClick={() => handleCardClick('diet-coke')}
                    >
                      <span className="hcc-letter">DC</span>
                      <span className="hcc-brand">Diet Coke</span>
                      <span className="hcc-mg">46mg</span>
                    </div>
                    {/* Monster Card */}
                    <div
                      className={`hero-can-card hero-can-card-monster transition-all duration-300 ${drink === 'monster' ? 'hero-can-card-front' : 'hero-can-card-back'}`}
                      onClick={() => handleCardClick('monster')}
                    >
                      <span className="hcc-letter">M</span>
                      <span className="hcc-brand">Monster</span>
                      <span className="hcc-mg">160mg</span>
                      {drink === 'monster' && <div className="hcc-glow" />}
                    </div>
                    {/* Floating badge */}
                    <div className="hero-float-badge">
                      <span>⚡</span> peak aura
                    </div>
                    {/* Chaos counter */}
                    <div className="hero-chaos-badge">chaos {scans.find(s => s.user === normalizedUser)?.score.chaos ?? 0}/10</div>
                  </div>
                </div>
              </div>

              {/* Chaos Index Graph */}
              <div className="rounded-[1.6rem] border-4 border-zinc-950 bg-white p-5 shadow-[6px_6px_0_#18181b]">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">my chaos timeline</p>
                <div className="mt-4 flex items-end gap-3">
                  <div className="chaos-bar-wrap flex-1">
                    {scans.filter(s => s.user === normalizedUser).slice(0, 10).map((scan) => (
                      <div
                        key={scan.id}
                        className="chaos-bar"
                        style={{ '--chaos': scan.score.chaos } as React.CSSProperties}
                        title={`chaos ${scan.score.chaos}/10`}
                      />
                    ))}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-3xl font-black tracking-[-0.06em] leading-none">
                      {scans.find(s => s.user === normalizedUser)?.score.chaos ?? 0}
                    </p>
                    <p className="text-[10px] font-black text-zinc-400 uppercase">chaos/10</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Scoreboard Leaderboard */}
            <div className="rounded-[2rem] border-4 border-zinc-950 bg-lime-300 p-6 shadow-[10px_10px_0_#18181b] min-h-[550px] flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900">fridge dashboard</p>
                <h2 className="text-4xl sm:text-5xl font-black uppercase leading-[0.82] tracking-[-0.07em] text-zinc-950 mt-1">top fridge</h2>

                <div className="mt-5 flex flex-col gap-3">
                  {leaderboard.slice(0, 6).map((entry, index) => (
                    <div
                      key={entry.user}
                      className={`rounded-2xl border-3 border-zinc-950 bg-white p-3 flex items-center justify-between shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#18181b]`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base font-black w-6 text-zinc-400 text-center">#{index + 1}</span>
                        <div className="size-8 rounded-full border-2 border-zinc-950 bg-zinc-950 text-white text-[10px] font-black flex items-center justify-center uppercase">
                          {entry.user.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-black text-sm text-zinc-950 leading-none">@{entry.user}</p>
                          <p className="text-[9px] font-bold text-zinc-400 uppercase mt-0.5">
                            {entry.monsterCans}⚡m | {entry.dietCokeCans}🥤dc
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black text-zinc-950 leading-none">{entry.caffeineMg}mg</p>
                        <p className="text-[9px] font-black uppercase text-zinc-400 mt-0.5">{entry.cans} cans</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leaderboard statistics footer */}
              <div className="mt-6 border-t-2 border-zinc-950 pt-4 flex items-center justify-between text-xs font-black uppercase text-zinc-950">
                <span>athletes: {leaderboard.length}</span>
                <span>fridge total scans: {scans.length}</span>
              </div>
            </div>
          </div>

          {/* Bottom Feed: Live Action Damage Log */}
          <div className="rounded-[1.6rem] border-4 border-zinc-950 bg-white p-5 shadow-[6px_6px_0_#18181b]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3">live damage feed</p>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-2">
              {scansLoading ? feedSkeleton : scans.length === 0 ? (
                <p className="text-xs text-zinc-400 italic text-center py-4">No damage logged yet. Fill the console!</p>
              ) : (
                scans.map((scan) => (
                  <div key={scan.id} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full border border-zinc-950 ${scan.can.brand === 'monster' ? 'bg-lime-300' : 'bg-red-500'}`} />
                      <span className="font-black text-zinc-950">@{scan.user}</span>
                      <span className="text-zinc-500">logged {scan.can.label} ({scan.can.ml}ml)</span>
                    </div>
                    <div className="flex items-center gap-3 text-zinc-500 font-bold">
                      <span className={scan.can.brand === 'monster' ? 'text-lime-600' : 'text-red-500'}>+{scan.can.caffeineMg}mg</span>
                      <span className="text-[10px] opacity-50 font-normal">
                        {new Date(scan.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Desktop Footer */}
          <footer className="border-t-[3px] border-zinc-950 bg-white p-5 mt-4 rounded-[1.6rem] shadow-[6px_6px_0_#18181b] flex items-center justify-between gap-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-950">
              © {new Date().getFullYear()} can damage. all rights stack.
            </p>
            <div className="flex gap-4 text-xs font-black uppercase tracking-[0.16em]">
              <a href="#" className="hover:text-red-500 transition-colors">instagram</a>
              <span className="text-zinc-300">•</span>
              <a href="#" className="hover:text-lime-500 transition-colors">linkedin</a>
              <span className="text-zinc-300">•</span>
              <a href="#" className="hover:text-red-500 transition-colors">github</a>
              <span className="text-zinc-300">•</span>
              <a href="#" className="hover:text-lime-500 transition-colors">portfolio</a>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}

export default App
