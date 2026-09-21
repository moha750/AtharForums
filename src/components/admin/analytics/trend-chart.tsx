'use client'

import { useMemo, useRef, useState } from 'react'

import type { AnalyticsPoint } from '@/lib/database.types'

/**
 * النقطة تصل ومعها تسميتها جاهزة. السبب دقيق: تنسيق التواريخ بالعربية يختلف
 * بين محرّك Node ومحرّك المتصفّح (بيانات ICU ليست واحدة)، فلو نسّقنا هنا
 * لاختلف نصّ الخادم عن نصّ المتصفّح وانكسر الترطيب. التنسيق على الخادم وحده.
 */
export interface TrendPoint extends AnalyticsPoint {
  label: string
}

/**
 * منحنى الزوار والمشاهدات عبر الزمن.
 *
 * سلسلتان لا أكثر، ومحور رأسي واحد: خلط مقياسين في رسم واحد أشهر خطأ في
 * لوحات المعلومات — يجعل تقاطع الخطين يبدو حدثًا وهو صدفة في الأرقام.
 * المشاهدات دائمًا أكبر من الزوار، فيشتركان في المقياس نفسه بلا تشويه.
 *
 * الاتجاه: في العربية يسير الزمن من اليمين إلى اليسار كالقراءة. SVG لا يعكس
 * نفسه، فنعكس حساب المحور الأفقي يدويًا بدل قلب الرسم كلّه (القلب يقلب
 * النصوص معه فتصير مرآة).
 */

interface Props {
  points: TrendPoint[]
  rtl: boolean
  labels: { visitors: string; pageviews: string; empty: string }
}

const W = 900
const H = 280
const PAD = { top: 16, right: 16, bottom: 30, left: 44 }

export function TrendChart({ points, rtl, labels }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const max = useMemo(
    () => Math.max(1, ...points.map((p) => Math.max(p.pageviews, p.visitors))),
    [points]
  )

  const niceMax = useMemo(() => {
    const raw = max * 1.15
    const magnitude = 10 ** Math.floor(Math.log10(raw))
    return Math.ceil(raw / magnitude) * magnitude
  }, [max])

  if (points.length === 0) {
    return (
      <div className="grid h-[280px] place-items-center text-sm text-[var(--fg-subtle)]">
        {labels.empty}
      </div>
    )
  }

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const step = points.length > 1 ? innerW / (points.length - 1) : 0

  const x = (index: number) =>
    rtl ? PAD.left + innerW - index * step : PAD.left + index * step
  const y = (value: number) => PAD.top + innerH - (value / niceMax) * innerH

  const line = (pick: (p: TrendPoint) => number) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ')

  const area =
    `${line((p) => p.visitors)} L${x(points.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)}` +
    ` L${x(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(niceMax * t))

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * W
    const ratio = (px - PAD.left) / innerW
    const raw = rtl ? (1 - ratio) * (points.length - 1) : ratio * (points.length - 1)
    const index = Math.round(raw)
    setHover(index >= 0 && index < points.length ? index : null)
  }

  const active = hover === null ? null : points[hover]
  // عدد التسميات الأفقية يتناقص مع كثرة النقاط حتى لا تتراكب
  const labelEvery = Math.max(1, Math.ceil(points.length / 7))

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-[var(--fg-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[var(--chart-1)]" aria-hidden />
          {labels.visitors}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[var(--chart-2)]" aria-hidden />
          {labels.pageviews}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-[280px] w-full touch-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`${labels.visitors} · ${labels.pageviews}`}
      >
        {ticks.map((tick) => {
          const ty = y(tick)
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={ty}
                y2={ty}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={rtl ? W - PAD.right + 8 : PAD.left - 8}
                y={ty + 4}
                textAnchor={rtl ? 'start' : 'end'}
                className="font-latin fill-[var(--fg-subtle)] text-[11px] tabular-nums"
              >
                {tick}
              </text>
            </g>
          )
        })}

        <path d={area} fill="var(--chart-1)" fillOpacity={0.1} />
        <path
          d={line((p) => p.visitors)}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={line((p) => p.pageviews)}
          fill="none"
          stroke="var(--chart-2)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) =>
          index % labelEvery === 0 ? (
            <text
              key={point.bucket}
              x={x(index)}
              y={H - 8}
              textAnchor="middle"
              className="font-latin fill-[var(--fg-subtle)] text-[11px]"
            >
              {point.label}
            </text>
          ) : null
        )}

        {hover !== null && active ? (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--fg-subtle)"
              strokeWidth={1}
            />
            <circle
              cx={x(hover)}
              cy={y(active.pageviews)}
              r={5}
              fill="var(--chart-2)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
            <circle
              cx={x(hover)}
              cy={y(active.visitors)}
              r={5}
              fill="var(--chart-1)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          </g>
        ) : null}
      </svg>

      {hover !== null && active ? (
        <div
          className="pointer-events-none absolute top-8 z-10 min-w-40 rounded-xl bg-[var(--surface-raised)] p-3 text-xs shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]"
          style={{
            insetInlineStart: `${rtl ? 100 - (x(hover) / W) * 100 : (x(hover) / W) * 100}%`,
            transform: 'translateX(0)',
          }}
        >
          <p className="font-medium">{active.label}</p>
          <p className="mt-1.5 flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-[var(--fg-muted)]">
              <span className="size-2 rounded-full bg-[var(--chart-1)]" aria-hidden />
              {labels.visitors}
            </span>
            <span className="font-latin tabular-nums">{active.visitors}</span>
          </p>
          <p className="mt-1 flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-[var(--fg-muted)]">
              <span className="size-2 rounded-full bg-[var(--chart-2)]" aria-hidden />
              {labels.pageviews}
            </span>
            <span className="font-latin tabular-nums">{active.pageviews}</span>
          </p>
        </div>
      ) : null}
    </div>
  )
}
