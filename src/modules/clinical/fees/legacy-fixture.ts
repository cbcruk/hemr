// 현행 픽스처의 입력을 서버 입력으로 바꾸는 테스트 도우미입니다. 서버 코드에서는 쓰지 않습니다.

import type { ServiceAt } from './consultation-fee-code.ts'
import type { ProcedureContext, ProcedureLine } from './procedure-fee-modifiers.ts'

/** `yyyyMMdd`를 `YYYY-MM-DD`로 바꿉니다. */
export function isoDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}

/** `yyyyMMddHHmm`을 진료 시각으로 바꿉니다. */
export function serviceAt(yyyymmddhhmm: string): ServiceAt {
  return { date: isoDate(yyyymmddhhmm), time: `${yyyymmddhhmm.slice(8, 10)}:${yyyymmddhhmm.slice(10, 12)}` }
}

/**
 * 주민번호 앞자리와 뒷자리 첫 글자로 생년월일을 만듭니다. 서버는 환자의 생년월일을 갖고 있으므로 이 변환은
 * 픽스처 이전에만 씁니다. 없는 날짜(13월 등)나 빈 값은 `null`입니다.
 */
export function birthDateFromRrn(front: string, back: string): string | null {
  if (!/^\d{6}$/.test(front) || !/^\d/.test(back)) return null
  const century = { '1': 1900, '2': 1900, '5': 1900, '6': 1900, '3': 2000, '4': 2000, '7': 2000, '8': 2000 }[back[0]!]
  const year = (century ?? 1800) + Number(front.slice(0, 2))
  const date = `${year}-${front.slice(2, 4)}-${front.slice(4, 6)}`
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date
}

/** 현행 `JLt` 입력을 시술 줄과 문맥으로 바꿉니다. 플래그가 여러 개면 현행처럼 마지막에 검사한 값이 이깁니다. */
export function procedureFromLegacy(input: Record<string, any>): { line: ProcedureLine; context: ProcedureContext } {
  const line: ProcedureLine = {
    feeCode: input['처방']['수가코드'],
    category: input['처방']['카테고리숫자코드'],
  }
  const method = lastFlag(input, {
    자락도침산침술법: 'PRICKING',
    사암오행체질침법: 'CONSTITUTIONAL',
    화침온침: 'WARMING',
  })
  if (method !== undefined) line.acupunctureMethod = method
  const time = lastFlag(input, { 토요주간임: 'SATURDAY_DAYTIME', 야간임: 'NIGHT', 공휴일임: 'HOLIDAY' })
  if (time !== undefined) line.timeSurcharge = time
  if (input['산정코드재설정'] === true) line.feeCodeComputed = true
  return {
    line,
    context: {
      serviceAt: serviceAt(input['기준일시']),
      birthDate: birthDateFromRrn(input['주민번호앞자리'] ?? '', input['주민번호뒷자리'] ?? ''),
      ageSurcharge: input['설정']['연령에따른시술료가산적용여부'],
    },
  }
}

function lastFlag<T extends string>(input: Record<string, any>, flags: Record<string, T>): T | undefined {
  return Object.entries(flags).findLast(([flag]) => input[flag] === true)?.[1]
}
