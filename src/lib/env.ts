/**
 * متغيّرات البيئة — تُقرأ مرة واحدة وتُتحقّق مبكّرًا حتى لا يفشل الموقع بصمت.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `متغيّر البيئة ${name} غير مُعرّف. انسخ .env.example إلى .env.local وعبّئ القيم.`
    )
  }
  return value
}

export const env = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),
}

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000')
  ).replace(/\/$/, '')
}
