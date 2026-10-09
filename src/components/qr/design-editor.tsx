'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Check, ImagePlus, Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import {
  AUTOSAVE_IDLE_MS,
  AUTOSAVE_MAX_MS,
  BRAND_ACCENT,
  BRAND_INK,
  CAPTION_MAX,
  LOGO_ACCEPT,
} from '@/lib/qr/config'
import { weakContrast } from '@/lib/qr/render'
import {
  DEFAULT_CAPTION_AR,
  HEX,
  normalizeDesign,
  type Ecc,
  type FrameStyle,
  type Paint,
  type QrDesign,
  type QrSpec,
} from '@/lib/qr/spec'
import { cn } from '@/lib/utils'
import { prepareLogo } from './file-tools'
import { DownloadButtons, QrPreview } from './qr-preview'
import { Notice, Segmented } from './ui'

/**
 * محرّر التصميم على الرمز الحيّ: المعاينة تُمسح وتعمل، وعدد وحداتها هو
 * عدد وحدات المطبوع.
 *
 * الحفظ تلقائي: بعد ١٫٥ ثانية سكون، وبسقف ٥ ثوانٍ من أول تغيير، ويُفرَّغ عند
 * إخفاء التبويب أو مغادرة الشاشة. والحفظ مصفوف: طلب واحد في الطريق، والأحدث
 * يُطلق بعده — فلا يسبق قديمٌ جديدًا إلى القاعدة.
 */

const SWATCHES = [BRAND_INK, '#3d866e', BRAND_ACCENT, '#12252a', '#000000', '#ffffff']

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

/**
 * كقواعد الخادم (الشعار يفرض H، وضلعه ٠٫٣) لكن النداء يبقى كما يُكتب: قصّ
 * المسافات مع كل حرف يمنع كتابة مسافة بين كلمتين. الخادم يقصّه عند الحفظ.
 */
function editorNormalize(design: QrDesign): QrDesign {
  const normalized = normalizeDesign(design)
  return design.frame && normalized.frame
    ? { ...normalized, frame: { ...normalized.frame, caption: design.frame.style === 'ring' ? '' : design.frame.caption.slice(0, CAPTION_MAX) } }
    : normalized
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  const [text, setText] = useState(value)
  // القيمة تتبدّل من الخارج (لوحة الألوان، الحاوية): نعيد النصّ إليها أثناء العرض
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setText(value)
  }
  const six = /^#[0-9a-f]{6}/i.test(value) ? value.slice(0, 7) : /^#[0-9a-f]{3}$/i.test(value) ? `#${value.slice(1).split('').map((c) => c + c).join('')}` : '#000000'

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-[var(--fg-muted)]">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={six}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-lg bg-[var(--surface)] p-1 ring-1 ring-inset ring-[var(--border-strong)]"
        />
        <Input
          id={id}
          dir="ltr"
          value={text}
          spellCheck={false}
          maxLength={9}
          onChange={(e) => {
            setText(e.target.value)
            if (HEX.test(e.target.value)) onChange(e.target.value.toLowerCase())
          }}
          onBlur={() => setText(value)}
          className="font-latin h-10 w-28"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            onClick={() => onChange(swatch)}
            aria-label={swatch}
            className={cn(
              'size-6 rounded-full ring-1 ring-[var(--border-strong)] transition-transform hover:scale-110',
              value.toLowerCase() === swatch && 'ring-2 ring-[var(--ring)] ring-offset-1 ring-offset-[var(--surface)]'
            )}
            style={{ background: swatch }}
          />
        ))}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-[var(--border)] pt-5 first:border-t-0 first:pt-0">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  suffix?: string
}) {
  const id = useId()
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-[var(--fg-muted)]">
        <label htmlFor={id}>{label}</label>
        <span className="font-latin tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--primary)]"
      />
    </div>
  )
}

export function DesignEditor({
  linkId,
  title,
  text,
  initial,
  doneHref,
}: {
  linkId: string
  title: string
  text: string
  initial: QrDesign
  doneHref: string
}) {
  const t = useTranslations('qr.design')
  const tc = useTranslations('qr.common')
  const router = useRouter()
  const [design, setDesign] = useState<QrDesign>(() => normalizeDesign(initial))
  const [state, setState] = useState<SaveState>('saved')
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoIssue, setLogoIssue] = useState<string | null>(null)
  const logoInput = useRef<HTMLInputElement>(null)

  // آخر ما حُفظ: الحالة لما يُرسم، والمرجع لمنطق الحفظ خارج العرض
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(normalizeDesign(initial)))
  const saved = useRef(savedJson)
  const latest = useRef(design)
  const inflight = useRef(false)
  const queued = useRef(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // المعاينة والتنزيل كما سيُحفظ: النداء الفارغ يصير الافتراضي
  const spec: QrSpec = useMemo(() => ({ text, ...normalizeDesign(design) }), [text, design])
  const weak = useMemo(() => weakContrast(spec), [spec])
  const dirty = JSON.stringify(design) !== savedJson

  const clearTimers = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (maxTimer.current) clearTimeout(maxTimer.current)
    idleTimer.current = null
    maxTimer.current = null
  }

  const flush = useCallback(
    async (keepalive = false) => {
      clearTimers()
      if (inflight.current) {
        queued.current = true
        return
      }
      const payload = latest.current
      const json = JSON.stringify(payload)
      if (json === saved.current) return

      const body = JSON.stringify({ id: linkId, design: payload })
      inflight.current = true
      setState('saving')
      try {
        const response = await fetch('/api/qr/design', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          // keepalive يحمل ٦٤ كيلوبايت فقط؛ الشعار الكبير يُحفظ بطلب عادي
          keepalive: keepalive && body.length < 60_000,
        })
        if (!response.ok) throw new Error(String(response.status))
        saved.current = json
        setSavedJson(json)
        setState(JSON.stringify(latest.current) === json ? 'saved' : 'dirty')
      } catch {
        setState('error')
      } finally {
        inflight.current = false
        if (queued.current) {
          queued.current = false
          void flush()
        }
      }
    },
    [linkId]
  )

  const update = (next: QrDesign) => {
    const normalized = editorNormalize(next)
    latest.current = normalized
    setDesign(normalized)
    setState('dirty')
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => void flush(), AUTOSAVE_IDLE_MS)
    maxTimer.current ??= setTimeout(() => void flush(), AUTOSAVE_MAX_MS)
  }

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void flush(true)
    }
    const onPageHide = () => void flush(true)
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== saved.current) {
        void flush(true)
        e.preventDefault()
      }
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
      // مغادرة الشاشة داخل التطبيق
      void flush(true)
    }
  }, [flush])

  const paint = design.dots.paint
  const setPaint = (next: Paint) => update({ ...design, dots: { ...design.dots, paint: next } })
  const paintFrom = paint.type === 'solid' ? paint.color : paint.from
  const paintTo = paint.type === 'solid' ? BRAND_ACCENT : paint.to

  async function pickLogo(file: File) {
    setLogoIssue(null)
    setLogoBusy(true)
    try {
      const result = await prepareLogo(file)
      if ('issue' in result) setLogoIssue(result.issue)
      else update({ ...design, logo: { href: result.href, scale: 0.3 } })
    } finally {
      setLogoBusy(false)
      if (logoInput.current) logoInput.current.value = ''
    }
  }

  const frameStyle: FrameStyle | 'none' = design.frame?.style ?? 'none'
  const setFrameStyle = (style: FrameStyle | 'none') => {
    if (style === 'none') return update({ ...design, frame: null })
    update({
      ...design,
      frame: {
        style,
        place: design.frame?.place ?? 'bottom',
        color: design.frame?.color ?? BRAND_INK,
        caption: design.frame?.caption || DEFAULT_CAPTION_AR,
        textColor: design.frame?.textColor ?? '#ffffff',
      },
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      {/* المعاينة */}
      <div className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
          <div className="mx-auto max-w-80 rounded-xl bg-white p-3 ring-1 ring-[var(--border)]">
            <QrPreview spec={spec} label={t('previewLabel')} />
          </div>
          <p className="font-latin mt-3 break-all text-center text-xs text-[var(--fg-subtle)]" dir="ltr">
            {text.replace(/^https?:\/\//, '')}
          </p>
        </div>

        {weak ? (
          <p className="flex gap-2 rounded-lg bg-[var(--warning-soft)] px-3.5 py-2.5 text-sm text-[var(--warning)]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t('contrastWarn')}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <DownloadButtons spec={spec} title={title} />
          <span role="status" className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-subtle)]">
            {state === 'saving' ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : state === 'saved' ? (
              <Check className="size-3.5 text-[var(--success)]" aria-hidden />
            ) : null}
            {state === 'error' ? (
              <span className="text-[var(--danger)]">{t('saveFailed')}</span>
            ) : state === 'dirty' ? (
              t('dirty')
            ) : state === 'saving' ? (
              tc('saving')
            ) : (
              t('autosave')
            )}
          </span>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" disabled={!dirty || state === 'saving'} onClick={() => void flush()}>
            {state === 'saving' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {tc('save')}
          </Button>
          <Button
            onClick={async () => {
              await flush()
              router.push(doneHref)
            }}
          >
            {t('done')}
          </Button>
        </div>
      </div>

      {/* الضوابط */}
      <div className="space-y-5 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        <Section title={t('ink')}>
          <Segmented
            label={t('ink')}
            value={paint.type}
            onChange={(type) =>
              setPaint(
                type === 'solid'
                  ? { type, color: paintFrom }
                  : type === 'linear'
                    ? { type, from: paintFrom, to: paintTo, angle: paint.type === 'linear' ? paint.angle : 45 }
                    : { type, from: paintFrom, to: paintTo, cx: 0.5, cy: 0.5 }
              )
            }
            options={[
              { value: 'solid', label: t('paintSolid') },
              { value: 'linear', label: t('paintLinear') },
              { value: 'radial', label: t('paintRadial') },
            ]}
          />
          {paint.type === 'solid' ? (
            <ColorField label={t('color')} value={paint.color} onChange={(color) => setPaint({ type: 'solid', color })} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField label={t('from')} value={paint.from} onChange={(from) => setPaint({ ...paint, from })} />
              <ColorField label={t('to')} value={paint.to} onChange={(to) => setPaint({ ...paint, to })} />
            </div>
          )}
          {paint.type === 'linear' ? (
            <Range label={t('angle')} value={paint.angle} min={0} max={360} onChange={(angle) => setPaint({ ...paint, angle })} suffix="°" />
          ) : null}
          {paint.type === 'radial' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Range label={t('centerX')} value={Math.round(paint.cx * 100)} min={0} max={100} onChange={(v) => setPaint({ ...paint, cx: v / 100 })} suffix="%" />
              <Range label={t('centerY')} value={Math.round(paint.cy * 100)} min={0} max={100} onChange={(v) => setPaint({ ...paint, cy: v / 100 })} suffix="%" />
            </div>
          ) : null}
        </Section>

        <Section title={t('eyes')}>
          {(['eye', 'pupil'] as const).map((part) => (
            <div key={part} className="space-y-2">
              <p className="text-xs font-medium text-[var(--fg-muted)]">{t(part)}</p>
              <Segmented
                label={t(part)}
                value={design[part].color === null ? 'follow' : 'custom'}
                onChange={(mode) =>
                  update({
                    ...design,
                    [part]: { ...design[part], color: mode === 'follow' ? null : part === 'pupil' ? BRAND_ACCENT : BRAND_INK },
                  })
                }
                options={[
                  { value: 'follow', label: t('followInk') },
                  { value: 'custom', label: t('custom') },
                ]}
              />
              {design[part].color !== null ? (
                <ColorField
                  label={t('color')}
                  value={design[part].color!}
                  onChange={(color) => update({ ...design, [part]: { ...design[part], color } })}
                />
              ) : null}
            </div>
          ))}
        </Section>

        <Section title={t('background')}>
          <Segmented
            label={t('background')}
            value={design.bg === null ? 'none' : 'color'}
            onChange={(mode) => update({ ...design, bg: mode === 'none' ? null : '#ffffff' })}
            options={[
              { value: 'none', label: t('transparent') },
              { value: 'color', label: t('solidBg') },
            ]}
          />
          {design.bg !== null ? <ColorField label={t('color')} value={design.bg} onChange={(bg) => update({ ...design, bg })} /> : null}
        </Section>

        <Section title={t('logo')}>
          <input
            ref={logoInput}
            type="file"
            accept={LOGO_ACCEPT}
            className="sr-only"
            id="qr-logo-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void pickLogo(file)
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            {design.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={design.logo.href} alt="" className="size-14 rounded-lg bg-[var(--bg-subtle)] object-contain p-1 ring-1 ring-[var(--border)]" />
            ) : null}
            <label htmlFor="qr-logo-input" className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--primary)] ring-1 ring-inset ring-[var(--border-strong)] hover:bg-[var(--bg-subtle)]">
              {logoBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
              {design.logo ? t('logoReplace') : t('logoAdd')}
            </label>
            {design.logo ? (
              <button
                type="button"
                onClick={() => update({ ...design, logo: null })}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-subtle)] hover:text-[var(--danger)]"
              >
                <Trash2 className="size-4" aria-hidden />
                {t('logoRemove')}
              </button>
            ) : null}
          </div>
          <p className="text-xs text-[var(--fg-subtle)]">{t('logoHint')}</p>
          {logoIssue ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {t(logoIssue as never)}
            </p>
          ) : null}
        </Section>

        <Section title={t('frame')}>
          <Segmented
            label={t('frame')}
            value={frameStyle}
            onChange={setFrameStyle}
            options={[
              { value: 'none', label: t('frameNone') },
              { value: 'band', label: t('frameBand') },
              { value: 'ring', label: t('frameRing') },
              { value: 'bubble', label: t('frameBubble') },
            ]}
          />
          {design.frame ? (
            <div className="space-y-4">
              {design.frame.style !== 'ring' ? (
                <>
                  <Segmented
                    label={t('frame')}
                    value={design.frame.place}
                    onChange={(place) => update({ ...design, frame: { ...design.frame!, place } })}
                    options={[
                      { value: 'top', label: t('placeTop') },
                      { value: 'bottom', label: t('placeBottom') },
                    ]}
                  />
                  <div className="space-y-1.5">
                    <label htmlFor="qr-caption" className="text-xs font-medium text-[var(--fg-muted)]">
                      {t('caption')}
                    </label>
                    <Input
                      id="qr-caption"
                      dir="auto"
                      maxLength={CAPTION_MAX}
                      value={design.frame.caption}
                      placeholder={t('captionDefault')}
                      onChange={(e) => update({ ...design, frame: { ...design.frame!, caption: e.target.value } })}
                    />
                  </div>
                </>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField label={t('frameColor')} value={design.frame.color} onChange={(color) => update({ ...design, frame: { ...design.frame!, color } })} />
                {design.frame.style !== 'ring' ? (
                  <ColorField label={t('textColor')} value={design.frame.textColor} onChange={(textColor) => update({ ...design, frame: { ...design.frame!, textColor } })} />
                ) : null}
              </div>
            </div>
          ) : null}
        </Section>

        <Section title={t('ecc')}>
          <Segmented<Ecc>
            label={t('ecc')}
            value={design.ecc}
            disabled={Boolean(design.logo)}
            onChange={(ecc) => update({ ...design, ecc })}
            options={(['L', 'M', 'Q', 'H'] as const).map((value) => ({ value, label: value }))}
          />
          {design.logo ? <Notice>{t('eccLocked')}</Notice> : <p className="text-xs text-[var(--fg-subtle)]">{t('eccHint')}</p>}
        </Section>
      </div>
    </div>
  )
}
