import { decimalFraction, divideHalfUp } from '../../../shared/money/decimal.ts'
import { ageOn, daysBetween } from '../../../shared/time/calendar.ts'
import { PATTERN_DIAGNOSIS_FEE } from './consultation-fee-code.ts'
import type { ServiceAt } from './consultation-fee-code.ts'

/** 경혈침술의 침법입니다. 셋째 자리가 자락·도침·산침술 `2`, 사암·오행·체질침법 `4`, 화침·온침 `6`입니다. */
export type AcupunctureMethod = 'PRICKING' | 'CONSTITUTIONAL' | 'WARMING'

/** 의사가 줄에 직접 지정한 시간대 가산입니다. 서버가 진료 시각으로 자동으로 붙이지 않습니다 (결정 2). */
export type TimeSurcharge = 'SATURDAY_DAYTIME' | 'NIGHT' | 'HOLIDAY'

/** 산정코드를 계산할 처방 줄입니다. */
export interface ProcedureLine {
  feeCode: string
  category: string
  acupunctureMethod?: AcupunctureMethod
  timeSurcharge?: TimeSurcharge
  /**
   * 지금 8자리 코드를 서버가 계산해 붙였는지입니다. 참이면 앞 5자리에서 다시 계산합니다.
   * 사용자가 직접 지정한 8자리 코드는 거짓이고 다시 계산하지 않습니다 (결정 7). 클라이언트가 `feeCode`를 보내면
   * upsert가 거짓으로 되돌립니다. 진찰료 코드는 consultation-fee-code가 맡으므로 이 값과 상관없이 바꾸지 않습니다.
   */
  feeCodeComputed?: boolean
}

export interface ProcedureContext {
  serviceAt: ServiceAt
  /** 생년월일(`YYYY-MM-DD`)입니다. 모르면 `null`이고 연령 자리를 붙이지 않습니다. */
  birthDate: string | null
  /** 연령 가산을 붙일지입니다(현행 `연령에따른시술료가산적용여부`). */
  ageSurcharge: boolean
}

/** 처방 줄 전체입니다. 금액 필드 이름은 결정 6을 따릅니다. */
export interface PrescriptionFeeLine extends ProcedureLine {
  name: string
  /** 수가 마스터 단가입니다(현행 `금액`). */
  unitPrice: number
  /** 단가 × 1일 투여량 × 일수를 반올림한 값입니다(현행 `단가`). */
  amount: number
  dailyDose: number
  days: number
}

/** 그 날짜 수가 마스터의 행입니다. */
export interface FeeMasterRow {
  name: string
  /** 산정명칭입니다. 비어 있지 않으면 처방명으로 씁니다. */
  claimName?: string
  unitPrice: number
}

export interface ProcedureFeeLinesInput<L extends PrescriptionFeeLine = PrescriptionFeeLine> extends ProcedureContext {
  lines: readonly L[]
  feeMaster: ReadonlyMap<string, FeeMasterRow>
  /** 비대면 진료면 산정코드를 다시 계산하지 않습니다. */
  telemedicine?: boolean
}

export interface ProcedureFeeLines<L extends PrescriptionFeeLine = PrescriptionFeeLine> {
  lines: L[]
  /** 계산한 코드가 마스터에 없으면 그 줄은 그대로 두고 경고합니다. 저장은 통과하고 완료는 막습니다 (결정 5). */
  warnings: { code: 'FEE_CODE_NOT_IN_MASTER'; feeCodes: string[] }[]
}

/** 이 규칙이 산정코드를 붙이는 코드 종류(앞 두 자리)입니다. 투약·조제 `30`과 시술 `40`입니다. */
const 산정코드대상종류: ReadonlySet<string> = new Set(['30', '40'])

const 침술카테고리 = '33001001'
const 신생아최대생후일수 = 28
/** 침법 자리를 붙이는 경혈침술(`40011`)·경혈침술 이체(`40012`)입니다. */
const 경혈침술코드: ReadonlySet<string> = new Set(['40011', '40012'])

/**
 * 시간대 자리를 붙일 수 있는 코드 종류(앞 두 자리)입니다 (결정 3). 진찰료 `10`과 시술 `40`입니다.
 * 고시가 바뀌면 참조데이터 속성으로 고칩니다. 진찰료는 consultation-fee-code가 계산하므로 여기서는 시술만 해당합니다.
 */
const 시간대가산코드종류: ReadonlySet<string> = new Set(['10', '40'])

const 침법자리값: Record<AcupunctureMethod, string> = { PRICKING: '2', CONSTITUTIONAL: '4', WARMING: '6' }
const 시간대자리값: Record<TimeSurcharge, string> = { SATURDAY_DAYTIME: '3', NIGHT: '1', HOLIDAY: '5' }

/**
 * 시술·투약 줄의 산정코드입니다. 바꿀 코드가 없으면 `null`입니다.
 *
 * 1. 투약·조제·시술이 아니거나, 빈 코드거나, 사용자가 지정한 8자리 코드면 바꾸지 않습니다. 서버가 계산한 8자리면
 *    앞 5자리에서 다시 계산합니다
 * 2. 첫째 자리(연령, 결정 1·4)
 *    - 투약·조제(`30…`): 1세 미만 `1`, 1–5세 `6`
 *    - 시술(`40…`, 변증기술료 `40400` 제외): 1세 미만 `3`, 1–5세 `6`. 생후 28일 이하이고 침술 카테고리면 `1`
 *    - 진찰료·검사 등은 붙이지 않습니다
 * 3. 셋째 자리(침법): 경혈침술 `40011`·`40012`에만 붙입니다
 * 4. 둘째 자리(시간대): 의사가 지정했고 표에 있는 코드 종류에만 붙입니다 (결정 2·3)
 * 5. 세 자리가 모두 `0`이면 5자리 기본코드입니다. 원래 코드와 같으면 `null`입니다
 */
export function procedureFeeCode(line: ProcedureLine, context: ProcedureContext): string | null {
  const 수가코드 = line.feeCode
  const 사용자지정코드 = 수가코드.length === 8 && line.feeCodeComputed !== true
  if (!산정코드대상종류.has(수가코드.slice(0, 2)) || 사용자지정코드) return null
  const 기본코드 = 수가코드.slice(0, 5)

  const 산정코드자리 = [연령자리(기본코드, line.category, context), '0', '0']
  if (line.timeSurcharge !== undefined && 시간대가산코드종류.has(기본코드.slice(0, 2))) {
    산정코드자리[1] = 시간대자리값[line.timeSurcharge]
  }
  if (line.acupunctureMethod !== undefined && 경혈침술코드.has(기본코드)) {
    산정코드자리[2] = 침법자리값[line.acupunctureMethod]
  }

  const 산정코드 = 산정코드자리.join('')
  const 새수가코드 = 산정코드 === '000' ? 기본코드 : 기본코드 + 산정코드
  return 새수가코드 === 수가코드 ? null : 새수가코드
}

/**
 * 처방 줄 전체에 산정코드를 적용합니다. 처방 줄을 upsert할 때, 진료 시각·환자·보험구분이 바뀔 때, 진료 완료의
 * 금액 확정 직전에 부릅니다 (결정 7).
 *
 * 바뀐 코드가 마스터에 있으면 코드·처방명(`산정명칭 || 이름`)·단가·금액을 바꾸고, 없으면 줄을 그대로 두고
 * `FEE_CODE_NOT_IN_MASTER`로 알립니다 (결정 5). 비대면이면 서버가 붙인 코드도 현행처럼 그대로 둡니다.
 */
export function procedureFeeLines<L extends PrescriptionFeeLine>(
  input: ProcedureFeeLinesInput<L>,
): ProcedureFeeLines<L> {
  if (input.telemedicine === true) return { lines: [...input.lines], warnings: [] }
  const 마스터누락코드: string[] = []
  const 처방줄 = input.lines.map((line): L => {
    const 새수가코드 = procedureFeeCode(line, input)
    if (새수가코드 === null) return line
    const 마스터행 = input.feeMaster.get(새수가코드)
    if (마스터행 === undefined) {
      if (!마스터누락코드.includes(새수가코드)) 마스터누락코드.push(새수가코드)
      return line
    }
    return {
      ...line,
      feeCode: 새수가코드,
      feeCodeComputed: 새수가코드.length === 8,
      name: 마스터행.claimName || 마스터행.name,
      unitPrice: 마스터행.unitPrice,
      amount: lineAmount(마스터행.unitPrice, line.dailyDose, line.days),
    }
  })
  return {
    lines: 처방줄,
    warnings: 마스터누락코드.length > 0 ? [{ code: 'FEE_CODE_NOT_IN_MASTER', feeCodes: 마스터누락코드 }] : [],
  }
}

/**
 * 단가 × 1일 투여량 × 일수를 한 번만 반올림(0.5는 올림)합니다 (결정 6). 1일 투여량은 소수점 아래 6자리까지이고,
 * 더 긴 값은 요청 스키마가 400으로 막으므로 여기까지 오면 예외입니다.
 */
export function lineAmount(unitPrice: number, dailyDose: number, days: number): number {
  for (const value of [unitPrice, days]) {
    if (!Number.isInteger(value) || value < 0) throw new RangeError(`Expected a non-negative integer, got ${value}`)
  }
  const 투여량분수 = decimalFraction(dailyDose)
  return divideHalfUp(unitPrice * 투여량분수.numerator * days, 투여량분수.denominator)
}

function 연령자리(기본코드: string, category: string, context: ProcedureContext): string {
  const { birthDate } = context
  const 진료일 = context.serviceAt.date
  // 진료일보다 늦은 생년월일은 잘못된 값이라 나이를 모르는 것으로 봅니다
  if (!context.ageSurcharge || birthDate === null || birthDate > 진료일) return '0'
  const 나이 = ageOn(birthDate, 진료일)
  if (기본코드.startsWith('30')) return 나이 < 1 ? '1' : 나이 < 6 ? '6' : '0'
  if (!기본코드.startsWith('40') || 기본코드 === PATTERN_DIAGNOSIS_FEE.feeCode) return '0'
  if (나이 >= 6) return '0'
  if (나이 >= 1) return '6'
  const 신생아침술 = category === 침술카테고리 && daysBetween(birthDate, 진료일) <= 신생아최대생후일수
  return 신생아침술 ? '1' : '3'
}
