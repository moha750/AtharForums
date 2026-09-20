'use client'

import { useParams } from 'next/navigation'
import { useTransition } from 'react'
import { Languages } from 'lucide-react'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing, localeLabels, type Locale } from '@/i18n/routing'
import { cn } from '@/lib/utils'

export function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const [pending, startTransition] = useTransition()

  const next = routing.locales.find((l) => l !== current) ?? current

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          router.replace(
            // @ts-expect-error — مسارات ديناميكية تُمرَّر كما هي
            { pathname, params },
            { locale: next }
          )
        })
      }
      aria-label={localeLabels[next]}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium',
        'text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]',
        pending && 'opacity-60'
      )}
    >
      <Languages className="size-4" aria-hidden />
      <span className={next === 'en' ? 'font-latin' : undefined}>{localeLabels[next]}</span>
    </button>
  )
}
