import { redirect } from '@/i18n/navigation'
import { getPublicSettings, hasLaunched } from '@/lib/settings'
import { getCurrentProfile, isStaff } from '@/lib/auth'
import type { Locale } from '@/i18n/routing'
import type { PublicSettings } from '@/lib/database.types'

/**
 * يمنع تسرّب الموقع قبل التدشين. فريق أثر يستطيع التصفّح للمراجعة، وغيرهم
 * يُعاد إلى الصفحة التشويقية.
 */
export async function requireLaunched(locale: Locale): Promise<PublicSettings> {
  const settings = await getPublicSettings()
  if (hasLaunched(settings)) return settings

  const profile = await getCurrentProfile()
  if (isStaff(profile)) return settings

  redirect({ href: '/', locale })
  // redirect() لا يعود أبدًا — هذا السطر لإرضاء المحلّل الثابت فقط
  throw new Error('unreachable')
}
