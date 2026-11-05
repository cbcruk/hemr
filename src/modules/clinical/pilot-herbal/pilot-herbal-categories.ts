/** 첩약 시범사업 첩약 처방 카테고리입니다. 심평원 승인을 받아야 하는 줄입니다. */
export const PILOT_HERBAL_CATEGORY = '35001001'

/** 첩약 시범사업 처방 카테고리입니다. 첩약·한약재·조제탕전료·심층변증방제기술료·시범사업약재입니다. */
export const PILOT_HERBAL_CATEGORIES: ReadonlySet<string> = new Set([
  PILOT_HERBAL_CATEGORY,
  '35001002',
  '35002001',
  '35003001',
  '35004001',
])
