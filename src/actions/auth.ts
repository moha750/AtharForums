'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getPublicSettings } from '@/lib/settings'
import { isAllowedDomain } from '@/lib/utils'
import { siteUrl } from '@/lib/env'

export type LoginState = {
  status: 'idle' | 'sent' | 'error'
  email?: string
  key?: 'errorDomain' | 'errorRate' | 'errorGeneric'
  domains?: string
}

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  next: z.string().max(512).optional(),
})

/** نقبل مسارًا داخليًا فقط — لا نسمح بإعادة توجيه إلى موقع خارجي. */
function safeNext(value: string | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}

async function originFromRequest(): Promise<string> {
  try {
    const h = await headers()
    const host = h.get('x-forwarded-host') ?? h.get('host')
    const proto = h.get('x-forwarded-proto') ?? 'https'
    if (host) return `${proto}://${host}`
  } catch {
    /* خارج سياق الطلب */
  }
  return siteUrl()
}

export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    next: formData.get('next') || undefined,
  })

  const settings = await getPublicSettings()
  const domains = settings.allowed_email_domains.join('، ')

  if (!parsed.success) {
    return { status: 'error', key: 'errorDomain', domains }
  }

  // الحارس الحقيقي في قاعدة البيانات (trigger على auth.users)؛ هذا الفحص
  // لتوفير رحلة ورسالة أوضح للمستخدم، لا للأمان.
  if (!isAllowedDomain(parsed.data.email, settings.allowed_email_domains)) {
    return { status: 'error', key: 'errorDomain', domains }
  }

  const origin = await originFromRequest()
  const next = safeNext(parsed.data.next)
  const callback = new URL('/api/auth/callback', origin)
  if (next) callback.searchParams.set('next', next)

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        emailRedirectTo: callback.toString(),
        shouldCreateUser: settings.registration_open,
      },
    })

    if (error) {
      const message = error.message.toLowerCase()
      if (message.includes('rate') || error.status === 429) {
        return { status: 'error', key: 'errorRate', domains }
      }
      return { status: 'error', key: 'errorGeneric', domains }
    }

    return { status: 'sent', email: parsed.data.email }
  } catch {
    return { status: 'error', key: 'errorGeneric', domains }
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
