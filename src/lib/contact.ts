import type { ContactTopic } from '@/lib/database.types'

/** بترتيب ظهورها في القائمة. يطابق النوع contact_topic في القاعدة. */
export const CONTACT_TOPICS = [
  'inquiry',
  'suggestion',
  'technical',
  'other',
] as const satisfies readonly ContactTopic[]
