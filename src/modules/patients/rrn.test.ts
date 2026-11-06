import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { Id } from '../../shared/ids/ids.types.ts'
import { patientCrypto } from './patient-crypto.ts'
import { birthDateOf, maskRrn, normalizeRrn, sexOf } from './rrn.ts'

const A = 'ten_01JBQ000000000000000000001' as Id<'tenant'>
const B = 'ten_01JBQ000000000000000000002' as Id<'tenant'>
const P1 = 'pat_01JBQ000000000000000000001' as Id<'patient'>
const P2 = 'pat_01JBQ000000000000000000002' as Id<'patient'>

describe('normalizeRrn', () => {
  it('accepts with or without the hyphen and rejects impossible dates', () => {
    expect(normalizeRrn('900101-1234567')).toBe('9001011234567')
    expect(normalizeRrn(' 0402293234567 ')).toBe('0402293234567')
    expect(normalizeRrn('900231-1234567')).toBeNull()
    expect(normalizeRrn('90010-11234567')).toBeNull()
    expect(normalizeRrn('900101-123456')).toBeNull()
  })

  it('reads the century, birth date and sex from the gender digit', () => {
    expect(birthDateOf('9001011')).toBe('1990-01-01')
    expect(birthDateOf('0402293')).toBe('2004-02-29')
    expect(birthDateOf('0002294')).toBe('2000-02-29')
    expect(birthDateOf('9902290')).toBeNull()
    expect([sexOf('9001011'), sexOf('9001012'), sexOf('0101017')]).toEqual(['MALE', 'FEMALE', 'MALE'])
  })

  it('masks everything after the gender digit', () => {
    expect(maskRrn('9001011234567')).toBe('900101-1******')
  })
})

describe('PatientCrypto', () => {
  const crypto = patientCrypto(randomBytes(32))

  it('opens what it sealed, with a fresh nonce each time', () => {
    const one = crypto.sealRrn(A, P1, '9001011234567')
    expect(crypto.openRrn(A, P1, one)).toBe('9001011234567')
    expect(crypto.sealRrn(A, P1, '9001011234567')).not.toBe(one)
    expect(one).not.toContain('9001011234567')
  })

  it('refuses a sealed value moved to another patient or tenant, or another key', () => {
    const sealed = crypto.sealRrn(A, P1, '9001011234567')
    expect(() => crypto.openRrn(A, P2, sealed)).toThrow()
    expect(() => crypto.openRrn(B, P1, sealed)).toThrow()
    const other = patientCrypto(new Uint8Array(32))
    expect(() => other.openRrn(A, P1, sealed)).toThrow()
  })

  it('indexes the same number the same way within a tenant only', () => {
    expect(crypto.rrnIndex(A, '9001011234567')).toBe(crypto.rrnIndex(A, '9001011234567'))
    expect(crypto.rrnIndex(A, '9001011234567')).not.toBe(crypto.rrnIndex(B, '9001011234567'))
    expect(crypto.rrnIndex(A, '9001011234567')).not.toBe(crypto.rrnIndex(A, '9001011234568'))
  })
})
