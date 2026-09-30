'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2, Send } from 'lucide-react'

import { sendContactMessage, type ContactState } from '@/actions/contact'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label, Textarea } from '@/components/ui/field'
import { CONTACT_TOPICS } from '@/lib/contact'
import { cn } from '@/lib/utils'

const initial: ContactState = { status: 'idle' }

const topicKey = {
  inquiry: 'topicInquiry',
  suggestion: 'topicSuggestion',
  technical: 'topicTechnical',
  other: 'topicOther',
} as const

/**
 * المسجَّل دخوله يُعرف بريده من حسابه فيُعرض للقراءة فقط، ويُملأ اسمه مسبقًا.
 * الزائر بلا حساب يكتبهما.
 */
export function ContactForm({
  locale,
  defaultName,
  accountEmail,
}: {
  locale: string
  defaultName?: string
  accountEmail?: string
}) {
  const t = useTranslations('contact')
  const [state, action, pending] = useActionState(sendContactMessage, initial)

  if (state.status === 'success') {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl bg-[var(--success-soft)] p-4 ring-1 ring-inset ring-[color-mix(in_srgb,var(--success)_25%,transparent)]"
      >
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--success)]" aria-hidden />
        <p className="text-sm text-[var(--success)]">{t('success')}</p>
      </div>
    )
  }

  const errors = state.fields ?? {}
  const values = state.values

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">{t('nameLabel')}</Label>
          <Input
            id="contact-name"
            name="name"
            autoComplete="name"
            maxLength={120}
            required
            defaultValue={values?.name ?? defaultName ?? ''}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'contact-name-error' : undefined}
          />
          {errors.name ? (
            <p id="contact-name-error" className="text-sm text-[var(--danger)]">
              {t('errorName')}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-email" hint={accountEmail ? t('emailAccountHint') : undefined}>
            {t('emailLabel')}
          </Label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            maxLength={254}
            required
            readOnly={Boolean(accountEmail)}
            defaultValue={accountEmail ?? values?.email ?? ''}
            placeholder="name@example.com"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'contact-email-error' : undefined}
            className={cn(
              'font-latin text-start placeholder:text-start',
              accountEmail && 'bg-[var(--bg-subtle)] text-[var(--fg-muted)]'
            )}
          />
          {errors.email ? (
            <p id="contact-email-error" className="text-sm text-[var(--danger)]">
              {t('errorEmail')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-topic">{t('topicLabel')}</Label>
        <select
          id="contact-topic"
          name="topic"
          defaultValue={values?.topic ?? 'inquiry'}
          className="h-11 w-full rounded-lg bg-[var(--surface)] px-3 text-[0.95rem] text-[var(--fg)] ring-1 ring-inset ring-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] sm:w-64"
        >
          {CONTACT_TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {t(topicKey[topic])}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-body">{t('bodyLabel')}</Label>
        <Textarea
          id="contact-body"
          name="body"
          rows={6}
          minLength={10}
          maxLength={4000}
          required
          defaultValue={values?.body ?? ''}
          placeholder={t('bodyPlaceholder')}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? 'contact-body-error' : undefined}
        />
        {errors.body ? (
          <p id="contact-body-error" className="text-sm text-[var(--danger)]">
            {t('errorBody')}
          </p>
        ) : null}
      </div>

      {/* مصيدة الروبوتات — مخفية عن البشر وعن قارئات الشاشة */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] size-0 opacity-0"
      />

      {state.key ? <FieldError>{t(state.key)}</FieldError> : null}

      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('submitting')}
          </>
        ) : (
          <>
            <Send className="size-4" aria-hidden />
            {t('submit')}
          </>
        )}
      </Button>
    </form>
  )
}
