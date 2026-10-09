/** مؤشّرات الرأس — بنمط بطاقات نظرة عامّة في لوحة التحكم. */
export function KpiRow({ items }: { items: Array<{ label: string; value: number | string; hint?: string }> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
          <p className="text-sm text-[var(--fg-muted)]">{item.label}</p>
          <p className="font-latin mt-2 text-3xl font-semibold tabular-nums">
            {typeof item.value === 'number' ? new Intl.NumberFormat('en-US').format(item.value) : item.value}
          </p>
          {item.hint ? <p className="mt-1 truncate text-xs text-[var(--fg-subtle)]">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  )
}
