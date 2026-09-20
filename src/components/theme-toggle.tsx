'use client'

import { useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

type Mode = 'system' | 'light' | 'dark'

const MODES: Mode[] = ['system', 'light', 'dark']
const ICONS = { system: Monitor, light: Sun, dark: Moon } as const
const KEY = 'athar-theme'

/* ── مخزن صغير خارج React ────────────────────────────────────────────────
   التفضيل يعيش في localStorage لا في حالة React. نقرؤه عبر
   useSyncExternalStore حتى يتطابق أول رسم مع ما أرسله الخادم («حسب النظام»)
   ثم يُصحَّح فور الترطيب.                                                */

const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function getSnapshot(): Mode {
  try {
    const stored = localStorage.getItem(KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

const getServerSnapshot = (): Mode => 'system'

function apply(mode: Mode) {
  const root = document.documentElement
  if (mode === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)

  try {
    if (mode === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, mode)
  } catch {
    /* التخزين محجوب — التبديل يبقى فعّالًا لهذه الجلسة */
  }
  notify()
}

export function ThemeToggle({ labels }: { labels: Record<Mode, string> }) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const Icon = ICONS[mode]

  return (
    <button
      type="button"
      onClick={() => apply(MODES[(MODES.indexOf(mode) + 1) % MODES.length])}
      aria-label={labels[mode]}
      title={labels[mode]}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg text-[var(--fg-muted)]',
        'transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]'
      )}
    >
      <Icon className="size-[18px]" aria-hidden />
    </button>
  )
}

/** يُحقن قبل الرسم لمنع وميض الوضع الخاطئ. */
export const themeBootstrapScript = `(function(){try{var m=localStorage.getItem('${KEY}');if(m==='light'||m==='dark'){document.documentElement.setAttribute('data-theme',m);}}catch(e){}})();`
