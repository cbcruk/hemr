import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Coverage } from '../../../shared/coverage.ts'
import { judgeDuplicateConsultationFee, telemedicineDuplicateIssues } from './duplicate-consultation-fee.ts'
import type { ConsultationEncounter } from './duplicate-consultation-fee.ts'
import { serviceAt } from './legacy-fixture.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/duplicate-consultation-fee.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 확인창은 위반으로, "이대로 저장"은 `acknowledge`로, "진찰료 정리하기"는 확인 없이 완료가 막히는 것으로
 * 옮깁니다. 확인창 문구의 두 갈래는 `paidEncounterIds`가 비었는지로 검사합니다.
 * 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/duplicate-consultation-fee.json'), 'utf8'),
) as { cases: FixtureCase[] }

const COVERAGE: Record<string, Coverage> = {
  건보: 'NHIS',
  급여: 'MEDICAL_AID',
  자보: 'AUTO_INSURANCE',
  산재: 'INDUSTRIAL_ACCIDENT',
}

const PAID_WORDING = '이미 수납이 완료된 진료입니다. 진찰료를 제외하면 과수납금이 발생할 수 있습니다.'

function toEncounter(legacy: Record<string, any>, lines: any[], paidIds: Set<string>): ConsultationEncounter {
  return {
    encounterId: legacy['진료Id'],
    serviceAt: legacy['기준일시'] ? serviceAt(legacy['기준일시']) : null,
    telemedicine: legacy['비대면시범사업여부'] === true,
    feeCodes: lines.map((line) => line['수가코드']),
    paid: paidIds.has(legacy['진료Id']),
  }
}

function cases(kind: string): FixtureCase[] {
  return fixture.cases.filter((testCase) => testCase.input['kind'] === kind && !(testCase.name in NOT_PORTED))
}

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, unknown> = {
  // 결정 1: 같은 방식 중복도 위반입니다
  'two face-to-face encounters same day both with 진찰료 -> no dialog': { conflicts: ['ftf'], paid: [] },
  'two telemedicine encounters same day -> no dialog': { conflicts: ['tele'], paid: [] },
  // 서버는 오늘 대기 목록이 아니라 수납 기록을 보므로 지난 날짜도 수납 완료를 압니다
  "past date with paid record -> '가정' wording (today check fails)": { conflicts: ['tele'], paid: ['tele'] },
  // 결정 4: 확인하고 넘긴 중복은 현행 계산 결과(`rawWarnings`) 그대로 청구 명세서 이슈로 보여 줍니다
  'telemedicine with 진찰료 and same-day face-to-face 진찰료 -> T0004 raw, filtered from claim warnings': 'RAW',
}

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  'missing 기준일시 -> no dialog': '현재 진료의 `serviceAt`은 필수라 없는 상태가 없습니다',
}

describe('duplicate-consultation-fee fixture', () => {
  describe('save guard (Uh + validate, 결정 1·2·3·5)', () => {
    it.each(cases('saveGuard').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const paidIds = new Set<string>(
        (input['waitingPatientsData'] as any[]).filter((row) => row['상태'] === '수납완료').map((row) => row['진료Id']),
      )
      const current = toEncounter(input['현재진료'], input['현재진료']['처방'], paidIds)
      const choice = input['userChoice'] as boolean | null
      const result = judgeDuplicateConsultationFee({
        coverage: COVERAGE[input['보험구분']]!,
        current: { ...current, serviceAt: current.serviceAt! },
        others: (input['최근진료기록'] as any[]).map((record) => toEncounter(record, record['진료처방'], paidIds)),
        ...(choice === true ? { acknowledge: ['DUPLICATE_CONSULTATION_FEE'] as const } : {}),
      })
      // 확인창이 뜬 경우만 위반입니다. 자보·산재는 현행도 `Uh` 결과를 쓰지 않습니다
      const dialog = expected['dialog']
      const want = (CHANGED[name] ?? {
        conflicts: dialog === null ? [] : [expected['conflictingRecordId']],
        paid: dialog?.description === PAID_WORDING ? [expected['conflictingRecordId']] : [],
      }) as { conflicts: string[]; paid: string[] }

      const [violation] = [...result.warnings, ...result.acknowledged]
      expect(violation?.conflictingEncounterIds ?? []).toEqual(want.conflicts)
      expect(violation?.paidEncounterIds ?? []).toEqual(want.paid)
      // 확인창에서 고르지 않은 케이스는 확인을 받지 않은 것으로 봅니다
      expect(result.accepted).toBe(want.conflicts.length === 0 || choice === true)
    })
  })

  describe('telemedicine claim issue (ZBt T0004, 결정 4)', () => {
    it.each(cases('telemedicineClaimWarning').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const lines = input['현재진료']['진료처방'] as any[]
      const sameDay = { date: '2026-11-01', time: '09:00' }
      const issues = telemedicineDuplicateIssues({
        current: {
          encounterId: 'cur',
          serviceAt: { ...sameDay, time: '14:00' },
          telemedicine: input['현재진료']['비대면시범사업여부'] === true,
          feeCodes: lines.map((line) => line['수가코드']),
          paid: false,
        },
        lines: lines.map((line) => ({
          lineId: line['id'],
          feeCode: line['수가코드'],
          category: line['카테고리숫자코드'],
        })),
        // 현행 입력의 "같은 날 대면 진찰료 있음"을 같은 날 대면 진료 하나로 바꿉니다
        others:
          input['같은날대면진찰료있음'] === true
            ? [{ encounterId: 'ftf', serviceAt: sameDay, telemedicine: false, feeCodes: ['10200'], paid: false }]
            : [],
      })
      const source = CHANGED[name] === 'RAW' ? expected['rawWarnings'] : expected['shownInClaimWarnings']
      expect(issues).toEqual(
        (source as any[]).map((warning) => ({ code: warning['에러코드'], lineIds: warning['원인제공자Ids'] })),
      )
    })
  })

  it('accounts for every fixture case', () => {
    const ported = new Set(['saveGuard', 'telemedicineClaimWarning'])
    const unaccounted = fixture.cases.filter(
      (testCase) => !(testCase.name in NOT_PORTED) && !ported.has(testCase.input['kind']),
    )
    expect(unaccounted.map((testCase) => testCase.name)).toEqual([])
    expect(Object.keys(NOT_PORTED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    expect(Object.keys(CHANGED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
