import { getTranslations } from 'next-intl/server'

import { SettingsForm } from '@/components/admin/settings-form'
import { adminSettings } from '@/lib/admin-data'
import type { SiteSettings } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const [t, settings] = await Promise.all([getTranslations('admin'), adminSettings()])

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('navSettings')}</h1>
      <div className="mt-6 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        {settings ? <SettingsForm settings={settings as SiteSettings} /> : null}
      </div>
    </div>
  )
}
