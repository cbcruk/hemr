import { describe, expect, it } from 'vitest'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { draftEncounter } from '../../clinical/encounters/encounter.aggregate.ts'
import type { Encounter } from '../../clinical/encounters/encounter.ts'
import { TEST_TENANT } from '../../identity/auth/testing.ts'
import type { Payment, ReceiptRecord } from '../receipts/receipt.ts'
import { testVisit } from './testing.ts'
import { eventContext } from '../../../shared/decision/decision-context.ts'
import type { DecisionContext } from '../../../shared/decision/decision-context.ts'
import { rejected, success, withoutIds } from '../../../shared/decision/testing.ts'
import { decideCancel, decideCheckIn, decideVisitAfterEncounter, decideVisitStatus } from './visit.aggregate.ts'
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

    rejected(decideVisitStatus(given, 'START_TREATMENT', {}, noData, context), {
      _tag: 'VisitTransitionInvalid',
      currentStatus: 'COMPLETED',
      command: 'START_TREATMENT',
    })
  })

  it('지난 내원은 다시 열 수 있지만 이어서 진료 흐름으로 옮기는 단계가 거부되면 아무것도 바꾸지 않습니다', () => {
    const given = visit({ status: 'COMPLETED', date: '2026-11-12' })

    expect(success(decideVisitStatus(given, 'REOPEN', { reason: '정정' }, noData, context)).visit.status).toBe(
      'AWAITING_PAYMENT',
    )
    rejected(decideVisitStatus(given, 'REOPEN', { reason: '정정', then: 'WAITING' }, noData, context), {
      _tag: 'VisitDatePast',
      date: '2026-11-12',
    })
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

  it('연쇄가 아닌 취소는 빈 초안을 철회하지 않고 정책에 맡깁니다', () => {
    const given = visit({ status: 'IN_TREATMENT' })
    const encounter = emptyDraft(given)

    const then = success(
      decideCancel(given, { reason: '환자 요청' }, { ...noData, encounter, activeReceipt: null }, context),
    )

    expect(then.visit).toMatchObject({ status: 'CANCELED', statusReason: '환자 요청' })
    expect(then.events.map((each) => each.type)).toEqual(['visit.status_changed'])
    expect(then.retracted).toBeNull()
    expect(then.voided).toBeNull()
  })

  it('연쇄 취소는 진료를 같은 사유로 함께 철회합니다', () => {
    const given = visit({ status: 'IN_TREATMENT' })
    const encounter = emptyDraft(given)

    const then = success(
      decideCancel(
        given,
        { reason: '환자 요청', cascade: true },
        { ...noData, encounter, activeReceipt: null },
        context,
      ),
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

  it('이미 철회한 진료는 연쇄 취소도 다시 철회하지 않습니다', () => {
    const given = visit({ status: 'WAITING' })
    const encounter: Encounter = { ...emptyDraft(given), status: 'ENTERED_IN_ERROR' }

    const then = success(
      decideCancel(given, { reason: '취소', cascade: true }, { ...noData, encounter, activeReceipt: null }, context),
    )

    expect(then.retracted).toBeNull()
  })

  it('진료 기록이 있으면 연쇄 없이는 상태와 상관없이 거부합니다', () => {
    const given = visit({ status: 'AWAITING_PAYMENT' })

    rejected(
      decideCancel(given, { reason: '취소' }, { hasClinicalData: true, encounter: null, activeReceipt: null }, context),
      { _tag: 'VisitHasClinicalData', currentStatus: 'AWAITING_PAYMENT' },
    )
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

    rejected(decideCancel(given, { reason: '취소', cascade: true }, facts, context), {
      _tag: 'PaymentRefundRequired',
      receiptId: RECEIPT.id,
      paymentIds: [card.id],
    })
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
    rejected(decideCheckIn({ patientId: facts.patient.id, coverage: 'NHIS' }, facts, ids, context), {
      _tag: 'CheckInRejected',
      errors: ['NHIS_NOT_ELIGIBLE', 'IDENTITY_VERIFICATION_REQUIRED'],
    })
  })
})

describe('decideVisitAfterEncounter', () => {
  it('고르지 않으면 대기 내원을 치료실로 옮깁니다', () => {
    const then = success(decideVisitAfterEncounter(visit({ status: 'WAITING' }), null, context))

    expect(then?.visit).toMatchObject({ status: 'IN_TREATMENT', version: 2 })
    expect(then?.events.map((each) => each.data)).toMatchObject([{ from: 'WAITING', to: 'IN_TREATMENT' }])
  })

  it('수납으로 보내면 진료 중인 내원을 수납 대기로 옮깁니다', () => {
    const then = success(decideVisitAfterEncounter(visit({ status: 'IN_TREATMENT' }), 'AWAITING_PAYMENT', context))

    expect(then?.visit.status).toBe('AWAITING_PAYMENT')
  })

  it('이미 그 상태, 수납 완료, 취소, 지난 날짜의 내원은 그대로 둡니다', () => {
    expect(success(decideVisitAfterEncounter(visit({ status: 'IN_TREATMENT' }), null, context))).toBeNull()
    expect(success(decideVisitAfterEncounter(visit({ status: 'COMPLETED' }), 'WAITING', context))).toBeNull()
    expect(success(decideVisitAfterEncounter(visit({ status: 'CANCELED' }), 'WAITING', context))).toBeNull()
    expect(
      success(decideVisitAfterEncounter(visit({ status: 'WAITING', date: '2026-11-12' }), null, context)),
    ).toBeNull()
  })

  it('데스크가 이미 수납으로 보낸 내원은 따로 고르지 않으면 되돌리지 않고, 고르면 옮깁니다', () => {
    const atCheckout = visit({ status: 'AWAITING_PAYMENT' })

    expect(success(decideVisitAfterEncounter(atCheckout, null, context))).toBeNull()
    expect(success(decideVisitAfterEncounter(atCheckout, 'IN_TREATMENT', context))?.visit.status).toBe('IN_TREATMENT')
  })
})
