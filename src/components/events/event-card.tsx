import { CalendarDays, MapPin, Video } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, localized } from '@/lib/utils'
import type { AtharEvent, Forum } from '@/lib/database.types'

export function EventCard({
  event,
  forum,
  locale,
  modeLabel,
}: {
  event: AtharEvent
  forum?: Forum
  locale: string
  modeLabel: string
}) {
  const ModeIcon = event.mode === 'online' ? Video : MapPin
  const place =
    event.mode === 'online'
      ? modeLabel
      : localized(event, 'location', locale) || modeLabel

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-shadow hover:shadow-[var(--shadow-soft)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-subtle)]">
          <CalendarDays className="size-3.5" aria-hidden />
          {formatDateTime(event.starts_at, locale)}
        </span>
        <Badge tone="neutral">{modeLabel}</Badge>
      </div>

      <h3 className="mt-3 text-lg font-semibold group-hover:text-[var(--primary)]">
        {localized(event, 'title', locale)}
      </h3>

      {localized(event, 'description', locale) ? (
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-[var(--fg-muted)]">
          {localized(event, 'description', locale)}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border)] pt-3.5 text-xs text-[var(--fg-subtle)]">
        <span className="inline-flex items-center gap-1.5">
          <ModeIcon className="size-3.5" aria-hidden />
          {place}
        </span>
        {forum ? <span>{localized(forum, 'name', locale)}</span> : null}
      </div>
    </Link>
  )
}
