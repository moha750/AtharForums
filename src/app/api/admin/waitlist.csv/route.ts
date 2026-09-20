import { NextResponse } from 'next/server'
import { getCurrentProfile, isAdmin } from '@/lib/auth'
import { adminWaitlist } from '@/lib/admin-data'

export const dynamic = 'force-dynamic'

function csvCell(value: string): string {
  // نسبق الخلايا التي تبدأ بمحرّف صيغة بفاصلة عليا حتى لا تُنفَّذ كصيغة في Excel
  const risky = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${risky.replace(/"/g, '""')}"`
}

export async function GET() {
  const profile = await getCurrentProfile()
  if (!isAdmin(profile)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const rows = await adminWaitlist()
  const header = ['email', 'full_name', 'source', 'created_at']
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [r.email, r.full_name ?? '', r.source, r.created_at].map((v) => csvCell(String(v))).join(',')
    ),
  ]

  // BOM ليفتح Excel العربية بترميز صحيح
  const body = '﻿' + lines.join('\r\n')

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="athar-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
