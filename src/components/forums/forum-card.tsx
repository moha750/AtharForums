import * as Icons from 'lucide-react'
import { ArrowLeft, ArrowRight, Users } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { cn, localized } from '@/lib/utils'
import type { Forum } from '@/lib/database.types'

const ACCENTS = {
  teal: {
    chip: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
    edge: 'group-hover:border-teal-300 dark:group-hover:border-teal-700',
    bar: 'bg-teal-600',
  },
  sage: {
    chip: 'bg-sage-50 text-sage-700 dark:bg-sage-950 dark:text-sage-300',
    edge: 'group-hover:border-sage-300 dark:group-hover:border-sage-700',
    bar: 'bg-sage-500',
  },
  ember: {
    chip: 'bg-ember-50 text-ember-700 dark:bg-ember-950 dark:text-ember-300',
    edge: 'group-hover:border-ember-300 dark:group-hover:border-ember-700',
    bar: 'bg-ember-500',
  },
} as const

function ForumIcon({ name, className }: { name: string; className?: string }) {
  const Fallback = Icons.Sparkles
  const Component = (Icons as unknown as Record<string, typeof Fallback>)[name] ?? Fallback
  return <Component className={className} aria-hidden />
}

export function ForumCard({
  forum,
  locale,
  membersLabel,
}: {
  forum: Forum
  locale: string
  membersLabel: string
}) {
  const accent = ACCENTS[forum.color] ?? ACCENTS.teal
  const Arrow = locale === 'en' ? ArrowRight : ArrowLeft
  const full = forum.capacity !== null && forum.members_count >= forum.capacity

  return (
    <Link
      href={`/forums/${forum.slug}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border)]',
        'bg-[var(--surface)] p-5 transition-[border-color,box-shadow,transform]',
        'hover:shadow-[var(--shadow-soft)] focus-visible:shadow-[var(--shadow-soft)]',
        accent.edge
      )}
    >
      <span className={cn('absolute inset-x-0 top-0 h-1', accent.bar)} aria-hidden />

      <div className="flex items-start justify-between gap-3">
        <span
          className={cn('inline-flex size-11 items-center justify-center rounded-xl', accent.chip)}
        >
          <ForumIcon name={forum.icon} className="size-[22px]" />
        </span>

        {full ? (
          <Badge tone="warning">{locale === 'en' ? 'Full' : 'اكتمل العدد'}</Badge>
        ) : forum.is_accepting ? (
          <Badge tone="success">{locale === 'en' ? 'Open' : 'مفتوح'}</Badge>
        ) : null}
      </div>

      <h3 className="mt-4 text-lg font-semibold">{localized(forum, 'name', locale)}</h3>

      {localized(forum, 'tagline', locale) ? (
        <p className="mt-1 text-sm text-[var(--primary)]">{localized(forum, 'tagline', locale)}</p>
      ) : null}

      <p className="mt-2.5 line-clamp-3 flex-1 text-sm leading-relaxed text-[var(--fg-muted)]">
        {localized(forum, 'description', locale)}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3.5">
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-subtle)]">
          <Users className="size-3.5" aria-hidden />
          {membersLabel}
        </span>
        <Arrow
          className="size-4 text-[var(--fg-subtle)] transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </Link>
  )
}
