import type { AnalyticsRealtime } from '@/lib/database.types'

/**
 * المتواجدون الآن.
 *
 * رقم واحد كبير، وثلاثون عمودًا تقول ماذا حدث في آخر نصف ساعة. هذه البطاقة
 * هي أول ما يُنظر إليه يوم التدشين: هل يدخل الناس فعلًا؟
 */

export function RealtimeCard({
  data,
  labels,
}: {
  data: AnalyticsRealtime
  labels: { now: string; lastHour: string; topNow: string; none: string; minutes: string }
}) {
  const max = Math.max(1, ...data.minutes.map((m) => m.views))

  return (
    <section className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)]">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--success)] opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-[var(--success)]" />
            </span>
            {labels.now}
          </p>
          <p className="font-latin mt-1 text-5xl font-semibold">{data.active_visitors}</p>
        </div>

        <div className="text-end">
          <p className="text-xs text-[var(--fg-muted)]">{labels.lastHour}</p>
          <p className="font-latin mt-1 text-xl font-semibold tabular-nums">
            {data.views_last_hour}
          </p>
        </div>
      </div>

      <p className="mt-5 text-xs text-[var(--fg-subtle)]">{labels.minutes}</p>
      <div className="mt-2 flex h-12 items-end gap-[3px]" aria-hidden>
        {data.minutes.length === 0
          ? Array.from({ length: 30 }, (_, i) => (
              <div key={i} className="flex-1 rounded-t bg-[var(--bg-subtle)]" style={{ height: 2 }} />
            ))
          : data.minutes.map((minute) => (
              <div
                key={minute.minute}
                className="flex-1 rounded-t bg-[var(--chart-1)]"
                style={{ height: `${Math.max(4, (minute.views / max) * 100)}%` }}
              />
            ))}
      </div>

      <p className="mt-5 text-xs font-medium text-[var(--fg-muted)]">{labels.topNow}</p>
      {data.top_now.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--fg-subtle)]">{labels.none}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {data.top_now.map((row) => (
            <li key={row.path} className="flex items-center justify-between gap-3 text-sm">
              <bdi className="min-w-0 truncate" title={row.path}>
                {row.path}
              </bdi>
              <span className="font-latin shrink-0 tabular-nums text-[var(--fg-muted)]">
                {row.views}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
