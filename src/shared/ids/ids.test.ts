import { describe, expect, it } from 'vitest'
import { isId, newId } from './ids.ts'

describe('newId', () => {
  it('prefixes the ULID with the entity kind', () => {
    expect(newId('patient')).toMatch(/^pat_[0-9A-HJKMNP-TV-Z]{26}$/)
  })

  it('sorts by creation time', () => {
    expect(newId('visit', 1_000) < newId('visit', 2_000)).toBe(true)
  })
})

describe('isId', () => {
  it('accepts an id of the same kind', () => {
    expect(isId('visit', newId('visit'))).toBe(true)
  })

  it('rejects an id of another kind', () => {
    expect(isId('visit', newId('patient'))).toBe(false)
  })

  it('rejects malformed values', () => {
    expect(isId('visit', 'vis_123')).toBe(false)
    expect(isId('visit', 42)).toBe(false)
  })
})
