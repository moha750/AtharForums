'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { saveForum, type AdminState } from '@/actions/admin'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/field'
import type { Forum } from '@/lib/database.types'

const initial: AdminState = { status: 'idle' }

const selectStyles =
  'h-11 w-full rounded-lg bg-[var(--surface)] px-3 text-[0.95rem] text-[var(--fg)] ring-1 ring-inset ring-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]'

export function ForumForm({ forum, locale }: { forum?: Forum; locale: string }) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const [state, action, pending] = useActionState(saveForum, initial)

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      {forum ? <input type="hidden" name="id" value={forum.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name_ar">{t('forumNameAr')}</Label>
          <Input id="name_ar" name="name_ar" required defaultValue={forum?.name_ar ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name_en">{t('forumNameEn')}</Label>
          <Input id="name_en" name="name_en" dir="ltr" defaultValue={forum?.name_en ?? ''} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="slug" hint={t('forumSlugHint')}>
            {t('forumSlug')}
          </Label>
          <Input
            id="slug"
            name="slug"
            required
            dir="ltr"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            defaultValue={forum?.slug ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tagline_ar">{t('forumTaglineAr')}</Label>
          <Input id="tagline_ar" name="tagline_ar" defaultValue={forum?.tagline_ar ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tagline_en">{t('forumTaglineEn')}</Label>
          <Input
            id="tagline_en"
            name="tagline_en"
            dir="ltr"
            defaultValue={forum?.tagline_en ?? ''}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description_ar">{t('forumDescAr')}</Label>
        <Textarea
          id="description_ar"
          name="description_ar"
          defaultValue={forum?.description_ar ?? ''}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description_en">{t('forumDescEn')}</Label>
        <Textarea
          id="description_en"
          name="description_en"
          dir="ltr"
          defaultValue={forum?.description_en ?? ''}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mission_ar">{t('forumMissionAr')}</Label>
        <Textarea id="mission_ar" name="mission_ar" defaultValue={forum?.mission_ar ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mission_en">{t('forumMissionEn')}</Label>
        <Textarea
          id="mission_en"
          name="mission_en"
          dir="ltr"
          defaultValue={forum?.mission_en ?? ''}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="skills" hint={t('forumSkillsHint')}>
          {t('forumSkills')}
        </Label>
        <Input id="skills" name="skills" defaultValue={forum?.skills.join('، ') ?? ''} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="icon" hint={t('forumIconHint')}>
            {t('forumIcon')}
          </Label>
          <Input id="icon" name="icon" dir="ltr" defaultValue={forum?.icon ?? 'Sparkles'} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="color">{t('forumColor')}</Label>
          <select
            id="color"
            name="color"
            defaultValue={forum?.color ?? 'teal'}
            className={selectStyles}
          >
            <option value="teal">فيروزي</option>
            <option value="sage">أخضر</option>
            <option value="ember">برتقالي</option>
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
            defaultValue={forum?.capacity ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status">{t('forumStatus')}</Label>
          <select
            id="status"
            name="status"
            defaultValue={forum?.status ?? 'draft'}
            className={selectStyles}
          >
            <option value="draft">{t('statusDraft')}</option>
            <option value="published">{t('statusPublished')}</option>
            <option value="archived">{t('statusArchived')}</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="inline-flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="is_accepting"
            defaultChecked={forum?.is_accepting ?? true}
            className="size-4 rounded accent-[var(--primary)]"
          />
          {t('forumAccepting')}
        </label>
        <label className="inline-flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="auto_approve"
            defaultChecked={forum?.auto_approve ?? false}
            className="size-4 rounded accent-[var(--primary)]"
          />
          {t('forumAutoApprove')}
        </label>
        <div className="ms-auto w-32 space-y-1.5">
          <Label htmlFor="sort_order">{t('forumOrder')}</Label>
          <Input
            id="sort_order"
            name="sort_order"
            type="number"
            dir="ltr"
            defaultValue={forum?.sort_order ?? 0}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--border)] pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {tCommon('save')}
        </Button>
        {state.status === 'error' ? (
          <span role="alert" className="text-sm text-[var(--danger)]">
            {state.message === 'duplicate-slug'
              ? `${t('forumSlug')} — ${tCommon('error')}`
              : tCommon('error')}
          </span>
        ) : null}
      </div>
    </form>
  )
}
