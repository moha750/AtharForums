/**
 * مسار ملف الباركود في المخزن: {uploaderId}/{uuid}.{webp|jpg|png|pdf}
 * القيد نفسه في القاعدة (qr_links_file_shape) — هذا للواجهة والاختبار.
 * نوع الملف يُستنتج من الامتداد، بلا عمود إضافي.
 */

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const FILE_PATH = new RegExp(`^${UUID}/${UUID}\\.(webp|jpg|png|pdf)$`)

export type FileExt = 'webp' | 'jpg' | 'png' | 'pdf'
export type FileKind = 'image' | 'pdf'

export const MIME_EXT: Record<string, FileExt> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
}

export function isFilePath(path: string): boolean {
  return FILE_PATH.test(path)
}

export function filePathOwner(path: string): string | null {
  return isFilePath(path) ? path.split('/')[0]! : null
}

export function fileExtOf(path: string): FileExt | null {
  const match = /\.(webp|jpg|png|pdf)$/.exec(path)
  return match ? (match[1] as FileExt) : null
}

export function fileKindOf(path: string): FileKind | null {
  const ext = fileExtOf(path)
  if (!ext) return null
  return ext === 'pdf' ? 'pdf' : 'image'
}
