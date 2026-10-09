import { env } from '@/lib/env'

/**
 * نداء RPC بالمفتاح العام مباشرةً، بلا جلسة ولا مكتبة — لباب المسح وصفحة
 * العرض واستنزاف التنبيهات. الدوالّ المستدعاة هنا تطلب QR_SERVER_KEY
 * (أو لا تكشف إلا المسار)، فالمفتاح العام وحده لا يكفي لشيء.
 *
 * no-store: لا تخزين مؤقّت لنتيجة تتغيّر مع كل تبديل وجهة.
 */

export const QR_SERVER_KEY = process.env.QR_SERVER_KEY ?? ''

export class RpcError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export async function anonRpc<T>(fn: string, args: Record<string, unknown>, timeoutMs = 4000): Promise<T> {
  const response = await fetch(`${env.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${env.supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new RpcError(`${fn} (${response.status}): ${detail.slice(0, 300)}`, response.status)
  }
  const text = await response.text()
  return (text ? JSON.parse(text) : null) as T
}
