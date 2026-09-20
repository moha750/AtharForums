import { redirect } from '@/i18n/navigation'
import { getPublicSettings, hasLaunched } from '@/lib/settings'
import { getCurrentProfile, isAdmin } from '@/lib/auth'
import type { Locale } from '@/i18n/routing'
import type { PublicSettings } from '@/lib/database.types'

/**
 * يمنع تسرّب الموقع قبل التدشين. فريق أثر يستطيع التصفّح للمراجعة، وغيرهم
 * يُعاد إلى الصفحة التشويقية.
 */
export async function requireLaunched(locale: Locale): Promise<PublicSettings> {
  const settings = await getPublicSettings()
  if (hasLaunched(settings)) return settings

  // المشرفون فقط: سياسات قاعدة البيانات تفتح المحتوى قبل التدشين لـ is_admin()
  // وحده، فلو سمحنا هنا لرئيس المنتدى لرأى موقعًا فارغًا لا موقعًا مبكّرًا.
  const profile = await getCurrentProfile()
  if (isAdmin(profile)) return settings

  redirect({ href: '/', locale })
  // redirect() لا يعود أبدًا — هذا السطر لإرضاء المحلّل الثابت فقط
  throw new Error('unreachable')
}
