import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Link, redirect } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { EventDetail, eventLabel } from '@/components/qr/event-log'
import { OversightTable } from '@/components/qr/oversight-table'
import { generatorHolders, getQrPermissions, overseeEvents, overseeLinks, people, sweepTrash } from '@/lib/qr/server'
import { hostOf } from '@/lib/qr/target'
import { formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function QrOversightPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const perms = await getQrPermissions()
  if (!perms.oversee) redirect({ href: '/qr', locale })

  await sweepTrash()
  const [t, links, events, holders] = await Promise.all([
    getTranslations('qr'),
    overseeLinks(),
    overseeEvents(60),
    generatorHolders(),
  ])
  const ownerNames = await people(events.filter((e) => e.kind === 'owner').flatMap((e) => [e.old_value, e.new_value]))

  const alertTone = { pending: 'neutral', sent: 'success', failed: 'danger', off: 'warning' } as const
  const alertLabel = {
    pending: t('oversight.alertPending'),
    sent: t('oversight.alertSent'),
    failed: t('oversight.alertFailed'),
    off: t('oversight.alertOff'),
  } as const

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">{t('oversight.title')}</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('oversight.lead')}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t('oversight.all')}</h2>
        <OversightTable
          locale={locale}
          holders={holders}
          rows={links.map((l) => ({
            id: l.id,
            code: l.code,
            title: l.title,
            kind: l.kind,
            host: hostOf(l.target_url),
            active: l.active,
            scans: l.scan_count,
            ownerId: l.owner_id,
            ownerName: l.owner_name,
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t('oversight.events')}</h2>
        {events.length === 0 ? (
          <p className="text-sm text-[var(--fg-subtle)]">{t('settings.eventsEmpty')}</p>
        ) : (
          <ol className="divide-y divide-[var(--border)] rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-3 text-sm">
                <span className="font-medium">{e.actor_name ?? (e.actor_id ? t('common.deletedAccount') : t('events.system'))}</span>
                <span className="text-[var(--fg-muted)]">{eventLabel(t, e.kind, e.new_value)}</span>
                {e.kind !== 'delete' && e.link_title ? (
                  <Link href={`/qr/${e.link_id}`} className="font-medium text-[var(--primary)] hover:underline">
                    {e.link_title}
                  </Link>
                ) : null}
                <EventDetail kind={e.kind} oldValue={e.old_value} newValue={e.new_value} names={ownerNames} />
                {(e.kind === 'target' || e.kind === 'schedule') && e.alert_status ? (
                  <Badge tone={alertTone[e.alert_status]} className="py-0.5">
                    {t('oversight.alert')}: {alertLabel[e.alert_status]}
                  </Badge>
                ) : null}
                <time className="ms-auto text-xs text-[var(--fg-subtle)]" dateTime={e.at}>
                  {formatDateTime(e.at, locale)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
