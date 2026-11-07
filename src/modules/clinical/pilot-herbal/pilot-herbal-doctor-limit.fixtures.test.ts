import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { judgePilotHerbalDiagnosis, pilotHerbalHistoryRow } from './pilot-herbal-diagnosis-limit.ts'
import {
  applyPilotHerbalDoctorLimit,
  exceededPilotHerbalDoctorPeriod,
  pilotHerbalDoctorLimitMessage,
  remainingPilotHerbalDoctorQuota,
} from './pilot-herbal-doctor-limit.ts'
import type { PilotHerbalDoctorCounts } from './pilot-herbal-doctor-limit.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/pilot-herbal-doctor-limit.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 횟수 `{일, 월, 년}`은 현재 진료를 포함한 순번으로 읽습니다 (결정 2). 본인부담률 코드 케이스는 질환 이력
 * 판정(`judgePilotHerbalDiagnosis`)에 의사별 한도를 더한 결과로 비교합니다. 현행과 기대값이 다른 케이스는
 * `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/pilot-herbal-doctor-limit.json'), 'utf8'),
) as { cases: FixtureCase[] }

function toCounts(legacy: Record<string, number>): PilotHerbalDoctorCounts {
  return { day: legacy['일']!, month: legacy['월']!, year: legacy['년']! }
}

function fromCounts(counts: PilotHerbalDoctorCounts) {
  return { 일: counts.day, 월: counts.month, 년: counts.year }
}

/** 본인부담률 판정을 현행 반환 모양으로 줄입니다. */
function resolveCopay(input: Record<string, any>) {
  const lineIds = ['h1']
  const judgement = judgePilotHerbalDiagnosis({
    diseaseCode: input['code'],
    lineIds,
    history:
      input['history'] === undefined
        ? null
        : (input['history'] as any[]).map((row) =>
            pilotHerbalHistoryRow({
              diseaseCode: row['첩약상병구분코드'],
              registration: row['해당요양기관등록여부'],
              cumulativeDays: row['누적투약일수'],
            }),
          ),
  })
  if ('error' in judgement) return judgement
  const result = applyPilotHerbalDoctorLimit(judgement, lineIds, { counts: toCounts(input['counts']) })
  return { 첩건본인부담률구분코드: result.copayCode, 본인일부부담이지만전액부담선택가능함: result.fullPayOptional }
}

const RUN: Record<string, (input: Record<string, any>) => unknown> = {
  exceedsDoctorLimit: (input) => exceededPilotHerbalDoctorPeriod(toCounts(input['counts'])) !== null,
  remainingDoctorQuota: (input) => fromCounts(remainingPilotHerbalDoctorQuota(toCounts(input['counts']))),
  doctorLimitMessage: (input) => {
    const period = exceededPilotHerbalDoctorPeriod(toCounts(input['counts']))
    return period === null ? '' : pilotHerbalDoctorLimitMessage({ period })
  },
  resolveCopayCode: resolveCopay,
}

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, unknown> = {
  // 결정 5: 의사별 한도는 질환 이력과 따로 판정해, 이력을 받지 못했어도 한도를 넘으면 `U`입니다
  'copay: history not loaded returns undefined even when over limit': {
    첩건본인부담률구분코드: 'U',
    본인일부부담이지만전액부담선택가능함: false,
  },
}

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  "numeric strings are coerced: day '9' exceeds": '서버는 횟수를 정수로 셉니다. 문자열 횟수가 없습니다',
  'missing fields never exceed': '서버는 하루·월·연 횟수를 모두 셉니다. 빠진 필드가 없습니다',
  'message: counts not loaded': '서버는 판정 전에 횟수를 셉니다. 불러오는 중 상태가 없습니다',
  'copay: counts not loaded returns undefined (no change)':
    '서버는 판정 전에 횟수를 셉니다. 불러오는 중 상태가 없습니다',
  'copay: no disease code returns undefined':
    '첩약 시범사업 처방의 질환 코드는 요청 스키마의 필수 값이라 빈 값이 없습니다',
}

describe('첩약 의사별 한도 픽스처 (pilot-herbal-doctor-limit)', () => {
  const ported = fixture.cases.filter((testCase) => !(testCase.name in NOT_PORTED))

  it.each(ported.map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
    expect(RUN[input['function']]!(input)).toEqual(name in CHANGED ? CHANGED[name] : expected['returned'])
  })

  it('모든 픽스처 케이스의 함수를 실행하고 예외 목록은 있는 케이스만 가리킵니다', () => {
    expect(fixture.cases.filter((c) => !(c.input['function'] in RUN)).map((c) => c.name)).toEqual([])
    expect(Object.keys(NOT_PORTED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
