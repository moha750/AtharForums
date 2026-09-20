import { Plus } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { Button, buttonStyles } from '@/components/ui/button'
import { deleteEvent } from '@/actions/admin'
import { adminEvents } from '@/lib/admin-data'
import { formatDateTime, localized } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminEventsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const [t, tCommon, events] = await Promise.all([
    getTranslations('admin'),
    getTranslations('common'),
    adminEvents(),
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
        <h1 className="text-2xl font-semibold">{t('navEvents')}</h1>
        <Link href="/admin/events/new" className={buttonStyles('primary', 'sm')}>
          <Plus className="size-4" aria-hidden />
          {t('navEvents')}
        </Link>
      </div>

      <ul className="mt-6 space-y-3">
        {events.map((event) => (
          <li
            key={event.id}
            className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{localized(event, 'title', locale)}</p>
                <Badge tone={tone[event.status]}>{label[event.status]}</Badge>
              </div>
              <p className="mt-1 text-xs text-[var(--fg-subtle)]">
                {formatDateTime(event.starts_at, locale)} · {event.registrations_count}
                {event.capacity ? `/${event.capacity}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/admin/events/${event.id}`} className={buttonStyles('secondary', 'sm')}>
                {tCommon('edit')}
              </Link>
              <form action={deleteEvent}>
                <input type="hidden" name="id" value={event.id} />
                <Button type="submit" variant="ghost" size="sm">
                  {tCommon('delete')}
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
