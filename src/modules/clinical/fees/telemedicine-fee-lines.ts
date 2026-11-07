import type { Coverage } from '../../../shared/coverage.ts'
import { weekdayIndex } from '../../../shared/time/calendar.ts'
import { CONSULTATION_CATEGORY, claimTimestamp, consultationFeeCodes, decodeFeeCode } from './consultation-fee-code.ts'
import type { ConsultationContext, ServiceAt } from './consultation-fee-code.ts'
import { isConsultationFee } from './fee-kinds.ts'
import { lineAmount } from './procedure-fee-modifiers.ts'
import type { FeeMasterRow } from './procedure-fee-modifiers.ts'

/** 비대면 관리료 수가코드입니다. 주간·야간·심야·공휴입니다. */
export type TelemedicineFeeCode = '91001' | '91002' | '91003' | '91004'

const 비대면관리료코드: ReadonlySet<string> = new Set(['91001', '91002', '91003', '91004'])

/**
 * 관리료 시간대 경계(`HH:mm`)입니다. 병원 설정이 아니라 고시 시간대입니다 (결정 2). 참조데이터 `regulatory-limits`에
 * 유효기간과 함께 둘 값이고, 그 전까지 이 초기값을 씁니다.
 */
export interface TelemedicineFeeHours {
  /** 이 시각 전은 심야입니다. */
  lateNightEnd: string
  /** 이 시각부터 주간입니다. 그 전은 야간입니다. */
  daytimeStart: string
  daytimeEnd: string
  saturdayDaytimeEnd: string
  /** 주간이 끝난 뒤 이 시각 전까지 야간, 그 뒤는 심야입니다. */
  nightEnd: string
}

export const DEFAULT_TELEMEDICINE_FEE_HOURS: TelemedicineFeeHours = {
  lateNightEnd: '07:00',
  daytimeStart: '09:00',
  daytimeEnd: '18:00',
  saturdayDaytimeEnd: '13:00',
  nightEnd: '20:00',
}

/** 비대면 관리료 줄인지입니다. `91000…` 코드는 관리료가 아닙니다 (결정 6). */
export function isTelemedicineFeeCode(feeCode: string | null): boolean {
  return feeCode !== null && 비대면관리료코드.has(feeCode)
}

/** 진료 시각의 관리료 수가코드입니다. 공휴일이나 일요일이면 공휴 `91004`입니다. */
export function telemedicineFeeCode(
  serviceAt: ServiceAt,
  publicHolidays: ReadonlySet<string>,
  hours: TelemedicineFeeHours = DEFAULT_TELEMEDICINE_FEE_HOURS,
): TelemedicineFeeCode {
  const 요일 = weekdayIndex(serviceAt.date)
  if (publicHolidays.has(serviceAt.date) || 요일 === 0) return '91004'
  const time = serviceAt.time
  const 주간종료 = 요일 === 6 ? hours.saturdayDaytimeEnd : hours.daytimeEnd
  if (time < hours.lateNightEnd) return '91003'
  if (time < hours.daytimeStart) return '91002'
  if (time < 주간종료) return '91001'
  if (time < hours.nightEnd) return '91002'
  return '91003'
}

/**
 * 새 관리료 줄입니다. 단가는 진료일 수가 마스터의 값을 줄에 고정합니다 (결정 1). 마스터에 없으면 `null`이고,
 * 호출하는 쪽이 422 `REFERENCE_DATA_UNAVAILABLE`로 거부합니다.
 */
export function telemedicineFeeLine(
  serviceAt: ServiceAt,
  publicHolidays: ReadonlySet<string>,
  feeMaster: ReadonlyMap<string, FeeMasterRow>,
  hours: TelemedicineFeeHours = DEFAULT_TELEMEDICINE_FEE_HOURS,
): TelemedicineLine | null {
  const 관리료코드 = telemedicineFeeCode(serviceAt, publicHolidays, hours)
  const 마스터행 = feeMaster.get(관리료코드)
  return 마스터행 === undefined ? null : 마스터값반영(새처방줄(관리료코드), 관리료코드, 마스터행)
}

/** 비대면 진료 토글에 쓰는 내원 정보입니다. */
export interface TelemedicineEligibility {
  coverage: Coverage
  /** 한방첩약 시범사업 대상인지입니다. */
  herbalPilot: boolean
  /** 방문진료 대상 구분이 있거나 방문진료료 처방이 있는지입니다. */
  homeVisit: boolean
  /** 지금 비대면 진료로 지정돼 있는지입니다. */
  telemedicine: boolean
}

/**
 * 비대면 진료로 바꿀 수 있는지입니다 (결정 8).
 *
 * 건보·의료급여이고 첩약 시범사업·방문진료가 아니면 켤 수 있습니다. 이미 켜진 건보·의료급여 진료는 계속 보여 줘서 끌
 * 수 있게 합니다. 서버는 조건 밖에서 켜는 요청을 422로 거부하고, 끄는 요청은 늘 받습니다.
 */
export function telemedicineToggleAvailable(input: TelemedicineEligibility): boolean {
  const 건보의료급여 = input.coverage === 'NHIS' || input.coverage === 'MEDICAL_AID'
  return 건보의료급여 && (input.telemedicine || (!input.herbalPilot && !input.homeVisit))
}

/** 비대면 지정을 바꾸는 요청이 허용되는지입니다. 끄는 요청은 늘 허용합니다 (결정 8). */
export function telemedicineChangeAllowed(current: TelemedicineEligibility, next: boolean): boolean {
  if (!next || current.telemedicine) return true
  return telemedicineToggleAvailable(current)
}

/** 처방 줄입니다. 관리료·진찰료를 다시 계산할 때 쓰는 값만 둡니다. */
export interface TelemedicineLine {
  lineId?: string
  feeCode: string
  category: string
  name: string
  unitPrice: number
  amount: number
  dailyDose: number
  days: number
  lineDetails?: { kind: string; content: string }[]
}

export interface TelemedicineLinesInput extends Omit<
  ConsultationContext,
  'telemedicine' | 'forceSaturday' | 'proxyReceipt'
> {
  telemedicine: boolean
  /** 자보 1일 2차 진료면 다시 계산하지 않습니다 (결정 7). */
  autoInsuranceSecondVisit: boolean
  lines: readonly TelemedicineLine[]
  /** 진료일 기준 수가 마스터입니다. 진찰료와 관리료 단가를 여기서 가져옵니다 (결정 1). */
  feeMaster: ReadonlyMap<string, FeeMasterRow>
  hours?: TelemedicineFeeHours
}

/**
 * 다시 계산한 줄이거나, 비대면 진료의 진찰료·관리료 코드가 진료일 수가 마스터에 없다는 오류(422)입니다 (결정 1·5).
 * 대면 진료의 진찰료 코드가 마스터에 없으면 consultation-fee-code와 같이 줄을 그대로 두고 경고합니다.
 */
export type TelemedicineLinesResult =
  | { lines: TelemedicineLine[]; warnings: { code: 'FEE_CODE_NOT_IN_MASTER'; feeCodes: string[] }[] }
  | { error: 'REFERENCE_DATA_UNAVAILABLE'; feeCodes: string[] }

/**
 * 진찰료와 비대면 관리료 줄을 다시 계산합니다. 진료 저장에서 `serviceAt`·비대면 여부·진찰료 줄이 바뀌면 같은 요청
 * 안에서 부릅니다 (결정 7).
 *
 * 1. 자보 1일 2차 진료면 바꾸지 않습니다
 * 2. 진찰료 줄이 없으면 관리료 줄만 지웁니다
 * 3. 진찰료 코드를 다시 정합니다. 비대면이면 가산 없는 기본코드 하나, 대면이면 가산·토요 쌍입니다 (결정 4).
 *    같은 자리의 기존 줄은 ID를 유지하고 이름·단가는 진료일 마스터 값으로 맞춥니다
 * 4. 비대면이면 관리료를 한 줄만 둡니다. 기존 관리료 줄이 있으면 첫 줄을 고쳐 쓰고 나머지는 지웁니다 (결정 3)
 * 5. 비대면 진료에서 계산한 코드가 마스터에 없으면 줄을 그대로 두지 않고 `REFERENCE_DATA_UNAVAILABLE`입니다
 *    (결정 1·5). 대면 진료면 진찰료 줄을 그대로 두고 `FEE_CODE_NOT_IN_MASTER` 경고를 줍니다. 저장은 통과하고 완료는
 *    막아, 비대면을 끄는 요청이 422로 막히지 않게 합니다 (결정 8)
 *
 * 결과 줄은 입력 줄 객체를 얕게 복사하므로 `lineDetails` 배열은 바뀐 줄에서만 새로 만듭니다.
 *
 * 줄 순서는 진찰료, 나머지 처방, 관리료입니다.
 */
export function reconcileTelemedicineLines(input: TelemedicineLinesInput): TelemedicineLinesResult {
  if (input.autoInsuranceSecondVisit) return { lines: [...input.lines], warnings: [] }
  const 진찰료줄 = input.lines.filter((line) => isConsultationFee(line.feeCode))
  const 관리료줄 = input.lines.filter((line) => isTelemedicineFeeCode(line.feeCode))
  const 나머지줄 = input.lines.filter((line) => !진찰료줄.includes(line) && !관리료줄.includes(line))
  if (진찰료줄.length === 0) return { lines: 나머지줄, warnings: [] }

  const 기본코드 = 진찰료줄.some((line) => line.feeCode.startsWith('10100')) ? '10100' : '10200'
  const 진찰료코드 = consultationFeeCodes(기본코드, input)
  const 관리료코드 = input.telemedicine ? telemedicineFeeCode(input.serviceAt, input.publicHolidays, input.hours) : null
  const 계산한코드 = [...진찰료코드, ...(관리료코드 === null ? [] : [관리료코드])]
  const 마스터누락코드 = 계산한코드.filter((수가코드) => !input.feeMaster.has(수가코드))
  if (마스터누락코드.length > 0 && input.telemedicine) {
    return { error: 'REFERENCE_DATA_UNAVAILABLE', feeCodes: 마스터누락코드 }
  }
  if (마스터누락코드.length > 0) {
    return {
      lines: [...진찰료줄, ...나머지줄],
      warnings: [{ code: 'FEE_CODE_NOT_IN_MASTER', feeCodes: 마스터누락코드 }],
    }
  }

  const 새진찰료줄 = 진찰료코드.map((수가코드, index) => {
    const 기존줄 = 진찰료줄[index]?.feeCode === 수가코드 ? 진찰료줄[index] : undefined
    const line = 마스터값반영(기존줄 ?? 새처방줄(수가코드), 수가코드, input.feeMaster.get(수가코드)!)
    // 야간 특정내역 `JS010`만 다시 정하고 다른 특정내역은 남깁니다
    const 특정내역 = (line.lineDetails ?? []).filter((detail) => detail.kind !== 'JS010')
    if (index === 0 && decodeFeeCode(수가코드).night) {
      특정내역.unshift({ kind: 'JS010', content: claimTimestamp(input.serviceAt) })
    }
    if (특정내역.length > 0) line.lineDetails = 특정내역
    else delete line.lineDetails
    return line
  })
  if (관리료코드 === null) return { lines: [...새진찰료줄, ...나머지줄], warnings: [] }

  const 기존관리료줄 = 관리료줄[0]
  const 마스터행 = input.feeMaster.get(관리료코드)!
  // 첫 관리료 줄의 코드·단가·금액만 새 값으로 바꿉니다. 이름은 사용자가 고쳤을 수 있어 그대로 둡니다
  const 새관리료줄 =
    기존관리료줄 === undefined
      ? 마스터값반영(새처방줄(관리료코드), 관리료코드, 마스터행)
      : {
          ...기존관리료줄,
          feeCode: 관리료코드,
          unitPrice: 마스터행.unitPrice,
          amount: lineAmount(마스터행.unitPrice, 기존관리료줄.dailyDose, 기존관리료줄.days),
        }
  return { lines: [...새진찰료줄, ...나머지줄, 새관리료줄], warnings: [] }
}

function 새처방줄(feeCode: string): TelemedicineLine {
  return { feeCode, category: CONSULTATION_CATEGORY, name: '', unitPrice: 0, amount: 0, dailyDose: 1, days: 1 }
}

function 마스터값반영(line: TelemedicineLine, feeCode: string, 마스터행: FeeMasterRow): TelemedicineLine {
  return {
    ...line,
    feeCode,
    name: 마스터행.claimName || 마스터행.name,
    unitPrice: 마스터행.unitPrice,
    amount: lineAmount(마스터행.unitPrice, line.dailyDose, line.days),
  }
}
