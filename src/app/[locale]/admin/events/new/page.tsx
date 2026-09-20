import { getTranslations } from 'next-intl/server'
import { EventForm } from '@/components/admin/event-form'
import { adminForums } from '@/lib/admin-data'

export const dynamic = 'force-dynamic'

export default async function NewEventPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [t, forums] = await Promise.all([getTranslations('admin'), adminForums()])
  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('navEvents')}</h1>
      <div className="mt-6 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        <EventForm forums={forums} locale={locale} />
      </div>
    </div>
  )
}
