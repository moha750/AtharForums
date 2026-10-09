/**
 * ثوابت نظام الباركود — مشتركة بين المتصفّح والخادم.
 *
 * ما يقابل قيدًا في القاعدة مكتوبٌ هنا بالقيمة نفسها (انظر
 * supabase/migrations/0019_qr.sql). القاعدة هي الحَكَم، وهذا للواجهة.
 */

/** منطقة الجهة الزمنية. كل «يوم» و«ساعة» في النظام بها لا بساعة الجهاز. */
export const QR_TZ = 'Asia/Riyadh'

/** بلا 0 و1 وi وl وo — لا يلتبس محرفٌ بآخر حين يُقرأ الرمز بالعين. */
export const CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export const CODE_LENGTH = 7
export const CODE_MAX_ATTEMPTS = 7

export const CUSTOM_CODE_MIN = 3
export const CUSTOM_CODE_MAX = 32
export const RESERVED_CODES: readonly string[] = ['unavailable', 'new', 'admin', 'api', 'q']

export const TITLE_MAX = 120
export const NOTE_MAX = 120
export const CAMPAIGN_NOTE_MAX = 200
export const TARGET_MAX = 2000

/** الملفات */
export const FILE_IMAGE_SOURCE_MAX = 20 * 1024 * 1024 // الصورة الخام عند الاختيار
export const FILE_IMAGE_MAX = 4 * 1024 * 1024 // الصورة بعد التصغير
export const FILE_PDF_MAX = 10 * 1024 * 1024
export const FILE_IMAGE_EDGE = 2048
export const FILE_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
export const FILE_BUCKET = 'qr-files'

/** الشعار داخل الباركود */
export const LOGO_SOURCE_MAX = 5 * 1024 * 1024
export const LOGO_EDGE = 640
export const LOGO_SCALE = 0.3
export const LOGO_ACCEPT = 'image/png,image/svg+xml,image/webp,image/jpeg'

/** التصميم */
export const QR_EXPORT_SIZE = 2048
export const SPEC_MAX_BYTES = 1.2 * 1024 * 1024
export const CAPTION_MAX = 40
export const QUIET_ZONE = 4

/** لون هوية مساحة أثر — الحبر الافتراضي للباركود. */
export const BRAND_INK = '#144e46'
export const BRAND_ACCENT = '#c59237'

/** الحفظ التلقائي في المحرّر */
export const AUTOSAVE_IDLE_MS = 1500
export const AUTOSAVE_MAX_MS = 5000

/** فحص التوفّر اللحظي */
export const AVAILABILITY_DEBOUNCE_MS = 400

/** الإحصاء */
export const STATS_ROW_CAP = 20000
