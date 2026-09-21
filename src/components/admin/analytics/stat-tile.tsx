import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * بطاقة مؤشّر: الرقم، والفرق عن الفترة السابقة.
 *
 * الرقم وحده لا يقول شيئًا — «٤٢٠ زائرًا» جيّد أم سيّئ؟ الفرق عن الفترة
 * السابقة هو ما يحوّله إلى معلومة. ولهذا كل بطاقة هنا تحمل مقارنتها معها.
 *
 * اتجاه الخير ليس واحدًا: ارتفاع الزوار خير، وارتفاع معدّل الارتداد شرّ.
 * ولذلك اللون يتبع `higherIsBetter` لا يتبع الإشارة.
 */

export function StatTile({
  label,
  value,
  previous,
  suffix,
  higherIsBetter = true,
  hint,
  comparisonLabel,
}: {
  label: string
  value: number
  previous?: number
  suffix?: string
  higherIsBetter?: boolean
  hint?: string
  comparisonLabel?: string
}) {
  const hasComparison = typeof previous === 'number' && previous > 0
  const changePct = hasComparison ? ((value - previous) / previous) * 100 : 0
  const flat = !hasComparison || Math.abs(changePct) < 0.5
  const good = higherIsBetter ? changePct > 0 : changePct < 0

  const Icon = flat ? Minus : changePct > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <div className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
      <p className="text-sm text-[var(--fg-muted)]">{label}</p>

      <p className="font-latin mt-2 text-3xl font-semibold">
        {formatValue(value)}
        {suffix ? <span className="text-xl text-[var(--fg-muted)]">{suffix}</span> : null}
      </p>

      {hasComparison ? (
        <p
          className={cn(
            'mt-2 inline-flex items-center gap-1 text-xs font-medium',
            flat
              ? 'text-[var(--fg-subtle)]'
              : good
                ? 'text-[var(--success)]'
                : 'text-[var(--danger)]'
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          <span className="font-latin tabular-nums">
            {flat ? '—' : `${Math.abs(changePct).toFixed(1)}%`}
          </span>
          {comparisonLabel ? (
            <span className="font-normal text-[var(--fg-subtle)]">{comparisonLabel}</span>
          ) : null}
        </p>
      ) : hint ? (
        <p className="mt-2 text-xs text-[var(--fg-subtle)]">{hint}</p>
      ) : null}
    </div>
  )
}

/** ١٬٢٨٤ يُكتب كما هو، و١٢٩٠٠ تصير 12.9K — الأرقام الطويلة لا تُقرأ. */
function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 10_000) return `${(value / 1_000).toFixed(1)}K`
  return new Intl.NumberFormat('en-US').format(Math.round(value * 100) / 100)
}

/** المدّة بصيغة يفهمها الإنسان: ٢:٢٧ لا ١٤٧ ثانية. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
