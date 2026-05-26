import { describe, expect, it } from 'vitest'
import {
  buildLeaderboard,
  buildScanInsertRows,
  calculateStats,
  getAutoDetectedQr,
  parseCanQr,
  resolveCanQrPayload,
  scoreScan,
  type ScanRecord,
} from './drinks'

describe('can QR parsing', () => {
  it('parses supported Diet Coke and Monster QR payloads', () => {
    expect(parseCanQr('CAN:DIET_COKE:330')).toEqual({
      brand: 'diet-coke',
      label: 'Diet Coke',
      ml: 330,
      caffeineMg: 46,
      accent: 'red',
    })

    expect(parseCanQr('CAN:MONSTER:500')).toEqual({
      brand: 'monster',
      label: 'Monster Energy',
      ml: 500,
      caffeineMg: 160,
      accent: 'green',
    })
  })

  it('rejects unsupported QR payloads', () => {
    expect(() => parseCanQr('CAN:COLA:330')).toThrow('Unsupported can QR')
    expect(() => parseCanQr('hello')).toThrow('Unsupported can QR')
  })
})

describe('scan scoring', () => {
  it('assigns higher chaos to monster than diet coke', () => {
    const diet = scoreScan(parseCanQr('CAN:DIET_COKE:330'))
    const monster = scoreScan(parseCanQr('CAN:MONSTER:500'))

    expect(diet.chaos).toBe(3)
    expect(monster.chaos).toBe(10)
    expect(monster.sleepDebtMinutes).toBeGreaterThan(diet.sleepDebtMinutes)
  })
})

describe('scan insert rows', () => {
  it('creates one valid UUID-style id per logged can without suffixes', () => {
    const can = parseCanQr('CAN:DIET_COKE:330')
    const score = scoreScan(can)
    const ids = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]

    const rows = buildScanInsertRows({
      can,
      score,
      quantity: 2,
      userId: 'user-1',
      handle: 'chethas',
      scannedAt: '2026-05-26T08:00:00.000Z',
      createId: () => ids.shift()!,
    })

    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ])
    expect(rows[0]).toMatchObject({
      user_id: 'user-1',
      handle: 'chethas',
      scanned_at: '2026-05-26T08:00:00.000Z',
      brand: 'diet-coke',
      caffeine_mg: 46,
      chaos: 3,
    })
  })
})

describe('auto detection', () => {
  it('alternates recognizable can QR payloads for demo scans', () => {
    expect(getAutoDetectedQr(0)).toBe('CAN:DIET_COKE:330')
    expect(getAutoDetectedQr(1)).toBe('CAN:MONSTER:500')
    expect(getAutoDetectedQr(2)).toBe('CAN:DIET_COKE:330')
  })

  it('normalizes decoded camera QR text into supported can payloads', () => {
    expect(resolveCanQrPayload('CAN:MONSTER:500')).toBe('CAN:MONSTER:500')
    expect(resolveCanQrPayload('https://drink.local/scan?brand=Diet%20Coke')).toBe('CAN:DIET_COKE:330')
    expect(resolveCanQrPayload('monster energy zero ultra')).toBe('CAN:MONSTER:500')
    expect(resolveCanQrPayload('plain cola')).toBeNull()
  })
})

describe('dashboard stats', () => {
  const scans: ScanRecord[] = [
    {
      id: '1',
      user: 'Ari',
      scannedAt: '2026-05-26T08:00:00.000Z',
      can: parseCanQr('CAN:DIET_COKE:330'),
      score: scoreScan(parseCanQr('CAN:DIET_COKE:330')),
    },
    {
      id: '2',
      user: 'Ari',
      scannedAt: '2026-05-26T10:00:00.000Z',
      can: parseCanQr('CAN:MONSTER:500'),
      score: scoreScan(parseCanQr('CAN:MONSTER:500')),
    },
    {
      id: '3',
      user: 'Bea',
      scannedAt: '2026-05-25T10:00:00.000Z',
      can: parseCanQr('CAN:DIET_COKE:330'),
      score: scoreScan(parseCanQr('CAN:DIET_COKE:330')),
    },
  ]

  it('calculates totals for a selected day', () => {
    expect(calculateStats(scans, new Date('2026-05-26T12:00:00.000Z'))).toEqual({
      todayCaffeineMg: 206,
      todayCans: 2,
      weekCaffeineMg: 252,
      dietCokeCans: 2,
      monsterCans: 1,
      sleepDebtMinutes: 103,
      streakDays: 2,
    })
  })

  it('orders leaderboard by weekly caffeine then can count', () => {
    expect(buildLeaderboard(scans).map((entry) => entry.user)).toEqual(['Ari', 'Bea'])
    expect(buildLeaderboard(scans)[0]).toMatchObject({
      user: 'Ari',
      caffeineMg: 206,
      cans: 2,
    })
  })
})
