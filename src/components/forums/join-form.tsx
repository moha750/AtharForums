'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { applyToForum, type JoinState } from '@/actions/membership'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/field'

const initial: JoinState = { status: 'idle' }

export function JoinForm({ forumId, slug }: { forumId: string; slug: string }) {
  const t = useTranslations('forums')
  const tCommon = useTranslations('common')
  const [state, action, pending] = useActionState(applyToForum, initial)

  if (state.status === 'success') {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl bg-[var(--success-soft)] p-4 ring-1 ring-inset ring-[color-mix(in_srgb,var(--success)_25%,transparent)]"
      >
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--success)]" aria-hidden />
        <p className="text-sm text-[var(--success)]">{t('applySuccess')}</p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="forumId" value={forumId} />
      <input type="hidden" name="slug" value={slug} />

      <div className="space-y-1.5">
        <Label htmlFor="motivation">{t('motivationLabel')}</Label>
        <Textarea
          id="motivation"
          name="motivation"
          required
          minLength={10}
          maxLength={1200}
          placeholder={t('motivationPlaceholder')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="skills">{t('skillsLabel')}</Label>
        <Input id="skills" name="skills" maxLength={400} placeholder={t('skillsPlaceholder')} />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {tCommon('saving')}
          </>
        ) : (
          t('applySubmit')
        )}
      </Button>

      {state.status === 'error' ? (
        <p role="alert" className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {tCommon('error')}
        </p>
      ) : null}
    </form>
  )
}
