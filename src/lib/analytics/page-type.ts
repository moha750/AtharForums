/**
 * تصنيف الصفحة من مسارها.
 *
 * «نوع الصفحة» هو ما يجعل الإحصاءات مفهومة: «٤٢٠ مشاهدة لصفحات المنتديات»
 * أنفع من قائمة بأربعين مسارًا متفرّقًا. والـ slug يتيح ربط المشاهدة بالمنتدى
 * أو الفعالية نفسها في قاعدة البيانات، وعليه تُبنى مسارات التحوّل.
 */

export type PageType =
  | 'teaser'
  | 'home'
  | 'forums'
  | 'forum'
  | 'events'
  | 'event'
  | 'news'
  | 'article'
  | 'about'
  | 'login'
  | 'dashboard'
  | 'admin'
  | 'other'

export interface PageInfo {
  pageType: PageType
  entitySlug: string | null
}

/** يزيل بادئة اللغة ويعيد المسار المنطقي: /ar/forums/x → /forums/x */
export function stripLocale(pathname: string, locales: readonly string[]): string {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return '/'
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1)
  }
  return pathname
}

/**
 * الوسيط لا يعرف إن كان الموقع في وضعه التشويقي — معرفة ذلك تكلّف قراءة من
 * قاعدة البيانات على كل طلب. فنسجّل الجذر دائمًا 'home'، وتتكفّل دوالّ
 * التقارير بالتمييز: ما قبل التدشين تشويقيّ بطبيعته.
 */
export function classifyPath(pathWithoutLocale: string): PageInfo {
  const path = pathWithoutLocale.replace(/\/+$/, '') || '/'
  const segments = path.split('/').filter(Boolean)

  if (segments.length === 0) {
    return { pageType: 'home', entitySlug: null }
  }

  const [head, second] = segments

  switch (head) {
    case 'forums':
      return second
        ? { pageType: 'forum', entitySlug: second }
        : { pageType: 'forums', entitySlug: null }
    case 'events':
      return second
        ? { pageType: 'event', entitySlug: second }
        : { pageType: 'events', entitySlug: null }
    case 'news':
      return second
        ? { pageType: 'article', entitySlug: second }
        : { pageType: 'news', entitySlug: null }
    case 'about':
      return { pageType: 'about', entitySlug: null }
    case 'login':
      return { pageType: 'login', entitySlug: null }
    case 'me':
      return { pageType: 'dashboard', entitySlug: null }
    case 'admin':
      return { pageType: 'admin', entitySlug: null }
    default:
      return { pageType: 'other', entitySlug: null }
  }
}
