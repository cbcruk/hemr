import { Effect, Option } from 'effect'
import type { Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../persistence.ts'
import { newId } from '../../shared/ids/ids.ts'
import type { Id } from '../../shared/ids/ids.types.ts'
import { classifyQuery } from './patient.ts'
import type { PatientRecord } from './patient.ts'
import { PatientRepository } from './patient-repository.ts'
import type { NewPatientRecord } from './patient-repository.ts'

const A = 'ten_01JBQ000000000000000000001' as Id<'tenant'>
const B = 'ten_01JBQ000000000000000000002' as Id<'tenant'>

const patient = (overrides: Partial<NewPatientRecord> = {}): NewPatientRecord => ({
  id: newId('patient'),
  tenantId: A,
  chartNumber: null,
  name: '홍길동',
  rrnSealed: null,
  rrnIndex: null,
  rrnMasked: null,
  birthDate: null,
  isLunarBirthday: false,
  sex: null,
  contacts: [],
  addresses: [],
  notes: null,
  firstVisitDate: null,
  status: 'ACTIVE',
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:00:00.000Z',
  version: 1,
  ...overrides,
})
const withRrn = (index: string) => ({ rrnSealed: `sealed-${index}`, rrnIndex: index, rrnMasked: '900101-1******' })

const run = <A, E>(layer: Layer.Layer<PatientRepository, unknown>, program: Effect.Effect<A, E, PatientRepository>) =>
  Effect.runPromise(program.pipe(Effect.provide(layer)))

describe.each([
  ['memory', () => PersistenceMemory()],
  ['sqlite', () => PersistenceSqlite(':memory:')],
] as const)('PatientRepository (%s)', (_, layer) => {
  it('numbers charts after the largest numeric chart number of the tenant', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* PatientRepository
        const first = yield* repository.create(patient(), () => [])
        yield* repository.create(patient({ chartNumber: '0041' }), () => [])
        yield* repository.create(patient({ chartNumber: 'A-9999' }), () => [])
        const next = yield* repository.create(patient(), () => [])
        const other = yield* repository.create(patient({ tenantId: B }), () => [])
        return {
          first: first.chartNumber,
          next: next.chartNumber,
          other: other.chartNumber,
          shown: yield* repository.nextChartNumber(A),
        }
      }),
    )
    expect(result).toEqual({ first: '1', next: '42', other: '1', shown: '43' })
  })

  it('never hands out the same automatic chart number to concurrent registrations', async () => {
    const numbers = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* PatientRepository
        const saved = yield* Effect.all(
          Array.from({ length: 10 }, () => repository.create(patient(), () => [])),
          { concurrency: 'unbounded' },
        )
        return saved.map((each) => each.chartNumber)
      }),
    )
    expect(new Set(numbers).size).toBe(10)
  })

  it('refuses a taken chart number or RRN within the tenant only', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* PatientRepository
        const first = yield* repository.create(patient({ chartNumber: '7', ...withRrn('rrn-1') }), () => [])
        const chart = yield* Effect.flip(repository.create(patient({ chartNumber: '7' }), () => []))
        const rrn = yield* Effect.flip(repository.create(patient({ ...withRrn('rrn-1') }), () => []))
        const otherTenant = yield* repository.create(
          patient({ tenantId: B, chartNumber: '7', ...withRrn('rrn-1') }),
          () => [],
        )
        return { first, chart, rrn, otherTenant }
      }),
    )
    expect(result.chart).toMatchObject({ code: 'CHART_NUMBER_TAKEN', chartNumber: '7' })
    expect(result.rrn).toMatchObject({ code: 'PATIENT_DUPLICATE_RRN', patientId: result.first.id })
    expect(result.otherTenant.chartNumber).toBe('7')
  })

  it('updates with the expected version and checks uniqueness against other patients', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* PatientRepository
        const one = yield* repository.create(patient({ chartNumber: '1', ...withRrn('rrn-1') }), () => [])
        const two = yield* repository.create(patient({ chartNumber: '2' }), () => [])
        const renamed: PatientRecord = { ...one, name: '홍길순', version: 2 }
        yield* repository.update(renamed, { expectedVersion: 1, events: [] })
        return {
          stale: yield* Effect.flip(repository.update({ ...renamed, version: 3 }, { expectedVersion: 1, events: [] })),
          chart: yield* Effect.flip(
            repository.update({ ...two, chartNumber: '1', version: 2 }, { expectedVersion: 1, events: [] }),
          ),
          rrn: yield* Effect.flip(
            repository.update({ ...two, ...withRrn('rrn-1'), version: 2 }, { expectedVersion: 1, events: [] }),
          ),
          otherTenant: yield* Effect.flip(
            repository.update({ ...renamed, tenantId: B, version: 3 }, { expectedVersion: 2, events: [] }),
          ),
          found: yield* repository.findById(A, one.id),
          hidden: yield* repository.findById(B, one.id),
        }
      }),
    )
    expect(result.stale).toMatchObject({ code: 'VERSION_MISMATCH', currentVersion: 2 })
    expect(result.chart).toMatchObject({ code: 'CHART_NUMBER_TAKEN' })
    expect(result.rrn).toMatchObject({ code: 'PATIENT_DUPLICATE_RRN' })
    expect(result.otherTenant).toMatchObject({ code: 'VERSION_MISMATCH', currentVersion: 0 })
    expect(Option.getOrThrow(result.found)).toMatchObject({ name: '홍길순', version: 2 })
    expect(Option.isNone(result.hidden)).toBe(true)
  })

  it('searches by name, initials, chart number and phone ending, in name order', async () => {
    const names = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* PatientRepository
        const mobile = (number: string) => [{ kind: 'MOBILE' as const, number, isPrimary: true }]
        yield* repository.create(
          patient({ name: '김원장', chartNumber: '120', contacts: mobile('010-1111-5678') }),
          () => [],
        )
        yield* repository.create(
          patient({ name: '이수진', chartNumber: '1201', contacts: mobile('010-5678-0000') }),
          () => [],
        )
        yield* repository.create(patient({ name: 'Kim Jane', chartNumber: 'K-7' }), () => [])
        yield* repository.create(patient({ name: '100%', chartNumber: '9' }), () => [])
        yield* repository.create(patient({ tenantId: B, name: '김원장' }), () => [])
        const search = (q: string) =>
          repository
            .search(A, { query: classifyQuery(q), limit: 10, after: null })
            .pipe(Effect.map((rows) => rows.map((each) => each.name)))
        return {
          name: yield* search('원장'),
          initials: yield* search('ㅇㅅ'),
          chart: yield* search('120'),
          phone: yield* search('5678'),
          hyphenated: yield* search('1111-5678'),
          latin: yield* search('jane'),
          chartLetters: yield* search('k-'),
          wildcard: yield* search('%'),
          all: yield* search(' '),
        }
      }),
    )
    expect(names).toEqual({
      name: ['김원장'],
      initials: ['이수진'],
      chart: ['김원장', '이수진'],
      phone: ['김원장'],
      hyphenated: ['김원장'],
      latin: ['Kim Jane'],
      chartLetters: ['Kim Jane'],
      wildcard: ['100%'],
      all: ['100%', 'Kim Jane', '김원장', '이수진'],
    })
  })

  it('pages by name then id', async () => {
    const pages = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* PatientRepository
        for (const name of ['나', '가', '다', '가']) yield* repository.create(patient({ name }), () => [])
        const first = yield* repository.search(A, { query: null, limit: 2, after: null })
        const last = first.at(-1)!
        const second = yield* repository.search(A, { query: null, limit: 2, after: { name: last.name, id: last.id } })
        return [first, second].map((page) => page.map((each) => each.name))
      }),
    )
    expect(pages).toEqual([
      ['가', '가'],
      ['나', '다'],
    ])
  })

  it('keeps consent records in order, per tenant', async () => {
    const result = await run(
      layer(),
      Effect.gen(function* () {
        const repository = yield* PatientRepository
        const one = yield* repository.create(patient(), () => [])
        const consent = (status: 'GRANTED' | 'WITHDRAWN') => ({
          patientId: one.id,
          purpose: 'MARKETING_SMS',
          status,
          source: 'DESK' as const,
          decidedAt: '2026-11-06T00:00:00.000Z',
          decidedBy: null,
          evidenceDocumentId: null,
        })
        yield* repository.appendConsent(A, consent('GRANTED'), [])
        yield* repository.appendConsent(A, consent('WITHDRAWN'), [])
        return {
          own: yield* repository.consentsOf(A, [one.id]),
          other: yield* repository.consentsOf(B, [one.id]),
          none: yield* repository.consentsOf(A, []),
        }
      }),
    )
    expect(result.own.map((each) => each.status)).toEqual(['GRANTED', 'WITHDRAWN'])
    expect(result.other).toEqual([])
    expect(result.none).toEqual([])
  })
})
