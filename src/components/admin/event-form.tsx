'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { saveEvent, type AdminState } from '@/actions/admin'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/field'
import { localized } from '@/lib/utils'
import type { AtharEvent, Forum } from '@/lib/database.types'

const initial: AdminState = { status: 'idle' }

const selectStyles =
  'h-11 w-full rounded-lg bg-[var(--surface)] px-3 text-[0.95rem] text-[var(--fg)] ring-1 ring-inset ring-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]'

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() + 3 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 16)
}

export function EventForm({
  event,
  forums,
  locale,
}: {
  event?: AtharEvent
  forums: Forum[]
  locale: string
}) {
  const t = useTranslations('admin')
  const tEvents = useTranslations('events')
  const tCommon = useTranslations('common')
  const [state, action, pending] = useActionState(saveEvent, initial)

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      {event ? <input type="hidden" name="id" value={event.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="title_ar">{t('forumNameAr')}</Label>
          <Input id="title_ar" name="title_ar" required defaultValue={event?.title_ar ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title_en">{t('forumNameEn')}</Label>
          <Input id="title_en" name="title_en" dir="ltr" defaultValue={event?.title_en ?? ''} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slug" hint={t('forumSlugHint')}>
            {t('forumSlug')}
          </Label>
          <Input
            id="slug"
            name="slug"
            required
            dir="ltr"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            defaultValue={event?.slug ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="forum_id">{t('navForums')}</Label>
          <select
            id="forum_id"
            name="forum_id"
            defaultValue={event?.forum_id ?? ''}
            className={selectStyles}
          >
            <option value="">—</option>
            {forums.map((f) => (
              <option key={f.id} value={f.id}>
                {localized(f, 'name', locale)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="starts_at" hint="Asia/Riyadh">
            {tEvents('whenHeading')}
          </Label>
          <Input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            dir="ltr"
            required
            defaultValue={toLocalInput(event?.starts_at ?? null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ends_at">—</Label>
          <Input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            dir="ltr"
            defaultValue={toLocalInput(event?.ends_at ?? null)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mode">{tEvents('whereHeading')}</Label>
          <select id="mode" name="mode" defaultValue={event?.mode ?? 'onsite'} className={selectStyles}>
            <option value="onsite">{tEvents('onsite')}</option>
            <option value="online">{tEvents('online')}</option>
            <option value="hybrid">{tEvents('hybrid')}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="capacity" hint={t('forumCapacityHint')}>
            {t('forumCapacity')}
          </Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            dir="ltr"
            defaultValue={event?.capacity ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="location_ar">{tEvents('whereHeading')} — AR</Label>
          <Input id="location_ar" name="location_ar" defaultValue={event?.location_ar ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location_en">{tEvents('whereHeading')} — EN</Label>
          <Input
            id="location_en"
            name="location_en"
            dir="ltr"
            defaultValue={event?.location_en ?? ''}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="meeting_url">{tEvents('joinLink')}</Label>
          <Input
            id="meeting_url"
            name="meeting_url"
            type="url"
            dir="ltr"
            defaultValue={event?.meeting_url ?? ''}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description_ar">{t('forumDescAr')}</Label>
        <Textarea
          id="description_ar"
          name="description_ar"
          defaultValue={event?.description_ar ?? ''}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description_en">{t('forumDescEn')}</Label>
        <Textarea
          id="description_en"
          name="description_en"
          dir="ltr"
          defaultValue={event?.description_en ?? ''}
        />
      </div>

      <div className="flex flex-wrap items-center gap-5">
        <label className="inline-flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="registration_open"
            defaultChecked={event?.registration_open ?? true}
            className="size-4 rounded accent-[var(--primary)]"
          />
          {tEvents('register')}
        </label>
        <label className="inline-flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="members_only"
            defaultChecked={event?.members_only ?? false}
            className="size-4 rounded accent-[var(--primary)]"
          />
          {tEvents('membersOnly')}
        </label>
        <div className="ms-auto w-40 space-y-1.5">
          <Label htmlFor="status">{t('forumStatus')}</Label>
          <select
            id="status"
            name="status"
            defaultValue={event?.status ?? 'draft'}
            className={selectStyles}
          >
            <option value="draft">{t('statusDraft')}</option>
            <option value="published">{t('statusPublished')}</option>
            <option value="archived">{t('statusArchived')}</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--border)] pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {tCommon('save')}
        </Button>
        {state.status === 'error' ? (
          <span role="alert" className="text-sm text-[var(--danger)]">
            {tCommon('error')}
          </span>
        ) : null}
      </div>
    </form>
  )
}
