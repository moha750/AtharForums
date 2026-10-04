/**
 * تصنيف الزائر من سلسلة المتصفّح.
 *
 * لم نستعمل مكتبة جاهزة عمدًا: مكتبات تحليل User-Agent تزن مئات الكيلوبايتات
 * وتُحمَّل في الوسيط على كل طلب. القواعد أدناه تغطّي ما يستعمله الموظفون
 * فعليًا، وما لا تعرفه يُصنَّف «غير معروف» بدل أن يُخمَّن خطأً.
 */

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'

export interface UaInfo {
  device: DeviceType
  browser: string | null
  os: string | null
  isBot: boolean
}

/** الزواحف وأدوات المراقبة — تُسجَّل ولا تُحتسب زوارًا. */
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|twitterbot|linkedinbot|embedly|quora|pinterest|vkshare|applebot|duckduck|yandex|baidu|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot|perplexity|headlesschrome|phantomjs|puppeteer|playwright|lighthouse|pingdom|uptimerobot|curl\/|wget\/|python-requests|axios\/|got\/|node-fetch/i

const TABLET = /ipad|tablet|playbook|silk|(android(?!.*mobile))/i
const MOBILE = /iphone|ipod|android.*mobile|windows phone|blackberry|bb10|opera mini|iemobile|mobile safari/i

function browserOf(ua: string): string | null {
  // الترتيب مقصود: Edge وOpera يذكران Chrome في سلسلتهما، وChrome يذكر Safari.
  if (/edg(e|a|ios)?\//i.test(ua)) return 'Edge'
  if (/opr\/|opera/i.test(ua)) return 'Opera'
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet'
  if (/ucbrowser/i.test(ua)) return 'UC Browser'
  if (/firefox\/|fxios/i.test(ua)) return 'Firefox'
  if (/chrome\/|crios/i.test(ua)) return 'Chrome'
  if (/safari\//i.test(ua)) return 'Safari'
  if (/msie|trident/i.test(ua)) return 'Internet Explorer'
  return null
}

function osOf(ua: string): string | null {
  if (/windows nt/i.test(ua)) return 'Windows'
  if (/iphone|ipad|ipod|ios/i.test(ua)) return 'iOS'
  if (/mac os x|macintosh/i.test(ua)) return 'macOS'
  if (/android/i.test(ua)) return 'Android'
  if (/cros/i.test(ua)) return 'ChromeOS'
  if (/linux/i.test(ua)) return 'Linux'
  return null
}

export function parseUserAgent(raw: string | null | undefined): UaInfo {
  const ua = (raw ?? '').slice(0, 512)

  if (!ua) return { device: 'unknown', browser: null, os: null, isBot: false }
  if (BOT.test(ua)) return { device: 'bot', browser: null, os: null, isBot: true }

  const device: DeviceType = TABLET.test(ua) ? 'tablet' : MOBILE.test(ua) ? 'mobile' : 'desktop'

  return { device, browser: browserOf(ua), os: osOf(ua), isBot: false }
}
