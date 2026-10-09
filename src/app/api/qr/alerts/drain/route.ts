import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

import { drainAlerts } from '@/lib/qr/alerts'

/**
 * استنزاف صندوق تنبيهات الباركود — محمي بسرّ في الترويسة:
 *   Authorization: Bearer <QR_CRON_SECRET>
 * يُستدعى من أي مُجدوِل (Vercel Cron يرسل الترويسة بهذا الشكل نفسه)، وتستدعيه
 * أفعال تبديل الوجهة بعد استجابتها فلا ينتظر التنبيهُ المُجدوِل.
 */

export const dynamic = 'force-dynamic'

function authorized(request: NextRequest): boolean {
  const secret = process.env.QR_CRON_SECRET ?? ''
  if (secret.length < 24) return false
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const result = await drainAlerts()
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[qr] drain failed', error)
    return Response.json({ error: 'drain-failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

export const GET = handle
export const POST = handle
