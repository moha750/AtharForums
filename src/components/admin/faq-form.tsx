'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { saveFaq, type AdminState } from '@/actions/admin'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/field'
import type { Faq } from '@/lib/database.types'

const initial: AdminState = { status: 'idle' }

const selectStyles =
  'h-11 w-full rounded-lg bg-[var(--surface)] px-3 text-[0.95rem] text-[var(--fg)] ring-1 ring-inset ring-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]'

export function FaqForm({ faq, locale }: { faq?: Faq; locale: string }) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const [state, action, pending] = useActionState(saveFaq, initial)

  const message =
    state.status === 'error'
      ? state.message === 'duplicate-slug'
        ? t('faqErrDuplicate')
        : tCommon('error')
      : null

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      {faq ? <input type="hidden" name="id" value={faq.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="question_ar">{t('faqQuestionAr')}</Label>
          <Input id="question_ar" name="question_ar" required defaultValue={faq?.question_ar ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="question_en">{t('faqQuestionEn')}</Label>
          <Input
            id="question_en"
            name="question_en"
            dir="ltr"
            defaultValue={faq?.question_en ?? ''}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="answer_ar">{t('faqAnswerAr')}</Label>
        <Textarea
          id="answer_ar"
          name="answer_ar"
          required
          className="min-h-36"
          defaultValue={faq?.answer_ar ?? ''}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="answer_en">{t('faqAnswerEn')}</Label>
        <Textarea
          id="answer_en"
          name="answer_en"
          dir="ltr"
          className="min-h-36"
          defaultValue={faq?.answer_en ?? ''}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="slug" hint={t('faqSlugHint')}>
            {t('forumSlug')}
          </Label>
          <Input
            id="slug"
            name="slug"
            required
            dir="ltr"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            defaultValue={faq?.slug ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status">{t('forumStatus')}</Label>
          <select
            id="status"
            name="status"
            defaultValue={faq?.status ?? 'published'}
            className={selectStyles}
          >
            <option value="draft">{t('statusDraft')}</option>
            <option value="published">{t('statusPublished')}</option>
            <option value="archived">{t('statusArchived')}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sort_order" hint={t('bannerOrderHint')}>
            {t('bannerOrder')}
          </Label>
          <Input
            id="sort_order"
            name="sort_order"
            type="number"
            min={0}
            max={9999}
            dir="ltr"
            defaultValue={faq?.sort_order ?? 100}
          />
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-xl bg-[var(--bg-subtle)] p-4 ring-1 ring-[var(--border)]">
        <input
          type="checkbox"
          name="is_featured"
          defaultChecked={faq?.is_featured ?? false}
          className="mt-0.5 size-4 accent-[var(--primary)]"
        />
        <span>
          <span className="block text-sm font-medium">{t('faqFeatured')}</span>
          <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
            {t('faqFeaturedHint')}
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
