'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { saveBoardMember, type AdminState } from '@/actions/admin'
import { ImageUpload } from '@/components/admin/image-upload'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/field'
import type { BoardMember } from '@/lib/database.types'

const initial: AdminState = { status: 'idle' }

const selectStyles =
  'h-11 w-full rounded-lg bg-[var(--surface)] px-3 text-[0.95rem] text-[var(--fg)] ring-1 ring-inset ring-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]'

export function BoardForm({ member, locale }: { member?: BoardMember; locale: string }) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const [state, action, pending] = useActionState(saveBoardMember, initial)

  const message =
    state.status === 'error'
      ? state.message === 'photo'
        ? t('boardErrPhoto')
        : tCommon('error')
      : null

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      {member ? <input type="hidden" name="id" value={member.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('boardPhoto')}</p>
          <ImageUpload
            name="photo_url"
            defaultUrl={member?.photo_url}
            folder="board"
            ratio={{ w: 1, h: 1 }}
            shape="circle"
            outputWidth={800}
            className="max-w-48"
          />
        </div>
        <div className="rounded-lg bg-[var(--primary-soft)] px-3.5 py-2.5 text-sm text-[var(--primary)] sm:mt-7">
          <p className="font-medium">{t('boardPhotoTitle')}</p>
          <p className="mt-0.5 text-[var(--fg-muted)]">{t('boardPhotoHint')}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name_ar">{t('boardNameAr')}</Label>
          <Input id="name_ar" name="name_ar" required minLength={2} defaultValue={member?.name_ar ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name_en">{t('boardNameEn')}</Label>
          <Input id="name_en" name="name_en" dir="ltr" defaultValue={member?.name_en ?? ''} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="position_ar" hint={t('boardPositionHint')}>
            {t('boardPositionAr')}
          </Label>
          <Input
            id="position_ar"
            name="position_ar"
            required
            minLength={2}
            defaultValue={member?.position_ar ?? ''}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="position_en">{t('boardPositionEn')}</Label>
          <Input
            id="position_en"
            name="position_en"
            dir="ltr"
            defaultValue={member?.position_en ?? ''}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="role_ar" hint={t('boardRoleHint')}>
            {t('boardRoleAr')}
          </Label>
          <Textarea
            id="role_ar"
            name="role_ar"
            maxLength={300}
            className="min-h-24"
            defaultValue={member?.role_ar ?? ''}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role_en">{t('boardRoleEn')}</Label>
          <Textarea
            id="role_en"
            name="role_en"
            dir="ltr"
            maxLength={300}
            className="min-h-24"
            defaultValue={member?.role_en ?? ''}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="tier" hint={t('boardTierHint')}>
            {t('boardTier')}
          </Label>
          <select
            id="tier"
            name="tier"
            defaultValue={String(member?.tier ?? 2)}
            className={selectStyles}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {t('boardTierN', { n: String(n) })}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sort_order" hint={t('boardOrderHint')}>
            {t('bannerOrder')}
          </Label>
          <Input
            id="sort_order"
            name="sort_order"
            type="number"
            min={0}
            max={9999}
            dir="ltr"
            defaultValue={member?.sort_order ?? 100}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status">{t('forumStatus')}</Label>
          <select
            id="status"
            name="status"
            defaultValue={member?.status ?? 'published'}
            className={selectStyles}
          >
            <option value="draft">{t('statusDraft')}</option>
            <option value="published">{t('statusPublished')}</option>
            <option value="archived">{t('statusArchived')}</option>
          </select>
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-xl bg-[var(--bg-subtle)] p-4 ring-1 ring-[var(--border)]">
        <input
          type="checkbox"
          name="is_featured"
          defaultChecked={member?.is_featured ?? false}
          className="mt-0.5 size-4 accent-[var(--primary)]"
        />
        <span>
          <span className="block text-sm font-medium">{t('boardFeatured')}</span>
          <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
            {t('boardFeaturedHint')}
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3 border-t border-[var(--border)] pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {tCommon('save')}
        </Button>
        {message ? (
          <span role="alert" className="text-sm text-[var(--danger)]">
            {message}
          </span>
        ) : null}
      </div>
    </form>
  )
}
