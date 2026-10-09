import {
  CODE_ALPHABET,
  CODE_LENGTH,
  CUSTOM_CODE_MAX,
  CUSTOM_CODE_MIN,
  RESERVED_CODES,
} from './config'

/**
 * رمز مولَّد بعشوائية تعمية، لا Math.random.
 *
 * الأبجدية ٣١ محرفًا، والبايت ٢٥٦ قيمة: أخذ الباقي مباشرةً يميل إلى أوائل
 * الأبجدية. نرفض البايتات من ٢٤٨ فما فوق (٣١ × ٨) فيتساوى الاحتمال.
 */
export function generateCode(
  random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)
): string {
  const limit = CODE_ALPHABET.length * Math.floor(256 / CODE_ALPHABET.length)
  let out = ''
  while (out.length < CODE_LENGTH) {
    const bytes = random(new Uint8Array(CODE_LENGTH * 2))
    for (const byte of bytes) {
      if (byte >= limit) continue
      out += CODE_ALPHABET[byte % CODE_ALPHABET.length]
      if (out.length === CODE_LENGTH) break
    }
  }
  return out
}

const GENERATED = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`)
const SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function looksGenerated(code: string): boolean {
  return GENERATED.test(code)
}

/** قصّ، وتصغير، والمسافات شرطات — قبل أي فحص. */
export function normalizeCustomCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-')
}

export type CustomCodeIssue = 'too-short' | 'too-long' | 'chars' | 'dash' | 'reserved'

/** يُرجع null إن صلح الرمز، وإلا سبب الرفض. */
export function customCodeIssue(code: string): CustomCodeIssue | null {
  if (code.length < CUSTOM_CODE_MIN) return 'too-short'
  if (code.length > CUSTOM_CODE_MAX) return 'too-long'
  if (/[^a-z0-9-]/.test(code)) return 'chars'
  if (!SHAPE.test(code)) return 'dash'
  if (RESERVED_CODES.includes(code)) return 'reserved'
  return null
}

/** شكل أي رمز صالح (مولَّد أو مختار) — يُفحص في باب المسح قبل أي استعلام. */
export function isCodeShape(code: string): boolean {
  return (
    code.length >= CUSTOM_CODE_MIN &&
    code.length <= CUSTOM_CODE_MAX &&
    SHAPE.test(code) &&
    !RESERVED_CODES.includes(code)
  )
}
