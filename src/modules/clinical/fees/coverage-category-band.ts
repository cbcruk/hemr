import type { Coverage } from '../../../shared/coverage.ts'
import { PILOT_HERBAL_CATEGORIES } from '../pilot-herbal/pilot-herbal-categories.ts'

/** 보험구분 검사에 쓰는 진료 문맥입니다. 내원의 `benefitFlags`에서 옵니다. */
export interface CoverageContext {
  coverage: Coverage
  /** 한방첩약 시범사업 대상인지입니다. 내원의 `benefitFlags.pilotHerbal`이 있으면 참입니다. */
  herbalPilot: boolean
  /** 비대면 시범사업 진료인지입니다(`benefitFlags.telemedicinePilot`). */
  telemedicinePilot: boolean
}

export interface CoverageLine {
  lineId: string
  category: string
  /** 수가코드입니다. 비급여처럼 코드가 없으면 `null`입니다. */
  feeCode: string | null
}

/** 보험구분 전용 처방의 판정 대상입니다. 카테고리와 수가코드는 정확히 일치, 접두사는 앞자리 일치로 봅니다. */
interface CoverageRestriction {
  categories?: ReadonlySet<string>
  feeCodes?: ReadonlySet<string>
  feeCodePrefixes?: readonly string[]
  /** 이 처방을 쓸 수 있는 진료인지입니다. */
  allowedIn: (context: CoverageContext) => boolean
}

const 건보의료급여인가 = (context: CoverageContext) => context.coverage === 'NHIS' || context.coverage === 'MEDICAL_AID'

/**
 * 보험구분별 차단 표입니다 (결정 1·2·3). 현행 값을 초기값으로 옮겼고, 고시가 바뀌면 참조데이터로 고칩니다.
 *
 * 대역 일치(건보 31·33·34·35 등)는 강제하지 않습니다. 자보 진료의 건보 침술·진찰료 줄과 모든 보험구분의 비급여
 * 줄을 현행처럼 쓸 수 있습니다.
 */
const 보험구분별차단표: readonly CoverageRestriction[] = [
  {
    // 자보 입원·검사·시술처치·투약
    categories: new Set(['71002001', '72001001', '73001001', '73002001', '74001001', '74002001', '74003001']),
    allowedIn: (context) => context.coverage === 'AUTO_INSURANCE',
  },
  {
    // 산재 검사·시술처치·투약
    categories: new Set(['92001001', '93001001', '93002001', '94002001', '94003001']),
    allowedIn: (context) => context.coverage === 'INDUSTRIAL_ACCIDENT',
  },
  {
    // 한방첩약 시범사업은 건보에만 있습니다
    categories: PILOT_HERBAL_CATEGORIES,
    allowedIn: (context) => context.coverage === 'NHIS' && context.herbalPilot,
  },
  {
    // 복잡추나(80%)는 자보에서 쓰지 않습니다 (결정 2)
    feeCodes: new Set(['40721']),
    allowedIn: (context) => context.coverage !== 'AUTO_INSURANCE',
  },
  {
    // 비대면 시범사업 코드와 관리료는 비대면 시범사업 진료에서만 씁니다 (결정 3)
    feeCodes: new Set(['91001', '91002', '91003', '91004']),
    feeCodePrefixes: ['91000'],
    allowedIn: (context) => 건보의료급여인가(context) && context.telemedicinePilot,
  },
]

/**
 * 진료의 보험구분에서 쓸 수 없는 처방 줄입니다. 원래 순서를 유지합니다.
 *
 * 보험구분 변경·진료 저장·완료가 같은 함수를 씁니다 (결정 4). 호출하는 쪽이 보험구분 변경에서는 줄을 지우지 않고
 * `invalid: COVERAGE_MISMATCH`로 표시해 `invalidatedPrescriptionLines[]`로 알리고 (결정 5), 저장에서는
 * `COVERAGE_CATEGORY_MISMATCH` warning, 완료에서는 같은 코드의 422 위반으로 만듭니다.
 */
export function coverageMismatchLineIds(lines: readonly CoverageLine[], context: CoverageContext): string[] {
  return lines
    .filter((line) => 보험구분별차단표.some((차단) => 차단대상줄(차단, line) && !차단.allowedIn(context)))
    .map((line) => line.lineId)
}

function 차단대상줄(차단: CoverageRestriction, line: CoverageLine): boolean {
  if (차단.categories?.has(line.category) === true) return true
  const 수가코드 = line.feeCode
  if (수가코드 === null) return false
  return (
    차단.feeCodes?.has(수가코드) === true || (차단.feeCodePrefixes ?? []).some((앞자리) => 수가코드.startsWith(앞자리))
  )
}
