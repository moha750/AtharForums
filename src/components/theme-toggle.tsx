'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

type Mode = 'system' | 'light' | 'dark'
const MODES: Mode[] = ['system', 'light', 'dark']
const ICONS = { system: Monitor, light: Sun, dark: Moon } as const

function apply(mode: Mode) {
  const root = document.documentElement
  if (mode === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)
  try {
    if (mode === 'system') localStorage.removeItem('athar-theme')
    else localStorage.setItem('athar-theme', mode)
  } catch {
    /* التخزين محجوب — التبديل يبقى فعّالًا لهذه الجلسة */
  }
}

export function ThemeToggle({ labels }: { labels: Record<Mode, string> }) {
  const [mode, setMode] = useState<Mode>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem('athar-theme')
      if (stored === 'light' || stored === 'dark') setMode(stored)
    } catch {
      /* لا شيء */
    }
  }, [])

  function cycle() {
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length]
    setMode(next)
    apply(next)
  }

  const Icon = ICONS[mode]

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={labels[mode]}
      title={labels[mode]}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg text-[var(--fg-muted)]',
        'transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]'
      )}
    >
      {mounted ? <Icon className="size-[18px]" aria-hidden /> : <span className="size-[18px]" />}
    </button>
  )
}

/** يُحقن قبل الرسم لمنع وميض الوضع الخاطئ. */
export const themeBootstrapScript = `(function(){try{var m=localStorage.getItem('athar-theme');if(m==='light'||m==='dark'){document.documentElement.setAttribute('data-theme',m);}}catch(e){}})();`
