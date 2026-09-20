'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'

import { ForumCard } from '@/components/forums/forum-card'
import { Input } from '@/components/ui/field'
import { cn, localized } from '@/lib/utils'
import type { Forum } from '@/lib/database.types'

export function ForumsBrowser({ forums, locale }: { forums: Forum[]; locale: string }) {
  const t = useTranslations('forums')
  const [query, setQuery] = useState('')
  const [skill, setSkill] = useState<string | null>(null)

  const skills = useMemo(() => {
    const set = new Set<string>()
    for (const forum of forums) for (const s of forum.skills) set.add(s)
    return [...set].sort((a, b) => a.localeCompare(b, locale))
  }, [forums, locale])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return forums.filter((forum) => {
      if (skill && !forum.skills.includes(skill)) return false
      if (!q) return true
      const haystack = [
        localized(forum, 'name', locale),
        localized(forum, 'tagline', locale),
        localized(forum, 'description', locale),
        ...forum.skills,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [forums, query, skill, locale])

  return (
    <div>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-[var(--fg-subtle)] start-3.5"
          aria-hidden
        />
        <label htmlFor="forum-search" className="sr-only">
          {t('searchPlaceholder')}
        </label>
        <Input
          id="forum-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="ps-10"
        />
      </div>

      {skills.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t('skillsHeading')}>
          <button
            type="button"
            onClick={() => setSkill(null)}
            aria-pressed={skill === null}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors',
              skill === null
                ? 'bg-[var(--primary)] text-[var(--primary-fg)] ring-transparent'
                : 'bg-[var(--surface)] text-[var(--fg-muted)] ring-[var(--border-strong)] hover:text-[var(--fg)]'
            )}
          >
            {t('filterAll')}
          </button>
          {skills.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSkill(skill === s ? null : s)}
              aria-pressed={skill === s}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors',
                skill === s
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)] ring-transparent'
                  : 'bg-[var(--surface)] text-[var(--fg-muted)] ring-[var(--border-strong)] hover:text-[var(--fg)]'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="mt-8 rounded-xl bg-[var(--bg-subtle)] px-4 py-8 text-center text-sm text-[var(--fg-subtle)]">
          {t('empty')}
        </p>
      ) : (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((forum) => (
            <ForumCard
              key={forum.id}
              forum={forum}
              locale={locale}
              membersLabel={t('members', { count: forum.members_count })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
