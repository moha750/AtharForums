import { cn } from '@/lib/utils'

/**
 * رسوم إحصاء الباركود — SVG وHTML يرسمهما الخادم، بلون الرسوم الأول
 * (‎--chart-1‎ المتحقَّق منه لعمى الألوان). سلسلة واحدة في كل رسم، فلا
 * وسيلة إيضاح ولا ألوان تتنافس.
 *
 * الزمن في العربية يسير من اليمين إلى اليسار كالقراءة — نعكس الترتيب لا
 * الرسم، فلا تنقلب النصوص.
 */

function niceMax(max: number): number {
  if (max <= 4) return Math.max(1, max)
  const raw = max * 1.1
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  return Math.ceil(raw / magnitude) * magnitude
}

export function SeriesChart({
  points,
  rtl,
  label,
}: {
  points: Array<{ key: string; label: string; value: number }>
  rtl: boolean
  label: string
}) {
  const W = 900
  const H = 240
  const pad = { top: 12, bottom: 28, side: 40 }
  const innerW = W - pad.side * 2
  const innerH = H - pad.top - pad.bottom
  const top = niceMax(Math.max(0, ...points.map((p) => p.value)))
  const slot = innerW / Math.max(points.length, 1)
  const bar = Math.max(1.5, Math.min(slot * 0.72, 28))
  const every = Math.max(1, Math.ceil(points.length / 8))
  const ordered = rtl ? [...points].reverse() : points
  const ticks = [0, 0.5, 1].map((r) => Math.round(top * r))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-60 w-full" role="img" aria-label={label}>
      {ticks.map((tick) => {
        const y = pad.top + innerH - (tick / top) * innerH
        return (
          <g key={tick}>
            <line x1={pad.side} x2={W - pad.side} y1={y} y2={y} stroke="var(--border)" />
            <text
              x={rtl ? W - pad.side + 6 : pad.side - 6}
              y={y + 4}
              textAnchor={rtl ? 'start' : 'end'}
              className="font-latin fill-[var(--fg-subtle)] text-[11px] tabular-nums"
            >
              {tick}
            </text>
          </g>
        )
      })}
      {ordered.map((point, i) => {
        const h = (point.value / top) * innerH
        const x = pad.side + i * slot + (slot - bar) / 2
        const originalIndex = rtl ? points.length - 1 - i : i
        return (
          <g key={point.key}>
            <rect
              x={x}
              y={pad.top + innerH - h}
              width={bar}
              height={Math.max(h, point.value > 0 ? 1.5 : 0)}
              rx={Math.min(3, bar / 3)}
              fill="var(--chart-1)"
            >
              <title>{`${point.label}: ${point.value}`}</title>
            </rect>
            {originalIndex % every === 0 ? (
              <text
                x={x + bar / 2}
                y={H - 8}
                textAnchor="middle"
                className="fill-[var(--fg-subtle)] text-[11px]"
              >
                {point.label}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

export function HoursChart({ hours, label, hourLabel }: { hours: number[]; label: string; hourLabel: (h: number) => string }) {
  const top = Math.max(1, ...hours)
  return (
    <div role="img" aria-label={label}>
      <div className="flex h-36 items-end gap-[3px]" dir="ltr">
        {hours.map((value, hour) => (
          <div key={hour} className="flex h-full flex-1 flex-col justify-end" title={`${hourLabel(hour)}: ${value}`}>
            <div
              className="rounded-t-sm bg-[var(--chart-1)]"
              style={{ height: `${value > 0 ? Math.max(3, (value / top) * 100) : 0}%` }}
            />
          </div>
        ))}
      </div>
      <div className="font-latin mt-1.5 flex justify-between text-[11px] text-[var(--fg-subtle)]" dir="ltr">
        <span>0</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
    </div>
  )
}

/** أيام الأسبوع × الساعات — كثافة اللون مقدار، لا فئة. */
export function Heatmap({
  grid,
  days,
  label,
  cellLabel,
}: {
  grid: number[][]
  days: string[]
  label: string
  cellLabel: (day: string, hour: number, value: number) => string
}) {
  const top = Math.max(1, ...grid.flat())
  return (
    <div role="img" aria-label={label} className="overflow-x-auto">
      <div className="min-w-[36rem] space-y-[3px]">
        {grid.map((row, d) => (
          <div key={d} className="flex items-center gap-2">
            <span className="w-16 shrink-0 truncate text-xs text-[var(--fg-muted)]">{days[d]}</span>
            <div className="grid flex-1 grid-cols-24 gap-[3px]" dir="ltr">
              {row.map((value, h) => (
                <span
                  key={h}
                  title={cellLabel(days[d]!, h, value)}
                  className={cn('aspect-square rounded-[3px]', value === 0 && 'bg-[var(--bg-subtle)] ring-1 ring-inset ring-[var(--border)]')}
                  style={value > 0 ? { background: 'var(--chart-1)', opacity: 0.18 + 0.82 * (value / top) } : undefined}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0" />
          <div className="font-latin flex flex-1 justify-between text-[11px] text-[var(--fg-subtle)]" dir="ltr">
            <span>0</span>
            <span>6</span>
            <span>12</span>
            <span>18</span>
            <span>23</span>
          </div>
        </div>
      </div>
    </div>
  )
}
