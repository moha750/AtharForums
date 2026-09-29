'use client'

import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'
import { heroLogoArt } from './hero-logo-art'

/**
 * شعار الهيرو — يتشكّل في كل مرّة يظهر فيها.
 *
 * الحركة نفسها معرَّفة في globals.css لا هنا، فتعمل مع أوّل رسم للصفحة
 * وبلا جافاسكربت أصلًا. دور هذا المكوّن إعادة تشغيلها وحدها، كلّما عاد
 * الشعار إلى مجال الرؤية.
 *
 * نتجاهل أوّل تقاطع إن كان الشعار ظاهرًا وقتها: حركة CSS تكون قد بدأت مع
 * الرسم الأوّل، وإعادة تشغيلها بعد التحميل تُرجعها إلى الصفر أمام العين.
 */
export function HeroLogo({ className, label }: { className?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let first = true
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (first) {
          first = false
          if (entry.isIntersecting) return
        }
        if (!entry.isIntersecting) return
        for (const animation of el.getAnimations({ subtree: true })) {
          animation.cancel()
          animation.play()
        }
      },
      { threshold: 0.4 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={cn('athar-hero-logo relative', className)}>
      <span aria-hidden className="athar-hero-glow" />
      {/* role="img" على الغلاف يجعل ما بداخله تزيينًا عند قارئ الشاشة، فلا
          تُقرأ الأربعون قطعة واحدة واحدة. */}
      <div
        role="img"
        aria-label={label}
        className="relative h-full"
        dangerouslySetInnerHTML={{ __html: heroLogoArt }}
      />
    </div>
  )
}
