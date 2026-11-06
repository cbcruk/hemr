import { Schema } from 'effect'
import { isId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'

/**
 * 진료 ID입니다. 예: `enc_01J...`
 *
 * 내원(`Visit.encounterId`)도 이 ID를 써서, 진료 모델(`encounter.ts`)과 따로 둡니다. 진료 모델이 내원 모듈을 읽으므로
 * 한 파일에 두면 두 모듈이 서로를 불러옵니다.
 */
export const EncounterId = Schema.String.pipe(
  Schema.refine((value): value is Id<'encounter'> => isId('encounter', value)),
)
