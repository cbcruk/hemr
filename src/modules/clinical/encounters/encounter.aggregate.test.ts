import { describe, expect, it } from 'vitest'
import type { Id } from '../../../shared/ids/ids.types.ts'
import {
  decideAmend,
  decideComplete,
  decideLock,
  decideRetract,
  decideRetractCanceledDraft,
  decideUpdate,
} from './encounter.aggregate.ts'
import type { CompletionFacts } from './encounter.aggregate.ts'
import { failure, PRIMARY, success, TEST_CONTEXT, testCompleted, testDraft, testIds, testVisitOf } from './testing.ts'

/**
 * 진료 판정 함수의 테스트입니다. given(진료와 미리 읽은 사실) / when(커맨드) / then(쓸 진료·판·이벤트, 또는 거부)으로
 * 씁니다. 저장·권한·동시성은 서비스 테스트(`encounters.test.ts`)가 봅니다.
 */

const RECEIPT = 'rcp_01JBQ000000000000000000001' as Id<'receipt'>
const facts = (overrides: Partial<CompletionFacts> = {}): CompletionFacts => ({
  visit: testVisitOf(),
  billedBy: null,
  others: [],
  ...overrides,
})
const addPrimary = { diagnoses: { upsert: [{ code: 'U23.4', kind: 'PRIMARY' as const }] } }
const addLine = {
  prescriptionLines: {
    upsert: [
      {
        clientRef: 'a',
        kind: 'NONBENEFIT' as const,
        feeCode: null,
        categoryCode: '90001001',
        name: '약침',
        dose: { perDay: 1, days: 1 },
        unitPrice: 10_000,
        prn: false,
      },
    ],
  },
}

describe('decideUpdate', () => {
  it('초안에 상병을 더하면 버전을 올리고 비어 있는 진료의를 채우며 바뀐 필드를 담은 이벤트를 냅니다', () => {
    const given = testDraft({ doctorId: null, version: 1 })

    const then = success(decideUpdate(given, addPrimary, 1, facts(), testIds(), TEST_CONTEXT))

    expect(then.encounter).toMatchObject({ doctorId: TEST_CONTEXT.userId, version: 2, updatedAt: TEST_CONTEXT.at })
    expect(then.encounter.diagnoses).toMatchObject([{ code: 'U23.4', kind: 'PRIMARY' }])
    expect(then.write).toMatchObject({
      expectedVersion: 1,
      revision: null,
      event: { type: 'encounter.updated', data: { changed: ['diagnoses'] } },
    })
  })

  it('바뀐 것이 없으면 쓰지 않고 지금 진료를 돌려줍니다', () => {
    const given = testDraft()

    const then = success(decideUpdate(given, {}, given.version, facts(), testIds(), TEST_CONTEXT))

    expect(then.write).toBeNull()
    expect(then.encounter).toBe(given)
  })

  it('버전이 다르면 지금 버전을 담아 거부합니다', () => {
    const given = testDraft({ version: 3 })

    expect(failure(decideUpdate(given, addPrimary, 2, facts(), testIds(), TEST_CONTEXT))).toMatchObject({
      _tag: 'VersionMismatch',
      currentVersion: 3,
    })
  })

  it('완료한 진료는 초안 저장으로 고치지 않습니다', () => {
    const given = testCompleted()

    expect(failure(decideUpdate(given, addPrimary, given.version, facts(), testIds(), TEST_CONTEXT))).toMatchObject({
      _tag: 'EncounterNotEditable',
      currentStatus: 'COMPLETED',
    })
  })

  it('수납한 진료는 처방을 바꾸지 못하지만 상병은 고칠 수 있습니다', () => {
    const given = testDraft()
    const billed = facts({ billedBy: RECEIPT })

    expect(failure(decideUpdate(given, addLine, given.version, billed, testIds(), TEST_CONTEXT))).toMatchObject({
      _tag: 'EncounterBilled',
      receiptId: RECEIPT,
    })
    expect(
      success(decideUpdate(given, addPrimary, given.version, billed, testIds(), TEST_CONTEXT)).write,
    ).not.toBeNull()
  })

  it('취소한 내원의 진료는 거부합니다', () => {
    const given = testDraft()
    const canceled = facts({ visit: testVisitOf({ status: 'CANCELED' }) })

    expect(failure(decideUpdate(given, addPrimary, given.version, canceled, testIds(), TEST_CONTEXT))._tag).toBe(
      'EncounterVisitCanceled',
    )
  })
})

describe('decideComplete', () => {
  const charted = () => testDraft({ diagnoses: [PRIMARY], version: 2 })

  it('완료하면 1판을 남기고 진료 중인 내원을 그대로 두며 치료실로 보낼 때는 시술을 끝내지 않습니다', () => {
    const given = charted()

    const then = success(decideComplete(given, { expectedVersion: 2 }, facts(), TEST_CONTEXT))

    expect(then.write.encounter).toMatchObject({ status: 'COMPLETED', completedAt: TEST_CONTEXT.at, revision: 1 })
    expect(then.write.revision).toMatchObject({ revision: 1, source: 'COMPLETION', reason: null })
    expect(then.write.event).toMatchObject({ type: 'encounter.completed', data: { acknowledged: [] } })
    expect(then.moved).toBeNull()
    expect(then.finishProcedures).toBe(false)
  })

  it('대기 내원은 치료실로 옮깁니다', () => {
    const then = success(
      decideComplete(
        charted(),
        { expectedVersion: 2 },
        facts({ visit: testVisitOf({ status: 'WAITING' }) }),
        TEST_CONTEXT,
      ),
    )

    expect(then.moved?.visit.status).toBe('IN_TREATMENT')
    expect(then.visit?.status).toBe('IN_TREATMENT')
  })

  it('수납으로 보내면 내원을 옮기고 진행 중인 시술을 끝내라고 알립니다', () => {
    const then = success(
      decideComplete(charted(), { expectedVersion: 2, nextVisitStatus: 'AWAITING_PAYMENT' }, facts(), TEST_CONTEXT),
    )

    expect(then.moved?.events.map((each) => each.data)).toMatchObject([
      { from: 'IN_TREATMENT', to: 'AWAITING_PAYMENT' },
    ])
    expect(then.finishProcedures).toBe(true)
  })

  it('데스크가 이미 수납으로 보낸 내원은 따로 고르지 않으면 되돌리지 않습니다', () => {
    const then = success(
      decideComplete(
        charted(),
        { expectedVersion: 2 },
        facts({ visit: testVisitOf({ status: 'AWAITING_PAYMENT' }) }),
        TEST_CONTEXT,
      ),
    )

    expect(then.moved).toBeNull()
    expect(then.visit?.status).toBe('AWAITING_PAYMENT')
  })

  it('지난 날짜의 내원은 옮기지 않습니다', () => {
    const past = testVisitOf({ status: 'WAITING', date: '2026-11-12' })

    expect(
      success(decideComplete(charted(), { expectedVersion: 2 }, facts({ visit: past }), TEST_CONTEXT)).moved,
    ).toBeNull()
  })

  it('주상병이 없으면 위반을 모두 담아 거부합니다', () => {
    const given = testDraft({ version: 2 })

    expect(failure(decideComplete(given, { expectedVersion: 2 }, facts(), TEST_CONTEXT))).toMatchObject({
      _tag: 'EncounterCompletionRejected',
      violations: [{ code: 'PRIMARY_DIAGNOSIS_MISSING' }],
    })
  })
})

describe('decideAmend', () => {
  const memo = { note: { body: '추가 소견' } }

  it('정정하면 다음 판을 사유와 함께 남기고 반영한 제안을 이벤트에 남깁니다', () => {
    const given = testCompleted()
    const proposalId = 'amp_01JBQ000000000000000000001' as Id<'amendmentProposal'>

    const then = success(
      decideAmend(
        given,
        { reason: '오타', changes: memo, expectedVersion: given.version, proposalId },
        facts(),
        testIds(),
        TEST_CONTEXT,
      ),
    )

    expect(then.encounter).toMatchObject({ status: 'AMENDED', revision: 2, version: given.version + 1 })
    expect(then.write?.revision).toMatchObject({ revision: 2, source: 'AMENDMENT', reason: '오타' })
    expect(then.write?.event).toMatchObject({
      type: 'encounter.amended',
      data: { revision: 2, reason: '오타', proposalId },
    })
  })

  it('고정한 진료는 정정하지 않습니다', () => {
    const given = testCompleted({ locked: true })

    expect(
      failure(
        decideAmend(
          given,
          { reason: '오타', changes: memo, expectedVersion: given.version },
          facts(),
          testIds(),
          TEST_CONTEXT,
        ),
      )._tag,
    ).toBe('EncounterLocked')
  })

  it('정정한 결과가 완료 검증에 막히면 거부합니다', () => {
    const given = testCompleted()
    const changes = { diagnoses: { remove: [PRIMARY.id] } }

    expect(
      failure(
        decideAmend(
          given,
          { reason: '상병 삭제', changes, expectedVersion: given.version },
          facts(),
          testIds(),
          TEST_CONTEXT,
        ),
      ),
    ).toMatchObject({ _tag: 'EncounterCompletionRejected', violations: [{ code: 'PRIMARY_DIAGNOSIS_MISSING' }] })
  })

  it('초안은 정정하지 않습니다', () => {
    const given = testDraft()

    expect(
      failure(
        decideAmend(
          given,
          { reason: '오타', changes: memo, expectedVersion: given.version },
          facts(),
          testIds(),
          TEST_CONTEXT,
        ),
      ),
    ).toMatchObject({ _tag: 'EncounterNotEditable', currentStatus: 'DRAFT' })
  })
})

describe('decideRetract', () => {
  it('철회하면 사유를 남기고 이전 상태를 담은 이벤트를 냅니다', () => {
    const given = testCompleted()

    const then = success(
      decideRetract(given, { reason: '다른 환자', expectedVersion: given.version }, { billedBy: null }, TEST_CONTEXT),
    )

    expect(then.encounter).toMatchObject({
      status: 'ENTERED_IN_ERROR',
      retraction: { reason: '다른 환자', retractedBy: TEST_CONTEXT.userId },
    })
    expect(then.event).toMatchObject({ type: 'encounter.retracted', data: { from: 'COMPLETED' } })
  })

  it('고정했거나 수납한 진료는 철회하지 않습니다', () => {
    const input = { reason: '다른 환자', expectedVersion: 3 }

    expect(failure(decideRetract(testCompleted({ locked: true }), input, { billedBy: null }, TEST_CONTEXT))._tag).toBe(
      'EncounterLocked',
    )
    expect(failure(decideRetract(testCompleted(), input, { billedBy: RECEIPT }, TEST_CONTEXT))).toMatchObject({
      _tag: 'EncounterBilled',
      receiptId: RECEIPT,
    })
  })
})

describe('decideRetractCanceledDraft', () => {
  it('취소한 내원의 초안을 취소 사유로 철회합니다', () => {
    const given = testDraft()

    const then = success(decideRetractCanceledDraft(given, '환자 요청', TEST_CONTEXT))

    expect(then).toMatchObject({
      encounter: { status: 'ENTERED_IN_ERROR', retraction: { reason: '환자 요청', retractedBy: TEST_CONTEXT.userId } },
      expectedVersion: given.version,
      event: { type: 'encounter.retracted', data: { from: 'DRAFT' } },
    })
  })

  it('이미 철회한 진료는 쓰지 않습니다', () => {
    expect(
      success(decideRetractCanceledDraft(testDraft({ status: 'ENTERED_IN_ERROR' }), '취소', TEST_CONTEXT)),
    ).toBeNull()
  })

  it('초안이 아닌 진료는 철회하지 않습니다', () => {
    expect(failure(decideRetractCanceledDraft(testCompleted(), '취소', TEST_CONTEXT))).toMatchObject({
      _tag: 'EncounterNotEditable',
      currentStatus: 'COMPLETED',
    })
  })
})

describe('decideLock', () => {
  it('완료한 진료를 고정하면 고정 이벤트를 내고, 이미 고정했으면 쓰지 않습니다', () => {
    const given = testCompleted()

    const locked = success(decideLock(given, true, given.version, TEST_CONTEXT))

    expect(locked).toMatchObject({
      encounter: { locked: true, version: given.version + 1 },
      event: { type: 'encounter.locked' },
    })
    expect(success(decideLock(locked!.encounter, true, locked!.encounter.version, TEST_CONTEXT))).toBeNull()
  })

  it('초안은 고정하지 않습니다', () => {
    const given = testDraft()

    expect(failure(decideLock(given, true, given.version, TEST_CONTEXT))._tag).toBe('EncounterNotEditable')
  })
})
