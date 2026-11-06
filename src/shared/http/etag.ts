import { HttpApiSchema } from 'effect/http-api'

/**
 * `If-Match: "7"`(또는 `W/"7"`, `7`)에서 버전을 읽습니다. 헤더가 없으면 빈 객체이고, 숫자가 아니면 어떤 버전과도 맞지
 * 않는 `NaN`입니다.
 */
export function expectedVersion(ifMatch: string | undefined): { expectedVersion?: number } {
  if (ifMatch === undefined) return {}
  const version = Number(ifMatch.replace(/^W\//, '').replaceAll('"', ''))
  return { expectedVersion: Number.isInteger(version) ? version : Number.NaN }
}

/** 응답 본문에 다음 요청의 `If-Match`로 쓸 `ETag`를 붙입니다. */
export function withEtag<A extends { readonly version: number }>(body: A) {
  return HttpApiSchema.withHeaders({ body, headers: { etag: `"${body.version}"` } })
}
