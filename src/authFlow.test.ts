import { describe, expect, it, vi } from 'vitest'
import { completeAuthRedirect } from './authFlow'

describe('auth redirect handling', () => {
  it('exchanges an OAuth code once and clears it from the URL', async () => {
    const session = { user: { id: 'user-1' } }
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ data: { session }, error: null })
    const getSession = vi.fn()
    const replaceUrl = vi.fn()

    const result = await completeAuthRedirect({
      code: 'oauth-code',
      pathname: '/dashboard',
      exchangeCodeForSession,
      getSession,
      replaceUrl,
    })

    expect(exchangeCodeForSession).toHaveBeenCalledOnce()
    expect(exchangeCodeForSession).toHaveBeenCalledWith('oauth-code')
    expect(getSession).not.toHaveBeenCalled()
    expect(replaceUrl).toHaveBeenCalledWith('/dashboard')
    expect(result).toBe(session)
  })

  it('falls back to the stored session when there is no OAuth code', async () => {
    const session = { user: { id: 'user-1' } }
    const exchangeCodeForSession = vi.fn()
    const getSession = vi.fn().mockResolvedValue({ data: { session }, error: null })
    const replaceUrl = vi.fn()

    const result = await completeAuthRedirect({
      code: null,
      pathname: '/',
      exchangeCodeForSession,
      getSession,
      replaceUrl,
    })

    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(getSession).toHaveBeenCalledOnce()
    expect(replaceUrl).not.toHaveBeenCalled()
    expect(result).toBe(session)
  })
})
