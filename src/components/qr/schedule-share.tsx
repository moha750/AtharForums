'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarClock, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/field'
import { addSchedule, addShare, changeShare, deleteSchedule, removeShare, updateSchedule } from '@/actions/qr'
import { NOTE_MAX } from '@/lib/qr/config'
import { TargetInput } from './fields'
import { ActionError, ConfirmDialog, DoneNote, Segmented, selectStyles, useAction } from './ui'

/* ── جدولة الوجهة ─────────────────────────────────────────────────────────── */

export type ScheduleRow = {
  id: string
  target: string
  startsLocal: string
  endsLocal: string
  startsLabel: string | null
  endsLabel: string | null
  note: string | null
  state: 'live' | 'upcoming' | 'ended'
}

function ScheduleForm({
  linkId,
  origin,
  row,
  onDone,
}: {
  linkId: string
  origin: string
  row?: ScheduleRow
  onDone: () => void
}) {
  const t = useTranslations('qr')
  const [target, setTarget] = useState(row?.target ?? '')
  const [starts, setStarts] = useState(row?.startsLocal ?? '')
  const [ends, setEnds] = useState(row?.endsLocal ?? '')
  const [note, setNote] = useState(row?.note ?? '')
  const [tried, setTried] = useState(false)
  const action = useAction()
  const windowBad = Boolean(starts && ends && ends <= starts)

  return (
    <form
      className="space-y-4 rounded-xl bg-[var(--bg-subtle)] p-4 ring-1 ring-[var(--border)]"
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (windowBad) return
        const input = { target, starts, ends, note }
        action.run(() => (row ? updateSchedule(row.id, input) : addSchedule(linkId, input)), { onOk: onDone })
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`sched-target-${row?.id ?? 'new'}`}>{t('target.label')}</Label>
        <TargetInput id={`sched-target-${row?.id ?? 'new'}`} value={target} onChange={setTarget} origin={origin} showEmpty={tried} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`sched-starts-${row?.id ?? 'new'}`} hint={t('schedule.tz')}>
            {t('schedule.starts')}
          </Label>
          <Input
            id={`sched-starts-${row?.id ?? 'new'}`}
            type="datetime-local"
            dir="ltr"
            value={starts}
            onChange={(e) => setStarts(e.target.value)}
          />
          <p className="text-xs text-[var(--fg-subtle)]">{starts ? null : t('schedule.openStart')}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`sched-ends-${row?.id ?? 'new'}`}>{t('schedule.ends')}</Label>
          <Input
            id={`sched-ends-${row?.id ?? 'new'}`}
            type="datetime-local"
            dir="ltr"
            value={ends}
            onChange={(e) => setEnds(e.target.value)}
            aria-invalid={windowBad || undefined}
          />
          <p className="text-xs text-[var(--fg-subtle)]">{ends ? null : t('schedule.openEnd')}</p>
        </div>
      </div>
      {windowBad ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {t('schedule.window')}
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor={`sched-note-${row?.id ?? 'new'}`}>{t('schedule.note')}</Label>
        <Input
          id={`sched-note-${row?.id ?? 'new'}`}
          value={note}
          maxLength={NOTE_MAX}
          placeholder={t('schedule.notePlaceholder')}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <ActionError error={action.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={action.pending}>
          {action.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t('common.save')}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={action.pending}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  )
}

export function SchedulePanel({
  linkId,
  rows,
  canEdit,
  origin,
}: {
  linkId: string
  rows: ScheduleRow[]
  canEdit: boolean
  origin: string
}) {
  const t = useTranslations('qr')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [removing, setRemoving] = useState<ScheduleRow | null>(null)

  const tone = { live: 'success', upcoming: 'teal', ended: 'neutral' } as const

  return (
    <div className="space-y-3">
      {rows.length === 0 && editing !== 'new' ? (
        <p className="text-sm text-[var(--fg-subtle)]">{t('schedule.empty')}</p>
      ) : null}
      <ul className="space-y-2">
        {rows.map((row) =>
          editing === row.id ? (
            <li key={row.id}>
              <ScheduleForm linkId={linkId} origin={origin} row={row} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={row.id} className="flex flex-wrap items-start gap-3 rounded-xl p-3 ring-1 ring-[var(--border)]">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={tone[row.state]}>{t(`schedule.${row.state}`)}</Badge>
                  {row.note ? <span className="text-sm font-medium">{row.note}</span> : null}
                </div>
                <p dir="ltr" className="font-latin break-all text-start text-sm text-[var(--primary)]">
                  {row.target}
                </p>
                <p className="text-xs text-[var(--fg-muted)]">
                  {row.startsLabel ?? t('schedule.openStart')} – {row.endsLabel ?? t('schedule.openEnd')}
                </p>
              </div>
              {canEdit ? (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(row.id)} aria-label={t('schedule.edit')}>
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(row)} aria-label={t('common.delete')}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              ) : null}
            </li>
          )
        )}
      </ul>
      {canEdit ? (
        editing === 'new' ? (
          <ScheduleForm linkId={linkId} origin={origin} onDone={() => setEditing(null)} />
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden />
            {t('schedule.add')}
          </Button>
        )
      ) : null}
      {removing ? (
        <ConfirmDialog
          open
          onClose={() => setRemoving(null)}
          title={t('schedule.deleteConfirm')}
          body={removing.target}
          action={t('common.delete')}
          onConfirm={() => deleteSchedule(removing.id)}
        />
      ) : null}
    </div>
  )
}

/* ── المشاركة (على الباركود أو الحملة) ───────────────────────────────────── */

export type ShareRow = { userId: string; name: string; access: 'read' | 'edit' }

export function SharePanel({
  target,
  rows,
  candidates,
  lead,
}: {
  target: { kind: 'link' | 'campaign'; id: string }
  rows: ShareRow[]
  candidates: Array<{ id: string; name: string }>
  lead: string
}) {
  const t = useTranslations('qr')
  const [person, setPerson] = useState('')
  const [access, setAccess] = useState<'read' | 'edit'>('read')
  const add = useAction()
  const change = useAction()
  const remove = useAction()
  const shared = new Set(rows.map((r) => r.userId))
  const available = candidates.filter((c) => !shared.has(c.id))
  const accessLabel = (a: 'read' | 'edit') => (a === 'edit' ? t('share.edit') : t('share.read'))

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{lead}</p>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--fg-subtle)]">{t('share.empty')}</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-xl ring-1 ring-[var(--border)]">
          {rows.map((row) => (
            <li key={row.userId} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
              <select
                className={`${selectStyles} h-9 w-auto`}
                value={row.access}
                disabled={change.pending}
                aria-label={`${t('share.access')} · ${row.name}`}
                onChange={(e) => {
                  const next = e.target.value as 'read' | 'edit'
                  change.run(() => changeShare(target, row.userId, next), {
                    success: t('share.changed', { access: accessLabel(next) }),
                  })
                }}
              >
                <option value="read">{t('share.read')}</option>
                <option value="edit">{t('share.edit')}</option>
              </select>
              <button
                type="button"
                disabled={remove.pending}
                onClick={() => remove.run(() => removeShare(target, row.userId), { success: t('share.removed') })}
                aria-label={`${t('share.remove')} · ${row.name}`}
                className="rounded-md p-1.5 text-[var(--fg-subtle)] transition-colors hover:text-[var(--danger)]"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ActionError error={change.error ?? remove.error} />
      <DoneNote>{change.done ?? remove.done}</DoneNote>

      {candidates.length === 0 ? (
        <p className="text-sm text-[var(--fg-subtle)]">{t('share.noCandidates')}</p>
      ) : available.length > 0 ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!person) return
            add.run(() => addShare(target, person, access), {
              success: t('share.added'),
              onOk: () => setPerson(''),
            })
          }}
        >
          <select
            className={`${selectStyles} min-w-0 flex-1 basis-48`}
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            aria-label={t('share.person')}
          >
            <option value="" disabled>
              {t('share.pick')}
            </option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Segmented
            label={t('share.access')}
            value={access}
            onChange={setAccess}
            options={[
              { value: 'read', label: t('share.read') },
              { value: 'edit', label: t('share.edit') },
            ]}
          />
          <Button type="submit" variant="secondary" disabled={add.pending || !person}>
            {add.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t('share.add')}
          </Button>
          <div className="basis-full">
            <ActionError error={add.error} />
            <DoneNote>{add.done}</DoneNote>
          </div>
        </form>
      ) : null}
    </div>
  )
}
