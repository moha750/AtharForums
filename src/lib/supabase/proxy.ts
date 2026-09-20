import { createServerClient } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/lib/database.types'

/**
 * يجدّد جلسة Supabase على كل طلب ويكتب الكوكيز المحدَّثة على الاستجابة
 * التي أنتجها next-intl، حتى لا تنتهي الجلسة أثناء التصفّح.
 */
export async function updateSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // مهم: getUser() يتحقّق من التوكن مع خادم Supabase — لا تستبدله بـ getSession()
  // الذي يقرأ الكوكي بلا تحقّق. وإن تعذّر الوصول لـ Supabase نعتبر الزائر غير
  // مسجَّل: الفشل يغلق الباب ولا يفتحه.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return { response, user }
  } catch {
    return { response, user: null }
  }
}
