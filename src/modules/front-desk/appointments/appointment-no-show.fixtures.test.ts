import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyNoShowPatch, migrateNoShowSettings } from './appointment-no-show.ts'
import type { NoShowSettingsPatch } from './appointment-no-show.ts'

/**
 * 현행 클라이언트 픽스처(`test/fixtures/rules/appointment-no-show.json`)를 서버 규칙으로 옮긴 테스트입니다.
 *
 * 현행 픽스처는 설정 화면과 이력 문구라서, 서버에서는 설정 이관(결정 4)과 설정 변경으로 옮깁니다.
 * 부도 판정 자체는 클라이언트에 없어 `appointment-no-show.test.ts`가 결정 1–3으로 검사합니다.
 */

interface FixtureCase {
  name: string
  input: Record<string, any>
  expected: any
}

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../test/fixtures/rules/appointment-no-show.json'), 'utf8'),
) as { cases: FixtureCase[] }

function toPatch(click: Record<string, unknown>): NoShowSettingsPatch {
  const patch: NoShowSettingsPatch = {}
  if (typeof click['부도처리시점'] === 'number') patch.noShowAfterMinutes = click['부도처리시점']
  if (typeof click['진료마감부도처리여부'] === 'boolean') patch.noShowAtClinicClose = click['진료마감부도처리여부']
  return patch
}

function cases(check: string): FixtureCase[] {
  return fixture.cases.filter((testCase) => testCase.input['check'] === check && !(testCase.name in NOT_PORTED))
}

/**
 * 서버 테스트로 옮기지 않은 케이스와 그 이유입니다. 픽스처에 케이스가 늘면 아래 검사가 실패합니다.
 */
const NOT_PORTED: Record<string, string> = {
  'history: server-created 부도 change renders as timeout no-show':
    '이력 문구는 displayStatus와 함께 예약 이력을 만들 때 옮깁니다',
  'history: 부도 change with a different 예약일자 renders as no-show by reschedule':
    '이력 문구는 displayStatus와 함께 예약 이력을 만들 때 옮깁니다',
}

describe('appointment-no-show fixture', () => {
  describe('settings migration (결정 4: 10/30/60이 아니면 올림)', () => {
    /** 현행 화면에서 활성 버튼이 없던 옛 값은 이관 뒤 올린 값이 됩니다. */
    const MIGRATED: Record<string, { noShowAfterMinutes: number; noShowAtClinicClose: boolean }> = {
      'settings view: {"부도처리시점":45,"진료마감부도처리여부":false}': {
        noShowAfterMinutes: 60,
        noShowAtClinicClose: false,
      },
      'settings view: {"부도처리시점":null,"진료마감부도처리여부":false}': {
        noShowAfterMinutes: 10,
        noShowAtClinicClose: false,
      },
    }

    it.each(cases('settingsView').map((c) => [c.name, c] as const))('%s', (name, { input, expected }) => {
      const legacy = input['settings']
      const { settings } = migrateNoShowSettings(legacy['부도처리시점'], legacy['진료마감부도처리여부'])
      const active = (expected.options as { label: string; active: boolean }[]).find((option) => option.active)

      if (name in MIGRATED) {
        expect(active).toBeUndefined()
        expect(settings).toEqual(MIGRATED[name])
        return
      }
      // 진료 마감 모드에서도 분 값은 그대로 남습니다
      expect(settings.noShowAfterMinutes).toBe(legacy['부도처리시점'])
      expect(settings.noShowAtClinicClose).toBe(active?.label === '진료 마감 후')
      if (!settings.noShowAtClinicClose) expect(active?.label).toBe(`${settings.noShowAfterMinutes}분 후`)
    })

    it('covers every migrated case', () => {
      expect(Object.keys(MIGRATED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
    })
  })

  describe('settings patch (진료 마감 모드를 켜도 분 값은 남김)', () => {
    it.each(cases('settingsPatch').map((c) => [c.name, c] as const))('%s', (_, { input, expected }) => {
      const { settings: current } = migrateNoShowSettings(
        input['settings']['부도처리시점'],
        input['settings']['진료마감부도처리여부'],
      )
      const result = applyNoShowPatch(current, toPatch(input['click']))

      // 현행이 보낸 바뀐 필드만큼 현재 설정에서 바뀌고, 나머지는 그대로입니다
      expect(result).toEqual({ settings: { ...current, ...toPatch(expected ?? {}) } })
    })
  })

  it('accounts for every fixture case', () => {
    const ported = new Set(['settingsView', 'settingsPatch'])
    const unaccounted = fixture.cases.filter(
      (testCase) => !(testCase.name in NOT_PORTED) && !ported.has(testCase.input['check']),
    )
    expect(unaccounted.map((testCase) => testCase.name)).toEqual([])
    expect(Object.keys(NOT_PORTED).filter((name) => !fixture.cases.some((c) => c.name === name))).toEqual([])
  })
})
