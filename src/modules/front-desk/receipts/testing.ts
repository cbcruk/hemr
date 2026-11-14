import { Result } from 'effect'
import { eventContext } from '../../../shared/decision/decision-context.ts'
import type { DecisionContext } from '../../../shared/decision/decision-context.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { draftEncounter } from '../../clinical/encounters/encounter.aggregate.ts'
import type { Encounter } from '../../clinical/encounters/encounter.ts'
import { TEST_TENANT } from '../../identity/auth/testing.ts'
import { testVisit } from '../visits/testing.ts'
import type { ReceiptIds } from './receipt.aggregate.ts'
import type { Payment, ReceiptRecord } from './receipt.ts'

/** 판정 함수 테스트의 시각과 행위자입니다. */
export const TEST_CONTEXT: DecisionContext = {
  at: '2026-11-13T01:00:00.000Z',
  today: '2026-11-13',
  tenantId: TEST_TENANT.id,
  userId: 'usr_01JBQ000000000000000000001' as Id<'user'>,
}

/** 시험용 새 영수증 ID입니다. 새 결제 ID는 `…9` 뒤에 1부터 셉니다. 아홉 개까지 겹치지 않습니다. */
export const TEST_RECEIPT_IDS: ReceiptIds = {
  receiptId: 'rcp_01JBQ000000000000000000009' as Id<'receipt'>,
  paymentIds: (count) =>
    Array.from({ length: count }, (_, index) => `pay_01JBQ${'0'.repeat(19)}9${index + 1}` as Id<'payment'>),
}

/** 시험용 결제입니다. `testVisit()`의 환자·내원에 적용한 현금 1만 원이고, `overrides`로 바꿉니다. */
export function testPayment(overrides: Partial<Payment> = {}): Payment {
  const visit = testVisit()
  return {
    id: 'pay_01JBQ000000000000000000001' as Id<'payment'>,
    tenantId: TEST_TENANT.id,
    patientId: visit.patientId,
    visitId: visit.id,
    receiptId: 'rcp_01JBQ000000000000000000001' as Id<'receipt'>,
    method: 'CASH',
    prepaidKind: null,
    amount: { taxable: 0, taxExempt: 10_000 },
    processorRef: null,
    status: 'CAPTURED',
    refunds: [],
    recordedBy: TEST_CONTEXT.userId,
    createdAt: '2026-11-13T00:00:00.000Z',
    updatedAt: '2026-11-13T00:00:00.000Z',
    version: 1,
    ...overrides,
  }
}

/** 시험용 영수증입니다. `testVisit()`의 내원을 1만 원 받고 끝낸 유효한 영수증이고, `overrides`로 바꿉니다. */
export function testReceipt(overrides: Partial<ReceiptRecord> = {}): ReceiptRecord {
  const visit = testVisit()
  return {
    id: 'rcp_01JBQ000000000000000000001' as Id<'receipt'>,
    tenantId: TEST_TENANT.id,
    visitId: visit.id,
    patientId: visit.patientId,
    date: '2026-11-13',
    cashierId: TEST_CONTEXT.userId,
    memo: '',
    encounterIds: [],
    quoteId: 'qt_01JBQ000000000000000000001' as Id<'quote'>,
    charges: { insuredCopay: 0, nonbenefit: { taxable: 0, taxExempt: 10_000 }, total: 10_000 },
    settlement: {
      due: { taxable: 0, taxExempt: 10_000 },
      received: { taxable: 0, taxExempt: 10_000 },
      result: 'PAID',
      outstanding: 0,
      overpaid: 0,
      writtenOff: 0,
      acknowledged: [],
    },
    flags: { excludeFromTaxDeduction: false },
    status: 'ACTIVE',
    voided: null,
    correctionOf: null,
    createdAt: '2026-11-13T00:00:00.000Z',
    updatedAt: '2026-11-13T00:00:00.000Z',
    version: 1,
    ...overrides,
  }
}

/** 시험용 진료입니다. `testVisit()`의 내원에서 일반 비급여 `amount`원을 처방한 진료이고, 0이면 처방이 없습니다. */
export function testEncounter(amount: number, overrides: Partial<Encounter> = {}): Encounter {
  const visit = testVisit()
  const { encounter } = draftEncounter(
    { ...visit, encounterId: 'enc_01JBQ000000000000000000001' as Id<'encounter'> },
    eventContext(TEST_CONTEXT),
  )
  const prescriptionLines: Encounter['prescriptionLines'] =
    amount === 0
      ? []
      : [
          {
            id: 'pl_01JBQ000000000000000000001' as Encounter['prescriptionLines'][number]['id'],
            kind: 'NONBENEFIT',
            feeCode: null,
            categoryCode: '90001001',
            name: '약침',
            dose: { perDay: 1, days: 1 },
            unitPrice: amount,
            amount,
            prn: false,
          },
        ]
  return { ...encounter, prescriptionLines, ...overrides }
}

/** 판정이 받아들였으면 결과를, 거부했으면 테스트를 실패시킵니다. */
export function success<A, E>(result: Result.Result<A, E>): A {
  if (Result.isFailure(result)) throw new Error(`거부되었습니다: ${String(result.failure)}`)
  return result.success
}

/** 판정이 거부했으면 그 오류를, 받아들였으면 테스트를 실패시킵니다. */
export function failure<A, E>(result: Result.Result<A, E>): E {
  if (Result.isSuccess(result)) throw new Error('거부되지 않았습니다')
  return result.failure
}
