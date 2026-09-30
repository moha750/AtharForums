import NextImage from 'next/image'

import { cn, localized } from '@/lib/utils'
import { boardTitle, groupByRank, type RankTitles } from '@/lib/board'
import type { BoardMember, BoardRank } from '@/lib/database.types'

/**
 * مجلس الإدارة — مكوّنات خادم بلا جافاسكربت.
 *
 * الصورة نصّها البديل فارغ عمدًا: الاسم مكتوب تحتها مباشرة، فوصفُها باسم
 * صاحبها يجعل قارئ الشاشة يقرأ الاسم مرّتين متتاليتين.
 */

function BoardAvatar({
  member,
  locale,
  size,
  className,
}: {
  member: BoardMember
  locale: string
  /** بالبكسل — يطابق عرض الدائرة ليختار next/image المقاس الصحيح. */
  size: number
  className?: string
}) {
  const name = localized(member, 'name', locale)
  const style = { width: size, height: size }

  if (member.photo_url) {
    return (
      <span
        className={cn('relative block shrink-0 overflow-hidden rounded-full bg-[var(--bg-subtle)]', className)}
        style={style}
      >
        <NextImage src={member.photo_url} alt="" fill sizes={`${size}px`} className="object-cover" />
      </span>
    )
  }

  // بلا صورة بعد: الحرف الأوّل من الاسم، لا أيقونة شخصٍ مجهول.
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] font-semibold text-[var(--primary)]',
        className
      )}
      style={{ ...style, fontSize: Math.round(size * 0.38) }}
    >
      {Array.from(name.trim())[0] ?? ''}
    </span>
  )
}

/** مقاس كل منصب في الهيكل: المدير العام أبرزها، ثمّ الرئيس، ثمّ الأعضاء. */
const LOOK: Record<
  BoardRank,
  { item: string; card: string; avatar: number; ring: string; name: string; role: string }
> = {
  general_manager: {
    item: 'w-full max-w-sm',
    card: 'p-6 shadow-[var(--shadow-soft)] ring-[color-mix(in_srgb,var(--primary)_35%,transparent)]',
    avatar: 112,
    ring: 'ring-[3px] ring-[var(--surface)]',
    name: 'mt-4 text-lg',
    role: 'text-sm',
  },
  chair: {
    item: 'w-full max-w-xs',
    card: 'p-5 ring-[color-mix(in_srgb,var(--primary)_25%,transparent)]',
    avatar: 96,
    ring: 'ring-2 ring-[color-mix(in_srgb,var(--primary)_45%,transparent)] ring-offset-2 ring-offset-[var(--surface)]',
    name: 'mt-3.5 text-base',
    role: 'text-sm',
  },
  member: {
    item: 'w-[calc(50%-0.375rem)] sm:w-[calc((100%-2rem)/3)]',
    card: 'p-4 ring-[var(--border)] sm:p-5',
    avatar: 80,
    ring: 'ring-1 ring-[var(--border)]',
    name: 'mt-3',
    role: 'text-xs sm:text-sm',
  },
}

/**
 * الهيكل كاملًا: المدير العام، فرئيس المجلس، فالأعضاء الإداريّون — كل منصب
 * صفّ، والصفوف متوسّطة. ومنصبٌ بلا بطاقة منشورة لا يترك صفًّا فارغًا.
 */
export function BoardStructure({
  members,
  locale,
  label,
  titles,
}: {
  members: BoardMember[]
  locale: string
  label: string
  titles: RankTitles
}) {
  if (members.length === 0) return null
  const rows = groupByRank(members)

  return (
    <ol aria-label={label}>
      {rows.map((row, level) => {
        const rank = row[0].rank
        const look = LOOK[rank]
        return (
          <li key={rank}>
            {level > 0 ? (
              <span aria-hidden className="mx-auto block h-8 w-px bg-[var(--border-strong)]" />
            ) : null}
            <ul className="flex flex-wrap justify-center gap-3 sm:gap-4">
              {row.map((member) => {
                const role = localized(member, 'role', locale)
                return (
                  <li key={member.id} className={look.item}>
                    <article
                      className={cn(
                        'flex h-full flex-col items-center rounded-2xl bg-[var(--surface)] text-center ring-1',
                        look.card
                      )}
                    >
                      {rank === 'general_manager' ? (
                        <span className="block rounded-full bg-athar-gradient p-1.5">
                          <BoardAvatar
                            member={member}
                            locale={locale}
                            size={look.avatar}
                            className={look.ring}
                          />
                        </span>
                      ) : (
                        <BoardAvatar
                          member={member}
                          locale={locale}
                          size={look.avatar}
                          className={look.ring}
                        />
                      )}
                      <h3 className={cn('font-semibold', look.name)}>
                        {localized(member, 'name', locale)}
                      </h3>
                      <p className="mt-0.5 text-balance text-sm font-medium text-[var(--primary)]">
                        {boardTitle(member, locale, titles)}
                      </p>
                      {role ? (
                        <p className={cn('mt-2 leading-relaxed text-[var(--fg-muted)]', look.role)}>
                          {role}
                        </p>
                      ) : null}
                    </article>
                  </li>
                )
              })}
            </ul>
          </li>
        )
      })}
    </ol>
  )
}

/** المختصر في الصفحة الرئيسة: بطاقات أفقية للأعضاء المميّزين. */
export function BoardHighlights({
  members,
  locale,
  titles,
}: {
  members: BoardMember[]
  locale: string
  titles: RankTitles
}) {
  if (members.length === 0) return null

  const layout =
    members.length === 1
      ? 'max-w-md'
      : members.length === 2
        ? 'max-w-3xl sm:grid-cols-2'
        : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <ul className={cn('grid gap-4', layout)}>
      {members.map((member) => {
        const role = localized(member, 'role', locale)
        return (
          <li
            key={member.id}
            className="flex items-center gap-4 rounded-2xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]"
          >
            <BoardAvatar
              member={member}
              locale={locale}
              size={64}
              className="ring-1 ring-[var(--border)]"
            />
            <div className="min-w-0">
              <p className="font-semibold">{localized(member, 'name', locale)}</p>
              <p className="text-sm font-medium text-[var(--primary)]">
                {boardTitle(member, locale, titles)}
              </p>
              {role ? (
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--fg-muted)]">
                  {role}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
