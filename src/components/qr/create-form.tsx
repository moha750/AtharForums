'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/field'
import { createLink, discardUpload } from '@/actions/qr'
import { TITLE_MAX } from '@/lib/qr/config'
import { normalizeCustomCode, customCodeIssue } from '@/lib/qr/code'
import { validateTarget } from '@/lib/qr/target'
import { CodeField, FilePicker, TargetInput, type CodeState } from './fields'
import { uploadPrepared, type PreparedFile } from './file-tools'
import { ActionError, Segmented } from './ui'

/**
 * الخطوة الأولى: الاسم والوجهة (رابط أو ملف) والرمز المختار اختياريًّا.
 * يُنشأ الصفّ بالوصفة الافتراضية، ثم ننتقل إلى محرّر التصميم على الرمز الحيّ.
 */
export function CreateForm({
  origin,
  locale,
  customCodes,
  campaignId,
}: {
  origin: string
  locale: string
  customCodes: boolean
  campaignId: string | null
}) {
  const t = useTranslations('qr')
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<'link' | 'file'>('link')
  const [target, setTarget] = useState('')
  const [file, setFile] = useState<PreparedFile | null>(null)
  const [code, setCode] = useState<CodeState>({ value: '', status: 'idle' })
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState<'upload' | 'create' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const titleOk = title.trim().length >= 1 && title.trim().length <= TITLE_MAX
  const targetOk = kind === 'link' ? validateTarget(target, origin).ok : Boolean(file)
  const customCode = normalizeCustomCode(code.value)
  const codeOk = !customCode || (!customCodeIssue(customCode) && code.status !== 'taken' && code.status !== 'disabled')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    setError(null)
    if (!titleOk || !targetOk || !codeOk || busy) return

    let path: string | undefined
    if (kind === 'file' && file) {
      setBusy('upload')
      const uploaded = await uploadPrepared(file)
      if ('error' in uploaded) {
        setBusy(null)
        setError(uploaded.error)
        return
      }
      path = uploaded.path
    }

    setBusy('create')
    try {
      const result = await createLink({
        title,
        kind,
        target: kind === 'link' ? target : undefined,
        filePath: path,
        customCode: customCodes && customCode ? customCode : undefined,
        campaignId,
      })
      if (!result.ok) {
        // الخادم يمحو المرفوع عند الفشل؛ ونكرّر من هنا احتياطًا لانقطاعٍ قبل وصوله
        if (path) await discardUpload(path).catch(() => undefined)
        setError(result.error)
        setBusy(null)
        return
      }
      router.push(`/${locale}/qr/${result.data.id}/design`)
    } catch {
      if (path) await discardUpload(path).catch(() => undefined)
      setError('generic')
      setBusy(null)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="qr-title" hint={t('create.nameHint')}>
          {t('create.name')}
        </Label>
        <Input
          id="qr-title"
          value={title}
          maxLength={TITLE_MAX}
          placeholder={t('create.namePlaceholder')}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={tried && !titleOk ? true : undefined}
          autoFocus
        />
        {tried && !titleOk ? (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {t('errors.title')}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">{t('create.kind')}</p>
        <Segmented
          label={t('create.kind')}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'link', label: t('create.kindLink') },
            { value: 'file', label: t('create.kindFile') },
          ]}
        />
        {kind === 'link' ? (
          <div className="space-y-1.5">
            <Label htmlFor="qr-target">{t('target.label')}</Label>
            <TargetInput id="qr-target" value={target} onChange={setTarget} origin={origin} showEmpty={tried} />
          </div>
        ) : (
          <FilePicker value={file} onChange={setFile} actionLabel={t('create.submit')} />
        )}
        {tried && kind === 'file' && !file ? (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {t('errors.file-missing')}
          </p>
        ) : null}
      </div>

      {customCodes ? <CodeField value={code} onChange={setCode} origin={origin} /> : null}

      <ActionError error={error} />

      <div className="flex items-center gap-3 border-t border-[var(--border)] pt-5">
        <Button type="submit" disabled={busy !== null}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {busy === 'upload' ? t('file.uploading') : busy === 'create' ? t('create.submitting') : t('create.submit')}
        </Button>
      </div>
    </form>
  )
}
