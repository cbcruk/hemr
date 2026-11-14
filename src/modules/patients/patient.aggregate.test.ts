import { Result } from 'effect'
import { rejected, success } from '../../shared/decision/testing.ts'
import { describe, expect, it, vi } from 'vitest'
import type { DecisionContext } from '../../shared/decision/decision-context.ts'
import type { Id } from '../../shared/ids/ids.types.ts'
import { TEST_TENANT } from '../identity/auth/testing.ts'
import { decideRecordConsent, decideRegister, decideUpdate } from './patient.aggregate.ts'
import type { SealedRrn } from './patient.aggregate.ts'
import type { Consent, Contact, PatientRecord } from './patient.ts'

/**
 * 환자 판정 함수의 테스트입니다. given(저장한 환자와 동의 기록) / when(커맨드) / then(쓸 기록과 이벤트, 또는 거부)으로
 * 씁니다. 주민등록번호 암호화·차트 번호 채번·저장은 서비스 테스트(`patients.test.ts`)가 봅니다.
 */

const USER = 'usr_01JBQ000000000000000000001' as Id<'user'>
const context: DecisionContext = {
  at: '2026-11-13T01:00:00.000Z',
  today: '2026-11-13',
  tenantId: TEST_TENANT.id,
  userId: USER,
}
const PATIENT = 'pat_01JBQ000000000000000000001' as Id<'patient'>
/** 1990-01-01 남자의 번호입니다. 값은 지어낸 것입니다. */
const DIGITS = '9001011000000'
const sealedOf = (index: string): SealedRrn => ({
  rrnSealed: `sealed:${index}`,
  rrnIndex: index,
  rrnMasked: '900101-1******',
})
const NO_RRN: SealedRrn = { rrnSealed: null, rrnIndex: null, rrnMasked: null }
const mobile = (isPrimary: boolean): Contact => ({ kind: 'MOBILE', number: '010-0000-0000', isPrimary }) as Contact

const stored = (overrides: Partial<PatientRecord> = {}): PatientRecord => ({
  id: PATIENT,
  tenantId: TEST_TENANT.id,
  chartNumber: '000001',
  name: '홍길동',
  ...sealedOf('idx-1'),
  birthDate: '1990-01-01',
  isLunarBirthday: false,
  sex: 'MALE',
  contacts: [],
  addresses: [],
  notes: null,
  firstVisitDate: null,
  status: 'ACTIVE',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  version: 2,
  ...overrides,
})

describe('decideRegister', () => {
  it('이름의 공백을 지우고 비어 있는 생년월일·성별을 번호에서 채우며, 채번한 차트 번호로 생성 이벤트를 냅니다', () => {
    const then = success(
      decideRegister(
        { name: ' 홍길동 ', rrn: '900101-1000000' },
        PATIENT,
        { digits: DIGITS, sealed: sealedOf('idx-1') },
        context,
      ),
    )

    expect(then.record).toMatchObject({
      name: '홍길동',
      chartNumber: null,
      birthDate: '1990-01-01',
      sex: 'MALE',
      rrnIndex: 'idx-1',
      createdAt: context.at,
      version: 1,
    })
    expect(then.events(stored({ chartNumber: '000042' }))).toMatchObject([
      { type: 'patient.created', subject: PATIENT, data: { patientId: PATIENT, chartNumber: '000042' } },
    ])
  })

  it('대표 연락처가 둘이거나 생년월일이 번호와 다르면 위반을 모두 담아 400입니다', () => {
    rejected(
      decideRegister(
        { name: '홍길동', birthDate: '1991-01-01', contacts: [mobile(true), mobile(true)] },
        PATIENT,
        { digits: DIGITS, sealed: sealedOf('idx-1') },
        context,
      ),
      {
        _tag: 'ValidationFailed',
        violations: [
          { field: 'contacts', code: 'MULTIPLE_PRIMARY' },
          { field: 'birthDate', code: 'RRN_MISMATCH' },
        ],
      },
    )
  })

  it('없는 날짜는 번호와 비교하기 전에 거부합니다', () => {
    rejected(
      decideRegister({ name: '홍길동', birthDate: '2026-02-30' }, PATIENT, { digits: null, sealed: NO_RRN }, context),
      { _tag: 'ValidationFailed', violations: [{ field: 'birthDate', code: 'INVALID_VALUE' }] },
    )
  })
})

describe('decideUpdate', () => {
  it('바뀐 필드만 이름으로 남기고 버전을 올립니다', () => {
    const given = stored()

    const then = success(decideUpdate(given, { name: ' 홍길순 ', notes: '메모' }, 2, null, () => DIGITS, context))

    expect(then?.next).toMatchObject({ name: '홍길순', notes: '메모', updatedAt: context.at, version: 3 })
    expect(then?.event).toMatchObject({
      type: 'patient.updated',
      data: { patientId: PATIENT, fields: ['name', 'notes'] },
    })
  })

  it('바뀐 것이 없으면 쓰지 않고 주민등록번호도 열지 않습니다', () => {
    const open = vi.fn(() => DIGITS)

    expect(success(decideUpdate(stored(), { name: '홍길동' }, undefined, null, open, context))).toBeNull()
    expect(open).not.toHaveBeenCalled()
  })

  it('번호를 바꾸면 색인으로 비교해 `rrn`으로 적고, 지우면 생년월일과 비교하지 않습니다', () => {
    const changed = success(
      decideUpdate(
        stored(),
        { rrn: '900101-1000001' },
        2,
        { digits: '9001011000001', sealed: sealedOf('idx-2') },
        () => DIGITS,
        context,
      ),
    )
    const removed = success(
      decideUpdate(stored(), { rrn: null }, 2, { digits: null, sealed: NO_RRN }, () => DIGITS, context),
    )

    expect(changed?.event.data).toMatchObject({ fields: ['rrn'] })
    expect(removed?.next).toMatchObject({ rrnSealed: null, rrnIndex: null, rrnMasked: null })
  })

  it('생년월일만 바꿔도 지금 번호와 맞는지 봅니다', () => {
    const open = vi.fn(() => DIGITS)

    rejected(decideUpdate(stored(), { birthDate: '1991-01-01' }, 2, null, open, context), {
      _tag: 'ValidationFailed',
      violations: [{ field: 'birthDate', code: 'RRN_MISMATCH' }],
    })
    expect(open).toHaveBeenCalledOnce()
  })

  it('버전이 다르면 지금 버전을 담아 거부합니다', () => {
    rejected(
      decideUpdate(stored(), { name: '홍길순' }, 1, null, () => DIGITS, context),
      {
        _tag: 'VersionMismatch',
        currentVersion: 2,
      },
    )
  })
})

describe('decideRecordConsent', () => {
  const consent = (source: Consent['source'], status: Consent['status'], purpose = 'MARKETING'): Consent => ({
    purpose,
    status,
    source,
    decidedAt: '2026-11-01T00:00:00.000Z',
    decidedBy: USER,
    evidenceDocumentId: null,
  })

  it('직원이 기록한 동의는 출처가 데스크이고 동의 변경 이벤트를 냅니다', () => {
    const then = success(decideRecordConsent(PATIENT, [], { purpose: 'MARKETING', status: 'GRANTED' }, context))

    expect(then.consent).toMatchObject({ patientId: PATIENT, source: 'DESK', decidedAt: context.at, decidedBy: USER })
    expect(then.event).toMatchObject({
      type: 'consent.changed',
      data: { purpose: 'MARKETING', status: 'GRANTED', source: 'DESK' },
    })
  })

  it('080으로 거부한 목적은 직원이 동의로 되돌리지 못하고, 사이에 다른 기록을 끼워도 풀리지 않습니다', () => {
    const history = [consent('PATIENT_080', 'DENIED'), consent('DESK', 'UNDECIDED')]

    rejected(decideRecordConsent(PATIENT, history, { purpose: 'MARKETING', status: 'GRANTED' }, context), {
      _tag: 'ConsentLockedByPatient',
      purpose: 'MARKETING',
    })
    expect(
      success(decideRecordConsent(PATIENT, history, { purpose: 'MARKETING', status: 'DENIED' }, context)).consent
        .status,
    ).toBe('DENIED')
  })

  it('거부 뒤 환자 본인이 동의했거나 다른 목적이면 직원이 동의를 기록합니다', () => {
    const history = [
      consent('PATIENT_080', 'DENIED'),
      consent('TABLET', 'GRANTED'),
      consent('PATIENT_080', 'DENIED', 'SMS'),
    ]

    expect(
      Result.isSuccess(decideRecordConsent(PATIENT, history, { purpose: 'MARKETING', status: 'GRANTED' }, context)),
    ).toBe(true)
    expect(
      Result.isFailure(decideRecordConsent(PATIENT, history, { purpose: 'SMS', status: 'GRANTED' }, context)),
    ).toBe(true)
  })
})
