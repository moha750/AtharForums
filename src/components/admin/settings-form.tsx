'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2 } from 'lucide-react'

import { updateSettings, type AdminState } from '@/actions/admin'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/field'
import type { SiteSettings } from '@/lib/database.types'

const initial: AdminState = { status: 'idle' }

/** يحوّل ISO إلى صيغة datetime-local بتوقيت الرياض. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const riyadh = new Date(d.getTime() + 3 * 60 * 60 * 1000)
  return riyadh.toISOString().slice(0, 16)
}

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const [state, action, pending] = useActionState(updateSettings, initial)

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="launch_at" hint="Asia/Riyadh">
            {t('settingsLaunch')}
          </Label>
          <Input
            id="launch_at"
            name="launch_at"
            type="datetime-local"
            dir="ltr"
            required
            defaultValue={toLocalInput(settings.launch_at)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact_email">{t('settingsContact')}</Label>
          <Input
            id="contact_email"
            name="contact_email"
            type="email"
            dir="ltr"
            defaultValue={settings.contact_email ?? ''}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="allowed_email_domains" hint="hrsd.gov.sa">
          {t('settingsDomains')}
        </Label>
        <Input
          id="allowed_email_domains"
          name="allowed_email_domains"
          dir="ltr"
          required
          defaultValue={settings.allowed_email_domains.join('، ')}
        />
      </div>

      <div className="space-y-3 rounded-xl bg-[var(--bg-subtle)] p-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="teaser_mode"
            defaultChecked={settings.teaser_mode}
            className="mt-0.5 size-4 rounded accent-[var(--primary)]"
          />
          <span>
            <span className="font-medium">{t('settingsTeaser')}</span>
            <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
              {t('settingsTeaserHint')}
            </span>
          </span>
        </label>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="registration_open"
            defaultChecked={settings.registration_open}
            className="size-4 rounded accent-[var(--primary)]"
          />
          <span className="font-medium">{t('settingsRegistration')}</span>
        </label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="about_ar">{t('settingsAbout')} — AR</Label>
        <Textarea id="about_ar" name="about_ar" defaultValue={settings.about_ar ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="about_en">{t('settingsAbout')} — EN</Label>
        <Textarea id="about_en" name="about_en" dir="ltr" defaultValue={settings.about_en ?? ''} />
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--border)] pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {tCommon('save')}
        </Button>
        {state.status === 'success' ? (
          <span role="status" className="inline-flex items-center gap-1.5 text-sm text-[var(--success)]">
            <CheckCircle2 className="size-4" aria-hidden />
            {tCommon('saved')}
          </span>
        ) : null}
        {state.status === 'error' ? (
          <span role="alert" className="text-sm text-[var(--danger)]">
            {tCommon('error')}
          </span>
        ) : null}
      </div>
    </form>
  )
}
