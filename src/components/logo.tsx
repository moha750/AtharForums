import Image from 'next/image'
import { cn } from '@/lib/utils'

type Props = {
  variant?: 'full' | 'mark'
  className?: string
  priority?: boolean
  alt?: string
}

/**
 * شعار مساحة أثر.
 * نعرض نسختين — فاتحة وداكنة — ونبدّل بينهما بالـ CSS لا بالجافاسكربت،
 * حتى لا يومض الشعار عند تحميل الصفحة في الوضع الداكن.
 */
export function Logo({ variant = 'full', className, priority, alt = 'مساحة أثر' }: Props) {
  const light = variant === 'full' ? '/athar-logo.svg' : '/athar-mark.svg'
  const dark = variant === 'full' ? '/athar-logo-dark.svg' : '/athar-mark-dark.svg'
  // المقاسات الجوهرية من viewBox الملفات — لا تخمينًا. الشعار مربّع والرمز
  // شبه مربّع، فأي رقم قديم هنا يشوّه النسبة.
  const ratio = variant === 'full' ? { width: 1254, height: 1254 } : { width: 806, height: 816 }

  return (
    <span className={cn('relative inline-block', className)}>
      <Image
        src={light}
        {...ratio}
        alt={alt}
        priority={priority}
        className="h-full w-auto dark:hidden"
      />
      <Image
        src={dark}
        {...ratio}
        alt=""
        aria-hidden
        priority={priority}
        className="hidden h-full w-auto dark:block"
      />
    </span>
  )
}
