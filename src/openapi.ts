import { OpenApi } from 'effect/http-api'
import { Api } from './api.ts'

/**
 * HTTP 계약(`Api`)에서 만든 OpenAPI 3.1 문서입니다. Schema의 `title`·`description`과 엔드포인트의
 * `OpenApi.Summary`가 한글 설명으로 들어갑니다(conventions.md 코드의 용어). 저장한 사본은
 * `docs/reference/openapi.json`이고 `pnpm openapi`로 다시 만듭니다.
 */
export function openApiDocument(): OpenApi.OpenAPISpec {
  const spec = OpenApi.fromApi(Api)
  // 라우터는 커맨드 경로의 콜론을 `::`로 적습니다(`/visits/:id::cancel`). 문서에는 실제 경로(`/visits/{id}:cancel`)를 씁니다
  const paths = Object.fromEntries(Object.entries(spec.paths).map(([path, item]) => [path.replaceAll('::', ':'), item]))
  return { ...spec, paths }
}

/** 저장하는 형태입니다. 두 칸 들여쓰기와 마지막 줄바꿈입니다. */
export const openApiJson = (): string => `${JSON.stringify(openApiDocument(), null, 2)}\n`
