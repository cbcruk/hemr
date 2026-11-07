import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openApiDocument, openApiJson } from './openapi.ts'

const ROOT = join(import.meta.dirname, '..')
const DESIGN_DIR = join(ROOT, 'docs', 'design')

/** 용어 표 한 행의 업무 용어와 키 짝입니다. 용어와 키가 `/`로 같은 수만큼 나뉘면 순서대로 짝짓습니다. */
interface TermPair {
  term: string
  key: string
  /** 행의 첫 키인지입니다. 필드 이름(첫 글자 소문자)으로 맞출 때는 첫 키만 봅니다. */
  first: boolean
}

/** 도메인 문서의 `용어` 표에서 업무 용어와 키의 짝을 읽습니다. 괄호 설명은 빼고, 셀은 이스케이프하지 않은 `|`로 나눕니다. */
function termPairs(): ReadonlyArray<TermPair> {
  const pairs: TermPair[] = []
  for (const file of readdirSync(DESIGN_DIR).filter((each) => each.endsWith('.md'))) {
    let inTable = false
    for (const line of readFileSync(join(DESIGN_DIR, file), 'utf8').split('\n')) {
      if (/^#{2,3} 용어\s*$/.test(line)) inTable = true
      else if (line.startsWith('#')) inTable = false
      if (!inTable || !line.startsWith('|') || line.startsWith('|---')) continue
      const [termCell = '', keyCell = ''] = line.split(/(?<!\\)\|/).slice(1)
      const terms = termCell
        .replace(/\([^)]*\)/g, '')
        .split('/')
        .map((each) => each.trim())
      const keys = [...keyCell.matchAll(/`([^`]+)`/g)].map((match) => /[A-Za-z0-9_.]+/.exec(match[1]!)?.[0] ?? '')
      if (terms.length > 1 && terms.length === keys.length) {
        terms.forEach((term, index) => pairs.push({ term, key: keys[index]!, first: index === 0 }))
      } else {
        for (const term of terms) keys.forEach((key, index) => pairs.push({ term, key, first: index === 0 }))
      }
    }
  }
  return pairs
}

const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1)

describe('OpenAPI 문서', () => {
  it('저장한 docs/reference/openapi.json이 HTTP 계약과 같습니다 (다르면 pnpm openapi)', () => {
    expect(readFileSync(join(ROOT, 'docs', 'reference', 'openapi.json'), 'utf8')).toBe(openApiJson())
  })

  it('이름 있는 Schema가 사본(`_1`)으로 갈라지지 않습니다', () => {
    // 이름 있는 Schema에 필드에서 `annotate`하면 `Visit_1`처럼 사본이 생깁니다. 설명은 Schema 쪽에 답니다
    const names = Object.keys(openApiDocument().components.schemas)
    expect(names.filter((name) => /_\d+$/.test(name))).toEqual([])
  })

  it('오류 응답은 모두 문제 응답(`application/problem+json`)입니다', () => {
    // 문제 클래스가 아닌 Schema가 `error`에 들어가면 500 `application/json`으로 문서에 섞입니다
    const strays = Object.entries(openApiDocument().paths).flatMap(([path, item]) =>
      Object.entries(item as Record<string, { responses?: Record<string, { content?: object }> }>).flatMap(
        ([method, operation]) =>
          Object.entries(operation.responses ?? {})
            .filter(([status, response]) => Number(status) >= 400 && response.content !== undefined)
            .filter(([, response]) =>
              Object.keys(response.content!).some((type) => type !== 'application/problem+json'),
            )
            .map(([status]) => `${method} ${path} ${status}`),
      ),
    )
    expect(strays).toEqual([])
  })

  it('Schema의 title은 그 이름을 키로 둔 용어 표 행의 업무 용어입니다', () => {
    const pairs = termPairs()
    const schemas = openApiDocument().components.schemas as Record<string, { title?: string }>
    const titled = Object.entries(schemas).filter(([, schema]) => schema.title !== undefined)
    expect(titled.length).toBeGreaterThan(0)
    const unmatched = titled
      .filter(
        ([identifier, schema]) =>
          !pairs.some(
            (pair) =>
              pair.term === schema.title &&
              (pair.key === identifier || (pair.first && pair.key === lowerFirst(identifier))),
          ),
      )
      .map(([identifier, schema]) => `${identifier}: ${schema.title}`)
    expect(unmatched).toEqual([])
  })
})
