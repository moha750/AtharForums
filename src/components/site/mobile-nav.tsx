'use client'

import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { buttonStyles } from '@/components/ui/button'

type Props = {
  links: Array<{ href: string; label: string }>
  signedIn: boolean
  isAdmin: boolean
  labels: { menu: string; close: string; login: string; dashboard: string; admin: string }
}

export function MobileNav({ links, signedIn, isAdmin, labels }: Props) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? labels.close : labels.menu}
        className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)] md:hidden"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>

      {open ? (
        <div className="fixed inset-x-0 top-16 z-40 border-b border-[var(--border)] bg-[var(--bg)] p-4 shadow-[var(--shadow-lift)] md:hidden">
          <nav className="flex flex-col gap-1" aria-label={labels.menu}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className="rounded-lg px-3 py-2.5 text-[0.95rem] font-medium text-[var(--fg)] transition-colors hover:bg-[var(--bg-subtle)]"
              >
                {link.label}
              </Link>
            ))}

            <div className="mt-2 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
              {signedIn ? (
                <>
                  {isAdmin ? (
                    <Link href="/admin" onClick={close} className={buttonStyles('secondary', 'md')}>
                      {labels.admin}
                    </Link>
                  ) : null}
                  <Link href="/me" onClick={close} className={buttonStyles('primary', 'md')}>
                    {labels.dashboard}
                  </Link>
                </>
              ) : (
                <Link href="/login" onClick={close} className={buttonStyles('primary', 'md')}>
                  {labels.login}
                </Link>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </>
  )
}
