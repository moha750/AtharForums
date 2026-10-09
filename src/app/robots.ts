import type { MetadataRoute } from 'next'

import { siteUrl } from '@/lib/env'

/**
 * /q/ مسارات تحويل لا محتوى: لا تُفهرس، ولا يُحتسب زحف الآلات عليها.
 * و/api/ لا يُزحف عليه أصلًا.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/q/', '/api/'] }],
    host: siteUrl(),
  }
}
