import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { openApiJson } from '../src/openapi.ts'

// HTTP 계약에서 OpenAPI 문서를 다시 만들어 저장합니다. 테스트(`src/openapi.test.ts`)가 저장본과 비교합니다
writeFileSync(join(import.meta.dirname, '..', 'docs', 'reference', 'openapi.json'), openApiJson())
