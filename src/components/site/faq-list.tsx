import { ChevronDown } from 'lucide-react'

import { localized } from '@/lib/utils'
import type { Faq } from '@/lib/database.types'

/**
 * قائمة أسئلة قابلة للطيّ.
 *
 * ‎<details>‎ لا جافاسكربت: يفتح ويُغلق ويصل إليه قارئ الشاشة ولوحة المفاتيح
 * بلا سطر واحد منّا، ويعمل قبل أن يُحمَّل الجافاسكربت أصلًا. وبحث المتصفّح
 * (Ctrl+F) يجد النصّ المطويّ ويفتحه في المتصفّحات الحديثة.
 */
export function FaqList({ items, locale }: { items: Faq[]; locale: string }) {
  if (items.length === 0) return null

  return (
    <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
      {items.map((faq) => (
        <li key={faq.id}>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-start font-medium transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]">
              {localized(faq, 'question', locale)}
              <ChevronDown
                className="size-5 shrink-0 text-[var(--fg-subtle)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden
              />
            </summary>
            <p className="whitespace-pre-line px-5 pb-5 leading-relaxed text-[var(--fg-muted)]">
              {localized(faq, 'answer', locale)}
            </p>
          </details>
        </li>
      ))}
    </ul>
  )
}
