import type { AnalyticsRow } from '@/lib/database.types'

/**
 * قائمة تفصيل: صفحات، مصادر، أجهزة، دول…
 *
 * شريط أفقي لا دائرة: مقارنة الأطوال أدقّ من مقارنة الزوايا، والأسماء العربية
 * تُقرأ كاملة إلى جانب الشريط بدل أن تُحشر في وسيلة إيضاح.
 *
 * لون واحد لا ألوان: هذه مقادير من نوع واحد لا فئات مختلفة. تلوين كل صفّ
 * بلون يوحي بفرق في النوع لا وجود له.
 */

export function BreakdownList({
  title,
  rows,
  valueLabel,
  emptyLabel,
  formatLabel,
}: {
  title: string
  rows: AnalyticsRow[]
  valueLabel: string
  emptyLabel: string
  formatLabel?: (label: string) => string
}) {
  const max = Math.max(1, ...rows.map((row) => row.pageviews))

  return (
    <section className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-[var(--fg-subtle)]">{valueLabel}</span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-center text-sm text-[var(--fg-subtle)]">{emptyLabel}</p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                {/* bdi يعزل النصّ اللاتيني داخل فقرة عربية. بدونه تنتقل
                    الشرطة المائلة إلى آخر المسار فيصير /ar مكتوبًا ar/ */}
                <bdi className="min-w-0 flex-1 truncate" title={row.label}>
                  {formatLabel ? formatLabel(row.label) : row.label}
                </bdi>
                <span className="font-latin shrink-0 tabular-nums text-[var(--fg-muted)]">
                  {row.pageviews}
                </span>
                <span className="font-latin w-12 shrink-0 text-end text-xs tabular-nums text-[var(--fg-subtle)]">
                  {row.share}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                <div
                  className="h-full rounded-full bg-[var(--chart-1)]"
                  style={{ width: `${Math.max(2, (row.pageviews / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
