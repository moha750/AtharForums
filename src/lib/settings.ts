import { createClient } from '@/lib/supabase/server'
import { fixtureSettings, previewMode } from '@/lib/fixtures'
import type { PublicSettings } from '@/lib/database.types'

const FALLBACK: PublicSettings = {
  launch_at: '2026-09-27T09:00:00Z',
  teaser_mode: true,
  registration_open: false,
  allowed_email_domains: ['hrsd.gov.sa'],
  site_name_ar: 'منتديات أثر',
  site_name_en: 'Athar Forums',
  tagline_ar: 'منتديات تواصل .. تصنع أثراً',
  tagline_en: 'Forums that connect, and leave a mark',
  about_ar: null,
  about_en: null,
  contact_email: null,
}

/**
 * إعدادات الموقع العامة. إن تعذّر الوصول لقاعدة البيانات نرجع إلى قيم آمنة
 * تُبقي الموقع في الوضع التشويقي بدل أن تكشف ما لم يُدشَّن بعد.
 */
export async function getPublicSettings(): Promise<PublicSettings> {
  if (previewMode) return fixtureSettings

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_public_settings')
    if (error || !data) return FALLBACK
    return { ...FALLBACK, ...(data as unknown as PublicSettings) }
  } catch {
    return FALLBACK
  }
}

export function hasLaunched(settings: PublicSettings): boolean {
  if (!settings.teaser_mode) return true
  return new Date(settings.launch_at).getTime() <= Date.now()
}
