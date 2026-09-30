'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { Check, Loader2, RotateCcw, TriangleAlert, ZoomIn, ZoomOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Ratio = { w: number; h: number }

/** مركز الإطار بإحداثيات الصورة الأصلية، ومعامل التكبير فوق «الملء». */
type View = { cx: number; cy: number; z: number }

const MAX_ZOOM = 5

/** دون هذا الجزء من عرض المخرَج نحذّر من صورة غير حادّة. */
const LOW_RES = 0.5

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('empty'))), type, quality)
  )
}

/**
 * التصغير على مراحل، كلّ مرحلة إلى النصف: القفز من ٤٠٠٠ بكسل إلى ٨٠٠ في
 * خطوة واحدة يُخرج حوافّ مسنّنة في Safari وFirefox حتى مع smoothing عالٍ.
 */
function drawScaled(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  outW: number,
  outH: number,
  opaqueBg: boolean
): HTMLCanvasElement {
  let src: CanvasImageSource = img
  let x = sx
  let y = sy
  let w = sw
  let h = sh

  while (w / 2 >= outW) {
    const step = document.createElement('canvas')
    step.width = Math.round(w / 2)
    step.height = Math.round(h / 2)
    const c = step.getContext('2d')!
    c.imageSmoothingQuality = 'high'
    c.drawImage(src, x, y, w, h, 0, 0, step.width, step.height)
    src = step
    x = 0
    y = 0
    w = step.width
    h = step.height
  }

  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const ctx = out.getContext('2d')!
  if (opaqueBg) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, outW, outH)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, x, y, w, h, 0, 0, outW, outH)
  return out
}

function isOpaque(canvas: HTMLCanvasElement): boolean {
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return false
  return true
}

/** مقاس الصورة الأصلية ومقاس الإطار على الشاشة. */
type Geo = { nw: number; nh: number; fw: number; fh: number }

/** مقياس «الملء»: أصغر مقياس تغطّي به الصورةُ الإطارَ كلّه. */
const coverScale = (g: Geo) => Math.max(g.fw / g.nw, g.fh / g.nh)

/** يحصر المركز والتكبير فلا يظهر في الإطار شيء خارج الصورة. */
function clampView(v: View, g: Geo): View {
  const z = Math.min(MAX_ZOOM, Math.max(1, v.z))
  const s = coverScale(g) * z
  const hw = g.fw / 2 / s
  const hh = g.fh / 2 / s
  return {
    z,
    cx: Math.min(g.nw - hw, Math.max(hw, v.cx)),
    cy: Math.min(g.nh - hh, Math.max(hh, v.cy)),
  }
}

function initialView(g: Geo, shape: 'rect' | 'circle'): View {
  // الصورة الشخصية الطوليّة: الوجه غالبًا في الثلث الأعلى لا في المنتصف.
  const cy = shape === 'circle' && g.nh > g.nw ? g.nh * 0.38 : g.nh / 2
  return clampView({ cx: g.nw / 2, cy, z: 1 }, g)
}

function panView(v: View, g: Geo, dx: number, dy: number): View {
  const s = coverScale(g) * v.z
  return clampView({ ...v, cx: v.cx - dx / s, cy: v.cy - dy / s }, g)
}

/** تكبير حول نقطة في الإطار، فتبقى النقطة التي تحت المؤشّر ثابتة. */
function zoomView(v: View, g: Geo, next: (z: number) => number, px: number, py: number): View {
  const s0 = coverScale(g)
  const s = s0 * v.z
  const z2 = Math.min(MAX_ZOOM, Math.max(1, next(v.z)))
  const s2 = s0 * z2
  const sx = v.cx + (px - g.fw / 2) / s
  const sy = v.cy + (py - g.fh / 2) / s
  return clampView({ z: z2, cx: sx - (px - g.fw / 2) / s2, cy: sy - (py - g.fh / 2) / s2 }, g)
}

/**
 * نافذة اقتصاص: الإطار ثابت بالنسبة المطلوبة، والصورة تتحرّك وتكبر تحته.
 *
 * بلا مكتبة: الحساب كلّه مركز وتكبير، والتصدير canvas. مكتبة اقتصاص تعني
 * اعتمادًا جديدًا لسلوكٍ هذا حجمه، وتعني أيضًا نصوصًا واتّجاهًا لا نتحكّم بهما.
 *
 * الحالة مركزُ الإطار بإحداثيات الصورة الأصلية لا إزاحةٌ بالبكسل، فتبقى
 * صحيحة إن تغيّر عرض النافذة (دوران الجوّال مثلًا) دون أيّ تصحيح.
 */
export function ImageCropper({
  src,
  crossOrigin = false,
  ratio,
  shape = 'rect',
  outputWidth,
  sourceType,
  onCancel,
  onConfirm,
}: {
  src: string
  /** للصورة المحفوظة في التخزين: بدونه تتلوّث canvas ويُمنع التصدير. */
  crossOrigin?: boolean
  ratio: Ratio
  shape?: 'rect' | 'circle'
  /** أقصى عرض للمخرَج بالبكسل. لا تكبير فوق دقّة الأصل. */
  outputWidth: number
  sourceType: string
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}) {
  const t = useTranslations('admin')
  const titleId = useId()
  const helpId = useId()

  const dialogRef = useRef<HTMLDialogElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [frame, setFrame] = useState({ w: 0, h: 0 })
  // null = الوضع الابتدائيّ. يُحسب عند العرض لا في effect، فلا عرضٌ مزدوج.
  const [view, setView] = useState<View | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; x: number; y: number } | null>(null)

  const geo = useMemo<Geo | null>(
    () =>
      img && frame.w > 0
        ? { nw: img.naturalWidth, nh: img.naturalHeight, fw: frame.w, fh: frame.h }
        : null,
    [img, frame.w, frame.h]
  )

  // الحصر عند العرض: إن تغيّر عرض الإطار بقي المعروض صحيحًا بلا تصحيح.
  const current = geo ? clampView(view ?? initialView(geo, shape), geo) : null

  /* ── فتح النافذة وإغلاقها ─────────────────────────────────────────────── */
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
      // التركيز على النافذة نفسها لا على أوّل عنصر فيها: فتحها بالفأرة لا
      // يُظهر حلقة تركيز على الإطار، و Tab يصل إليه لمن يستعمل لوحة المفاتيح.
      dialog.focus()
    }
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  /* ── تحميل الصورة ─────────────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true
    const probe = new window.Image()
    if (crossOrigin) probe.crossOrigin = 'anonymous'
    probe.onload = () => alive && setImg(probe)
    probe.onerror = () => alive && setError(t('cropLoadFailed'))
    probe.src = src
    return () => {
      alive = false
    }
  }, [src, crossOrigin, t])

  /* ── قياس الإطار ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setFrame({ w: width, h: height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /** كل تعديل يبدأ من المعروض فعلًا (المحصور)، لا من القيمة الخام. */
  function update(op: (v: View, g: Geo) => View) {
    if (!geo) return
    setView((v) => op(clampView(v ?? initialView(geo, shape), geo), geo))
  }

  const panBy = (dx: number, dy: number) => update((v, g) => panView(v, g, dx, dy))
  const zoomAt = (next: (z: number) => number, px: number, py: number) =>
    update((v, g) => zoomView(v, g, next, px, py))

  /* ── العجلة: مستمع أصليّ لأنّ React يسجّل wheel سلبيًّا فلا يُمنع التمرير ─ */
  useEffect(() => {
    const el = frameRef.current
    if (!el || !geo) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      setView((v) => zoomView(clampView(v ?? initialView(geo, shape), geo), geo, (z) => z * factor, px, py))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [geo, shape])

  /* ── السحب والقرص بإصبعين ─────────────────────────────────────────────── */
  function pinchState() {
    const [a, b] = [...pointers.current.values()]
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) pinch.current = pinchState()
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 1) {
      panBy(e.clientX - prev.x, e.clientY - prev.y)
    } else if (pointers.current.size === 2 && pinch.current) {
      const now = pinchState()
      const rect = e.currentTarget.getBoundingClientRect()
      const factor = pinch.current.dist > 0 ? now.dist / pinch.current.dist : 1
      zoomAt((z) => z * factor, now.x - rect.left, now.y - rect.top)
      panBy(now.x - pinch.current.x, now.y - pinch.current.y)
      pinch.current = now
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    pinch.current = pointers.current.size === 2 ? pinchState() : null
  }

  /* ── لوحة المفاتيح ────────────────────────────────────────────────────── */
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!geo) return
    const step = e.shiftKey ? 40 : 10
    const { fw, fh } = geo
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    if (moves[e.key]) {
      e.preventDefault()
      panBy(...moves[e.key])
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      zoomAt((z) => z * 1.1, fw / 2, fh / 2)
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      zoomAt((z) => z / 1.1, fw / 2, fh / 2)
    }
  }

  /* ── التصدير ──────────────────────────────────────────────────────────── */
  async function apply() {
    if (!img || !geo || !current) return
    setBusy(true)
    setError(null)
    try {
      const s = coverScale(geo) * current.z
      const cw = geo.fw / s
      const ch = geo.fh / s
      const sx = current.cx - cw / 2
      const sy = current.cy - ch / 2
      const outW = Math.max(1, Math.round(Math.min(outputWidth, cw)))
      const outH = Math.max(1, Math.round((outW * ratio.h) / ratio.w))

      // JPEG للصور المعتمة — أصغر وتقرؤه كل المتصفّحات. وما فيه شفافيّة
      // يبقى بها: WebP، ويعود PNG وحده حيث لا يكتب المتصفّح WebP.
      const jpegSource = sourceType === 'image/jpeg'
      let canvas = drawScaled(img, sx, sy, cw, ch, outW, outH, jpegSource)
      let blob: Blob
      if (jpegSource || isOpaque(canvas)) {
        if (!jpegSource) {
          canvas = drawScaled(img, sx, sy, cw, ch, outW, outH, true)
        }
        blob = await toBlob(canvas, 'image/jpeg', 0.9)
      } else {
        blob = await toBlob(canvas, 'image/webp', 0.9)
      }
      onConfirm(blob)
    } catch {
      // الغالب هنا canvas ملوّثة: صورة محفوظة لم يُسمح بقراءتها عبر النطاقات.
      setError(t('cropFailed'))
      setBusy(false)
    }
  }

  /* ── العرض ────────────────────────────────────────────────────────────── */
  const ready = !!geo && !!current
  let imageStyle: React.CSSProperties | undefined
  let lowRes = false
  if (geo && current) {
    const s = coverScale(geo) * current.z
    imageStyle = {
      left: 0,
      top: 0,
      width: geo.nw * s,
      height: geo.nh * s,
      transform: `translate(${geo.fw / 2 - current.cx * s}px, ${geo.fh / 2 - current.cy * s}px)`,
    }
    lowRes = geo.fw / s < outputWidth * LOW_RES
  }

  const dialog = (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-[var(--surface)] p-0 text-[var(--fg)] shadow-2xl outline-none ring-1 ring-[var(--border)] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="space-y-4 p-5 sm:p-6">
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            {t('cropTitle')}
          </h2>
          <p id={helpId} className="mt-1 text-sm leading-relaxed text-[var(--fg-muted)]">
            {t('cropHelp')}
            {shape === 'circle' ? ` ${t('cropCircleNote')}` : ''}
          </p>
        </div>

        <div
          ref={frameRef}
          tabIndex={0}
          role="group"
          aria-label={t('cropFrame')}
          aria-describedby={helpId}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className={cn(
            'relative mx-auto w-full cursor-grab touch-none select-none overflow-hidden rounded-xl bg-[var(--bg-subtle)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] active:cursor-grabbing',
            shape === 'circle' && 'max-w-sm'
          )}
          style={{ aspectRatio: `${ratio.w} / ${ratio.h}` }}
        >
          {ready ? (
            // next/image لا يقبل رابط blob: المحلّي، ولا حاجة لتحسينه هنا أصلًا.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              draggable={false}
              crossOrigin={crossOrigin ? 'anonymous' : undefined}
              className="pointer-events-none absolute max-w-none"
              style={imageStyle}
            />
          ) : error ? null : (
            <div className="absolute inset-0 grid place-items-center">
              <Loader2 className="size-6 animate-spin text-[var(--primary)]" aria-hidden />
            </div>
          )}

          {shape === 'circle' ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_100vmax_rgb(0_0_0/0.6)] ring-2 ring-white/85"
            />
          ) : (
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <span className="absolute inset-y-0 start-1/3 w-px bg-white/45" />
              <span className="absolute inset-y-0 start-2/3 w-px bg-white/45" />
              <span className="absolute inset-x-0 top-1/3 h-px bg-white/45" />
              <span className="absolute inset-x-0 top-2/3 h-px bg-white/45" />
              <span className="absolute inset-0 ring-2 ring-inset ring-white/70" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <ZoomOut className="size-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden />
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={current?.z ?? 1}
            disabled={!ready}
            aria-label={t('cropZoom')}
            onChange={(e) => {
              const z = Number(e.target.value)
              if (geo) zoomAt(() => z, geo.fw / 2, geo.fh / 2)
            }}
            className="h-2 w-full cursor-pointer accent-[var(--primary)]"
          />
          <ZoomIn className="size-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden />
          <Button
            variant="ghost"
            size="sm"
            disabled={!ready}
            onClick={() => setView(null)}
            className="shrink-0"
          >
            <RotateCcw className="size-4" aria-hidden />
            {t('cropReset')}
          </Button>
        </div>

        {lowRes ? (
          <p className="flex items-start gap-1.5 text-xs text-[var(--warning)]">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t('cropLowRes')}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
            {t('cropCancel')}
          </Button>
          <Button size="sm" onClick={apply} disabled={!ready || busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            {t('cropApply')}
          </Button>
        </div>
      </div>
    </dialog>
  )

  return createPortal(dialog, document.body)
}
