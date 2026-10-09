import { TARGET_MAX } from './config'

/**
 * تصديق وجهة الباركود — حَكَمٌ واحد يستعمله المتصفّح (رسالة فورية) والخادم
 * (قبل الحفظ). القاعدة تضيف شبكة أمان أخيرة: ^https?://\S+$.
 */

export type TargetIssue =
  | 'empty'
  | 'too-long'
  | 'invalid'
  | 'protocol'
  | 'local'
  | 'private'
  | 'tld'
  | 'loop'

export type TargetResult = { ok: true; url: string } | { ok: false; issue: TargetIssue }

function ipv4(host: string): number[] | null {
  const parts = host.split('.')
  if (parts.length !== 4) return null
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN))
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null
}

function hostIssue(hostname: string): TargetIssue | null {
  const host = hostname.toLowerCase().replace(/\.$/, '')

  if (host === 'localhost' || host.endsWith('.localhost')) return 'local'

  // IPv6 يصل بين قوسين: [::1]
  if (host.startsWith('[')) {
    const v6 = host.slice(1, -1)
    if (v6 === '::1' || v6 === '::') return 'local'
    if (/^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)) return 'private'
    return 'tld' // عنوان رقمي بلا امتداد
  }

  const v4 = ipv4(host)
  if (v4) {
    const [a, b] = v4 as [number, number, number, number]
    if (a === 127 || a === 0) return 'local' // ‎0.0.0.0‎ وكل 0.x
    if (a === 10) return 'private'
    if (a === 172 && b >= 16 && b <= 31) return 'private'
    if (a === 192 && b === 168) return 'private'
    if (a === 169 && b === 254) return 'private'
    return 'tld'
  }

  if (host.endsWith('.local') || host === 'local') return 'private'

  const labels = host.split('.')
  const tld = labels[labels.length - 1] ?? ''
  if (labels.length < 2) return 'tld'
  if (!/^[a-z]{2,}$/.test(tld) && !/^xn--[a-z0-9-]+$/.test(tld)) return 'tld'
  return null
}

function sameSite(a: string, b: string): boolean {
  const strip = (h: string) => h.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
  return strip(a) === strip(b)
}

/**
 * @param origin أصل الموقع نفسه، لرفض وجهة تشير إلى /q/ عندنا (دورة).
 */
export function validateTarget(raw: string, origin: string): TargetResult {
  const value = raw.trim()
  if (!value) return { ok: false, issue: 'empty' }
  if (value.length > TARGET_MAX) return { ok: false, issue: 'too-long' }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return { ok: false, issue: /^[a-z][a-z0-9+.-]*:/i.test(value) ? 'invalid' : 'protocol' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, issue: 'protocol' }
  // بيانات دخول داخل الرابط حيلة تصيّد معروفة: https://bank.com@evil.example
  if (url.username || url.password || !url.hostname) return { ok: false, issue: 'invalid' }

  const issue = hostIssue(url.hostname)
  if (issue) return { ok: false, issue }

  try {
    const self = new URL(origin)
    if (sameSite(url.hostname, self.hostname) && /^\/q(\/|$)/i.test(url.pathname)) {
      return { ok: false, issue: 'loop' }
    }
  } catch {
    // أصل غير صالح في الإعداد — لا نمنع الحفظ بسببه
  }

  const href = url.toString()
  if (href.length > TARGET_MAX) return { ok: false, issue: 'too-long' }
  if (!/^https?:\/\/\S+$/.test(href)) return { ok: false, issue: 'invalid' }
  return { ok: true, url: href }
}

/** اسم المضيف للعرض، بلا www. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
