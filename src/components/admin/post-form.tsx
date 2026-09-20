'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { savePost, type AdminState } from '@/actions/admin'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/field'
import { localized } from '@/lib/utils'
import type { Forum, Post } from '@/lib/database.types'

const initial: AdminState = { status: 'idle' }

const selectStyles =
  'h-11 w-full rounded-lg bg-[var(--surface)] px-3 text-[0.95rem] text-[var(--fg)] ring-1 ring-inset ring-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]'

export function PostForm({
  post,
  forums,
  locale,
}: {
  post?: Post
  forums: Forum[]
  locale: string
}) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const [state, action, pending] = useActionState(savePost, initial)

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      {post ? <input type="hidden" name="id" value={post.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="title_ar">{t('forumNameAr')}</Label>
          <Input id="title_ar" name="title_ar" required defaultValue={post?.title_ar ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title_en">{t('forumNameEn')}</Label>
          <Input id="title_en" name="title_en" dir="ltr" defaultValue={post?.title_en ?? ''} />
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
            defaultValue={post?.slug ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="forum_id">{t('navForums')}</Label>
          <select
            id="forum_id"
            name="forum_id"
            defaultValue={post?.forum_id ?? ''}
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
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="excerpt_ar">AR — {t('forumTaglineAr')}</Label>
        <Textarea id="excerpt_ar" name="excerpt_ar" defaultValue={post?.excerpt_ar ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="excerpt_en">EN — {t('forumTaglineEn')}</Label>
        <Textarea
          id="excerpt_en"
          name="excerpt_en"
          dir="ltr"
          defaultValue={post?.excerpt_en ?? ''}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body_ar">AR</Label>
        <Textarea
          id="body_ar"
          name="body_ar"
          className="min-h-64"
          defaultValue={post?.body_ar ?? ''}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="body_en">EN</Label>
        <Textarea
          id="body_en"
          name="body_en"
          dir="ltr"
          className="min-h-64"
          defaultValue={post?.body_en ?? ''}
        />
      </div>

      <div className="flex items-end gap-4">
        <div className="w-48 space-y-1.5">
          <Label htmlFor="status">{t('forumStatus')}</Label>
          <select
            id="status"
            name="status"
            defaultValue={post?.status ?? 'draft'}
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
