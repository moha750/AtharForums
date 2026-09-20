'use client'

import { useEffect, useState } from 'react'

type Labels = { days: string; hours: string; minutes: string; seconds: string }

function remaining(target: number) {
  const diff = Math.max(0, target - Date.now())
  return {
    done: diff === 0,
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

export function Countdown({
  launchAt,
  labels,
  onDone,
}: {
  launchAt: string
  labels: Labels
  onDone?: React.ReactNode
}) {
  const target = new Date(launchAt).getTime()
  // نبدأ بقيم الخادم المحسوبة مرة واحدة، ثم نحدّث في المتصفّح كل ثانية
  const [time, setTime] = useState(() => remaining(target))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setTime(remaining(target))
    const id = setInterval(() => setTime(remaining(target)), 1000)
    return () => clearInterval(id)
  }, [target])

  if (mounted && time.done) return <>{onDone}</>

  const cells: Array<[number, string]> = [
    [time.days, labels.days],
    [time.hours, labels.hours],
    [time.minutes, labels.minutes],
    [time.seconds, labels.seconds],
  ]

  return (
    <div
      className="flex items-stretch gap-2 sm:gap-3"
      role="timer"
      aria-live="off"
      suppressHydrationWarning
    >
      {cells.map(([value, label], i) => (
        <div
          key={label}
          className="flex min-w-16 flex-1 flex-col items-center gap-1 rounded-xl bg-[var(--surface)] px-2 py-3 ring-1 ring-[var(--border)] sm:min-w-20 sm:px-4 sm:py-4"
        >
          <span
            className="font-latin text-2xl font-semibold tabular-nums text-[var(--primary)] sm:text-3xl"
            suppressHydrationWarning
          >
            {mounted ? String(value).padStart(2, '0') : '––'}
          </span>
          <span className="text-[0.7rem] text-[var(--fg-subtle)] sm:text-xs">{label}</span>
          <span className="sr-only">{i === 0 ? '' : ''}</span>
        </div>
      ))}
    </div>
  )
}
