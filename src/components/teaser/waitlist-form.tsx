'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2, Send } from 'lucide-react'
import { joinWaitlist, type WaitlistState } from '@/actions/waitlist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'

const initial: WaitlistState = { status: 'idle' }

export function WaitlistForm() {
  const t = useTranslations('teaser')
  const [state, action, pending] = useActionState(joinWaitlist, initial)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === 'success') formRef.current?.reset()
  }, [state.status])

  if (state.status === 'success') {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl bg-[var(--success-soft)] p-4 text-start ring-1 ring-inset ring-[color-mix(in_srgb,var(--success)_25%,transparent)]"
      >
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--success)]" aria-hidden />
        <p className="text-sm text-[var(--success)]">{t(state.key ?? 'success')}</p>
      </div>
    )
  }

  return (
    <form ref={formRef} action={action} className="space-y-3 text-start" noValidate>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="waitlist-email" className="sr-only">
            {t('emailLabel')}
          </label>
          <Input
            id="waitlist-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            required
            placeholder={t('emailPlaceholder')}
            aria-describedby={state.status === 'error' ? 'waitlist-error' : undefined}
            className="text-start placeholder:text-start"
          />
        </div>

        <Button type="submit" disabled={pending} className="sm:w-auto">
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

      {state.status === 'error' ? (
        <p id="waitlist-error" role="alert" className="text-sm text-[var(--danger)]">
          {t(state.key ?? 'errorGeneric')}
        </p>
      ) : null}
    </form>
  )
}
