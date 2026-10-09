import { getTranslations, setRequestLocale } from 'next-intl/server'

import { CustomCodesToggle, PermissionsTable, type PermissionRow } from '@/components/qr/permissions-table'
import { getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { AppPermission } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

/** منح صلاحيات الباركود — للمشرفين (تخطيط /admin يحرس الدخول). */
export default async function QrAccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const [t, profile, { data: profiles }, { data: grants }, { data: settings }] = await Promise.all([
    getTranslations('qr'),
    getCurrentProfile(),
    supabase.from('profiles').select('id, email, full_name_ar, full_name_en, is_active').order('created_at'),
    supabase.from('profile_permissions').select('profile_id, permission'),
    supabase.from('site_settings').select('qr_custom_codes').eq('id', true).maybeSingle(),
  ])

  const byProfile = new Map<string, AppPermission[]>()
  for (const g of grants ?? []) {
    byProfile.set(g.profile_id as string, [...(byProfile.get(g.profile_id as string) ?? []), g.permission as AppPermission])
  }
  const rows: PermissionRow[] = (profiles ?? []).map((p) => ({
    id: p.id as string,
    email: p.email as string,
    name:
      (locale === 'en' ? (p.full_name_en as string | null) : (p.full_name_ar as string | null)) ||
      (p.full_name_ar as string | null) ||
      (p.email as string).split('@')[0]!,
    active: p.is_active as boolean,
    permissions: byProfile.get(p.id as string) ?? [],
  }))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('access.title')}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--fg-muted)]">{t('access.lead')}</p>
      </header>

      <section className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
        <h2 className="text-base font-semibold">{t('access.customCodes')}</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('access.customCodesLead')}</p>
        <div className="mt-4">
          <CustomCodesToggle enabled={Boolean(settings?.qr_custom_codes)} />
        </div>
      </section>

      <PermissionsTable rows={rows} selfId={profile?.id ?? ''} isSuper={profile?.role === 'super_admin'} />
    </div>
  )
}
