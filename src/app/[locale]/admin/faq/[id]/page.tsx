import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { FaqForm } from '@/components/admin/faq-form'
import { adminFaq } from '@/lib/admin-data'

export const dynamic = 'force-dynamic'

export default async function EditFaqPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const [t, faq] = await Promise.all([getTranslations('admin'), adminFaq(id)])
  if (!faq) notFound()

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('navFaq')}</h1>
      <div className="mt-6 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        <FaqForm faq={faq} locale={locale} />
      </div>
    </div>
  )
}
