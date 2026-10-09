import { getTranslations } from 'next-intl/server'

import type { QrEventKind, QrLinkEvent } from '@/lib/database.types'
import { formatDateTime } from '@/lib/utils'

/** سطر الواقعة: من فعل ماذا ومتى، والقيمتان حين تفيدان. */
export async function EventLog({
  events,
  names,
  locale,
  emptyLabel,
}: {
  events: Array<Pick<QrLinkEvent, 'id' | 'kind' | 'actor_id' | 'old_value' | 'new_value' | 'at'>>
  names: Map<string, string>
  locale: string
  emptyLabel: string
}) {
  const t = await getTranslations('qr')
  if (events.length === 0) return <p className="text-sm text-[var(--fg-subtle)]">{emptyLabel}</p>

  const actor = (id: string | null) => (id ? names.get(id) ?? t('common.deletedAccount') : t('events.system'))

  return (
    <ol className="space-y-2.5">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <span className="font-medium">{actor(event.actor_id)}</span>
          <span className="text-[var(--fg-muted)]">{eventLabel(t, event.kind, event.new_value)}</span>
          <EventDetail kind={event.kind} oldValue={event.old_value} newValue={event.new_value} names={names} />
          <time className="ms-auto text-xs text-[var(--fg-subtle)]" dateTime={event.at}>
            {formatDateTime(event.at, locale)}
          </time>
        </li>
      ))}
    </ol>
  )
}

type T = Awaited<ReturnType<typeof getTranslations<'qr'>>>

export function eventLabel(t: T, kind: QrEventKind, newValue: string | null): string {
  if (kind === 'active') return newValue === 'true' ? t('events.activeOn') : t('events.activeOff')
  return t(`events.${kind}`)
}

export function EventDetail({
  kind,
  oldValue,
  newValue,
  names,
}: {
  kind: QrEventKind
  oldValue: string | null
  newValue: string | null
  names?: Map<string, string>
}) {
  const pair = (a: string | null, b: string | null, latin = false) => (
    <span dir={latin ? 'ltr' : undefined} className={latin ? 'font-latin text-xs text-[var(--fg-subtle)]' : 'text-[var(--fg-subtle)]'}>
      <bdi>{a ?? '—'}</bdi> → <bdi className="text-[var(--fg)]">{b ?? '—'}</bdi>
    </span>
  )
  switch (kind) {
    case 'target':
      return pair(shortUrl(oldValue), shortUrl(newValue), true)
    case 'title':
    case 'campaign':
      return pair(oldValue, newValue)
    case 'owner':
      return pair(oldValue ? (names?.get(oldValue) ?? '…') : null, newValue ? (names?.get(newValue) ?? '…') : null)
    case 'delete':
      return <span className="text-[var(--fg-subtle)]"><bdi>{newValue}</bdi> · <bdi dir="ltr" className="font-latin text-xs">{oldValue}</bdi></span>
    default:
      return null
  }
}

/** الرابط بلا بروتوكول ومقصوصًا — يكفي ليُعرف دون أن يطغى على السطر. */
function shortUrl(url: string | null): string | null {
  if (!url) return null
  const bare = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  return bare.length > 48 ? `${bare.slice(0, 47)}…` : bare
}
