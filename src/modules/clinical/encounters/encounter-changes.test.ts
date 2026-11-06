import { describe, expect, it } from 'vitest'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { applyChanges, diagnosisWarnings } from './encounter-changes.ts'
import type { EncounterContent } from './encounter-changes.ts'
import type { Diagnosis } from './encounter.ts'

const dx = (n: number) => `dx_01JBQ00000000000000000000${n}` as Id<'diagnosis'>
const primary: Diagnosis = { id: dx(1), code: 'U23.4', kind: 'PRIMARY' }
const secondary: Diagnosis = { id: dx(2), code: 'M54.5', kind: 'SECONDARY' }
const current: EncounterContent = {
  note: { body: '<p>요통</p>' },
  diagnoses: [primary, secondary],
  prescriptionLines: [],
}

/** 새 상병 ID를 `dx_new1`부터, 처방 라인 ID를 `pl_new1`부터 차례로 만듭니다. */
const ids = () => {
  let next = 1
  let nextLine = 1
  return {
    diagnosis: () => `dx_new${next++}` as Id<'diagnosis'>,
    prescriptionLine: () => `pl_new${nextLine++}` as Id<'prescriptionLine'>,
  }
}

describe('applyChanges', () => {
  it('replaces the note and reports only the fields that changed', () => {
    expect(applyChanges(current, { note: { body: '<p>요통 호전</p>' } }, ids())).toEqual({
      ok: true,
      content: { note: { body: '<p>요통 호전</p>' }, diagnoses: [primary, secondary], prescriptionLines: [] },
      changed: ['note'],
      prescriptionLineRefs: [],
    })
    expect(applyChanges(current, { note: current.note, diagnoses: { upsert: [primary] } }, ids())).toMatchObject({
      ok: true,
      changed: [],
    })
  })

  it('removes first, then updates by ID or code in place and appends new codes', () => {
    const result = applyChanges(
      current,
      {
        diagnoses: {
          remove: [dx(2)],
          upsert: [
            { id: dx(1), code: 'U23.5', kind: 'PRIMARY' },
            { code: 'M54.5', kind: 'SECONDARY' },
            { code: 'U23.5', kind: 'SECONDARY' },
          ],
        },
      },
      ids(),
    )
    expect(result).toMatchObject({ ok: false, errors: [{ reason: 'DIAGNOSIS_DUPLICATE', target: 'U23.5' }] })

    expect(
      applyChanges(
        current,
        {
          diagnoses: {
            remove: [dx(2)],
            upsert: [
              { id: dx(1), code: 'U23.5', kind: 'PRIMARY' },
              { code: 'M54.5', kind: 'SECONDARY' },
            ],
          },
        },
        ids(),
      ),
    ).toEqual({
      ok: true,
      content: {
        note: current.note,
        diagnoses: [
          { id: dx(1), code: 'U23.5', kind: 'PRIMARY' },
          { id: 'dx_new1', code: 'M54.5', kind: 'SECONDARY' },
        ],
        prescriptionLines: [],
      },
      changed: ['diagnoses'],
      prescriptionLineRefs: [],
    })
  })

  it('changes the kind of an existing code instead of adding it twice', () => {
    expect(applyChanges(current, { diagnoses: { upsert: [{ code: 'M54.5', kind: 'PRIMARY' }] } }, ids())).toEqual({
      ok: true,
      content: { note: current.note, diagnoses: [primary, { ...secondary, kind: 'PRIMARY' }], prescriptionLines: [] },
      changed: ['diagnoses'],
      prescriptionLineRefs: [],
    })
  })

  it('rejects unknown IDs and codes taken by another diagnosis, with every reason', () => {
    expect(
      applyChanges(
        current,
        {
          diagnoses: {
            remove: [dx(7)],
            upsert: [
              { id: dx(8), code: 'R51', kind: 'SECONDARY' },
              { id: dx(1), code: 'M54.5', kind: 'PRIMARY' },
            ],
          },
        },
        ids(),
      ),
    ).toEqual({
      ok: false,
      errors: [
        { reason: 'DIAGNOSIS_NOT_FOUND', target: dx(7) },
        { reason: 'DIAGNOSIS_NOT_FOUND', target: dx(8) },
        { reason: 'DIAGNOSIS_DUPLICATE', target: 'M54.5' },
      ],
    })
  })

  it('does not update a diagnosis removed in the same change', () => {
    expect(
      applyChanges(
        current,
        { diagnoses: { remove: [dx(1)], upsert: [{ id: dx(1), code: 'U23.4', kind: 'PRIMARY' }] } },
        ids(),
      ),
    ).toEqual({ ok: false, errors: [{ reason: 'DIAGNOSIS_NOT_FOUND', target: dx(1) }] })
  })

  it('rejects the same diagnosis ID sent twice instead of letting the last one win', () => {
    expect(
      applyChanges(
        current,
        {
          diagnoses: {
            upsert: [
              { id: dx(1), code: 'R51', kind: 'PRIMARY' },
              { id: dx(1), code: 'R52', kind: 'PRIMARY' },
            ],
          },
        },
        ids(),
      ),
    ).toEqual({ ok: false, errors: [{ reason: 'DIAGNOSIS_DUPLICATE', target: dx(1) }] })
  })
})

describe('diagnosisWarnings', () => {
  it('warns about the primary diagnosis once there is any diagnosis', () => {
    expect(diagnosisWarnings([])).toEqual([])
    expect(diagnosisWarnings([primary, secondary])).toEqual([])
    expect(diagnosisWarnings([secondary]).map((each) => each.code)).toEqual(['PRIMARY_DIAGNOSIS_MISSING'])
    expect(diagnosisWarnings([primary, { ...secondary, kind: 'PRIMARY' }]).map((each) => each.code)).toEqual([
      'PRIMARY_DIAGNOSIS_MULTIPLE',
    ])
  })
})
