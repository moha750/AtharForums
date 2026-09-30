import NextImage from 'next/image'

import { cn, localized } from '@/lib/utils'
import type { BoardMember } from '@/lib/database.types'

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

function groupByTier(members: BoardMember[]): BoardMember[][] {
  const tiers = new Map<number, BoardMember[]>()
  for (const m of members) {
    const row = tiers.get(m.tier)
    if (row) row.push(m)
    else tiers.set(m.tier, [m])
  }
  return [...tiers.entries()].sort(([a], [b]) => a - b).map(([, row]) => row)
}

/**
 * الهيكل كاملًا: كل مستوى صفّ، والأعلى فوق. الصفوف متوسّطة لتبقى شجرة
 * مقروءة حين يكون في المستوى عضو واحد أو اثنان.
 *
 * المستويات تُرسم بترتيبها لا بأرقامها: مستوى ١ ثم ٣ بلا ٢ يُرسمان صفّين
 * متتاليين، فلا تظهر فجوة فارغة لأنّ أحدًا تخطّى رقمًا في اللوحة.
 */
export function BoardStructure({
  members,
  locale,
  label,
}: {
  members: BoardMember[]
  locale: string
  label: string
}) {
  if (members.length === 0) return null
  const tiers = groupByTier(members)

  return (
    <ol aria-label={label}>
      {tiers.map((row, level) => {
        const top = level === 0
        return (
          <li key={row[0].tier}>
            {level > 0 ? (
              <span aria-hidden className="mx-auto block h-8 w-px bg-[var(--border-strong)]" />
            ) : null}
            <ul className="flex flex-wrap justify-center gap-3 sm:gap-4">
              {row.map((member) => {
                const role = localized(member, 'role', locale)
                return (
                  <li
                    key={member.id}
                    className={
                      top
                        ? 'w-full max-w-xs'
                        : 'w-[calc(50%-0.375rem)] sm:w-[calc((100%-2rem)/3)]'
                    }
                  >
                    <article
                      className={cn(
                        'flex h-full flex-col items-center rounded-2xl bg-[var(--surface)] text-center ring-1',
                        top
                          ? 'p-6 shadow-[var(--shadow-soft)] ring-[color-mix(in_srgb,var(--primary)_35%,transparent)]'
                          : 'p-4 ring-[var(--border)] sm:p-5'
                      )}
                    >
                      {top ? (
                        <span className="block rounded-full bg-athar-gradient p-1.5">
                          <BoardAvatar
                            member={member}
                            locale={locale}
                            size={112}
                            className="ring-[3px] ring-[var(--surface)]"
                          />
                        </span>
                      ) : (
                        <BoardAvatar
                          member={member}
                          locale={locale}
                          size={80}
                          className="ring-1 ring-[var(--border)]"
                        />
                      )}
                      <h3 className={cn('font-semibold', top ? 'mt-4 text-lg' : 'mt-3')}>
                        {localized(member, 'name', locale)}
                      </h3>
                      <p className="mt-0.5 text-sm font-medium text-[var(--primary)]">
                        {localized(member, 'position', locale)}
                      </p>
                      {role ? (
                        <p
                          className={cn(
                            'mt-2 leading-relaxed text-[var(--fg-muted)]',
                            top ? 'text-sm' : 'text-xs sm:text-sm'
                          )}
                        >
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
export function BoardHighlights({ members, locale }: { members: BoardMember[]; locale: string }) {
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
                {localized(member, 'position', locale)}
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
