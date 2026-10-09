'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Copy, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { QrActionResult } from '@/actions/qr'

/**
 * قطع صغيرة مشتركة بين شاشات الباركود — مبنية على مكوّنات المشروع
 * ورموزه (‎--surface‎ و‎--border‎ و‎--primary‎…)، لا نظام تصميم جديد.
 */

export const selectStyles =
  'h-11 w-full rounded-lg bg-[var(--surface)] px-3 text-[0.95rem] text-[var(--fg)] ring-1 ring-inset ring-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60'

export const cardStyles = 'rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6'

/** نافذة حوار أصلية — كما في image-cropper. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={cn(
        'm-auto max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-[var(--surface)] p-0 text-[var(--fg)] shadow-2xl outline-none ring-1 ring-[var(--border)] backdrop:bg-black/60 backdrop:backdrop-blur-sm',
        wide ? 'w-[min(40rem,calc(100vw-2rem))]' : 'w-[min(28rem,calc(100vw-2rem))]'
      )}
    >
      {open ? (
        <div className="space-y-4 p-5 sm:p-6">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          {children}
        </div>
      ) : null}
    </dialog>
  )
}

/** تأكيد قبل فعل لا يُتراجع عنه، أو يُفضَّل أن يُفكَّر فيه. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  action,
  tone = 'danger',
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  body: string
  action: string
  tone?: 'danger' | 'primary'
  onConfirm: () => Promise<QrActionResult<unknown>>
}) {
  const t = useTranslations('qr')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  return (
    <Dialog open={open} onClose={() => !pending && onClose()} title={title}>
      <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{body}</p>
      <ActionError error={error} />
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          {t('common.cancel')}
        </Button>
        <Button
          variant={tone}
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const result = await onConfirm()
              if (result.ok) {
                onClose()
                router.refresh()
              } else setError(result.error)
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {action}
        </Button>
      </div>
    </Dialog>
  )
}

/** رسالة خطأ من مفتاح يعيده فعل الخادم. */
export function ActionError({ error }: { error: string | null | undefined }) {
  const t = useTranslations('qr.errors')
  if (!error) return null
  const key = t.has(error as never) ? error : 'generic'
  return (
    <p role="alert" className="text-sm text-[var(--danger)]">
      {t(key as never)}
    </p>
  )
}

export function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warning' }) {
  return (
    <p
      className={cn(
        'rounded-lg px-3.5 py-2.5 text-sm leading-relaxed',
        tone === 'warning'
          ? 'bg-[var(--warning-soft)] text-[var(--warning)]'
          : 'bg-[var(--primary-soft)] text-[var(--primary)]'
      )}
    >
      {children}
    </p>
  )
}

/** مجموعة أزرار متجاورة لاختيار واحد — بنمط RangeTabs في الإحصاءات. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  label: string
  disabled?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex flex-wrap rounded-xl bg-[var(--bg-subtle)] p-1 ring-1 ring-[var(--border)]"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-55',
            option.value === value
              ? 'bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-soft)]'
              : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const t = useTranslations('qr.common')
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        } catch {
          // الحافظة ممنوعة في سياقات غير آمنة — النصّ ظاهر للنسخ اليدوي
        }
      }}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)]',
        className
      )}
    >
      {done ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {done ? t('copied') : t('copy')}
    </button>
  )
}

/** الرابط القصير بخطّ لاتيني واتجاه صحيح داخل نصّ عربي. */
export function ShortLink({ href, className }: { href: string; className?: string }) {
  return (
    <span dir="ltr" className={cn('font-latin break-all text-sm', className)}>
      {href.replace(/^https?:\/\//, '')}
    </span>
  )
}

/**
 * يشغّل فعل خادم ويعرض حالته. يُحدّث الصفحة بعد النجاح حتى تظهر القيم
 * الجديدة من الخادم لا من حالة المتصفّح.
 */
export function useAction() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const router = useRouter()

  function run<T>(action: () => Promise<QrActionResult<T>>, options: { success?: string; onOk?: (data: T) => void; refresh?: boolean } = {}) {
    start(async () => {
      setError(null)
      setDone(null)
      const result = await action()
      if (result.ok) {
        if (options.success) setDone(options.success)
        options.onOk?.(result.data)
        if (options.refresh !== false) router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return { pending, error, done, run, setError, setDone }
}

export function DoneNote({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <p role="status" className="inline-flex items-center gap-1.5 text-sm text-[var(--success)]">
      <Check className="size-4" aria-hidden />
      {children}
    </p>
  )
}
