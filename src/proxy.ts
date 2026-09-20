import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'
import { updateSession } from '@/lib/supabase/proxy'
import { previewMode } from '@/lib/fixtures'

const handleIntl = createIntlMiddleware(routing)

/** المسارات التي تتطلّب تسجيل دخول. تُطابَق بعد إزالة بادئة اللغة. */
const PROTECTED_PREFIXES = ['/me', '/admin']

function splitLocale(pathname: string): { locale: string; path: string } {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return { locale, path: '/' }
    if (pathname.startsWith(`/${locale}/`)) {
      return { locale, path: pathname.slice(locale.length + 1) }
    }
  }
  return { locale: routing.defaultLocale, path: pathname }
}

/** هل يحمل الطلب كوكي جلسة من Supabase أصلًا؟ */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.startsWith('sb-'))
}

export async function proxy(request: NextRequest) {
  const intlResponse = handleIntl(request)

  // وضع المعاينة بلا قاعدة بيانات: لا جلسات ولا حارس دخول — للعرض فقط
  if (previewMode) return intlResponse

  const { locale, path } = splitLocale(request.nextUrl.pathname)
  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )

  // الصفحات العامة بلا جلسة: لا نستدعي Supabase إطلاقًا — لا داعي لرحلة شبكة
  // على كل زيارة لصفحة لا تحتاج هوية.
  if (!needsAuth && !hasAuthCookie(request)) {
    return intlResponse
  }

  const { response, user } = await updateSession(request, intlResponse)

  if (needsAuth && !user) {
    // الوجهة تحمل بادئة اللغة، وإلا خرجنا من نطاق next-intl وانتهينا إلى 404
    const loginUrl = new URL(`/${locale}/login`, request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
    const redirect = NextResponse.redirect(loginUrl)
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie)
    }
    return redirect
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
