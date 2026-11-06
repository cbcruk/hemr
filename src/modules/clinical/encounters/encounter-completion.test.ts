import { describe, expect, it } from 'vitest'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { PrescriptionLine } from '../prescriptions/prescription-line.ts'
import { judgeCompletion } from './encounter-completion.ts'
import type { Encounter } from './encounter.ts'

const primary = { id: 'dx_01JBQ000000000000000000001' as Id<'diagnosis'>, code: 'U23.4', kind: 'PRIMARY' } as const
const line = (n: number, overrides: Partial<PrescriptionLine> = {}): PrescriptionLine => ({
  id: `pl_01JBQ00000000000000000000${n}` as Id<'prescriptionLine'>,
  kind: 'CONSULTATION',
  feeCode: '10200',
  categoryCode: '31001001',
  name: '재진진찰료',
  dose: { perDay: 1, days: 1 },
  unitPrice: 10_000,
  amount: 10_000,
  prn: false,
  ...overrides,
})
const encounter = (n: number, overrides: Partial<Encounter> = {}): Encounter => ({
  id: `enc_01JBQ00000000000000000000${n}` as Encounter['id'],
  tenantId: 'ten_01JBQ000000000000000000001' as Encounter['tenantId'],
  patientId: 'pat_01JBQ000000000000000000001' as Encounter['patientId'],
  visitId: null,
  doctorId: null,
  encounterType: 'OFFICE',
  coverage: 'NHIS',
  // 서울 2026-11-06 09:00
  serviceAt: '2026-11-06T00:00:00.000Z',
  note: { body: '' },
  diagnoses: [primary],
  prescriptionLines: [line(n)],
  benefitFlags: { fullSelfPay: false, pregnant: false },
  status: 'DRAFT',
  completedAt: null,
  revision: 0,
  locked: false,
  retraction: null,
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:00:00.000Z',
  version: 1,
  ...overrides,
})

describe('judgeCompletion', () => {
  it('passes an encounter with one primary diagnosis and lines its coverage can use', () => {
    expect(judgeCompletion({ encounter: encounter(1), others: [], acknowledge: [] })).toEqual({
      violations: [],
      acknowledged: [],
    })
  })

  it('needs exactly one primary diagnosis, even when there are no diagnoses yet', () => {
    const codes = (diagnoses: Encounter['diagnoses']) =>
      judgeCompletion({ encounter: encounter(1, { diagnoses }), others: [], acknowledge: [] }).violations.map(
        (each) => each.code,
      )

    expect(codes([])).toEqual(['PRIMARY_DIAGNOSIS_MISSING'])
    expect(codes([{ ...primary, kind: 'SECONDARY' }])).toEqual(['PRIMARY_DIAGNOSIS_MISSING'])
    expect(codes([primary, { ...primary, code: 'M54.5' }])).toEqual(['PRIMARY_DIAGNOSIS_MULTIPLE'])
  })

  it('blocks lines reserved for another coverage and pilot herbal lines without approval', () => {
    const lines = [
      line(1),
      line(2, { categoryCode: '73001001' }),
      line(3, { kind: 'PILOT_HERBAL', categoryCode: '35001001' }),
    ]
    const result = judgeCompletion({
      encounter: encounter(1, { prescriptionLines: lines }),
      others: [],
      acknowledge: [],
    })

    expect(result.violations).toEqual([
      { code: 'COVERAGE_CATEGORY_MISMATCH', message: expect.any(String), targets: [lines[1]!.id, lines[2]!.id] },
      { code: 'PILOT_HERBAL_NOT_APPROVED', message: expect.any(String), targets: [lines[2]!.id] },
    ])
  })

  it('blocks a second consultation fee on the same day unless acknowledged', () => {
    const others = [
      encounter(2, { status: 'COMPLETED' }),
      // 초안, 철회한 진료와 다른 날 진료는 세지 않습니다
      encounter(3),
      encounter(4, { status: 'ENTERED_IN_ERROR' }),
      encounter(5, { status: 'COMPLETED', serviceAt: '2026-11-05T00:00:00.000Z' }),
    ]

    expect(judgeCompletion({ encounter: encounter(1), others, acknowledge: [] }).violations).toEqual([
      { code: 'DUPLICATE_CONSULTATION_FEE', message: expect.any(String), targets: [others[0]!.id] },
    ])
    expect(judgeCompletion({ encounter: encounter(1), others, acknowledge: ['DUPLICATE_CONSULTATION_FEE'] })).toEqual({
      violations: [],
      acknowledged: ['DUPLICATE_CONSULTATION_FEE'],
    })
    // 자기 자신은 비교하지 않고, 건보·의료급여가 아닌 진료는 검사하지 않습니다
    expect(judgeCompletion({ encounter: encounter(2), others, acknowledge: [] }).violations).toEqual([])
    expect(
      judgeCompletion({ encounter: encounter(1, { coverage: 'SELF_PAY' }), others, acknowledge: [] }).violations,
    ).toEqual([])
  })

  it('compares days in the clinic time zone', () => {
    // UTC로는 같은 날이지만 서울로는 11-06과 11-07입니다
    const late = encounter(2, { status: 'COMPLETED', serviceAt: '2026-11-06T15:30:00.000Z' })
    const early = encounter(1, { serviceAt: '2026-11-06T00:30:00.000Z' })

    expect(judgeCompletion({ encounter: early, others: [late], acknowledge: [] }).violations).toEqual([])
  })
})
