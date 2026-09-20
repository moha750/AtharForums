import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { env } from '@/lib/env'

/**
 * عميل Supabase لمكوّنات الخادم وServer Actions.
 * يحترم سياسات RLS — أي أن المستخدم لا يرى إلا ما تسمح به السياسات.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // الاستدعاء من مكوّن خادم للقراءة فقط — تحديث الجلسة يتم في proxy.ts
        }
      },
    },
  })
}
