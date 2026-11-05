import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { transitionVisit } from './visit-status.ts'
import type { VisitCommand, VisitStatus } from './visit-status.types.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/visit-status-transitions.json`)를 서버 커맨드로 옮긴 테스트입니다.
 *
 * 현행은 카드를 끌어 놓으면 `PATCH {상태}`를 보냈고, 재설계는 커맨드를 보냅니다. 결정
 * (`docs/design/rule-decisions.md`의 visit-status-transitions)에 따라 끌어 놓은 칸의 상태에
 * 커맨드로 도달할 수 있는지를 검사합니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, unknown>
  expected: unknown
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/visit-status-transitions.json'), 'utf8'),
) as { cases: FixtureCase[] }

const COLUMN_STATUS: Record<string, VisitStatus> = {
  대기: 'WAITING',
  치료: 'IN_TREATMENT',
  수납: 'AWAITING_PAYMENT',
  수납완료: 'COMPLETED',
}

/**
 * 끌어 놓기 하나에 대응하는 서버 커맨드입니다.
 *
 * `수납완료`에서 나가려면 먼저 `:reopen`을 보냅니다(결정 3). `수납완료`로 가는 길은 수납 기록
 * 유무와 상관없이 `:checkout` 하나입니다(결정 1, 2).
 */
function commandsForDrop(from: VisitStatus, to: VisitStatus): VisitCommand[] {
  const reopen: VisitCommand[] = from === 'COMPLETED' ? ['REOPEN'] : []
  switch (to) {
    case 'WAITING':
      return [...reopen, 'RETURN_TO_WAITING']
    case 'IN_TREATMENT':
      return [...reopen, 'START_TREATMENT']
    case 'AWAITING_PAYMENT':
      return from === 'COMPLETED' ? ['REOPEN'] : ['SEND_TO_CHECKOUT']
    default:
      return ['CHECKOUT']
  }
}

function run(from: VisitStatus, commands: VisitCommand[]): VisitStatus | string {
  let status = from
  for (const command of commands) {
    const result = transitionVisit(status, command)
    if (!result.ok) return result.code
    status = result.to
  }
  return status
}

const drops = fixture.cases.filter(
  (testCase) => typeof testCase.input['from'] === 'string' && testCase.input['permissions'] === undefined,
)

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 이 목록과 맞지 않아 테스트가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  'drag 수납 -> 수납완료 without 접수수정 permission': '권한 모델이 아직 없습니다',
  'drag 수납 -> 수납완료 unpaid without 수납생성 permission': '권한 모델이 아직 없습니다',
  'check-in creates visit in 대기 or 치료': '접수(:check-in)가 아직 없습니다',
  'bed modal confirm without a bed sends 상태 치료':
    '베드 배정은 :start-treatment {roomId, bedNumber} 입력으로, 아직 없습니다',
  'bed modal confirm with a bed assigns the bed instead of PATCHing status': '베드 배정 입력이 아직 없습니다',
  'move to 치료 with no treatment rooms configured asks to go to settings': '화면 안내입니다',
  'move to 치료 when 치료실현황.치료완료일시 is set asks for duplicate confirm': '화면 안내입니다',
  "치료 card menu '대기로 이동'": '끌어 놓기와 같은 :return-to-waiting이라 위에서 검사합니다',
  "수납 card menu '치료로 이동' sends status directly (no bed modal)":
    '끌어 놓기와 같은 :start-treatment라 위에서 검사합니다',
  'checkout success moves visit to 수납완료': '수납(:checkout)이 아직 없습니다',
  'repeat checkout does not change status': '수납(:checkout)이 아직 없습니다',
  '접수 취소 exists only on 대기 cards': 'visits.http.test.ts의 취소 테스트가 결정 4를 검사합니다',
  'past desk date: card menus keep only non-moving items':
    'visit-status.test.ts의 지난 날짜 테스트가 결정 5를 검사합니다',
}

describe('visit-status-transitions fixture', () => {
  it.each(drops.map((testCase) => [testCase.name, testCase] as const))('%s', (_, testCase) => {
    const from = COLUMN_STATUS[testCase.input['from'] as string]!
    const to = COLUMN_STATUS[testCase.input['to'] as string]!

    expect(run(from, commandsForDrop(from, to))).toBe(to)
  })

  it('accounts for every case that is not ported', () => {
    const ported = new Set(drops.map((testCase) => testCase.name))
    const rest = fixture.cases.map((testCase) => testCase.name).filter((name) => !ported.has(name))

    expect(rest.sort()).toEqual(Object.keys(NOT_PORTED).sort())
  })
})
