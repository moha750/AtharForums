'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ExternalLink, FileText, Loader2, Pause, Play, Trash2, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/field'
import {
  assignLinks,
  deleteLink,
  discardUpload,
  overseeDelete,
  overseeSetActive,
  overseeTransfer,
  renameLink,
  setLinkActive,
  setLinkFile,
  setLinkTarget,
} from '@/actions/qr'
import { TITLE_MAX } from '@/lib/qr/config'
import { FilePicker, TargetInput } from './fields'
import { uploadPrepared, type PreparedFile } from './file-tools'
import { ActionError, ConfirmDialog, Dialog, DoneNote, Segmented, selectStyles, useAction } from './ui'

/* ── الوجهة: الفعل الأبرز، والتحويل بين النوعين بتحديث واحد ─────────────── */

export function DestinationPanel({
  linkId,
  kind,
  target,
  fileUrl,
  fileKind,
  origin,
  canEdit,
}: {
  linkId: string
  kind: 'link' | 'file'
  target: string
  fileUrl: string | null
  fileKind: 'image' | 'pdf' | null
  origin: string
  canEdit: boolean
}) {
  const t = useTranslations('qr')
  const [mode, setMode] = useState<'link' | 'file'>(kind)
  const [url, setUrl] = useState(kind === 'link' ? target : '')
  const [file, setFile] = useState<PreparedFile | null>(null)
  const [tried, setTried] = useState(false)
  const [uploading, setUploading] = useState(false)
  const action = useAction()

  const current =
    kind === 'link' ? (
      <a
        href={target}
        target="_blank"
        rel="noopener noreferrer"
        dir="ltr"
        className="font-latin inline-flex max-w-full items-center gap-1.5 break-all text-sm text-[var(--primary)] hover:underline"
      >
        {target}
        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
      </a>
    ) : (
      <span className="inline-flex flex-wrap items-center gap-2 text-sm">
        <FileText className="size-4 text-[var(--primary)]" aria-hidden />
        {t('settings.currentFile')} · {fileKind === 'pdf' ? t('common.pdf') : t('common.image')}
        {fileUrl ? (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">
            {t('file.openCurrent')}
          </a>
        ) : null}
      </span>
    )

  if (!canEdit) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-[var(--fg-subtle)]">{t('settings.currentTarget')}</p>
        {current}
      </div>
    )
  }

  async function saveFile() {
    if (!file) {
      setTried(true)
      return
    }
    setUploading(true)
    const uploaded = await uploadPrepared(file)
    setUploading(false)
    if ('error' in uploaded) {
      action.setError(uploaded.error)
      return
    }
    action.run(
      async () => {
        try {
          return await setLinkFile(linkId, uploaded.path)
        } catch {
          // انقطاع بعد الرفع وقبل الحفظ: لا يبقى المرفوع يتيمًا
          await discardUpload(uploaded.path).catch(() => undefined)
          return { ok: false as const, error: 'generic' }
        }
      },
      { success: t('list.targetSaved'), onOk: () => setFile(null) }
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1 rounded-xl bg-[var(--bg-subtle)] p-3.5 ring-1 ring-[var(--border)]">
        <p className="text-xs text-[var(--fg-subtle)]">{t('settings.currentTarget')}</p>
        {current}
      </div>

      <Segmented
        label={t('create.kind')}
        value={mode}
        onChange={(next) => {
          setMode(next)
          setTried(false)
          action.setError(null)
        }}
        options={[
          { value: 'link', label: kind === 'file' ? t('settings.switchToLink') : t('create.kindLink') },
          { value: 'file', label: kind === 'link' ? t('settings.switchToFile') : t('file.replace') },
        ]}
      />

      {mode === 'link' ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            setTried(true)
            action.run(() => setLinkTarget(linkId, url), { success: t('list.targetSaved') })
          }}
        >
          <Label htmlFor="qr-destination">{t('target.label')}</Label>
          <TargetInput id="qr-destination" value={url} onChange={setUrl} origin={origin} showEmpty={tried} />
          <Button type="submit" disabled={action.pending || (kind === 'link' && url.trim() === target)}>
            {action.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t('settings.saveTarget')}
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          <FilePicker value={file} onChange={setFile} actionLabel={t('settings.saveFile')} />
          {tried && !file ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {t('errors.file-missing')}
            </p>
          ) : null}
          <Button onClick={saveFile} disabled={action.pending || uploading}>
            {action.pending || uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {uploading ? t('file.uploading') : t('settings.saveFile')}
          </Button>
        </div>
      )}

      <ActionError error={action.error} />
      <DoneNote>{action.done}</DoneNote>
    </div>
  )
}

/* ── الاسم ─────────────────────────────────────────────────────────────────── */

export function TitleForm({ linkId, title }: { linkId: string; title: string }) {
  const t = useTranslations('qr')
  const [value, setValue] = useState(title)
  const action = useAction()
  return (
    <form
      className="flex flex-wrap items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        action.run(() => renameLink(linkId, value), { success: t('common.saved') })
      }}
    >
      <Input
        aria-label={t('settings.titleSection')}
        value={value}
        maxLength={TITLE_MAX}
        onChange={(e) => setValue(e.target.value)}
        className="min-w-0 flex-1 basis-60"
      />
      <Button type="submit" variant="secondary" disabled={action.pending || value.trim() === title || !value.trim()}>
        {action.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t('common.save')}
      </Button>
      <div className="basis-full">
        <ActionError error={action.error} />
        <DoneNote>{action.done}</DoneNote>
      </div>
    </form>
  )
}

/* ── الحالة: الإيقاف بتأكيد، والتشغيل بلا تأكيد ─────────────────────────── */

export function StatusControl({ linkId, title, active }: { linkId: string; title: string; active: boolean }) {
  const t = useTranslations('qr')
  const [confirm, setConfirm] = useState(false)
  const action = useAction()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge tone={active ? 'success' : 'warning'}>{active ? t('common.active') : t('common.paused')}</Badge>
      <p className="min-w-0 flex-1 text-sm text-[var(--fg-muted)]">{active ? t('settings.statusOn') : t('settings.statusOff')}</p>
      {active ? (
        <Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>
          <Pause className="size-4" aria-hidden />
          {t('common.pause')}
        </Button>
      ) : (
        <Button size="sm" disabled={action.pending} onClick={() => action.run(() => setLinkActive(linkId, true))}>
          {action.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {t('common.resume')}
        </Button>
      )}
      <ActionError error={action.error} />
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('list.pauseConfirmTitle', { title })}
        body={t('list.pauseConfirmBody')}
        action={t('common.pause')}
        tone="primary"
        onConfirm={() => setLinkActive(linkId, false)}
      />
    </div>
  )
}

/* ── الحملة (للمالك) ──────────────────────────────────────────────────────── */

export function CampaignSelect({
  linkId,
  current,
  campaigns,
}: {
  linkId: string
  current: string | null
  campaigns: Array<{ id: string; name: string }>
}) {
  const t = useTranslations('qr')
  const [value, setValue] = useState(current ?? '')
  const action = useAction()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={`${selectStyles} min-w-0 flex-1 basis-56`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={t('settings.campaignSection')}
      >
        <option value="">{t('settings.campaignNone')}</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <Button
        variant="secondary"
        disabled={action.pending || value === (current ?? '')}
        onClick={() => action.run(() => assignLinks([linkId], value || null), { success: t('common.saved') })}
      >
        {action.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t('common.save')}
      </Button>
      <div className="basis-full">
        <ActionError error={action.error} />
        <DoneNote>{action.done}</DoneNote>
      </div>
    </div>
  )
}

/* ── منطقة الخطر (للمالك) ─────────────────────────────────────────────────── */

export function DangerZone({ linkId, title, locale }: { linkId: string; title: string; locale: string }) {
  const t = useTranslations('qr')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden />
        {t('settings.deleteLink')}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('list.deleteConfirmTitle', { title })}
        body={t('list.deleteConfirmBody')}
        action={t('list.deleteConfirmAction')}
        onConfirm={async () => {
          const result = await deleteLink(linkId)
          if (result.ok) router.replace(`/${locale}/qr`)
          return result
        }}
      />
    </>
  )
}

/* ── أفعال المشرف: دوالّ ضيّقة لا سياسات كتابة ───────────────────────────── */

export function OverseerActions({
  linkId,
  title,
  active,
  holders,
  ownerId,
  locale,
  afterDelete,
}: {
  linkId: string
  title: string
  active: boolean
  holders: Array<{ id: string; name: string }>
  ownerId: string
  locale: string
  afterDelete?: string
}) {
  const t = useTranslations('qr')
  const router = useRouter()
  const [dialog, setDialog] = useState<'pause' | 'delete' | 'transfer' | null>(null)
  const [owner, setOwner] = useState('')
  const resume = useAction()
  const transfer = useAction()
  const candidates = holders.filter((h) => h.id !== ownerId)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active ? (
        <Button size="sm" variant="secondary" onClick={() => setDialog('pause')}>
          <Pause className="size-4" aria-hidden />
          {t('common.pause')}
        </Button>
      ) : (
        <Button size="sm" disabled={resume.pending} onClick={() => resume.run(() => overseeSetActive(linkId, true))}>
          {resume.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {t('common.resume')}
        </Button>
      )}
      <Button size="sm" variant="secondary" onClick={() => setDialog('transfer')}>
        <UserRound className="size-4" aria-hidden />
        {t('oversight.transfer')}
      </Button>
      <Button size="sm" variant="ghost" className="text-[var(--danger)]" onClick={() => setDialog('delete')}>
        <Trash2 className="size-4" aria-hidden />
        {t('common.delete')}
      </Button>
      <ActionError error={resume.error} />

      <ConfirmDialog
        open={dialog === 'pause'}
        onClose={() => setDialog(null)}
        title={t('list.pauseConfirmTitle', { title })}
        body={t('list.pauseConfirmBody')}
        action={t('common.pause')}
        tone="primary"
        onConfirm={() => overseeSetActive(linkId, false)}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title={t('list.deleteConfirmTitle', { title })}
        body={t('list.deleteConfirmBody')}
        action={t('list.deleteConfirmAction')}
        onConfirm={async () => {
          const result = await overseeDelete(linkId)
          if (result.ok && afterDelete) router.replace(`/${locale}${afterDelete}`)
          return result
        }}
      />
      <Dialog open={dialog === 'transfer'} onClose={() => !transfer.pending && setDialog(null)} title={t('oversight.transferTitle', { title })}>
        <p className="text-sm text-[var(--fg-muted)]">{t('oversight.transferLead')}</p>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            transfer.run(() => overseeTransfer(linkId, owner), { onOk: () => setDialog(null) })
          }}
        >
          <select
            className={selectStyles}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            aria-label={t('oversight.transferTo')}
            required
          >
            <option value="" disabled>
              {t('oversight.transferTo')}
            </option>
            {candidates.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <ActionError error={transfer.error} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={transfer.pending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={transfer.pending || !owner}>
              {transfer.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t('oversight.transfer')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
