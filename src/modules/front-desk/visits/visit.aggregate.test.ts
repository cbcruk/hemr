import { Result } from 'effect'
import { describe, expect, it } from 'vitest'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { draftEncounter } from '../../clinical/encounters/encounter-draft.ts'
import type { Encounter } from '../../clinical/encounters/encounter.ts'
import { TEST_TENANT } from '../../identity/auth/testing.ts'
import type { Payment, ReceiptRecord } from '../receipts/receipt.ts'
import { testVisit } from './testing.ts'
import { eventContext } from '../../../shared/decision/decision-context.ts'
import type { DecisionContext } from '../../../shared/decision/decision-context.ts'
import { decideCancel, decideCheckIn, decideVisitStatus } from './visit.aggregate.ts'
import type { CheckInFacts } from './visit.aggregate.ts'
import type { Visit } from './visit.ts'

/**
 * 내원 판정 함수의 테스트입니다. given(지금 내원과 사실) / when(커맨드) / then(다음 내원과 이벤트, 또는 거부)으로 씁니다.
 * 저장·권한·동시성은 서비스 테스트(`visits.test.ts`, `check-in.test.ts`)가 봅니다.
 */

const AT = '2026-11-13T01:00:00.000Z'
const TODAY = '2026-11-13'
const USER = 'usr_01JBQ000000000000000000001' as Id<'user'>
const context: DecisionContext = { at: AT, today: TODAY, tenantId: TEST_TENANT.id, userId: USER }
const ENCOUNTER_ID = 'enc_01JBQ000000000000000000001' as Id<'encounter'>

const visit = (overrides: Partial<Visit> = {}) => testVisit({ date: TODAY, encounterId: ENCOUNTER_ID, ...overrides })

const emptyDraft = (of: Visit): Encounter =>
  draftEncounter({ ...of, encounterId: ENCOUNTER_ID }, eventContext(context)).encounter

const noData = { hasClinicalData: false }

/** 이벤트 ID는 판정할 때마다 새로 만들어 비교에서 뺍니다. */
const withoutIds = <T extends { id: unknown }>(events: ReadonlyArray<T>) => events.map(({ id: _, ...rest }) => rest)

const success = <A, E>(result: Result.Result<A, E>): A => {
  if (Result.isFailure(result)) throw new Error(`거부되었습니다: ${String(result.failure)}`)
  return result.success
}

const failure = <A, E>(result: Result.Result<A, E>): E => {
  if (Result.isSuccess(result)) throw new Error('거부되지 않았습니다')
  return result.failure
}

describe('decideVisitStatus', () => {
  it('대기 내원에 진료 시작을 보내면 진료 중이 되고 버전이 오르며 상태 변경 이벤트 하나를 냅니다', () => {
    const given = visit({ status: 'WAITING', version: 3 })

    const then = success(decideVisitStatus(given, 'START_TREATMENT', {}, noData, context))

    expect(then.visit).toMatchObject({ status: 'IN_TREATMENT', statusChangedAt: AT, version: 4 })
    expect(withoutIds(then.events)).toEqual([
      {
        type: 'visit.status_changed',
        subject: given.id,
        time: AT,
        tenantId: TEST_TENANT.id,
        actor: { kind: 'USER', id: USER },
        data: { visitId: given.id, patientId: given.patientId, from: 'WAITING', to: 'IN_TREATMENT' },
      },
    ])
  })

  it('다시 열고 이어서 옮기면 처음 상태에서 마지막 상태로 가는 이벤트 하나만 내고 사유를 남깁니다', () => {
    const given = visit({ status: 'COMPLETED' })

    const then = success(decideVisitStatus(given, 'REOPEN', { reason: '재수납', then: 'WAITING' }, noData, context))

    expect(then.visit).toMatchObject({ status: 'WAITING', statusReason: '재수납', version: given.version + 1 })
    expect(then.events.map((each) => each.data)).toEqual([
      { visitId: given.id, patientId: given.patientId, from: 'COMPLETED', to: 'WAITING' },
    ])
  })

  it('사유 없는 커맨드는 앞서 남긴 사유를 지웁니다', () => {
    const given = visit({ status: 'WAITING', statusReason: '재수납' })

    const then = success(decideVisitStatus(given, 'START_TREATMENT', {}, noData, context))

    expect(then.visit).not.toHaveProperty('statusReason')
  })

  it('지금 상태가 받지 않는 커맨드는 현재 상태와 커맨드를 담아 거부합니다', () => {
    const given = visit({ status: 'COMPLETED' })

    const then = failure(decideVisitStatus(given, 'START_TREATMENT', {}, noData, context))

    expect(then).toMatchObject({
      code: 'VISIT_TRANSITION_INVALID',
      currentStatus: 'COMPLETED',
      command: 'START_TREATMENT',
    })
  })

  it('지난 내원은 다시 열 수 있지만 이어서 진료 흐름으로 옮기는 단계가 거부되면 아무것도 바꾸지 않습니다', () => {
    const given = visit({ status: 'COMPLETED', date: '2026-11-12' })

    expect(success(decideVisitStatus(given, 'REOPEN', { reason: '정정' }, noData, context)).visit.status).toBe(
      'AWAITING_PAYMENT',
    )
    expect(
      failure(decideVisitStatus(given, 'REOPEN', { reason: '정정', then: 'WAITING' }, noData, context)),
    ).toMatchObject({ code: 'VISIT_DATE_PAST', date: '2026-11-12' })
  })
})

describe('decideCancel', () => {
  // 영수증의 내원·환자는 `visit()`과 같습니다
  const RECEIPT = {
    id: 'rcp_01JBQ000000000000000000001',
    visitId: visit().id,
    patientId: visit().patientId,
    date: TODAY,
    status: 'ACTIVE',
    voided: null,
    version: 4,
  } as unknown as ReceiptRecord
  const cash = {
    id: 'pay_01JBQ000000000000000000001',
    method: 'CASH',
    status: 'CAPTURED',
    amount: { taxable: 0, taxExempt: 10_000 },
    refunds: [],
    version: 1,
  } as unknown as Payment
  const card = { ...cash, id: 'pay_01JBQ000000000000000000002', method: 'CARD' } as unknown as Payment

  it('진료 내용이 없는 내원을 취소하면 빈 초안 진료를 같은 사유로 철회합니다', () => {
    const given = visit({ status: 'IN_TREATMENT' })
    const encounter = emptyDraft(given)

    const then = success(
      decideCancel(given, { reason: '환자 요청' }, { ...noData, encounter, activeReceipt: null }, context),
    )

    expect(then.visit).toMatchObject({ status: 'CANCELED', statusReason: '환자 요청' })
    expect(then.retracted).toMatchObject({
      encounter: {
        status: 'ENTERED_IN_ERROR',
        retraction: { reason: '환자 요청', retractedAt: AT, retractedBy: USER },
      },
      expectedVersion: encounter.version,
      event: { type: 'encounter.retracted' },
    })
    expect(then.voided).toBeNull()
  })

  it('이미 철회한 진료는 다시 철회하지 않습니다', () => {
    const given = visit({ status: 'WAITING' })
    const encounter: Encounter = { ...emptyDraft(given), status: 'ENTERED_IN_ERROR' }

    const then = success(
      decideCancel(given, { reason: '취소' }, { ...noData, encounter, activeReceipt: null }, context),
    )

    expect(then.retracted).toBeNull()
  })

  it('진료 기록이 있으면 연쇄 없이는 상태와 상관없이 거부합니다', () => {
    const given = visit({ status: 'AWAITING_PAYMENT' })

    const then = failure(
      decideCancel(given, { reason: '취소' }, { hasClinicalData: true, encounter: null, activeReceipt: null }, context),
    )

    expect(then).toMatchObject({ code: 'VISIT_HAS_CLINICAL_DATA', currentStatus: 'AWAITING_PAYMENT' })
  })

  it('연쇄 취소는 서버 안에서 받은 결제를 취소하고 영수증 취소 이벤트를 냅니다', () => {
    const given = visit({ status: 'COMPLETED' })
    const facts = {
      hasClinicalData: true,
      encounter: null,
      activeReceipt: { receipt: RECEIPT, payments: [cash] },
    }

    const then = success(decideCancel(given, { reason: '잘못 접수', cascade: true }, facts, context))

    expect(then.visit.status).toBe('CANCELED')
    expect(then.voided).toMatchObject({
      receipt: { status: 'VOIDED' },
      expectedVersion: 4,
      voided: [{ id: cash.id, status: 'VOIDED' }],
      event: {
        type: 'receipt.voided',
        data: {
          receiptId: RECEIPT.id,
          visitId: given.id,
          patientId: given.patientId,
          date: TODAY,
          reason: '잘못 접수',
          correctedBy: null,
        },
      },
    })
  })

  it('연쇄 취소는 밖에서 취소할 결제가 남았으면 내원 상태를 보기 전에 거부합니다', () => {
    // 이미 취소된 내원이라 상태 전이로도 거부되지만, 환불이 먼저입니다
    const given = visit({ status: 'CANCELED' })
    const facts = { hasClinicalData: true, encounter: null, activeReceipt: { receipt: RECEIPT, payments: [card] } }

    const then = failure(decideCancel(given, { reason: '취소', cascade: true }, facts, context))

    expect(then).toMatchObject({ code: 'PAYMENT_REFUND_REQUIRED', receiptId: RECEIPT.id, paymentIds: [card.id] })
  })
})

describe('decideCheckIn', () => {
  const facts: CheckInFacts = {
    patient: { id: 'pat_01JBQ000000000000000000001' as Id<'patient'>, birthDate: '1980-01-01', firstVisitDate: null },
    history: { firstVisitDate: null, lastIdentityVerifiedOn: null },
    clinicInstitutionCode: '12345678',
  }
  const ids = { visitId: 'vis_01JBQ000000000000000000009' as Id<'visit'>, encounterId: ENCOUNTER_ID }

  it('일반 환자를 오늘 진료로 접수하면 대기 내원과 접수 이벤트 하나를 냅니다', () => {
    const then = success(decideCheckIn({ patientId: facts.patient.id, coverage: 'SELF_PAY' }, facts, ids, context))

    expect(then.visit).toMatchObject({
      id: ids.visitId,
      encounterId: ENCOUNTER_ID,
      date: TODAY,
      checkedInAt: AT,
      status: 'WAITING',
      isFirstVisit: true,
      eligibility: { status: 'NOT_REQUIRED', nhis: null },
      version: 1,
    })
    expect(withoutIds(then.events)).toEqual([
      {
        type: 'visit.checked_in',
        subject: ids.visitId,
        time: AT,
        tenantId: TEST_TENANT.id,
        actor: { kind: 'USER', id: USER },
        data: {
          visitId: ids.visitId,
          patientId: facts.patient.id,
          date: TODAY,
          coverage: 'SELF_PAY',
          isFirstVisit: true,
          status: 'WAITING',
        },
      },
    ])
  })

  it('바로 진료로 들어가도 이벤트는 접수 하나입니다', () => {
    const then = success(
      decideCheckIn(
        { patientId: facts.patient.id, coverage: 'SELF_PAY', initialStatus: 'IN_TREATMENT' },
        facts,
        ids,
        context,
      ),
    )

    expect(then.visit.status).toBe('IN_TREATMENT')
    expect(then.events.map((each) => each.type)).toEqual(['visit.checked_in'])
  })

  it('건보 접수에 자격 조회 결과가 없으면 접수 검증의 이유를 담아 거부합니다', () => {
    const then = failure(decideCheckIn({ patientId: facts.patient.id, coverage: 'NHIS' }, facts, ids, context))

    expect(then).toMatchObject({ code: 'CHECK_IN_REJECTED' })
    expect(then.errors).toContain('NHIS_NOT_ELIGIBLE')
  })
})
