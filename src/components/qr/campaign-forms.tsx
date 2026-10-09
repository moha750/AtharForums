'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { BarChart3, FolderMinus, FolderInput, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'

import { Button, buttonStyles } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/field'
import { assignLinks, createCampaign, deleteCampaign, updateCampaign } from '@/actions/qr'
import { CAMPAIGN_NOTE_MAX, TITLE_MAX } from '@/lib/qr/config'
import { ActionError, ConfirmDialog, Dialog, selectStyles, useAction } from './ui'

/** الحملة كيان يُنشأ أولًا ثم يُملأ: اسم وتعريف قصير. */
export function CampaignCreate({ locale }: { locale: string }) {
  const t = useTranslations('qr')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const action = useAction()

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {t('campaigns.create')}
      </Button>
    )
  }

  return (
    <form
      className="w-full space-y-4 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]"
      onSubmit={(e) => {
        e.preventDefault()
        action.run(() => createCampaign(name, note), {
          refresh: false,
          onOk: (data) => router.push(`/${locale}/qr/campaigns/${data.id}`),
        })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="campaign-name">{t('campaigns.name')}</Label>
          <Input id="campaign-name" value={name} maxLength={TITLE_MAX} onChange={(e) => setName(e.target.value)} autoFocus required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="campaign-note">{t('campaigns.note')}</Label>
          <Input
            id="campaign-note"
            value={note}
            maxLength={CAMPAIGN_NOTE_MAX}
            placeholder={t('campaigns.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      <ActionError error={action.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={action.pending || !name.trim()}>
          {action.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t('campaigns.submit')}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  )
}

/** بنية الحملة للمالك وحده: تسمية، وحذف. */
export function CampaignOwnerBar({
  id,
  name,
  note,
  locale,
}: {
  id: string
  name: string
  note: string | null
  locale: string
}) {
  const t = useTranslations('qr')
  const router = useRouter()
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null)
  const [draft, setDraft] = useState({ name, note: note ?? '' })
  const action = useAction()

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={() => setDialog('rename')}>
        <Pencil className="size-4" aria-hidden />
        {t('campaigns.rename')}
      </Button>
      <Button size="sm" variant="ghost" className="text-[var(--danger)]" onClick={() => setDialog('delete')}>
        <Trash2 className="size-4" aria-hidden />
        {t('campaigns.delete')}
      </Button>

      <Dialog open={dialog === 'rename'} onClose={() => !action.pending && setDialog(null)} title={t('campaigns.rename')}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            action.run(() => updateCampaign(id, draft.name, draft.note), { onOk: () => setDialog(null) })
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="campaign-rename">{t('campaigns.name')}</Label>
            <Input id="campaign-rename" value={draft.name} maxLength={TITLE_MAX} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campaign-renote">{t('campaigns.note')}</Label>
            <Input id="campaign-renote" value={draft.note} maxLength={CAMPAIGN_NOTE_MAX} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </div>
          <ActionError error={action.error} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={action.pending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={action.pending || !draft.name.trim()}>
              {action.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title={t('campaigns.deleteConfirmTitle', { name })}
        body={t('campaigns.deleteConfirmBody')}
        action={t('campaigns.delete')}
        onConfirm={async () => {
          const result = await deleteCampaign(id)
          if (result.ok) router.replace(`/${locale}/qr/campaigns`)
          return result
        }}
      />
    </div>
  )
}

/** ضمّ باركودات مفردة إلى الحملة — جماعيًّا. */
export function AddToCampaign({
  campaignId,
  singles,
}: {
  campaignId: string
  singles: Array<{ id: string; title: string }>
}) {
  const t = useTranslations('qr')
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const action = useAction()

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <FolderInput className="size-4" aria-hidden />
        {t('campaigns.addExisting')}
      </Button>
      <Dialog open={open} onClose={() => !action.pending && setOpen(false)} title={t('campaigns.addExisting')} wide>
        {singles.length === 0 ? (
          <p className="text-sm text-[var(--fg-muted)]">{t('campaigns.addExistingEmpty')}</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              action.run(() => assignLinks([...picked], campaignId), {
                onOk: () => {
                  setPicked(new Set())
                  setOpen(false)
                },
              })
            }}
          >
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {singles.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--bg-subtle)]">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={picked.has(s.id)}
                      onChange={() =>
                        setPicked((prev) => {
                          const next = new Set(prev)
                          if (next.has(s.id)) next.delete(s.id)
                          else next.add(s.id)
                          return next
                        })
                      }
                    />
                    <span className="text-sm">{s.title}</span>
                  </label>
                </li>
              ))}
            </ul>
            <ActionError error={action.error} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={action.pending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={action.pending || picked.size === 0}>
                {action.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t('campaigns.addSelected')}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  )
}

export type RoomRow = {
  id: string
  title: string
  scans: number
  share: number | null
  active: boolean
  kind: 'link' | 'file'
  host: string
  shortLink: string
}

/**
 * باركودات الحملة مرتّبة بالمسحات، ومعها نصيب كلٍّ من مجموعها.
 * الإخراج والنقل إلى حملة أخرى للمالك وحده، جماعيًّا.
 */
export function CampaignRoomList({
  rows,
  otherCampaigns,
  canManage,
  labels,
}: {
  rows: RoomRow[]
  otherCampaigns: Array<{ id: string; name: string }>
  canManage: boolean
  labels: { empty: string }
}) {
  const t = useTranslations('qr')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [moveTo, setMoveTo] = useState('')
  const action = useAction()
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const ids = [...picked].filter((id) => rows.some((r) => r.id === id))
  const max = Math.max(1, ...rows.map((r) => r.scans))

  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--fg-subtle)] ring-1 ring-[var(--border)]">
        {labels.empty}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {canManage && ids.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--primary-soft)] px-4 py-2.5 text-sm text-[var(--primary)]">
          <span className="font-medium">{t('list.selected', { count: ids.length })}</span>
          <Button
            size="sm"
            variant="secondary"
            disabled={action.pending}
            onClick={() => action.run(() => assignLinks(ids, null), { onOk: () => setPicked(new Set()) })}
          >
            <FolderMinus className="size-4" aria-hidden />
            {t('campaigns.removeSelected')}
          </Button>
          {otherCampaigns.length > 0 ? (
            <span className="flex items-center gap-2">
              <select
                className={`${selectStyles} h-9 w-auto`}
                value={moveTo}
                onChange={(e) => setMoveTo(e.target.value)}
                aria-label={t('campaigns.move')}
              >
                <option value="">{t('campaigns.move')}</option>
                {otherCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="secondary"
                disabled={!moveTo || action.pending}
                onClick={() =>
                  action.run(() => assignLinks(ids, moveTo), {
                    onOk: () => {
                      setPicked(new Set())
                      setMoveTo('')
                    },
                  })
                }
              >
                {action.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t('common.confirm')}
              </Button>
            </span>
          ) : null}
        </div>
      ) : null}
      <ActionError error={action.error} />

      <ol className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
            <div className="flex flex-wrap items-center gap-3">
              {canManage ? (
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={picked.has(row.id)}
                  onChange={() => toggle(row.id)}
                  aria-label={t('list.selectRow', { title: row.title })}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/qr/${row.id}`} className="font-medium hover:text-[var(--primary)] hover:underline">
                    {row.title}
                  </Link>
                  {!row.active ? <Badge tone="warning">{t('common.paused')}</Badge> : null}
                </div>
                <p className="mt-0.5 text-xs text-[var(--fg-subtle)]">
                  <bdi className="font-latin" dir="ltr">
                    {row.shortLink.replace(/^https?:\/\//, '')}
                  </bdi>
                  {' · '}
                  <bdi className="font-latin">{row.kind === 'file' ? t('common.file') : row.host}</bdi>
                </p>
              </div>
              <span className="font-latin text-sm tabular-nums">{row.scans.toLocaleString('en-US')}</span>
              {row.share !== null ? (
                <span className="font-latin w-14 text-end text-xs tabular-nums text-[var(--fg-subtle)]">{row.share}%</span>
              ) : null}
              <Link href={`/qr/${row.id}/stats`} className={buttonStyles('ghost', 'sm')} aria-label={t('common.stats')}>
                <BarChart3 className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
              <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${Math.max(1, (row.scans / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
