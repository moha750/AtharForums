'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { saveBanner, type AdminState } from '@/actions/admin'
import { ImageUpload } from '@/components/admin/image-upload'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/field'
import type { Banner } from '@/lib/database.types'

const initial: AdminState = { status: 'idle' }

const selectStyles =
  'h-11 w-full rounded-lg bg-[var(--surface)] px-3 text-[0.95rem] text-[var(--fg)] ring-1 ring-inset ring-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]'

export function BannerForm({
  banner,
  locale,
  startsAt,
  endsAt,
}: {
  banner?: Banner
  locale: string
  /** محسوبان على الخادم بتوقيت الرياض حتى لا يختلف الترطيب. */
  startsAt: string
  endsAt: string
}) {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const [state, action, pending] = useActionState(saveBanner, initial)

  const errors: Record<string, string> = {
    'cta-pair': t('bannerErrCtaPair'),
    'cta-href': t('bannerErrCtaHref'),
    window: t('bannerErrWindow'),
  }
  const message =
    state.status === 'error' ? (errors[state.message ?? ''] ?? tCommon('error')) : null

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      {banner ? <input type="hidden" name="id" value={banner.id} /> : null}

      <div className="space-y-2">
        <Label htmlFor="image">{t('bannerImage')}</Label>
        <div className="rounded-lg bg-[var(--primary-soft)] px-3.5 py-2.5 text-sm text-[var(--primary)]">
          <p className="font-medium">{t('bannerSizeTitle')}</p>
          <p className="mt-0.5 text-[var(--fg-muted)]">{t('bannerSizeHint')}</p>
        </div>
        <ImageUpload
          name="image_url"
          defaultUrl={banner?.image_url}
          folder="banners"
          ratio={{ w: 8, h: 3 }}
        />
      </div>

      <fieldset className="space-y-4 rounded-xl bg-[var(--bg-subtle)] p-4 ring-1 ring-[var(--border)]">
        <legend className="px-1 text-sm font-medium">{t('bannerTextGroup')}</legend>
        <p className="text-xs text-[var(--fg-subtle)]">{t('bannerTextHint')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="image_alt_ar" hint={t('bannerAltHint')}>
            {t('bannerAltAr')}
          </Label>
          <Input id="image_alt_ar" name="image_alt_ar" defaultValue={banner?.image_alt_ar ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="image_alt_en">{t('bannerAltEn')}</Label>
          <Input
            id="image_alt_en"
            name="image_alt_en"
            dir="ltr"
            defaultValue={banner?.image_alt_en ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title_ar">{t('bannerTitleAr')}</Label>
          <Input id="title_ar" name="title_ar" defaultValue={banner?.title_ar ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title_en">{t('bannerTitleEn')}</Label>
          <Input
            id="title_en"
            name="title_en"
            dir="ltr"
            defaultValue={banner?.title_en ?? ''}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="body_ar">{t('bannerBodyAr')}</Label>
          <Textarea id="body_ar" name="body_ar" defaultValue={banner?.body_ar ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="body_en">{t('bannerBodyEn')}</Label>
          <Textarea id="body_en" name="body_en" dir="ltr" defaultValue={banner?.body_en ?? ''} />
        </div>
      </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl bg-[var(--bg-subtle)] p-4 ring-1 ring-[var(--border)]">
        <legend className="px-1 text-sm font-medium">{t('bannerCta')}</legend>
        <p className="text-xs text-[var(--fg-subtle)]">{t('bannerCtaHint')}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="cta_label_ar">{t('bannerCtaLabelAr')}</Label>
            <Input
              id="cta_label_ar"
              name="cta_label_ar"
              defaultValue={banner?.cta_label_ar ?? ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cta_label_en">{t('bannerCtaLabelEn')}</Label>
            <Input
              id="cta_label_en"
              name="cta_label_en"
              dir="ltr"
              defaultValue={banner?.cta_label_en ?? ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cta_href" hint={t('bannerCtaHrefHint')}>
              {t('bannerCtaHref')}
            </Label>
            <Input
              id="cta_href"
              name="cta_href"
              dir="ltr"
              placeholder="/forums"
              defaultValue={banner?.cta_href ?? ''}
            />
          </div>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="status">{t('forumStatus')}</Label>
          <select
            id="status"
            name="status"
            defaultValue={banner?.status ?? 'draft'}
            className={selectStyles}
          >
            <option value="draft">{t('statusDraft')}</option>
            <option value="published">{t('statusPublished')}</option>
            <option value="archived">{t('statusArchived')}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="starts_at" hint={t('bannerTimeHint')}>
            {t('bannerStartsAt')}
          </Label>
          <Input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            dir="ltr"
            defaultValue={startsAt}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ends_at">{t('bannerEndsAt')}</Label>
          <Input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            dir="ltr"
            defaultValue={endsAt}
          />
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
            defaultValue={banner?.sort_order ?? 100}
          />
        </div>
      </div>

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
