'use client'

import { useSyncExternalStore } from 'react'

type Labels = { days: string; hours: string; minutes: string; seconds: string }

/**
 * ساعة تنبض كل ثانية.
 *
 * نستخدم useSyncExternalStore لا useEffect + useState: لقطة الخادم ثابتة
 * (صفر) فيتطابق أول رسم على المتصفّح مع ما أرسله الخادم، ثم يقفز إلى الوقت
 * الحقيقي بعد الترطيب — بلا تحذير تعارض ولا ومضة.
 */
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 1000)
  return () => clearInterval(id)
}

const getSnapshot = () => Math.floor(Date.now() / 1000)
const getServerSnapshot = () => 0

function remaining(target: number, now: number) {
  const diff = Math.max(0, target - now)
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
  const nowSeconds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const hydrated = nowSeconds !== 0

  const target = new Date(launchAt).getTime()
  const time = remaining(target, nowSeconds * 1000)

  if (hydrated && time.done) return <>{onDone}</>

  const cells: Array<[number, string]> = [
    [time.days, labels.days],
    [time.hours, labels.hours],
    [time.minutes, labels.minutes],
    [time.seconds, labels.seconds],
  ]

  return (
    <div className="flex items-stretch gap-2 sm:gap-3" role="timer" aria-live="off">
      {cells.map(([value, label]) => (
        <div
          key={label}
          className="flex min-w-16 flex-1 flex-col items-center gap-1 rounded-xl bg-[var(--surface)] px-2 py-3 ring-1 ring-[var(--border)] sm:min-w-20 sm:px-4 sm:py-4"
        >
          <span className="font-latin text-2xl font-semibold tabular-nums text-[var(--primary)] sm:text-3xl">
            {hydrated ? String(value).padStart(2, '0') : '––'}
          </span>
          <span className="text-[0.7rem] text-[var(--fg-subtle)] sm:text-xs">{label}</span>
        </div>
      ))}
    </div>
  )
}
