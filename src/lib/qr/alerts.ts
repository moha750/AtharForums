import nodemailer from 'nodemailer'

import { siteUrl } from '@/lib/env'
import type { QrAlertClaim } from '@/lib/database.types'
import { QR_TZ } from './config'
import { escapeXml } from './render'
import { anonRpc, QR_SERVER_KEY } from './rpc'
import { hostOf } from './target'
import { shortLink } from './origin'

/**
 * تنبيه تبديل الوجهة.
 *
 * المحفّز في القاعدة يكتب صفًّا في صندوق الصادر ولا يرسل شيئًا داخل
 * المعاملة. هنا نستنزف الصندوق دفعات من ٢٠، ونرسل لبريد كل حاملي
 * oversee_qr. مطفأ افتراضيًّا: QR_ALERTS=on وSMTP_URL يشغّلانه.
 *
 * الحالات: sent أو failed، أو off حين يكون الإرسال مطفأً أو لا مستقبِلين —
 * حتى يعرف المشرف أن التبديل لم يُبلَّغ به أحد، لا أن البريد ضاع.
 */

export function alertsEnabled(): boolean {
  return process.env.QR_ALERTS === 'on' && Boolean(process.env.SMTP_URL)
}

/** المضيف نصًّا لا رابطًا: برامج البريد تحوّل كل ما يشبه النطاق إلى رابط. */
function inertHost(url: string | null): string {
  if (!url) return '—'
  return escapeXml(hostOf(url)).replace(/\./g, '.&#8203;')
}

function inertHostText(url: string | null): string {
  return url ? hostOf(url).replace(/\./g, '[.]') : '—'
}

function when(at: string): string {
  return new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: QR_TZ,
  }).format(new Date(at))
}

/** نافذة الجدولة في السجل: «الوجهة | البداية | النهاية | الملاحظة». */
function scheduleParts(value: string | null): { target: string | null; window: string } {
  const [target, starts, ends] = (value ?? '').split(' | ')
  const at = (v: string | undefined) => (v && v !== '-' ? when(v) : null)
  const from = at(starts)
  const to = at(ends)
  const window = from || to ? `${from ?? 'من الآن'} — ${to ?? 'بلا نهاية'}` : 'مفتوحة الطرفين: تعمل الآن وبلا نهاية'
  return { target: target || null, window }
}

export function alertEmail(row: QrAlertClaim): { subject: string; html: string; text: string } {
  const title = row.link_title ?? 'باركود'
  const short = row.link_code ? shortLink(row.link_code) : ''
  const page = `${siteUrl()}/ar/qr/${row.link_id}`
  const actor = row.actor_name ?? 'غير معروف'
  const scheduled = row.kind === 'schedule'
  const sched = scheduled ? scheduleParts(row.new_value) : null
  const oldTarget = scheduled ? null : row.old_value
  const newTarget = scheduled ? sched!.target : row.new_value
  const subject = scheduled ? `جدولة وجهة باركود: ${title}` : `تبديل وجهة باركود: ${title}`
  const heading = scheduled ? `جُدولت وجهة لـ«${title}»` : `تبدّلت وجهة «${title}»`

  const html = `<!doctype html>
<html lang="ar" dir="rtl"><body style="margin:0;background:#f6f9f9;font-family:Tahoma,Arial,sans-serif;color:#12252a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e9ea;border-radius:16px;padding:24px">
<tr><td>
<p style="margin:0 0 4px;font-size:13px;color:#4d595d">مساحة أثر · تنبيه الباركود</p>
<h1 style="margin:0 0 16px;font-size:20px;color:#144e46">${escapeXml(heading)}</h1>
<p style="margin:0 0 4px;font-size:14px;color:#4d595d">الرابط القصير</p>
<p dir="ltr" style="margin:0 0 16px;font-size:14px;text-align:right">${escapeXml(short)}</p>
<p style="margin:0 0 4px;font-size:14px;color:#4d595d">المضيف</p>
<p dir="ltr" style="margin:0 0 16px;font-size:16px;text-align:right">${scheduled ? '' : `<span>${inertHost(oldTarget)}</span> &rarr; `}<strong>${inertHost(newTarget)}</strong></p>
${sched ? `<p style="margin:0 0 16px;font-size:14px">النافذة: ${escapeXml(sched.window)}</p>` : ''}
<p style="margin:0 0 16px;font-size:14px">بواسطة <strong>${escapeXml(actor)}</strong> · ${escapeXml(when(row.at))}</p>
<p style="margin:0 0 20px"><a href="${escapeXml(page)}" style="display:inline-block;background:#144e46;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px">افتح صفحة الباركود</a></p>
<p style="margin:0;padding:12px;border-radius:10px;background:#fff5e3;color:#8a6208;font-size:13px;line-height:1.7">إن لم تعرف هذا التغيير، أوقف الباركود من صفحته فورًا ثم تحقّق ممّن غيّره. الإيقاف قابل للرجوع، ومن يمسح الباركود الموقوف يصل إلى صفحة «غير متاح».</p>
</td></tr></table></td></tr></table></body></html>`

  const text = [
    heading,
    `الرابط القصير: ${short}`,
    // المضيفان مقطع لاتيني يُعرض من اليسار، فالسهم يتّجه يمينًا من القديم إلى الجديد
    scheduled
      ? `المضيف: ${inertHostText(newTarget)} · النافذة: ${sched!.window}`
      : `المضيف: ${inertHostText(oldTarget)} → ${inertHostText(newTarget)}`,
    `بواسطة: ${actor} · ${when(row.at)}`,
    `صفحة الباركود: ${page}`,
    '',
    'إن لم تعرف هذا التغيير، أوقف الباركود من صفحته فورًا.',
  ].join('\n')

  return { subject, html, text }
}

export type DrainResult = { claimed: number; sent: number; failed: number; off: number; skipped?: string }

/** يستنزف حتى خمس دفعات من ٢٠. آمن للتشغيل المتزامن (SKIP LOCKED في القاعدة). */
export async function drainAlerts(maxBatches = 5): Promise<DrainResult> {
  const result: DrainResult = { claimed: 0, sent: 0, failed: 0, off: 0 }
  if (!QR_SERVER_KEY) return { ...result, skipped: 'no-server-key' }

  const enabled = alertsEnabled()
  const recipients = enabled
    ? await anonRpc<string[]>('qr_alerts_recipients', { p_secret: QR_SERVER_KEY })
    : []
  const transport = enabled && recipients.length > 0 ? nodemailer.createTransport(process.env.SMTP_URL) : null
  const from = process.env.QR_ALERTS_FROM || 'مساحة أثر <no-reply@localhost>'

  const mark = (id: number, status: 'sent' | 'failed' | 'off', error?: string) =>
    anonRpc('qr_alerts_mark', { p_secret: QR_SERVER_KEY, p_id: id, p_status: status, p_error: error ?? null })

  for (let batch = 0; batch < maxBatches; batch++) {
    const rows = await anonRpc<QrAlertClaim[]>('qr_alerts_claim', { p_secret: QR_SERVER_KEY, p_limit: 20 })
    if (!rows || rows.length === 0) break
    result.claimed += rows.length

    for (const row of rows) {
      if (!transport) {
        await mark(row.outbox_id, 'off', enabled ? 'no-recipients' : 'disabled')
        result.off++
        continue
      }
      try {
        const mail = alertEmail(row)
        await transport.sendMail({ from, to: from, bcc: recipients, ...mail })
        await mark(row.outbox_id, 'sent')
        result.sent++
      } catch (error) {
        await mark(row.outbox_id, 'failed', error instanceof Error ? error.message : String(error))
        result.failed++
      }
    }
    if (rows.length < 20) break
  }
  return result
}
