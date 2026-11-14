import { Result } from 'effect'
import { expect } from 'vitest'

/**
 * 판정 함수 테스트의 도우미입니다(`*.aggregate.test.ts`). given(지금 상태와 미리 읽은 사실) / when(판정 함수) / then(다음
 * 상태와 이벤트는 `success`, 거부는 `rejected`)으로 씁니다.
 */

/** 판정이 받아들였으면 결과를, 거부했으면 테스트를 실패시킵니다. */
export function success<A, E>(result: Result.Result<A, E>): A {
  if (Result.isFailure(result)) throw new Error(`거부되었습니다: ${String(result.failure)}`)
  return result.success
}

/** 문제 상세의 필드입니다. 오류 태그로 정해지므로 거부를 비교할 때 뺍니다. */
const PROBLEM_FIELDS = new Set(['code', 'type', 'status', 'title', 'detail'])

/** 기대하는 거부입니다. 오류 태그와, 오류에 담긴 도메인 필드 전부입니다. */
export type Rejection<E extends { readonly _tag: string }> = { readonly _tag: E['_tag'] } & Readonly<
  Record<string, unknown>
>

/**
 * 판정이 `expected`로 거부했는지 확인하고 그 오류를 돌려줍니다. 받아들였으면 테스트를 실패시킵니다. 오류의 도메인
 * 필드(`currentStatus` 등)는 빠짐없이 같아야 합니다.
 */
export function rejected<A, E extends { readonly _tag: string }>(
  result: Result.Result<A, E>,
  expected: Rejection<E>,
): E {
  if (Result.isSuccess(result)) throw new Error(`거부되지 않았습니다: ${expected._tag}`)
  const error = result.failure
  const fields = Object.entries(error).filter(([key]) => !PROBLEM_FIELDS.has(key))
  expect({ _tag: error._tag, ...Object.fromEntries(fields) }).toEqual(expected)
  return error
}

/** 이벤트 ID는 판정할 때마다 새로 만들어 비교에서 뺍니다. */
export const withoutIds = <T extends { id: unknown }>(events: ReadonlyArray<T>) =>
  events.map(({ id: _, ...rest }) => rest)
