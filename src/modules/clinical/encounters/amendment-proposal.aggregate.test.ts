import { describe, expect, it } from 'vitest'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { decideApply, decideDismiss, decidePropose } from './amendment-proposal.aggregate.ts'
import type { AmendmentProposal } from './amendment-proposal.ts'
import { failure, success, TEST_CONTEXT, testCompleted, testDraft, testIds, testVisitOf } from './testing.ts'

/**
 * 정정 제안 판정 함수의 테스트입니다. given(제안과 진료) / when(커맨드) / then(쓸 제안·진료와 이벤트, 또는 거부)으로
 * 씁니다. 저장·권한은 서비스 테스트(`amendment-proposals.test.ts`)가 봅니다.
 */

const PROPOSAL_ID = 'amp_01JBQ000000000000000000001' as Id<'amendmentProposal'>
const memo = { note: { body: '추가 소견' } }
const facts = { visit: testVisitOf(), billedBy: null, others: [] }

const proposed = (overrides: Partial<AmendmentProposal> = {}): AmendmentProposal => ({
  ...success(decidePropose(testCompleted(), { reason: '오타', changes: memo }, PROPOSAL_ID, testIds(), TEST_CONTEXT))
    .proposal,
  ...overrides,
})

describe('decidePropose', () => {
  it('완료한 진료에 지금 판을 기준으로 대기 제안을 만들고 생성 이벤트를 냅니다', () => {
    const given = testCompleted({ revision: 2 })

    const then = success(decidePropose(given, { reason: '오타', changes: memo }, PROPOSAL_ID, testIds(), TEST_CONTEXT))

    expect(then.proposal).toMatchObject({
      id: PROPOSAL_ID,
      status: 'PENDING',
      baseRevision: 2,
      proposedBy: TEST_CONTEXT.userId,
      version: 1,
    })
    expect(then.expectedVersion).toBeNull()
    expect(then.event).toMatchObject({ type: 'amendment_proposal.created', subject: PROPOSAL_ID })
  })

  it('고정한 진료에도 제안을 만듭니다', () => {
    const given = testCompleted({ locked: true })

    expect(
      success(decidePropose(given, { reason: '오타', changes: memo }, PROPOSAL_ID, testIds(), TEST_CONTEXT)).proposal
        .status,
    ).toBe('PENDING')
  })

  it('초안에는 제안하지 않고, 바뀌는 것이 없는 제안은 거부합니다', () => {
    expect(
      failure(decidePropose(testDraft(), { reason: '오타', changes: memo }, PROPOSAL_ID, testIds(), TEST_CONTEXT))._tag,
    ).toBe('EncounterNotEditable')
    expect(
      failure(decidePropose(testCompleted(), { reason: '없음', changes: {} }, PROPOSAL_ID, testIds(), TEST_CONTEXT))
        ._tag,
    ).toBe('AmendmentProposalEmpty')
  })
})

describe('decideApply', () => {
  it('반영하면 제안의 사유로 진료를 정정하고 제안을 그 판으로 반영합니다', () => {
    const encounter = testCompleted()

    const then = success(decideApply(proposed(), encounter, {}, facts, testIds(), TEST_CONTEXT))

    expect(then.amended.write?.event).toMatchObject({
      type: 'encounter.amended',
      data: { reason: '오타', proposalId: PROPOSAL_ID },
    })
    expect(then.applied).toMatchObject({
      proposal: { status: 'APPLIED', resolution: { by: TEST_CONTEXT.userId, revision: 2, reason: null }, version: 2 },
      expectedVersion: 1,
      event: { type: 'amendment_proposal.applied' },
    })
  })

  it('제안 뒤 진료가 정정되었으면 두 판을 담아 거부합니다', () => {
    const encounter = testCompleted({ status: 'AMENDED', revision: 2 })

    expect(failure(decideApply(proposed(), encounter, {}, facts, testIds(), TEST_CONTEXT))).toMatchObject({
      _tag: 'AmendmentProposalStale',
      baseRevision: 1,
      currentRevision: 2,
    })
  })

  it('대기 제안이 아니면 거부합니다', () => {
    expect(
      failure(decideApply(proposed({ status: 'DISMISSED' }), testCompleted(), {}, facts, testIds(), TEST_CONTEXT)),
    ).toMatchObject({ _tag: 'AmendmentProposalNotPending', currentStatus: 'DISMISSED' })
  })

  it('고정한 진료의 제안은 정정과 같이 거부합니다', () => {
    expect(
      failure(decideApply(proposed(), testCompleted({ locked: true }), {}, facts, testIds(), TEST_CONTEXT))._tag,
    ).toBe('EncounterLocked')
  })
})

describe('decideDismiss', () => {
  it('대기 제안을 사유와 함께 버리고, 이미 버린 제안은 거부합니다', () => {
    const then = success(decideDismiss(proposed(), '필요 없음', TEST_CONTEXT))

    expect(then.proposal).toMatchObject({ status: 'DISMISSED', resolution: { revision: null, reason: '필요 없음' } })
    expect(then.event.type).toBe('amendment_proposal.dismissed')
    expect(failure(decideDismiss(then.proposal, '다시', TEST_CONTEXT))._tag).toBe('AmendmentProposalNotPending')
  })
})
