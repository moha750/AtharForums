'use client'

import { ArrowLeft, ArrowRight, FolderKanban, QrCode, Settings2, ShieldCheck } from 'lucide-react'

import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

const ICONS = { singles: QrCode, campaigns: FolderKanban, oversight: ShieldCheck, admin: Settings2 } as const

/** شريط الباركود الجانبي — بنمط AdminNav نفسه. */
export function QrNav({
  items,
  backLabel,
  label,
  locale,
}: {
  items: Array<{ key: keyof typeof ICONS; href: string; label: string }>
  backLabel: string
  label: string
  locale: string
}) {
  const pathname = usePathname()
  const Arrow = locale === 'en' ? ArrowLeft : ArrowRight

  const isActive = (href: string) => {
    if (href === '/qr') {
      return pathname === '/qr' || (/^\/qr\/[^/]+/.test(pathname) && !/^\/qr\/(campaigns|oversight)(\/|$)/.test(pathname))
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <nav className="flex flex-col gap-1" aria-label={label}>
      {items.map((item) => {
        const Icon = ICONS[item.key]
        const active = isActive(item.href)
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

/** تبويبا «باركودات مفردة» و«الحملات» — روابط، فالتبويب يبقى في العنوان. */
export function QrTabs({ current, labels }: { current: 'singles' | 'campaigns'; labels: { singles: string; campaigns: string } }) {
  const tabs = [
    { key: 'singles' as const, href: '/qr', label: labels.singles },
    { key: 'campaigns' as const, href: '/qr/campaigns', label: labels.campaigns },
  ]
  return (
    <div role="tablist" className="inline-flex rounded-xl bg-[var(--bg-subtle)] p-1 ring-1 ring-[var(--border)]">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          role="tab"
          aria-selected={tab.key === current}
          className={cn(
            'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
            tab.key === current
              ? 'bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-soft)]'
              : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
