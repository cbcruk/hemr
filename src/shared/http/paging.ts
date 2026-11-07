import { Schema } from 'effect'

// 목록의 커서 쪽 넘김 인자입니다 (conventions.md 목록). 변환 Schema는 문서에 인코딩 쪽(문자열)만 나오므로 설명을
// 그쪽에 답니다
export const PageLimit = Schema.String.annotate({
  description: '한 쪽의 개수입니다. 1–200이고 기본값은 50입니다.',
}).pipe(Schema.decodeTo(Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 200 }))))

/** 앞 쪽 응답의 `nextCursor`를 받는 쿼리입니다. `maxLength`는 목록마다 다릅니다. */
export const PageCursor = (maxLength: number) =>
  Schema.String.check(Schema.isMaxLength(maxLength)).annotate({ description: '앞 쪽 응답의 `nextCursor`입니다.' })

/** 커서로 넘기는 목록의 한 쪽입니다. `description`은 응답 설명이 됩니다. */
export const Page = <S extends Schema.Top>(item: S, description: string) =>
  Schema.Struct({
    items: Schema.Array(item),
    nextCursor: Schema.NullOr(Schema.String).annotate({
      description: '다음 쪽을 받을 커서입니다. 마지막 쪽이면 `null`입니다.',
    }),
  }).annotate({ description })
