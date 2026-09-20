'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, MailCheck, ShieldCheck } from 'lucide-react'
import { requestMagicLink, type LoginState } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/field'

const initial: LoginState = { status: 'idle' }

export function LoginForm({
  next,
  ministry,
  linkError,
}: {
  next?: string
  ministry: string
  linkError?: boolean
}) {
  const t = useTranslations('auth')
  const [state, action, pending] = useActionState(requestMagicLink, initial)

  if (state.status === 'sent') {
    return (
      <div className="space-y-4 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--success-soft)]">
          <MailCheck className="size-7 text-[var(--success)]" aria-hidden />
        </span>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{t('sentHeading')}</h2>
          <p className="text-[var(--fg-muted)]">
            {t.rich('sentLead', {
              email: state.email ?? '',
              b: (chunks) => (
                <bdi className="font-medium text-[var(--fg)]" dir="ltr">
                  {chunks}
                </bdi>
              ),
            })}
          </p>
          <p className="text-sm text-[var(--fg-subtle)]">{t('sentHint')}</p>
        </div>
        <form action={action}>
          <input type="hidden" name="email" value={state.email ?? ''} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t('resend')}
          </Button>
        </form>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="login-email">{t('emailLabel')}</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          required
          autoFocus
          placeholder={t('emailPlaceholder')}
          className="text-start"
          aria-describedby="login-hint"
        />
        <p id="login-hint" className="flex items-center gap-1.5 text-xs text-[var(--fg-subtle)]">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
          {t('noticeWhyEmail')}
        </p>
      </div>

      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('sending')}
          </>
        ) : (
          t('sendLink')
        )}
      </Button>

      {linkError && state.status === 'idle' ? (
        <p role="alert" className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {t('errorLink')}
        </p>
      ) : null}

      {state.status === 'error' ? (
        <p role="alert" className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {state.key === 'errorDomain'
            ? t('errorDomain', { domains: state.domains ?? '' })
            : t(state.key ?? 'errorGeneric')}
        </p>
      ) : null}

      <p className="text-center text-xs text-[var(--fg-subtle)]">{ministry}</p>
    </form>
  )
}
