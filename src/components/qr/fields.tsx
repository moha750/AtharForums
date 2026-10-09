'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, FileText, FileUp, Loader2, X } from 'lucide-react'

import { Input, Label } from '@/components/ui/field'
import { checkCode, type CodeCheck } from '@/actions/qr'
import { AVAILABILITY_DEBOUNCE_MS, FILE_ACCEPT } from '@/lib/qr/config'
import { customCodeIssue, normalizeCustomCode } from '@/lib/qr/code'
import { validateTarget } from '@/lib/qr/target'
import { cn } from '@/lib/utils'
import { prepareFile, type PreparedFile } from './file-tools'

/* ── الوجهة: تصديق لحظي بالحَكَم نفسه الذي يستعمله الخادم ────────────────── */

export function TargetInput({
  value,
  onChange,
  origin,
  id,
  autoFocus,
  showEmpty,
}: {
  value: string
  onChange: (value: string) => void
  origin: string
  id?: string
  autoFocus?: boolean
  /** أظهر «أدخل الرابط» (بعد محاولة حفظ). */
  showEmpty?: boolean
}) {
  const t = useTranslations('qr.target')
  const [touched, setTouched] = useState(false)
  const result = validateTarget(value, origin)
  const issue = result.ok ? null : result.issue
  const visible = issue && (issue !== 'empty' ? touched || value.length > 8 : showEmpty)
  const messageId = useId()

  return (
    <div className="space-y-1.5">
      <Input
        id={id}
        type="url"
        inputMode="url"
        dir="ltr"
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={t('placeholder')}
        value={value}
        aria-invalid={visible ? true : undefined}
        aria-describedby={visible ? messageId : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        className="font-latin"
      />
      {visible ? (
        <p id={messageId} role="alert" className="text-sm text-[var(--danger)]">
          {t(issue)}
        </p>
      ) : null}
    </div>
  )
}

/* ── الملف: فحص عند الاختيار، والرفع لاحقًا عند الحفظ ────────────────────── */

export function FilePicker({
  value,
  onChange,
  actionLabel,
}: {
  value: PreparedFile | null
  onChange: (file: PreparedFile | null) => void
  /** اسم الزرّ الذي يرفع: «إنشاء» أو «حفظ». */
  actionLabel: string
}) {
  const t = useTranslations('qr.file')
  const inputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [issue, setIssue] = useState<string | null>(null)

  useEffect(() => () => {
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl)
  }, [value])

  async function pick(file: File) {
    setIssue(null)
    setBusy(true)
    try {
      const prepared = await prepareFile(file)
      if ('issue' in prepared) {
        setIssue(prepared.issue)
        onChange(null)
      } else onChange(prepared)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {/* لا HEIC في accept: صور آيفون تُحوَّل عند المشاركة، وما لا يُفكّ لا يُقبل */}
      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept={FILE_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void pick(file)
        }}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-xl bg-[var(--bg-subtle)] p-3 ring-1 ring-[var(--border)]">
          {value.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.previewUrl} alt="" className="size-16 shrink-0 rounded-lg object-cover ring-1 ring-[var(--border)]" />
          ) : (
            <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-[var(--surface)] text-[var(--primary)] ring-1 ring-[var(--border)]">
              <FileText className="size-7" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" dir="auto">
              {value.name}
            </p>
            <p className="font-latin text-xs text-[var(--fg-subtle)]">
              {value.kind === 'pdf' ? 'PDF' : value.mime.replace('image/', '').toUpperCase()} ·{' '}
              {(value.blob.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <label htmlFor={inputId} className="cursor-pointer text-sm font-medium text-[var(--primary)] hover:underline">
            {t('replace')}
          </label>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t('remove')}
            className="rounded-md p-1 text-[var(--fg-subtle)] transition-colors hover:text-[var(--danger)]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] px-4 py-8 text-center transition-colors hover:border-[var(--primary)]"
        >
          {busy ? (
            <Loader2 className="size-6 animate-spin text-[var(--primary)]" aria-hidden />
          ) : (
            <FileUp className="size-6 text-[var(--fg-subtle)]" aria-hidden />
          )}
          <span className="text-sm font-medium">{busy ? t('preparing') : t('pick')}</span>
          <span className="text-xs text-[var(--fg-subtle)]">{t('hint')}</span>
        </label>
      )}

      {issue ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {t(issue as never)}
        </p>
      ) : value ? (
        <p className="text-xs text-[var(--fg-subtle)]">{t('notUploadedYet', { action: actionLabel })}</p>
      ) : null}
    </div>
  )
}

/* ── الرمز المختار: فحص لحظي بعد سكون ٤٠٠ ملّي ثانية ─────────────────────── */

export type CodeState = { value: string; status: 'idle' | 'checking' | CodeCheck['state'] }

export function CodeField({
  value,
  onChange,
  origin,
}: {
  value: CodeState
  onChange: (state: CodeState) => void
  origin: string
}) {
  const t = useTranslations('qr.code')
  const id = useId()
  // يُتجاهَل الجواب إن تغيّر النصّ قبل وصوله
  const latest = useRef(value.value)

  useEffect(() => {
    latest.current = value.value
    const code = normalizeCustomCode(value.value)
    if (!code || customCodeIssue(code)) return
    const timer = setTimeout(async () => {
      onChange({ value: value.value, status: 'checking' })
      const result = await checkCode(value.value)
      if (latest.current !== value.value) return
      onChange({ value: value.value, status: result.state })
    }, AVAILABILITY_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.value])

  const code = normalizeCustomCode(value.value)
  const local = code ? customCodeIssue(code) : null

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} hint={t('hint', { origin: origin.replace(/^https?:\/\//, '') })}>
        {t('label')}
      </Label>
      <div className="relative">
        <Input
          id={id}
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('placeholder')}
          value={value.value}
          maxLength={40}
          onChange={(e) => onChange({ value: e.target.value, status: 'idle' })}
          className="font-latin pe-10"
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center">
          {value.status === 'checking' ? (
            <Loader2 className="size-4 animate-spin text-[var(--fg-subtle)]" aria-hidden />
          ) : value.status === 'available' ? (
            <Check className="size-4 text-[var(--success)]" aria-hidden />
          ) : null}
        </span>
      </div>
      {code && code !== value.value.trim() && !local ? (
        <p className="font-latin text-xs text-[var(--fg-subtle)]" dir="ltr">
          /q/{code}
        </p>
      ) : null}
      <p
        role="status"
        className={cn(
          'min-h-5 text-sm',
          value.status === 'available' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
        )}
      >
        {local
          ? t(local)
          : value.status === 'available'
            ? t('available')
            : value.status === 'taken'
              ? t('taken')
              : value.status === 'disabled'
                ? t('disabled')
                : value.status === 'checking'
                  ? ''
                  : ''}
      </p>
    </div>
  )
}
