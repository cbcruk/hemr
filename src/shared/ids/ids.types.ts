import type { ID_PREFIXES } from './ids.ts'

/** 접두사가 붙은 ID를 가진 엔터티 종류 이름입니다. */
export type IdKind = keyof typeof ID_PREFIXES

/** 엔터티 종류별 접두사 문자열입니다. 예: 환자는 `pat` */
export type IdPrefix<K extends IdKind = IdKind> = (typeof ID_PREFIXES)[K]

/**
 * `K` 종류 엔터티의 불투명 ID입니다. 형식은 `<prefix>_<ULID>`입니다.
 *
 * 브랜드 타입이라 내원 ID 자리에 환자 ID를 넘기면 컴파일 오류가 납니다.
 */
export type Id<K extends IdKind> = `${IdPrefix<K>}_${string}` & { readonly __kind: K }
