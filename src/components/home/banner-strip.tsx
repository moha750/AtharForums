'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

export type BannerSlide = {
  id: string
  imageUrl: string
  alt: string
  title: string
  body: string | null
  ctaLabel: string | null
  /** جاهز للاستعمال: الداخليّ مسبوق باللغة، والخارجيّ كما هو. */
  ctaHref: string | null
  external: boolean
}

const INTERVAL = 7000

export function BannerStrip({
  slides,
  locale,
  labels,
}: {
  slides: BannerSlide[]
  locale: string
  labels: { region: string; previous: string; next: string; goTo: string; pause: string }
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [motionOk, setMotionOk] = useState(false)

  const count = slides.length
  const many = count > 1

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setMotionOk(!query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    // لا تبديل تلقائيّ مع تفضيل تقليل الحركة، ولا وهو متوقّف، ولا لبانر واحد.
    // وnextjs يوقف المؤقّتات في التبويب المخفيّ؟ لا — نتكفّل بها بأنفسنا،
    // وإلا عاد الزائر فوجد الشريط قد قفز عشر مرّات دفعة واحدة.
    if (!many || paused || !motionOk) return
    const tick = () => setIndex((i) => (i + 1) % count)
    const timer = window.setInterval(() => {
      if (!document.hidden) tick()
    }, INTERVAL)
    return () => window.clearInterval(timer)
  }, [many, paused, motionOk, count])

  if (count === 0) return null

  // في RTL يتقدّم الشريط نحو اليسار، فسهم «التالي» هو الأيسر.
  const NextIcon = locale === 'en' ? ChevronRight : ChevronLeft
  const PrevIcon = locale === 'en' ? ChevronLeft : ChevronRight

  return (
    <section
      aria-roledescription="carousel"
      aria-label={labels.region}
      className="container-athar py-10 sm:py-14"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-[var(--border)]">
        <div className="relative aspect-[4/3] sm:aspect-[16/6]">
          {slides.map((slide, i) => {
            const active = i === index
            return (
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} / ${count}`}
                aria-hidden={!active}
                className={cn(
                  'absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none',
                  active ? 'opacity-100' : 'pointer-events-none opacity-0'
                )}
              >
                <Image
                  src={slide.imageUrl}
                  alt={slide.alt}
                  fill
                  priority={i === 0}
                  sizes="(min-width: 1280px) 76rem, 100vw"
                  className="object-cover"
                />
                {/* حجاب متدرّج من جهة النصّ وحدها: تغطية الصورة كلها تُفقدها
                    معناها، وتركها بلا حجاب يجعل النصّ يختفي على الصور الفاتحة. */}
                <div
                  aria-hidden
                  className="banner-scrim absolute inset-0"
                />
                <div className="absolute inset-0 flex items-center">
                  <div className="max-w-xl p-6 text-start sm:p-10">
                    <h2 className="text-balance text-xl font-bold text-white sm:text-3xl">
                      {slide.title}
                    </h2>
                    {slide.body ? (
                      <p className="mt-2.5 text-pretty text-sm leading-relaxed text-white/85 sm:text-base">
                        {slide.body}
                      </p>
                    ) : null}
                    {slide.ctaHref && slide.ctaLabel ? (
                      <a
                        href={slide.ctaHref}
                        {...(slide.external
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : {})}
                        tabIndex={active ? undefined : -1}
                        className="mt-5 inline-flex h-11 items-center rounded-lg bg-white px-5 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        {slide.ctaLabel}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {many ? (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={labels.previous}
              className="absolute start-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <PrevIcon className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={labels.next}
              className="absolute end-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <NextIcon className="size-5" aria-hidden />
            </button>

            <div className="absolute bottom-3 start-1/2 flex -translate-x-1/2 gap-2 rtl:translate-x-1/2">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`${labels.goTo} ${i + 1}`}
                  aria-current={i === index}
                  className={cn(
                    'h-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
                    i === index ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/75'
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
