import { cn } from '@/lib/utils'

/**
 * مسار التحوّل: من رأى الصفحة، ومن فعل شيئًا بعدها.
 *
 * هذا هو الرقم الذي يُبنى عليه قرار. «١٧٦ فتحوا صفحة منتدى التقنية وطلب
 * الانضمام ١٤» يقول شيئًا عن الصفحة؛ «١٧٦ مشاهدة» لا يقول شيئًا.
 *
 * النسبة الضعيفة ليست دائمًا مشكلة، لذلك لا نلوّنها بالأحمر: صفحة تشويقية
 * تحوّل ١٥٪ ممتازة، وصفحة دخول تحوّل ١٥٪ كارثة. الحكم للسياق لا للّون.
 */

export function FunnelRow({
  label,
  sublabel,
  views,
  completions,
  rate,
  labels,
}: {
  label: string
  sublabel?: string
  views: number
  completions: number
  rate?: number
  labels: { views: string; completed: string }
}) {
  const pct = typeof rate === 'number' ? rate : views === 0 ? 0 : (completions / views) * 100

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{label}</p>
          {sublabel ? <p className="truncate text-xs text-[var(--fg-subtle)]">{sublabel}</p> : null}
        </div>
        <p className="font-latin shrink-0 text-sm font-semibold tabular-nums">
          {pct.toFixed(1)}%
        </p>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
        <div
          className="h-full rounded-full bg-[var(--chart-2)]"
          style={{ width: `${Math.min(100, Math.max(1.5, pct))}%` }}
        />
      </div>

      <p className="mt-1.5 flex items-center gap-3 text-xs text-[var(--fg-subtle)]">
        <span>
          {labels.views} <span className="font-latin tabular-nums">{views}</span>
        </span>
        <span aria-hidden>·</span>
        <span>
          {labels.completed} <span className="font-latin tabular-nums">{completions}</span>
        </span>
      </p>
    </li>
  )
}

export function FunnelCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn('rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]', className)}
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? (
        <p className="mt-1 text-xs text-[var(--fg-subtle)]">{description}</p>
      ) : null}
      <ul className="mt-4 divide-y divide-[var(--border)]">{children}</ul>
    </section>
  )
}
