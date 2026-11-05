import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { NotFound, problemType } from './problem.ts'

describe('problemType', () => {
  it('turns an error code into a hemr problem URN', () => {
    expect(problemType('APPOINTMENT_SLOT_FULL')).toBe('urn:hemr:problem:appointment-slot-full')
  })
})

describe('NotFound', () => {
  it('encodes to RFC 9457 fields and omits empty optionals', () => {
    expect(Schema.encodeSync(NotFound)(new NotFound({}))).toEqual({
      type: 'urn:hemr:problem:not-found',
      title: 'Resource not found',
      status: 404,
      code: 'NOT_FOUND',
    })
  })
})
