import { ulid } from 'ulid'
import type { Id, IdKind } from './ids.types.ts'

/**
 * API에 노출하는 엔터티 종류별 ID 접두사입니다.
 *
 * ID 규칙은 `docs/design/conventions.md`를 보세요.
 */
export const ID_PREFIXES = {
  tenant: 'ten',
  user: 'usr',
  device: 'dev',
  patient: 'pat',
  appointment: 'apt',
  visit: 'vis',
  encounter: 'enc',
  receipt: 'rcp',
  payment: 'pay',
  quote: 'qt',
  eligibilityLookup: 'elg',
  externalHerbalOrder: 'xho',
  job: 'job',
  event: 'evt',
  offlineCommand: 'cmd',
} as const

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/

/**
 * 주어진 엔터티 종류의 새 ID를 만듭니다.
 *
 * @example 환자 ID 만들기
 * ```ts
 * import { newId } from "./ids.ts";
 *
 * const id = newId("patient"); // "pat_01J..."
 * ```
 */
export function newId<K extends IdKind>(kind: K, time?: number): Id<K> {
  return `${ID_PREFIXES[kind]}_${ulid(time)}` as Id<K>
}

/**
 * 값이 주어진 종류의 올바른 형식 ID인지 확인합니다.
 *
 * 오프라인 엣지 장치는 ID를 직접 만들기 때문에, 서버는 클라이언트가 보낸 ID를
 * 그대로 믿지 않고 형식을 검사합니다.
 */
export function isId<K extends IdKind>(kind: K, value: unknown): value is Id<K> {
  if (typeof value !== 'string') return false
  const prefix = `${ID_PREFIXES[kind]}_`
  return value.startsWith(prefix) && ULID_PATTERN.test(value.slice(prefix.length))
}
