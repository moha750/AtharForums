'use client'

import { useId, useRef, useState } from 'react'
import NextImage from 'next/image'
import { useTranslations } from 'next-intl'
import { Crop, ImageUp, Loader2, X } from 'lucide-react'

import { ImageCropper } from '@/components/admin/image-cropper'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/** حدّ دلو media في 0004_grants_storage.sql. تغييره هنا وحده لا يرفع الحدّ. */
const MAX_BYTES = 8 * 1024 * 1024

/**
 * حدّ الملف الداخل إلى الاقتصاص. أكبر من حدّ الدلو عمدًا: صورة الجوّال
 * الأصلية تتجاوز ثمانية ميغابايت كثيرًا، والاقتصاص يُخرجها أصغر بكثير.
 * والسقف موجود لأنّ فكّ صورة ضخمة في ذاكرة المتصفّح يُثقل الجهاز.
 */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024

/**
 * الدلو يقبل SVG أيضًا، ونمنعه هنا: next/image لا يحسّن SVG إلا بتفعيل
 * dangerouslyAllowSVG، والصور هنا صور لا رسوم متجهيّة.
 */
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif']

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

/** فرق النسبة الذي نرفع معه الصورة كما هي بلا اقتصاص — ما دونه لا تُلاحظه العين. */
const RATIO_TOLERANCE = 0.02

type Ratio = { w: number; h: number }

type CropSource = { src: string; local: boolean; type: string }

async function readSize(file: File): Promise<Ratio | null> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<Ratio | null>((resolve) => {
      const probe = new window.Image()
      probe.onload = () => resolve({ w: probe.naturalWidth, h: probe.naturalHeight })
      probe.onerror = () => resolve(null)
      probe.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function typeFromUrl(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase()
  return Object.entries(EXT).find(([, e]) => e === ext || (ext === 'jpeg' && e === 'jpg'))?.[0] ?? 'image/jpeg'
}

/**
 * رفع صورة إلى دلو media، وإخراج رابطها العامّ في حقل مخفيّ باسم `name`
 * ليصل مع بقيّة النموذج إلى إجراء الخادم.
 *
 * إن مُرّرت `ratio` فالصورة التي تخالف النسبة لا تُرفع كما هي: تُفتح نافذة
 * اقتصاص يختار فيها المشرف الإطار، ويُرفع الناتج وحده. والصورة المطابقة
 * تُرفع بلا لمس — تصميمٌ جاهز بمقاسه لا يُعاد ضغطه فيفقد حدّته. وزرّ «تعديل
 * الإطار» يعيد فتح الاقتصاص على الأصل في أيّ وقت.
 *
 * الرفع يتمّ من المتصفّح مباشرة إلى Supabase: المرور بالخادم يعني تحميل
 * ثمانية ميغابايت إلى الذاكرة ثمّ رفعها ثانية، بلا فائدة. وسياسة الدلو هي
 * التي تحرس الكتابة — لا هذا المكوّن.
 */
export function ImageUpload({
  name,
  defaultUrl,
  folder = 'uploads',
  ratio,
  shape = 'rect',
  outputWidth = 1600,
  className,
}: {
  name: string
  defaultUrl?: string | null
  folder?: string
  /** النسبة المطلوبة. بوجودها يُقصّ ما يخالفها قبل الرفع. */
  ratio?: Ratio
  /** دائرة للصور الشخصية: دليل الاقتصاص والمعاينة دائريّان. */
  shape?: 'rect' | 'circle'
  /** أقصى عرض للصورة بعد الاقتصاص. */
  outputWidth?: number
  className?: string
}) {
  const t = useTranslations('admin')
  const inputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  // مسارات رفعناها في هذه الجلسة ثمّ استُبدلت — تُحذف كي لا تتراكم يتيمة.
  const orphans = useRef<string[]>([])
  // الأصل قبل الاقتصاص، ليعيد «تعديل الإطار» الاقتصاص منه لا من الناتج.
  const original = useRef<File | null>(null)

  const [url, setUrl] = useState(defaultUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [crop, setCrop] = useState<CropSource | null>(null)

  const box = ratio ? { aspectRatio: `${ratio.w} / ${ratio.h}` } : { aspectRatio: '8 / 3' }

  function openCrop(file: File) {
    setCrop({ src: URL.createObjectURL(file), local: true, type: file.type })
  }

  function closeCrop() {
    if (crop?.local) URL.revokeObjectURL(crop.src)
    setCrop(null)
  }

  function adjust() {
    setError(null)
    if (original.current) openCrop(original.current)
    else if (url) setCrop({ src: url, local: false, type: typeFromUrl(url) })
  }

  async function upload(body: Blob) {
    if (body.size > MAX_BYTES) return setError(t('uploadTooBig'))
    setBusy(true)
    try {
      const supabase = createClient()
      const path = `${folder}/${crypto.randomUUID()}.${EXT[body.type] ?? 'jpg'}`

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(path, body, { contentType: body.type, cacheControl: '31536000' })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('media').getPublicUrl(path)

      const previous = orphans.current.pop()
      if (previous) await supabase.storage.from('media').remove([previous])
      orphans.current.push(path)

      setUrl(data.publicUrl)
    } catch {
      setError(t('uploadFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function handle(file: File) {
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
    if (!TYPES.includes(file.type)) return setError(t('uploadBadType'))

    if (!ratio) {
      if (file.size > MAX_BYTES) return setError(t('uploadTooBig'))
      return upload(file)
    }

    if (file.size > MAX_SOURCE_BYTES) return setError(t('uploadTooBigSource'))
    const size = await readSize(file)
    if (!size) return setError(t('uploadBadType'))
    original.current = file

    const want = ratio.w / ratio.h
    const matches = size.h > 0 && Math.abs(size.w / size.h - want) / want <= RATIO_TOLERANCE
    if (matches && file.size <= MAX_BYTES) return upload(file)
    openCrop(file)
  }

  const circle = shape === 'circle'

  return (
    <div className={cn('space-y-2', className)}>
      <input type="hidden" name={name} value={url} />
      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept={TYPES.join(',')}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handle(file)
        }}
      />

      {url ? (
        <div className="overflow-hidden rounded-xl ring-1 ring-[var(--border)]">
          <div className="relative bg-[var(--bg-subtle)]" style={box}>
            <div
              className={cn(
                'absolute overflow-hidden',
                circle ? 'inset-3 rounded-full ring-1 ring-[var(--border)]' : 'inset-0'
              )}
            >
              <NextImage
                src={url}
                alt=""
                fill
                sizes="(min-width: 640px) 40rem, 100vw"
                className="object-cover"
              />
            </div>
            {busy ? (
              <div className="absolute inset-0 grid place-items-center bg-[color-mix(in_srgb,var(--surface)_60%,transparent)]">
                <Loader2 className="size-6 animate-spin text-[var(--primary)]" aria-hidden />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 bg-[var(--surface)] px-3 py-2 text-sm">
            <label
              htmlFor={inputId}
              className="cursor-pointer font-medium text-[var(--primary)] hover:underline"
            >
              {busy ? t('uploadBusy') : t('uploadReplace')}
            </label>
            {ratio ? (
              <button
                type="button"
                onClick={adjust}
                disabled={busy}
                className="inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline disabled:opacity-55"
              >
                <Crop className="size-4" aria-hidden />
                {t('uploadAdjust')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setUrl('')
                original.current = null
              }}
              className="ms-auto inline-flex items-center gap-1 text-[var(--fg-subtle)] transition-colors hover:text-[var(--danger)]"
            >
              <X className="size-4" aria-hidden />
              {t('uploadRemove')}
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          style={box}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files?.[0]
            if (file) void handle(file)
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition-colors',
            dragging
              ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
              : 'border-[var(--border-strong)] bg-[var(--bg-subtle)] hover:border-[var(--primary)]'
          )}
        >
          {busy ? (
            <Loader2 className="size-6 animate-spin text-[var(--primary)]" aria-hidden />
          ) : (
            <ImageUp className="size-6 text-[var(--fg-subtle)]" aria-hidden />
          )}
          <span className="text-sm font-medium text-[var(--fg)]">
            {busy ? t('uploadBusy') : t('uploadPrompt')}
          </span>
          <span className="text-xs text-[var(--fg-subtle)]">
            {ratio ? t('uploadHintCrop') : t('uploadHint')}
          </span>
        </label>
      )}

      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {crop && ratio ? (
        <ImageCropper
          src={crop.src}
          crossOrigin={!crop.local}
          sourceType={crop.type}
          ratio={ratio}
          shape={shape}
          outputWidth={outputWidth}
          onCancel={closeCrop}
          onConfirm={(blob) => {
            closeCrop()
            void upload(blob)
          }}
        />
      ) : null}
    </div>
  )
}
