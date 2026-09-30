'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

export type BannerSlide = {
  id: string
  imageUrl: string
  alt: string
  title: string | null
  body: string | null
  ctaLabel: string | null
  /** جاهز للاستعمال: الداخليّ مسبوق باللغة، والخارجيّ كما هو. */
  ctaHref: string | null
  external: boolean
}

const INTERVAL = 7000

/**
 * نسبة واحدة في كل المقاسات — 8:3.
 *
 * كانت نسبتان (4:3 للجوّال و16:6 للحاسوب)، وهذا يعني أنّ المصمّم لا يعرف
 * على أي مقاس يصمّم: ما يظهر كاملًا على الحاسوب يُقصّ نصفه على الجوّال.
 * النصّ — إن وُجد — يتكيّف بدلًا من الصورة: طبقة فوقها على الشاشات
 * الواسعة، ولوحة تحتها على الجوّال حيث لا يتّسع الشريط لسطرين.
 */
const RATIO = '8 / 3'

export function BannerStrip({
  slides,
  locale,
  labels,
  className,
}: {
  slides: BannerSlide[]
  locale: string
  labels: { region: string; previous: string; next: string; goTo: string }
  className?: string
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
    if (!many || paused || !motionOk) return
    // التبويب المخفيّ لا يُبدّل: وإلا عاد الزائر فوجد الشريط قد قفز عشرًا.
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % count)
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
      className={cn('relative', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="grid overflow-hidden rounded-2xl ring-1 ring-[var(--border)]">
        {slides.map((slide, i) => {
          const active = i === index
          const hasText = Boolean(slide.title || slide.body || slide.ctaLabel)
          // رابط بلا زرّ ظاهر: البانر كلّه يصير قابلًا للنقر.
          const wholeIsLink = Boolean(slide.ctaHref) && !slide.ctaLabel
          const linkProps = slide.external
            ? { target: '_blank', rel: 'noopener noreferrer' as const }
            : {}

          const picture = (
            <div className="relative" style={{ aspectRatio: RATIO }}>
              <Image
                src={slide.imageUrl}
                alt={slide.alt}
                fill
                priority={i === 0}
                sizes="(min-width: 1280px) 76rem, 100vw"
                className="object-cover"
              />
              {/* الحجاب للنصّ وحده: تعتيم صورةٍ لا نصّ فوقها إفسادٌ لها. */}
              {hasText ? <div aria-hidden className="banner-scrim absolute inset-0 hidden sm:block" /> : null}
            </div>
          )

          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              aria-hidden={!active}
              className={cn(
                'relative col-start-1 row-start-1 transition-opacity duration-700 ease-out motion-reduce:transition-none',
                active ? 'opacity-100' : 'pointer-events-none opacity-0'
              )}
            >
              {wholeIsLink && slide.ctaHref ? (
                <a
                  href={slide.ctaHref}
                  {...linkProps}
                  tabIndex={active ? undefined : -1}
                  aria-label={slide.alt}
                  className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  {picture}
                </a>
              ) : (
                picture
              )}

              {hasText ? (
                // على الجوّال لوحة تحت الصورة، وعلى الشاشات الواسعة طبقة
                // فوقها. عنصر واحد بصنفين لا عنصران، حتى لا يقرأ قارئ
                // الشاشة النصّ مرّتين.
                <div className="bg-[#061a16] p-5 text-start sm:absolute sm:inset-0 sm:flex sm:max-w-xl sm:items-center sm:bg-transparent sm:p-10">
                  <div>
                    {slide.title ? (
                      <h2 className="text-balance text-lg font-bold text-white sm:text-3xl">
                        {slide.title}
                      </h2>
                    ) : null}
                    {slide.body ? (
                      <p className="mt-2 text-pretty text-sm leading-relaxed text-white/85 sm:mt-2.5 sm:text-base">
                        {slide.body}
                      </p>
                    ) : null}
                    {slide.ctaHref && slide.ctaLabel ? (
                      <a
                        href={slide.ctaHref}
                        {...linkProps}
                        tabIndex={active ? undefined : -1}
                        className="mt-4 inline-flex h-11 items-center rounded-lg bg-white px-5 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:mt-5"
                      >
                        {slide.ctaLabel}
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}

        {many ? (
          <div
            className="pointer-events-none col-start-1 row-start-1 self-start"
            style={{ aspectRatio: RATIO }}
          >
            <div className="relative h-full w-full">
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={labels.previous}
              className="pointer-events-auto absolute start-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <PrevIcon className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={labels.next}
              className="pointer-events-auto absolute end-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <NextIcon className="size-5" aria-hidden />
            </button>

            <div className="pointer-events-auto absolute bottom-3 start-1/2 flex -translate-x-1/2 gap-2 rtl:translate-x-1/2">
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
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
