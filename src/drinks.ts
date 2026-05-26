export type DrinkBrand = 'diet-coke' | 'monster'

export type CanInfo = {
  brand: DrinkBrand
  label: string
  ml: number
  caffeineMg: number
  accent: 'red' | 'green'
}

export type ScanScore = {
  chaos: number
  sleepDebtMinutes: number
}

export type ScanRecord = {
  id: string
  user: string
  scannedAt: string
  can: CanInfo
  score: ScanScore
}

export type ScanInsertRow = {
  id: string
  user_id: string
  handle: string
  scanned_at: string
  brand: string
  label: string
  ml: number
  caffeine_mg: number
  chaos: number
  sleep_debt: number
}

export type DashboardStats = {
  todayCaffeineMg: number
  todayCans: number
  weekCaffeineMg: number
  dietCokeCans: number
  monsterCans: number
  sleepDebtMinutes: number
  streakDays: number
}

export type LeaderboardEntry = {
  user: string
  caffeineMg: number
  cans: number
  monsterCans: number
  dietCokeCans: number
}

const CAN_CATALOG: Record<string, Omit<CanInfo, 'ml'>> = {
  DIET_COKE: {
    brand: 'diet-coke',
    label: 'Diet Coke',
    caffeineMg: 46,
    accent: 'red',
  },
  MONSTER: {
    brand: 'monster',
    label: 'Monster Energy',
    caffeineMg: 160,
    accent: 'green',
  },
}

const AUTO_DETECT_QRS = ['CAN:DIET_COKE:330', 'CAN:MONSTER:500'] as const

export function getAutoDetectedQr(scanIndex: number): string {
  return AUTO_DETECT_QRS[Math.abs(scanIndex) % AUTO_DETECT_QRS.length]
}

export function resolveCanQrPayload(decodedText: string): string | null {
  const normalized = decodedText.trim()

  try {
    parseCanQr(normalized)
    return normalized.toUpperCase()
  } catch {
    const searchable = decodeURIComponent(normalized).toLowerCase()

    if (searchable.includes('monster')) {
      return 'CAN:MONSTER:500'
    }

    if (searchable.includes('diet') && searchable.includes('coke')) {
      return 'CAN:DIET_COKE:330'
    }

    return null
  }
}

export function parseCanQr(payload: string): CanInfo {
  const [prefix, code, rawMl] = payload.trim().toUpperCase().split(':')
  const can = CAN_CATALOG[code]
  const ml = Number(rawMl)

  if (prefix !== 'CAN' || !can || !Number.isFinite(ml) || ml <= 0) {
    throw new Error('Unsupported can QR')
  }

  return {
    ...can,
    ml,
  }
}

export function scoreScan(can: CanInfo): ScanScore {
  // chaos on 0-10 scale: Monster (160mg) = 10, Diet Coke (46mg) ≈ 3
  return {
    chaos: Math.min(10, Math.round((can.caffeineMg / 160) * 10)),
    sleepDebtMinutes: Math.round(can.caffeineMg / 2),
  }
}

export function buildScanInsertRows({
  can,
  score,
  quantity,
  userId,
  handle,
  scannedAt,
  createId,
}: {
  can: CanInfo
  score: ScanScore
  quantity: number
  userId: string
  handle: string
  scannedAt: string
  createId: () => string
}): ScanInsertRow[] {
  return Array.from({ length: quantity }, () => ({
    id: createId(),
    user_id: userId,
    handle,
    scanned_at: scannedAt,
    brand: can.brand as string,
    label: can.label,
    ml: can.ml,
    caffeine_mg: can.caffeineMg,
    chaos: score.chaos,
    sleep_debt: score.sleepDebtMinutes,
  }))
}

/** Personal stats for the current user */
export function calculateStats(scans: ScanRecord[], now = new Date(), userId?: string): DashboardStats {
  const mine = userId ? scans.filter((s) => s.user === userId) : scans
  const todayKey = dateKey(now)
  const weekStart = startOfDay(addDays(now, -6))
  const todayScans = mine.filter((s) => dateKey(new Date(s.scannedAt)) === todayKey)
  const weekScans = mine.filter((s) => new Date(s.scannedAt) >= weekStart)

  return {
    todayCaffeineMg: sum(todayScans, (s) => s.can.caffeineMg),
    todayCans: todayScans.length,
    weekCaffeineMg: sum(weekScans, (s) => s.can.caffeineMg),
    dietCokeCans: mine.filter((s) => s.can.brand === 'diet-coke').length,
    monsterCans: mine.filter((s) => s.can.brand === 'monster').length,
    sleepDebtMinutes: sum(todayScans, (s) => s.score.sleepDebtMinutes),
    streakDays: countStreak(mine, now),
  }
}

export function buildLeaderboard(scans: ScanRecord[]): LeaderboardEntry[] {
  const byUser = new Map<string, LeaderboardEntry>()

  for (const scan of scans) {
    const current =
      byUser.get(scan.user) ??
      {
        user: scan.user,
        caffeineMg: 0,
        cans: 0,
        monsterCans: 0,
        dietCokeCans: 0,
      }

    current.caffeineMg += scan.can.caffeineMg
    current.cans += 1
    current.monsterCans += scan.can.brand === 'monster' ? 1 : 0
    current.dietCokeCans += scan.can.brand === 'diet-coke' ? 1 : 0
    byUser.set(scan.user, current)
  }

  return [...byUser.values()].sort(
    (a, b) => b.caffeineMg - a.caffeineMg || b.cans - a.cans || a.user.localeCompare(b.user),
  )
}

function countStreak(scans: ScanRecord[], now: Date): number {
  const activeDays = new Set(scans.map((scan) => dateKey(new Date(scan.scannedAt))))
  let streak = 0
  let cursor = startOfDay(now)

  while (activeDays.has(dateKey(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0)
}
