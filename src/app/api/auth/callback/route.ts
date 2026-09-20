import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { routing } from '@/i18n/routing'

/**
 * نقطة هبوط الرابط السحري.
 *
 * تحت /api عمدًا: هذا المسار مستثنى من وسيط اللغة، فلا يُعاد توجيهه إلى
 * ‎/ar/…‎ قبل أن نبدّل الرمز بجلسة — وإعادة التوجيه أثناء ذلك تكسر الدخول.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const requestedNext = searchParams.get('next')
  const next =
    requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : `/${routing.defaultLocale}/me`

  const localeFromNext =
    routing.locales.find((l) => next === `/${l}` || next.startsWith(`/${l}/`)) ??
    routing.defaultLocale

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'magiclink' | 'email' | 'signup' | 'recovery' | 'invite',
      token_hash: tokenHash,
    })
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }

  const failure = new URL(`/${localeFromNext}/login`, origin)
  failure.searchParams.set('error', 'link')
  return NextResponse.redirect(failure)
}
