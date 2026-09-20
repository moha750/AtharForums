'use client'

import {
  CalendarDays,
  LayoutGrid,
  Mail,
  Newspaper,
  Settings,
  Users,
  UserCheck,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'

import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

const ICONS = {
  overview: LayoutGrid,
  forums: LayoutGrid,
  applications: UserCheck,
  members: Users,
  events: CalendarDays,
  news: Newspaper,
  waitlist: Mail,
  settings: Settings,
} as const

export function AdminNav({
  items,
  backLabel,
  locale,
}: {
  items: Array<{ key: keyof typeof ICONS; href: string; label: string }>
  backLabel: string
  locale: string
}) {
  const pathname = usePathname()
  const Arrow = locale === 'en' ? ArrowLeft : ArrowRight

  return (
    <nav className="flex flex-col gap-1" aria-label={backLabel}>
      {items.map((item) => {
        const Icon = ICONS[item.key]
        const active =
          item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                : 'text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]'
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        )
      })}

      <Link
        href="/"
        className="mt-3 inline-flex items-center gap-2 border-t border-[var(--border)] px-3 pt-4 text-sm text-[var(--fg-subtle)] transition-colors hover:text-[var(--fg)]"
      >
        <Arrow className="size-4" aria-hidden />
        {backLabel}
      </Link>
    </nav>
  )
}
