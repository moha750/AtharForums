'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * يقيس ما لا يعرفه الخادم: كم بقي الزائر في الصفحة، وكم قرأ منها.
 *
 * الخادم يعرف أن الصفحة طُلبت، ولا يعرف أنها قُرئت. الفرق بين زيارة مدّتها
 * ثلاث ثوانٍ وأخرى مدّتها ثلاث دقائق هو الفرق بين صفحة لا تنفع وصفحة تنفع —
 * وهذا المكوّن هو من يخبرنا بذلك.
 *
 * لا يضع كوكيز ولا يقرأ شيئًا عن الزائر. يرسل رقمين ومسارًا، ويصمت.
 */

interface Payload {
  path: string
  durationMs: number
  scrollPct: number
  screenWidth: number
}

function send(payload: Payload): void {
  if (payload.durationMs < 1000) return

  const body = JSON.stringify(payload)
  const url = '/api/analytics/engagement'

  // sendBeacon ينجح حتى والصفحة تُغلق — وهو بالضبط وقت الإرسال هنا
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
    return
  }

  void fetch(url, { method: 'POST', body, keepalive: true }).catch(() => undefined)
}

export function EngagementBeacon() {
  const pathname = usePathname()
  const startedAt = useRef(0)
  const visibleMs = useRef(0)
  const maxScroll = useRef(0)
  const sent = useRef(false)

  useEffect(() => {
    startedAt.current = Date.now()
    visibleMs.current = 0
    maxScroll.current = 0
    sent.current = false

    const measureScroll = () => {
      const doc = document.documentElement
      const scrollable = doc.scrollHeight - window.innerHeight
      const pct = scrollable <= 0 ? 100 : ((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100
      maxScroll.current = Math.min(100, Math.max(maxScroll.current, Math.round(pct)))
    }

    const flush = () => {
      if (sent.current) return
      sent.current = true
      measureScroll()
      send({
        path: window.location.pathname,
        durationMs: visibleMs.current + (Date.now() - startedAt.current),
        scrollPct: maxScroll.current,
        screenWidth: window.innerWidth,
      })
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // الوقت خلف تبويب آخر ليس قراءة — نوقف العدّاد ونرسل ما تجمّع
        visibleMs.current += Date.now() - startedAt.current
        startedAt.current = Date.now()
        flush()
      } else {
        startedAt.current = Date.now()
        sent.current = false
      }
    }

    measureScroll()
    window.addEventListener('scroll', measureScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)

    return () => {
      window.removeEventListener('scroll', measureScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      flush() // تنقّل داخلي: الصفحة تتبدّل ولا تُغلق
    }
  }, [pathname])

  return null
}
