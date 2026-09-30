import { Plus, Star } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { Button, buttonStyles } from '@/components/ui/button'
import { deleteFaq } from '@/actions/admin'
import { adminFaqs } from '@/lib/admin-data'
import { localized } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminFaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [t, tCommon, faqs] = await Promise.all([
    getTranslations('admin'),
    getTranslations('common'),
    adminFaqs(),
  ])

  const tone = { published: 'success', draft: 'warning', archived: 'neutral' } as const
  const label = {
    published: t('statusPublished'),
    draft: t('statusDraft'),
    archived: t('statusArchived'),
  } as const

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('navFaq')}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('faqLead')}</p>
        </div>
        <Link href="/admin/faq/new" className={buttonStyles('primary', 'sm')}>
          <Plus className="size-4" aria-hidden />
          {t('faqNew')}
        </Link>
      </div>

      {faqs.length === 0 ? (
        <p className="mt-8 rounded-xl bg-[var(--bg-subtle)] p-8 text-center text-sm text-[var(--fg-muted)] ring-1 ring-[var(--border)]">
          {t('faqEmpty')}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {faqs.map((faq) => (
            <li
              key={faq.id}
              className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{localized(faq, 'question', locale)}</p>
                  <Badge tone={tone[faq.status]}>{label[faq.status]}</Badge>
                  {faq.is_featured ? (
                    <span
                      title={t('faqFeatured')}
                      className="inline-flex items-center gap-1 text-xs text-[var(--accent)]"
                    >
                      <Star className="size-3.5 fill-current" aria-hidden />
                      {t('faqFeatured')}
                    </span>
                  ) : null}
                </div>
                <p className="font-latin mt-1 text-xs text-[var(--fg-subtle)]" dir="ltr">
                  {faq.slug} · {faq.sort_order}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/admin/faq/${faq.id}`} className={buttonStyles('secondary', 'sm')}>
                  {tCommon('edit')}
                </Link>
                <form action={deleteFaq}>
                  <input type="hidden" name="id" value={faq.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    {tCommon('delete')}
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
