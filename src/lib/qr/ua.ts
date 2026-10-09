/**
 * الجهاز والآلة من User-Agent — لباب المسح.
 *
 * لا نضع أسماء تطبيقات بشرية (سناب شات، بنترست…): متصفّحها الداخلي يحمل
 * اسمها، وكاميرا سناب من أكثر ما يُمسح به الباركود هنا. زواحفها تُلتقط
 * بكلمات bot وspider وpreview أصلًا.
 *
 * الآلة: سلسلة فارغة، أو زاحف، أو أداة جلب، أو معاينة روابط في تطبيقات
 * المراسلة (واتساب وتيليجرام يجلبان الرابط ليعرضا بطاقته قبل أن ينقره أحد).
 * صفّها يُحفظ ولا يُعدّ.
 */

export type ScanDevice = 'mobile' | 'tablet' | 'desktop' | 'unknown'

const BOT =
  /bot|crawl|spider|slurp|preview|fetch|curl|wget|python|axios|headless|whatsapp|telegram|facebookexternalhit|twitterbot|discord|slackbot|linkedinbot|embedly|lighthouse|screenshot|phantomjs|puppeteer|playwright|selenium|pingdom|uptimerobot|monitor|scrapy|httpclient|okhttp|go-http-client|java\/|libwww|got\/|undici|postman|insomnia|iframely|outbrain|vkshare|quora link|skypeuripreview|semrush|ahrefs|petalbot|bytespider|gptbot|claudebot|ccbot|perplexity|googleother|google-inspectiontool/i

const TABLET = /ipad|tablet|playbook|silk|kindle|(android(?!.*mobile))/i
const MOBILE = /iphone|ipod|android.*mobile|windows phone|blackberry|bb10|opera mini|iemobile|mobile/i

export function isBotUserAgent(raw: string | null | undefined): boolean {
  const ua = (raw ?? '').trim()
  if (!ua) return true
  return BOT.test(ua)
}

export function deviceOf(raw: string | null | undefined): ScanDevice {
  const ua = (raw ?? '').trim()
  if (!ua) return 'unknown'
  if (TABLET.test(ua)) return 'tablet'
  if (MOBILE.test(ua)) return 'mobile'
  if (/windows nt|macintosh|mac os x|x11|linux|cros/i.test(ua)) return 'desktop'
  return 'unknown'
}

export function classifyScan(raw: string | null | undefined): { device: ScanDevice; isBot: boolean } {
  const isBot = isBotUserAgent(raw)
  return { device: isBot ? 'unknown' : deviceOf(raw), isBot }
}

/** المُحيل: اسم المضيف وحده، بلا مسار ولا استعلام. */
export function referrerHost(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const host = new URL(raw).hostname.toLowerCase()
    return host ? host.slice(0, 500) : null
  } catch {
    return null
  }
}
