import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { EventForm } from '@/components/admin/event-form'
import { adminEvent, adminForums } from '@/lib/admin-data'

export const dynamic = 'force-dynamic'

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const [t, event, forums] = await Promise.all([
    getTranslations('admin'),
    adminEvent(id),
    adminForums(),
  ])
  if (!event) notFound()

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('navEvents')}</h1>
      <div className="mt-6 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        <EventForm event={event} forums={forums} locale={locale} />
      </div>
    </div>
  )
}
