import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { fixtureProfile, previewMode } from '@/lib/fixtures'
import type { Profile } from '@/lib/database.types'

/**
 * الملف الشخصي للمستخدم الحالي، أو null.
 * cache() يمنع تكرار الاستعلام داخل الطلب الواحد.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  // في المعاينة: مشرف افتراضي إلا إن طُلب زائر غير مسجَّل (لمعاينة الصفحة التشويقية)
  if (previewMode) return process.env.ATHAR_PREVIEW_ANON === '1' ? null : fixtureProfile
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return (data as Profile) ?? null
})

export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === 'admin' || profile?.role === 'super_admin'
}

export function isStaff(profile: Profile | null): boolean {
  return isAdmin(profile) || profile?.role === 'forum_lead'
}

export function displayName(profile: Profile | null, locale: string): string {
  if (!profile) return ''
  const preferred = locale === 'en' ? profile.full_name_en : profile.full_name_ar
  return preferred || profile.full_name_ar || profile.full_name_en || profile.email.split('@')[0]
}
