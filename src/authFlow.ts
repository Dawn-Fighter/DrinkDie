import type { Session } from '@supabase/supabase-js'

type AuthResult = {
  data: { session: Session | null }
  error: { message: string } | null
}

type CompleteAuthRedirectOptions = {
  code: string | null
  pathname: string
  exchangeCodeForSession: (code: string) => Promise<AuthResult>
  getSession: () => Promise<AuthResult>
  replaceUrl: (url: string) => void
}

export async function completeAuthRedirect({
  code,
  pathname,
  exchangeCodeForSession,
  getSession,
  replaceUrl,
}: CompleteAuthRedirectOptions) {
  if (!code) {
    const { data } = await getSession()
    return data.session
  }

  const { data, error } = await exchangeCodeForSession(code)
  replaceUrl(pathname)

  if (error) {
    const { data: existingData } = await getSession()
    return existingData.session
  }

  return data.session
}
