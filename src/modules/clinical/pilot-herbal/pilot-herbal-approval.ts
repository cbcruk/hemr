import { PILOT_HERBAL_CATEGORIES, PILOT_HERBAL_CATEGORY } from './pilot-herbal-categories.ts'

/** 처방 줄의 심평원 승인 상태입니다. Claims 모듈의 심평원 사전 제출 결과로만 바뀝니다 (결정 5). */
export type HiraApprovalStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED'

/** 테넌트 제품입니다 (identity-access `Tenant.products`). identity-access 모듈을 만들면 그쪽으로 옮깁니다. */
export type TenantProduct = 'EMR' | 'LITE' | 'INSURANCE' | 'CRM' | 'MEMBERS'

/** 승인 검사를 받는 처방 줄입니다. `hiraApproval`이 `null`이면 승인되지 않은 것으로 봅니다. 줄 모델의 빠진 값은 호출하는 쪽이 `null`로 넘깁니다. */
export interface PilotHerbalApprovalLine {
  lineId: string
  category: string
  hiraApproval: { status: HiraApprovalStatus } | null
}

/** 승인을 받아야 하는 줄인지입니다. 첩약(`35001001`)만 받고, 다른 시범사업 줄은 받지 않습니다 (결정 1). */
export const requiresHiraApproval = (category: string): boolean => category === PILOT_HERBAL_CATEGORY

/** 줄을 만들 때의 승인 상태입니다. 첩약은 제출 전(`PENDING`), 나머지는 `NOT_REQUIRED`입니다 (결정 1). */
export const initialHiraApprovalStatus = (category: string): HiraApprovalStatus =>
  requiresHiraApproval(category) ? 'PENDING' : 'NOT_REQUIRED'

/** 승인된 줄인지입니다. 클라이언트가 보낸 승인 플래그는 쓰지 않습니다 (결정 5). */
export const isHiraApproved = (line: Pick<PilotHerbalApprovalLine, 'hiraApproval'>): boolean =>
  line.hiraApproval?.status === 'APPROVED'

/** 미승인 첩약 줄이 있어 완료를 막는 위반입니다. 저장은 통과하고 C0005 warning으로 알립니다 (결정 4). */
export interface PilotHerbalNotApproved {
  code: 'PILOT_HERBAL_NOT_APPROVED'
  lineIds: string[]
  blocksCompletion: true
}

/**
 * 진료 완료 검사입니다 (결정 1·2·3). 승인되지 않은 첩약 줄을 모두 모아 위반으로 돌려줍니다. 계정이나 완료 경로와
 * 상관없이 같은 검사를 하며, 첩약 줄이 없으면 통과합니다.
 */
export function pilotHerbalApprovalViolation(lines: readonly PilotHerbalApprovalLine[]): PilotHerbalNotApproved | null {
  const 미승인첩약줄Ids = lines
    .filter((line) => requiresHiraApproval(line.category) && !isHiraApproved(line))
    .map((line) => line.lineId)
  return 미승인첩약줄Ids.length > 0
    ? { code: 'PILOT_HERBAL_NOT_APPROVED', lineIds: 미승인첩약줄Ids, blocksCompletion: true }
    : null
}

/**
 * 첩약 시범사업 줄을 만들 수 있는 테넌트인지입니다 (결정 2). EMR 제품이 없는 LITE 단독 테넌트는 시범사업
 * 카테고리 줄 모두 422 `PILOT_HERBAL_NOT_AVAILABLE`입니다.
 */
export function pilotHerbalLineRejection(
  category: string,
  products: readonly TenantProduct[],
): 'PILOT_HERBAL_NOT_AVAILABLE' | null {
  return PILOT_HERBAL_CATEGORIES.has(category) && !products.includes('EMR') ? 'PILOT_HERBAL_NOT_AVAILABLE' : null
}
