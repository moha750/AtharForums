import { test } from 'node:test'
import assert from 'node:assert/strict'

import { resolveStatsRange, utcToZonedInput, zonedDay, zonedToUtc } from '@/lib/qr/time'

test('ساعة الرياض تُحوَّل بإزاحتها لا بساعة الجهاز', () => {
  assert.equal(zonedToUtc('2026-10-09T21:30')?.toISOString(), '2026-10-09T18:30:00.000Z')
  assert.equal(zonedToUtc('2026-01-01')?.toISOString(), '2025-12-31T21:00:00.000Z')
  assert.equal(utcToZonedInput('2026-10-09T18:30:00Z'), '2026-10-09T21:30')
  assert.equal(zonedDay(new Date('2026-10-09T21:30:00Z')), '2026-10-10')
  assert.equal(zonedToUtc('2026-02-30T10:00'), null)
  assert.equal(zonedToUtc('2026-10-09T25:00'), null)
  assert.equal(zonedToUtc('yesterday'), null)
})

test('المنطقة ذات التوقيت الصيفي تُحسب بإزاحة تلك اللحظة', () => {
  // نيويورك: ‎-04:00‎ صيفًا و‎-05:00‎ شتاءً — دليل أن الحساب لا يفترض إزاحة ثابتة
  assert.equal(zonedToUtc('2026-07-01T12:00', 'America/New_York')?.toISOString(), '2026-07-01T16:00:00.000Z')
  assert.equal(zonedToUtc('2026-12-01T12:00', 'America/New_York')?.toISOString(), '2026-12-01T17:00:00.000Z')
})

test('مدى الإحصاء: الاختصارات والمخصّص بطرفين داخلين', () => {
  // الجمعة ٩ أكتوبر ٢٠٢٦، ١١ مساءً بتوقيت الرياض
  const now = new Date('2026-10-09T20:00:00Z')
  const iso = (d: Date | null) => d?.toISOString() ?? null

  const today = resolveStatsRange({ range: 'today' }, now)
  assert.equal(iso(today.from), '2026-10-08T21:00:00.000Z')
  assert.equal(iso(today.to), '2026-10-09T21:00:00.000Z')

  const yesterday = resolveStatsRange({ range: 'yesterday' }, now)
  assert.equal(yesterday.fromDay, '2026-10-08')
  assert.equal(yesterday.toDay, '2026-10-08')

  const week = resolveStatsRange({ range: '7d' }, now)
  assert.equal(week.fromDay, '2026-10-03')
  assert.equal(week.toDay, '2026-10-09')

  const ninety = resolveStatsRange({ range: '90d' }, now)
  assert.equal(ninety.fromDay, '2026-07-12')

  assert.equal(resolveStatsRange({ range: 'month' }, now).fromDay, '2026-10-01')
  const lastMonth = resolveStatsRange({ range: 'last-month' }, now)
  assert.equal(lastMonth.fromDay, '2026-09-01')
  assert.equal(lastMonth.toDay, '2026-09-30')
  assert.equal(resolveStatsRange({ range: 'year' }, now).fromDay, '2026-01-01')

  const all = resolveStatsRange({}, now)
  assert.equal(all.key, 'all')
  assert.equal(all.from, null)

  const custom = resolveStatsRange({ range: 'custom', from: '2026-09-20', to: '2026-09-10' }, now)
  assert.equal(custom.fromDay, '2026-09-10')
  assert.equal(custom.toDay, '2026-09-20')
  assert.equal(iso(custom.to), '2026-09-20T21:00:00.000Z') // نهاية يوم ٢٠ داخلة

  const january = resolveStatsRange({ range: 'last-month' }, new Date('2027-01-15T09:00:00Z'))
  assert.equal(january.fromDay, '2026-12-01')
  assert.equal(january.toDay, '2026-12-31')
})
