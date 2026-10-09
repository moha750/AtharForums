import { createHash } from 'node:crypto'

import { QR_TZ } from './config'
import { zonedDay } from './time'

/**
 * بصمة الماسح: sha256(ip | ملح سرّي | اليوم بمنطقة الجهة).
 *
 * تدور يوميًّا، فلا تتبّع أحدًا عبر الأيام، وتكفي لمنع عدّ المسح نفسه مرّتين
 * خلال دقيقة. الـIP لا يُخزَّن أبدًا: يدخل هنا ويخرج بصمة.
 *
 * بلا ملح في الإنتاج: البصمة null والتحويل يمضي (يُعدّ كل مسح).
 */
export function visitorHash(ip: string | null, now: Date = new Date()): string | null {
  const salt = process.env.QR_VISITOR_SALT ?? ''
  if (!ip) return null
  if (salt.length < 16) {
    if (process.env.NODE_ENV === 'production') return null
    return createHash('sha256').update(`${ip}|development-salt|${zonedDay(now, QR_TZ)}`).digest('hex')
  }
  return createHash('sha256').update(`${ip}|${salt}|${zonedDay(now, QR_TZ)}`).digest('hex')
}

interface HeaderLike {
  get(name: string): string | null
}

export function requestIp(headers: HeaderLike): string | null {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim() || null
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? null
}
