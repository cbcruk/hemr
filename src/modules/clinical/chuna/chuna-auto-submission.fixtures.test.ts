import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Coverage } from '../../../shared/coverage.ts'
import { isoDate } from '../fees/legacy-fixture.ts'
import { DEFAULT_CHUNA_LIMITS } from './chuna-annual-limit.ts'
import {
  chunaAutoSubmission,
  chunaSubmissionPayload,
  precheckOutcome,
  matchHiraChunaSubmission,
  submissionResultOutcome,
} from './chuna-auto-submission.ts'
import type {
  ChunaAutoSubmissionDecision,
  ChunaCreateResult,
  ChunaSubmissionLine,
  ChunaSubmissionOutcome,
  ChunaSubmissionPayload,
  HiraChunaSubmissionRow,
} from './chuna-auto-submission.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/chuna-auto-approval.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행은 진료 완료 뒤 클라이언트가 한 번에 제출했고, 서버는 완료 때 큐 조건만 보고 작업을 만든 뒤 에이전트가
 * 페이로드 검증·기제출 확인·제출을 합니다 (결정 3). 테스트는 이 단계를 차례로 이어 현행 부수효과와 비교합니다.
 * 현행과 기대값이 다른 케이스는 `CHANGED`에 결정 번호와 함께 적었습니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/chuna-auto-approval.json'), 'utf8'),
) as { cases: FixtureCase[] }

const COVERAGE: Record<string, Coverage> = { 건보: 'NHIS', 급여: 'MEDICAL_AID', 자보: 'AUTO_INSURANCE' }

/** 현행 픽스처의 요양기관기호입니다. 서버는 병원 설정에서 읽습니다. */
const CLINIC_CODE = '12345678'

interface PipelineResult {
  decision: ChunaAutoSubmissionDecision
  /** 심평원에 새로 제출한 내용(현행 형식)입니다. 기제출 건이 있거나 제출 전에 끝나면 없습니다. */
  submitted?: Record<string, unknown>
  outcome?: ChunaSubmissionOutcome
}

/** 큐 판정 → 페이로드 → 기제출 확인 → 제출을 이어 실행합니다. 심평원 응답은 픽스처 값입니다. */
function run(input: Record<string, any>): PipelineResult {
  const record = input['진료내용']
  const coverage = COVERAGE[record['보험구분']]!
  const serviceAt = { date: input['진료일시'].slice(0, 10), time: input['진료일시'].slice(11, 16) }
  const lines: ChunaSubmissionLine[] = (record['처방'] as any[]).map((line) => ({
    lineId: line['id'],
    feeCode: line['수가코드'] ?? null,
    category: line['카테고리숫자코드'],
    approved: line['승인여부'],
    performerId: line['시술진료의Id'] ?? null,
  }))
  const exhausted = input['추나횟수소진']
  // 현행 소진 `undefined`·로딩 중·조회 오류는 서버에서 저장된 사용량이 없는 상태입니다
  const usageUnknown = exhausted === undefined || input['isLoading'] || input['isError']
  const decision = chunaAutoSubmission({
    coverage,
    serviceAt,
    autoSubmit: input['autoApproveSetting'],
    lines,
    hiraUsage: usageUnknown
      ? null
      : {
          rows: (input['조회목록'] as any[]).map((row) => ({
            serviceDate: row['시술일'].slice(0, 10),
            deleted: row['삭제여부'],
            ownClinic: row['본원'],
          })),
          // 소진이면 누적을 한도값으로 둡니다. 이 케이스의 조회목록은 비어 있습니다
          cumulativeCount: exhausted ? DEFAULT_CHUNA_LIMITS.NHIS! : null,
          complete: true,
        },
    // 현행 제출 잠금은 같은 날 진행 중인 제출이 있다는 뜻입니다
    sameDaySubmissions: input['lockAvailable'] === false ? ['SUBMITTED'] : [],
  })
  if (decision.action === 'SKIP') return { decision }

  const lookup = record['보험조회']
  const doctors = (input['doctorList'] as any[]).map((doctor) => ({
    doctorId: doctor['진료의Id'],
    licenseNumber: doctor['면허번호'] ?? null,
  }))
  const diagnosisCodes = (record['상병'] as any[]).map((diagnosis) => diagnosis['상병코드'])
  const built = chunaSubmissionPayload({
    clinicCode: CLINIC_CODE,
    coverage,
    serviceAt,
    patient: {
      name: input['patient']['이름'],
      rrnFront: input['patient']['주민등록번호앞자리'],
      rrnBack: input['patient']['주민등록번호뒷자리'],
    },
    diagnosisCodes,
    line: queuedLine(lines, decision.lineId),
    defaultPerformerId: input['기본시술자Id'] ?? null,
    doctors,
    eligibility:
      coverage === 'AUTO_INSURANCE' || lookup === undefined
        ? null
        : {
            qualification: lookup['자격여부'] ?? null,
            disabled: lookup['장애여부'] === 'Y',
            nearPoverty: lookup['차상위대상자'] ?? null,
            rareDiseaseSupportTarget: lookup['희귀난치의료비지원대상자'] ?? null,
          },
    accidentNumber: lookup?.['사고접수번호'] ?? null,
    rareDiseaseSupport: false,
  })
  if ('failure' in built) return { decision, outcome: { status: 'FAILED', reason: built.failure } }

  const existing = input['제출건조회']
  const found =
    existing === 'throw'
      ? ('UNAVAILABLE' as const)
      : existing === null
        ? null
        : { diagnosisCodes: existing['상병기호'], licenseNumber: existing['의사면허번호'] ?? null }
  const checked = precheckOutcome(found, diagnosisCodes, doctors)
  if (checked !== null) return { decision, outcome: checked }
  const created = input['createResult'] as [unknown, unknown] | null
  // 현행 제출 오류는 심평원 응답의 오류라 거부로 봅니다
  const result: ChunaCreateResult =
    created === null || (!created[1] && created[0])
      ? { ok: true }
      : { ok: false, kind: 'REJECTED', reason: String(created[1]) }
  return {
    decision,
    submitted: legacyPayload(built.payload),
    outcome: submissionResultOutcome(result, built.performer),
  }
}

function queuedLine(lines: readonly ChunaSubmissionLine[], lineId: string): ChunaSubmissionLine & { feeCode: string } {
  const line = lines.find((each) => each.lineId === lineId)
  if (!line?.feeCode) throw new Error(`queued line ${lineId} has no fee code`)
  return { ...line, feeCode: line.feeCode }
}

/** 서버 페이로드를 현행 심평원 요청 형식으로 바꿉니다. 에이전트가 하는 변환입니다. */
function legacyPayload(payload: ChunaSubmissionPayload): Record<string, unknown> {
  const legacy: Record<string, unknown> = {
    요양기관기호: payload.clinicCode,
    수진자명: payload.patientName,
    수진자주민등록번호: payload.rrn,
    의사면허번호: payload.licenseNumber,
    상병기호: payload.diagnosisCodes,
    진료일자: payload.serviceDate.replaceAll('-', ''),
    보험자구분코드: payload.insurerType,
  }
  if (payload.medicalAidType !== undefined) legacy['의료급여종별코드'] = payload.medicalAidType
  legacy['수가코드'] = payload.feeCodes
  if (payload.accidentNumber !== undefined) legacy['사고접수번호'] = payload.accidentNumber
  if (payload.benefitCategory !== undefined) legacy['공상구분코드'] = payload.benefitCategory
  return legacy
}

/**
 * 현행 부수효과를 서버 결과로 옮깁니다. 아무것도 하지 않은 케이스의 건너뛴 사유는 현행 코드 경로로 정한
 * `SKIP_REASON`에서 가져옵니다.
 */
function legacyResult(name: string, actions: any[][]): PipelineResult {
  const queued = actions.some(([kind]) => kind === 'fetch제출건조회')
  if (!queued) return { decision: { action: 'SKIP', reason: SKIP_REASON[name]! } }
  const approve = actions.find(([kind]) => kind === '승인상태반영')
  const create = actions.find(([kind]) => kind === 'createChunaData')
  if (approve === undefined) throw new Error(`${name}: queued without approval; add it to CHANGED`)
  const result: PipelineResult = { decision: { action: 'QUEUE', lineId: approve[1]['id'] } }
  if (create !== undefined) result.submitted = create[1]
  const performer = approve[2]
  result.outcome = {
    status: 'APPROVED',
    performer: performer ? { doctorId: performer['시술자Id'], licenseNumber: performer['면허번호'] } : null,
  }
  return result
}

/** 현행이 아무것도 하지 않은 케이스가 어느 조건에서 멈췄는지입니다. */
const SKIP_REASON: Record<string, 'POLICY_OFF' | 'ANNUAL_LIMIT' | 'SAME_DAY' | 'NO_UNAPPROVED_LINE'> = {
  'policy flag off -> no-op': 'POLICY_OFF',
  'annual limit exhausted -> warning, no submission': 'ANNUAL_LIMIT',
  'same-day row already in history -> silent skip': 'SAME_DAY',
  'no unapproved chuna line -> no-op': 'NO_UNAPPROVED_LINE',
  'processing lock held -> silent skip': 'SAME_DAY',
}

function caseNamed(name: string): FixtureCase {
  return fixture.cases.find((testCase) => testCase.name === name)!
}

const HAPPY_NAME = 'happy path 건보: submits to HIRA and marks approved'
const happy = (): PipelineResult => legacyResult(HAPPY_NAME, caseNamed(HAPPY_NAME).expected['actions'])
const queued: ChunaAutoSubmissionDecision = { action: 'QUEUE', lineId: 'rx1' }
type FailedReason = Extract<ChunaSubmissionOutcome, { status: 'FAILED' }>['reason']
const failed = (reason: FailedReason): PipelineResult => ({ decision: queued, outcome: { status: 'FAILED', reason } })

/** 결정으로 기대값이 바뀐 케이스입니다. */
const CHANGED: Record<string, () => PipelineResult> = {
  // 설계: 에이전트가 처리하므로 웹에서 완료해도 작업을 만듭니다 (claims.md 심평원 사전 제출)
  'not Electron (web) -> no-op': happy,
  // 설계: 저장된 사용량이 없으면(조회 전·조회 실패) 한도·당일 이력을 모르는 것으로 보고 진행합니다
  'chuna history still loading -> no-op': happy,
  'chuna history lookup error -> no-op': happy,
  // 결정 1: 삭제(취소)된 이력만 있으면 다시 제출합니다
  'same-day row that is deleted still skips (no 삭제여부 check)': happy,
  // 결정 3: 페이로드 검증 실패는 완료를 막지 않고 작업을 `FAILED`로 남깁니다
  'no diagnoses -> error toast': () => failed('DIAGNOSIS_MISSING'),
  'performer has no license -> error toast': () => failed('LICENSE_MISSING'),
  '자보 without accident number -> error toast': () => failed('ACCIDENT_NUMBER_MISSING'),
  '건보 without 보험조회 -> error toast': () => failed('ELIGIBILITY_MISSING'),
  // 결정 3: 기제출 조회가 실패하면 조용히 넘기지 않고 `FAILED`로 남겨 현황에서 다시 냅니다
  'pre-check lookup throws -> skip': () => failed('PRECHECK_UNAVAILABLE'),
  // 결정 3: 심평원 거부는 사유와 함께 `REJECTED`입니다
  'submission returns error -> error toast': () => {
    const { submitted } = happy()
    return { decision: queued, submitted: submitted!, outcome: { status: 'REJECTED', reason: 'fail' } }
  },
  // 결정 4: 상병이 다르면 `DIAGNOSIS_MISMATCH`로 남겨 삭제 후 재제출을 안내합니다
  'already submitted at HIRA but diagnoses differ -> nothing': () => failed('DIAGNOSIS_MISMATCH'),
}

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {}

function toSubmissionRow(legacy: Record<string, any>): HiraChunaSubmissionRow {
  return {
    serviceDate: isoDate(legacy['진료일자']),
    patientName: legacy['수진자명'],
    birthDate: legacy['수진자생년월일'],
    sex: legacy['수진자성별'],
    insurerType: legacy['보험자구분코드'],
    accidentNumber: legacy['사고접수번호'] ?? '',
    deleted: legacy['삭제여부'] === 'Y',
    serialNumber: Number(legacy['일련번호']),
  }
}

const submissionCases = fixture.cases.filter(
  (testCase) => testCase.input['kind'] === undefined && !(testCase.name in NOT_PORTED),
)

describe('chuna-auto-approval fixture', () => {
  describe('auto submission (autoApproveChuna, 결정 1·2·3·4·5)', () => {
    it.each(submissionCases.map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const want = CHANGED[name]?.() ?? legacyResult(name, expected['actions'])
      expect(run(input)).toEqual(want)
    })
  })

  describe('existing submission match (B)', () => {
    const matchCases = fixture.cases.filter((testCase) => testCase.input['kind'] === 'matchSubmission')
    it.each(matchCases.map((c) => [c.name, c] as const))('%s', (_name, { input, expected }) => {
      const key = input['key']
      const match = matchHiraChunaSubmission((input['rows'] as any[]).map(toSubmissionRow), {
        serviceDate: isoDate(key['진료일']),
        patientName: key['환자명'],
        birthDate: key['생년월일'],
        sex: key['성별'],
        insurerType: key['보험자구분코드'],
        accidentNumber: key['사고접수번호'] ?? '',
      })
      expect(match).toEqual(expected['match'] === null ? null : toSubmissionRow(expected['match']))
    })
  })

  it('accounts for every fixture case', () => {
    const unaccounted = fixture.cases.filter(
      (testCase) =>
        !(testCase.name in NOT_PORTED) &&
        testCase.input['kind'] !== 'matchSubmission' &&
        testCase.input['kind'] !== undefined,
    )
    expect(unaccounted.map((testCase) => testCase.name)).toEqual([])
    for (const names of [Object.keys(NOT_PORTED), Object.keys(CHANGED), Object.keys(SKIP_REASON)]) {
      expect(names.filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    }
  })
})
