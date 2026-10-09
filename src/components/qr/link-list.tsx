'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  BarChart3,
  FileText,
  FolderInput,
  Link2,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Search,
  Settings2,
  Share2,
  Trash2,
  ArrowLeftRight,
} from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { Button, buttonStyles } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/field'
import { assignLinks, deleteLink, setLinkActive, setLinkTarget } from '@/actions/qr'
import { cn } from '@/lib/utils'
import type { QrAccess } from '@/lib/database.types'
import { TargetInput } from './fields'
import { ActionError, ConfirmDialog, CopyButton, Dialog, DoneNote, Segmented, ShortLink, selectStyles, useAction } from './ui'

export type ListItem = {
  id: string
  code: string
  title: string
  kind: 'link' | 'file'
  target: string
  host: string
  active: boolean
  scans: number
  access: QrAccess
  shortLink: string
}

type Campaign = { id: string; name: string }

/* ── قائمة منسدلة صغيرة ───────────────────────────────────────────────────── */

function Menu({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={buttonStyles('ghost', 'sm', 'px-2')}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-full z-20 mt-1 min-w-48 rounded-xl bg-[var(--surface-raised)] p-1.5 shadow-[var(--shadow-lift)] ring-1 ring-[var(--border)]"
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  )
}

const itemStyles =
  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-sm text-[var(--fg)] transition-colors hover:bg-[var(--bg-subtle)]'

/* ── الصفّ ─────────────────────────────────────────────────────────────────── */

type Dialogs =
  | { type: 'target'; item: ListItem }
  | { type: 'assign'; items: ListItem[] }
  | { type: 'pause'; item: ListItem }
  | { type: 'delete'; item: ListItem }
  | null

export function LinkList({
  items,
  campaigns,
  origin,
  emptyTitle,
  emptyBody,
  selectable = true,
}: {
  items: ListItem[]
  campaigns: Campaign[]
  origin: string
  emptyTitle?: string
  emptyBody?: string
  selectable?: boolean
}) {
  const t = useTranslations('qr')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'paused'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<Dialogs>(null)
  const resume = useAction()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (status === 'active' && !item.active) return false
      if (status === 'paused' && item.active) return false
      if (!q) return true
      return (
        item.title.toLowerCase().includes(q) ||
        item.code.includes(q) ||
        item.host.toLowerCase().includes(q)
      )
    })
  }, [items, query, status])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--surface)] px-6 py-14 text-center ring-1 ring-[var(--border)]">
        <p className="font-medium">{emptyTitle ?? t('list.emptyTitle')}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-[var(--fg-muted)]">{emptyBody ?? t('list.emptyBody')}</p>
      </div>
    )
  }

  const selectedItems = items.filter((item) => selected.has(item.id))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-[var(--fg-subtle)]" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search')}
            aria-label={t('common.search')}
            className="ps-9"
          />
        </div>
        <Segmented
          label={t('settings.statusSection')}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: t('common.statusAll') },
            { value: 'active', label: t('common.statusActive') },
            { value: 'paused', label: t('common.statusPaused') },
          ]}
        />
      </div>

      {selectable && selectedItems.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--primary-soft)] px-4 py-2.5 text-sm text-[var(--primary)]">
          <span className="font-medium">{t('list.selected', { count: selectedItems.length })}</span>
          <Button size="sm" variant="secondary" onClick={() => setDialog({ type: 'assign', items: selectedItems })}>
            <FolderInput className="size-4" aria-hidden />
            {t('list.assignSelected')}
          </Button>
          <button type="button" className="ms-auto text-sm hover:underline" onClick={() => setSelected(new Set())}>
            {t('list.clearSelection')}
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-xl bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--fg-subtle)] ring-1 ring-[var(--border)]">
          {t('common.noMatch')}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => {
            const canEdit = item.access === 'owner' || item.access === 'edit'
            const isOwner = item.access === 'owner'
            return (
              <li
                key={item.id}
                className={cn(
                  'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]',
                  !item.active && 'bg-[var(--bg-subtle)]'
                )}
              >
                {selectable ? (
                  isOwner ? (
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                      aria-label={t('list.selectRow', { title: item.title })}
                    />
                  ) : (
                    <span className="size-4" aria-hidden />
                  )
                ) : null}

                <div className="min-w-0 flex-1 basis-64">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/qr/${item.id}`} className="font-medium hover:text-[var(--primary)] hover:underline">
                      {item.title}
                    </Link>
                    <Badge tone={item.active ? 'success' : 'warning'}>
                      {item.active ? t('common.active') : t('common.paused')}
                    </Badge>
                    {item.access === 'edit' ? <Badge tone="teal">{t('common.accessEdit')}</Badge> : null}
                    {item.access === 'read' ? <Badge>{t('common.accessRead')}</Badge> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--fg-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <ShortLink href={item.shortLink} className="text-xs" />
                      <CopyButton value={item.shortLink} />
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs" title={item.target}>
                      {item.kind === 'file' ? (
                        <FileText className="size-3.5" aria-hidden />
                      ) : (
                        <Link2 className="size-3.5" aria-hidden />
                      )}
                      <bdi className="font-latin max-w-56 truncate">{item.kind === 'file' ? t('common.file') : item.host}</bdi>
                    </span>
                  </div>
                </div>

                <span className="font-latin text-sm tabular-nums text-[var(--fg-muted)]">
                  {t('common.scans', { count: item.scans })}
                </span>

                <div className="flex items-center gap-1">
                  {canEdit ? (
                    item.kind === 'link' ? (
                      <Button size="sm" onClick={() => setDialog({ type: 'target', item })}>
                        <ArrowLeftRight className="size-4" aria-hidden />
                        {t('common.editTarget')}
                      </Button>
                    ) : (
                      <Link href={`/qr/${item.id}#destination`} className={buttonStyles('primary', 'sm')}>
                        <ArrowLeftRight className="size-4" aria-hidden />
                        {t('common.editTarget')}
                      </Link>
                    )
                  ) : null}
                  <Link href={`/qr/${item.id}/stats`} className={buttonStyles('ghost', 'sm')} aria-label={t('common.stats')}>
                    <BarChart3 className="size-4" aria-hidden />
                    <span className="hidden sm:inline">{t('common.stats')}</span>
                  </Link>
                  <Menu label={t('common.more')}>
                    {(close) => (
                      <>
                        <Link href={`/qr/${item.id}`} className={itemStyles} onClick={close}>
                          <Settings2 className="size-4" aria-hidden />
                          {t('common.settings')}
                        </Link>
                        {isOwner ? (
                          <Link href={`/qr/${item.id}#share`} className={itemStyles} onClick={close}>
                            <Share2 className="size-4" aria-hidden />
                            {t('common.share')}
                          </Link>
                        ) : null}
                        {isOwner ? (
                          <button
                            type="button"
                            className={itemStyles}
                            onClick={() => {
                              close()
                              setDialog({ type: 'assign', items: [item] })
                            }}
                          >
                            <FolderInput className="size-4" aria-hidden />
                            {t('list.assign')}
                          </button>
                        ) : null}
                        {canEdit ? (
                          item.active ? (
                            <button
                              type="button"
                              className={itemStyles}
                              onClick={() => {
                                close()
                                setDialog({ type: 'pause', item })
                              }}
                            >
                              <Pause className="size-4" aria-hidden />
                              {t('common.pause')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={itemStyles}
                              disabled={resume.pending}
                              onClick={() => {
                                close()
                                resume.run(() => setLinkActive(item.id, true))
                              }}
                            >
                              {resume.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
                              {t('common.resume')}
                            </button>
                          )
                        ) : null}
                        {isOwner ? (
                          <button
                            type="button"
                            className={cn(itemStyles, 'text-[var(--danger)]')}
                            onClick={() => {
                              close()
                              setDialog({ type: 'delete', item })
                            }}
                          >
                            <Trash2 className="size-4" aria-hidden />
                            {t('common.delete')}
                          </button>
                        ) : null}
                      </>
                    )}
                  </Menu>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ActionError error={resume.error} />

      {dialog?.type === 'target' ? (
        <TargetDialog item={dialog.item} origin={origin} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.type === 'assign' ? (
        <AssignDialog
          items={dialog.items}
          campaigns={campaigns}
          onClose={() => setDialog(null)}
          onDone={() => setSelected(new Set())}
        />
      ) : null}
      {dialog?.type === 'pause' ? (
        <ConfirmDialog
          open
          onClose={() => setDialog(null)}
          title={t('list.pauseConfirmTitle', { title: dialog.item.title })}
          body={t('list.pauseConfirmBody')}
          action={t('common.pause')}
          tone="primary"
          onConfirm={() => setLinkActive(dialog.item.id, false)}
        />
      ) : null}
      {dialog?.type === 'delete' ? (
        <ConfirmDialog
          open
          onClose={() => setDialog(null)}
          title={t('list.deleteConfirmTitle', { title: dialog.item.title })}
          body={t('list.deleteConfirmBody')}
          action={t('list.deleteConfirmAction')}
          onConfirm={() => deleteLink(dialog.item.id)}
        />
      ) : null}
    </div>
  )
}

/* ── تعديل الوجهة — الفعل الأبرز ──────────────────────────────────────────── */

function TargetDialog({ item, origin, onClose }: { item: ListItem; origin: string; onClose: () => void }) {
  const t = useTranslations('qr')
  const [value, setValue] = useState(item.target)
  const [tried, setTried] = useState(false)
  const action = useAction()

  return (
    <Dialog open onClose={() => !action.pending && onClose()} title={`${t('list.targetTitle')} · ${item.title}`}>
      <p className="text-sm text-[var(--fg-muted)]">{t('list.targetHint')}</p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          action.run(() => setLinkTarget(item.id, value), { onOk: onClose })
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="qr-target-dialog">{t('target.label')}</Label>
          <TargetInput id="qr-target-dialog" value={value} onChange={setValue} origin={origin} autoFocus showEmpty={tried} />
        </div>
        <ActionError error={action.error} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={action.pending || value.trim() === item.target}>
            {action.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t('settings.saveTarget')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/* ── الضمّ لحملة (للمالك) ─────────────────────────────────────────────────── */

function AssignDialog({
  items,
  campaigns,
  onClose,
  onDone,
}: {
  items: ListItem[]
  campaigns: Campaign[]
  onClose: () => void
  onDone: () => void
}) {
  const t = useTranslations('qr')
  const [campaign, setCampaign] = useState(campaigns[0]?.id ?? '')
  const action = useAction()

  return (
    <Dialog open onClose={() => !action.pending && onClose()} title={t('list.assignTitle')}>
      {campaigns.length === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--fg-muted)]">{t('list.assignNone')}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t('common.close')}
            </Button>
            <Link href="/qr/campaigns" className={buttonStyles('primary', 'md')}>
              {t('campaigns.create')}
            </Link>
          </div>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            action.run(() => assignLinks(items.map((i) => i.id), campaign), {
              onOk: () => {
                onDone()
                onClose()
              },
            })
          }}
        >
          <ul className="max-h-32 space-y-1 overflow-y-auto text-sm text-[var(--fg-muted)]">
            {items.map((item) => (
              <li key={item.id} className="truncate">
                • {item.title}
              </li>
            ))}
          </ul>
          <select className={selectStyles} value={campaign} onChange={(e) => setCampaign(e.target.value)} aria-label={t('settings.campaignSection')}>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ActionError error={action.error} />
          <DoneNote>{action.done}</DoneNote>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={action.pending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={action.pending || !campaign}>
              {action.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t('list.assign')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
