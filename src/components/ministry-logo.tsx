import Image from 'next/image'
import { cn } from '@/lib/utils'

type Props = {
  /** full = الشعار كاملًا بالاسم، symbol = النخلة وحدها للمساحات الضيّقة */
  variant?: 'full' | 'symbol'
  className?: string
  alt: string
  priority?: boolean
}

const SOURCES = {
  full: { light: '/ministry-logo.svg', dark: '/ministry-logo-dark.svg', w: 729, h: 492 },
  symbol: { light: '/ministry-symbol.svg', dark: '/ministry-symbol-dark.svg', w: 285, h: 250 },
} as const

/**
 * شعار الوزارة.
 *
 * النسخة الكاملة لا تُقرأ تحت ارتفاع ٤٤ بكسل تقريبًا — اسم الوزارة فيها سطران
 * دقيقان. في المساحات الضيّقة نستخدم النخلة وحدها بدل لطخة غير مقروءة.
 */
export function MinistryLogo({ variant = 'full', className, alt, priority }: Props) {
  const src = SOURCES[variant]

  return (
    <span className={cn('relative inline-block', className)}>
      <Image
        src={src.light}
        width={src.w}
        height={src.h}
        alt={alt}
        priority={priority}
        className="h-full w-auto dark:hidden"
      />
      <Image
        src={src.dark}
        width={src.w}
        height={src.h}
        alt=""
        aria-hidden
        priority={priority}
        className="hidden h-full w-auto dark:block"
      />
    </span>
  )
}
