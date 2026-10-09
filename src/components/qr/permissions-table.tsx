'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Search } from 'lucide-react'

import { Input } from '@/components/ui/field'
import { setCustomCodes, setPermission } from '@/actions/qr'
import type { AppPermission } from '@/lib/database.types'
import { ActionError, Segmented, useAction } from './ui'

export type PermissionRow = {
  id: string
  name: string
  email: string
  active: boolean
  permissions: AppPermission[]
}

const COLUMNS: Array<{ key: AppPermission; label: 'use' | 'oversee' | 'org' }> = [
  { key: 'use_qr_generator', label: 'use' },
  { key: 'oversee_qr', label: 'oversee' },
  { key: 'qr_org_account', label: 'org' },
]

function Toggle({ row, permission, disabled }: { row: PermissionRow; permission: AppPermission; disabled: boolean }) {
  const t = useTranslations('qr.access')
  const action = useAction()
  const on = row.permissions.includes(permission)
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="checkbox"
        className="size-4 accent-[var(--primary)]"
        checked={on}
        disabled={disabled || action.pending}
        aria-label={`${t(COLUMNS.find((c) => c.key === permission)!.label)} · ${row.name}`}
        onChange={() => action.run(() => setPermission(row.id, permission, !on))}
      />
      {action.pending ? <Loader2 className="size-3.5 animate-spin text-[var(--fg-subtle)]" aria-hidden /> : null}
      <ActionError error={action.error} />
    </span>
  )
}

export function PermissionsTable({ rows, selfId, isSuper }: { rows: PermissionRow[]; selfId: string; isSuper: boolean }) {
  const t = useTranslations('qr')
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)) : rows
    // حاملو الصلاحيات أولًا: هم ما يُراجَع غالبًا
    return [...list].sort((a, b) => b.permissions.length - a.permissions.length)
  }, [rows, query])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-[var(--fg-subtle)]" aria-hidden />
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('access.search')} aria-label={t('access.search')} className="ps-9" />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--fg-subtle)]">{t('access.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="text-xs text-[var(--fg-subtle)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-4 py-3 text-start font-medium">{t('share.person')}</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="px-3 py-3 text-center font-medium">
                    {t(`access.${c.label}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((row) => {
                const self = row.id === selfId && !isSuper
                return (
                  <tr key={row.id} className={row.active ? undefined : 'opacity-60'}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.name}</p>
                      <p dir="ltr" className="font-latin text-start text-xs text-[var(--fg-subtle)]">
                        {row.email}
                      </p>
                      {self ? <p className="text-xs text-[var(--fg-subtle)]">{t('access.self')}</p> : null}
                    </td>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className="px-3 py-3 text-center">
                        <Toggle row={row} permission={c.key} disabled={self} />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function CustomCodesToggle({ enabled }: { enabled: boolean }) {
  const t = useTranslations('qr.access')
  const action = useAction()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented
        label={t('customCodes')}
        value={enabled ? 'on' : 'off'}
        disabled={action.pending}
        onChange={(v) => action.run(() => setCustomCodes(v === 'on'))}
        options={[
          { value: 'off', label: t('off') },
          { value: 'on', label: t('on') },
        ]}
      />
      {action.pending ? <Loader2 className="size-4 animate-spin text-[var(--fg-subtle)]" aria-hidden /> : null}
      <ActionError error={action.error} />
    </div>
  )
}
