'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { updateProfile, type ProfileState } from '@/actions/profile'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/field'
import type { Profile } from '@/lib/database.types'

const initial: ProfileState = { status: 'idle' }

export function ProfileForm({ profile }: { profile: Profile }) {
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const [state, action, pending] = useActionState(updateProfile, initial)

  const fields = [
    { name: 'full_name_ar', label: t('fullNameAr'), value: profile.full_name_ar, dir: 'rtl' },
    { name: 'full_name_en', label: t('fullNameEn'), value: profile.full_name_en, dir: 'ltr' },
    { name: 'job_title', label: t('jobTitle'), value: profile.job_title },
    { name: 'department', label: t('department'), value: profile.department },
    { name: 'sector', label: t('sector'), value: profile.sector },
    { name: 'work_location', label: t('workLocation'), value: profile.work_location },
    { name: 'phone', label: t('phone'), value: profile.phone, dir: 'ltr' },
  ] as const

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input
              id={field.name}
              name={field.name}
              defaultValue={field.value ?? ''}
              dir={'dir' in field ? field.dir : undefined}
              maxLength={160}
            />
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="skills" hint={t('skillsHint')}>
          {t('skills')}
        </Label>
        <Input
          id="skills"
          name="skills"
          defaultValue={profile.skills.join('، ')}
          maxLength={400}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio">{t('bio')}</Label>
        <Textarea id="bio" name="bio" defaultValue={profile.bio ?? ''} maxLength={600} />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {tCommon('saving')}
            </>
          ) : (
            tCommon('save')
          )}
        </Button>

        {state.status === 'success' ? (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--success)]"
          >
            <CheckCircle2 className="size-4" aria-hidden />
            {t('profileSaved')}
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
