import { Archive, ArchiveRestore, Check, Reply, UserRound } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { Button, buttonStyles } from '@/components/ui/button'
import { deleteContactMessage, setContactStatus } from '@/actions/admin'
import { adminContactMessages } from '@/lib/admin-data'
import { cn, formatDateTime } from '@/lib/utils'
import type { ContactMessage } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

const topicKey = {
  inquiry: 'topicInquiry',
  suggestion: 'topicSuggestion',
  technical: 'topicTechnical',
  other: 'topicOther',
} as const

/** أقصى ما يُقتبس من الرسالة في الردّ — روابط mailto الطويلة تُقصّ في بعض برامج البريد. */
const QUOTE_LIMIT = 600

export default async function AdminMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ view?: string }>
}) {
  const { locale } = await params
  const view = (await searchParams).view === 'archive' ? 'archive' : 'inbox'

  const [t, tContact, tCommon, tReplyAr, tReplyEn, messages] = await Promise.all([
    getTranslations('admin'),
    getTranslations('contact'),
    getTranslations('common'),
    // عنوان الردّ بلغة المرسل لا بلغة واجهة المشرف
    getTranslations({ locale: 'ar', namespace: 'admin' }),
    getTranslations({ locale: 'en', namespace: 'admin' }),
    adminContactMessages(view),
  ])

  const replyHref = (message: ContactMessage) => {
    const subject = (message.locale === 'en' ? tReplyEn : tReplyAr)('messageReplySubject')
    const quoted =
      message.body.length > QUOTE_LIMIT ? `${message.body.slice(0, QUOTE_LIMIT)}…` : message.body
    const body = `\n\n———\n${message.full_name}:\n${quoted}`
    return `mailto:${message.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const tabs = [
    { value: 'inbox', href: '/admin/messages', label: t('messagesInbox') },
    { value: 'archive', href: '/admin/messages?view=archive', label: t('messagesArchive') },
  ] as const

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('navMessages')}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('messagesLead')}</p>
        </div>

        <div className="inline-flex rounded-xl bg-[var(--bg-subtle)] p-1 ring-1 ring-[var(--border)]">
          {tabs.map((tab) => (
            <Link
              key={tab.value}
              href={tab.href}
              aria-current={tab.value === view ? 'page' : undefined}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                tab.value === view
                  ? 'bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-soft)]'
                  : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {messages.length === 0 ? (
        <p className="mt-6 rounded-xl bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--fg-subtle)] ring-1 ring-[var(--border)]">
          {view === 'archive' ? t('messagesArchiveEmpty') : t('messagesEmpty')}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {messages.map((message) => {
            const isNew = message.status === 'new'
            return (
              <li
                key={message.id}
                className={cn(
                  'rounded-2xl bg-[var(--surface)] p-5',
                  isNew ? 'ring-2 ring-[var(--accent)]' : 'ring-1 ring-[var(--border)]'
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {message.full_name}
                      {isNew ? <Badge tone="warning">{t('messageNew')}</Badge> : null}
                    </p>
                    <p className="font-latin mt-0.5 text-xs text-[var(--fg-subtle)]" dir="ltr">
                      {message.email}
                    </p>
                    {message.profile_id ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                        <UserRound className="size-3.5" aria-hidden />
                        {t('messageMember')}
                      </p>
                    ) : null}
                  </div>

                  <div className="text-end">
                    <Badge tone="teal">{tContact(topicKey[message.topic])}</Badge>
                    <p className="mt-1.5 text-xs text-[var(--fg-subtle)]">
                      {formatDateTime(message.created_at, locale)}
                    </p>
                  </div>
                </div>

                <p
                  dir="auto"
                  className="mt-4 whitespace-pre-line break-words leading-relaxed text-[var(--fg)]"
                >
                  {message.body}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
                  <a href={replyHref(message)} className={buttonStyles('primary', 'sm')}>
                    <Reply className="size-4" aria-hidden />
                    {t('messageReply')}
                  </a>

                  {isNew ? (
                    <form action={setContactStatus}>
                      <input type="hidden" name="id" value={message.id} />
                      <input type="hidden" name="status" value="read" />
                      <Button type="submit" variant="secondary" size="sm">
                        <Check className="size-4" aria-hidden />
                        {t('messageMarkRead')}
                      </Button>
                    </form>
                  ) : null}

                  <form action={setContactStatus}>
                    <input type="hidden" name="id" value={message.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={message.status === 'archived' ? 'read' : 'archived'}
                    />
                    <Button type="submit" variant="secondary" size="sm">
                      {message.status === 'archived' ? (
                        <>
                          <ArchiveRestore className="size-4" aria-hidden />
                          {t('messageRestore')}
                        </>
                      ) : (
                        <>
                          <Archive className="size-4" aria-hidden />
                          {t('messageArchive')}
                        </>
                      )}
                    </Button>
                  </form>

                  <form action={deleteContactMessage} className="ms-auto">
                    <input type="hidden" name="id" value={message.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      {tCommon('delete')}
                    </Button>
                  </form>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
