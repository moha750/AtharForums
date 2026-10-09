import { siteUrl } from '@/lib/env'

/**
 * أصل الرابط القصير — يُطبع داخل كل باركود ولا يتغيّر بعدها أبدًا.
 *
 * QR_ORIGIN يثبّته صراحةً على النطاق النهائي. بدونه نرجع إلى أصل الموقع،
 * وهذا مقبول في التطوير فقط: لو تبدّل نطاق الموقع لاحقًا لانكسر كل ملصق
 * طُبع على النطاق القديم.
 */
export function qrOrigin(): string {
  const raw = process.env.QR_ORIGIN?.trim() || siteUrl()
  return raw.replace(/\/+$/, '')
}

export function shortLink(code: string): string {
  return `${qrOrigin()}/q/${code}`
}

export function viewLink(code: string): string {
  return `${shortLink(code)}/view`
}
