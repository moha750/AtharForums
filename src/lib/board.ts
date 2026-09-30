import type { BoardMember, BoardRank } from '@/lib/database.types'

/** المناصب مرتّبةً من الأعلى، كما في enum القاعدة. */
export const BOARD_RANKS: readonly BoardRank[] = ['general_manager', 'chair', 'member']

/** مفاتيح المسمّيات المعتمدة في نطاق board من نصوص الواجهة. */
export const RANK_TITLE_KEY = {
  general_manager: 'rankGeneralManager',
  chair: 'rankChair',
  member: 'rankMember',
} as const satisfies Record<BoardRank, string>

export type RankTitles = Record<BoardRank, string>

/**
 * المسمّى الظاهر: الصيغة المكتوبة للعضو بلغة الصفحة إن وُجدت، وإلا المعتمد
 * لمنصبه بلغة الصفحة. لا رجوع إلى العربية في الصفحة الإنجليزية كما تفعل
 * localized: «رئيسة مجلس الإدارة» وسط صفحة إنجليزية أسوأ من «Chair».
 */
export function boardTitle(member: BoardMember, locale: string, titles: RankTitles): string {
  const own = locale === 'en' ? member.position_en : member.position_ar
  return own && own.trim() !== '' ? own : titles[member.rank]
}

/** يجمع الأعضاء صفوفًا بحسب المنصب، من الأعلى، ويُسقط المنصب الفارغ. */
export function groupByRank(members: BoardMember[]): BoardMember[][] {
  return BOARD_RANKS.map((rank) => members.filter((m) => m.rank === rank)).filter(
    (row) => row.length > 0
  )
}
