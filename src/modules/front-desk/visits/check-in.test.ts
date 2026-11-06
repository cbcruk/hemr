import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { TEST_TENANT, testMember } from '../../identity/auth/testing.ts'
import { TestPatientCrypto } from '../../patients/patient-crypto.ts'
import { Patients } from '../../patients/patients.ts'
import { Visits } from './visits.ts'
import type { CheckInInput } from './visits.ts'

/** 요양기관기호가 있는 병원입니다. 선택의료기관 판정에 씁니다. */
const CLINIC_CODE = '12345678'
const desk = testMember({ role: 'FRONT_DESK', tenant: { ...TEST_TENANT, hiraInstitutionCode: CLINIC_CODE } })
const otherTenant = testMember({
  tenant: { ...TEST_TENANT, id: 'ten_01JBQ000000000000000000002' as typeof TEST_TENANT.id },
})

/** 성인 건보 자격입니다. */
const NHIS = { qualificationCode: '1', selectedInstitutionCodes: [] }

type Services = Visits | Patients | Outbox | CurrentAccess

const run = <A, E>(program: Effect.Effect<A, E, Services>, store: 'memory' | 'sqlite') =>
  Effect.runPromise(
    program.pipe(
      Effect.provideService(CurrentAccess, desk.access),
      Effect.provide(
        Visits.layer.pipe(
          Layer.provideMerge(Patients.layer),
          Layer.provideMerge(Layer.mergeAll(desk.seed, otherTenant.seed)),
          Layer.provideMerge(store === 'memory' ? PersistenceMemory() : PersistenceSqlite(':memory:')),
          Layer.provideMerge(TestPatientCrypto),
        ),
      ),
    ),
  )

/** 환자를 등록하고 그 환자로 접수하는 함수를 돌려줍니다. */
const registered = (birthDate = '1990-01-01') =>
  Effect.gen(function* () {
    const patient = yield* (yield* Patients).register({ name: '홍길동', birthDate })
    const visits = yield* Visits
    return {
      patient,
      checkIn: (input: Omit<CheckInInput, 'patientId'>) => visits.checkIn({ patientId: patient.id, ...input }),
    }
  })

describe.each(['memory', 'sqlite'] as const)('Visits.checkIn (%s)', (store) => {
  it('checks a patient in for today and emits one visit.checked_in', async () => {
    const result = await run(
      Effect.gen(function* () {
        const { patient, checkIn } = yield* registered()
        const visit = yield* checkIn({ coverage: 'SELF_PAY', eligibility: { ...NHIS }, copayCode: 'U001' })
        const pending = yield* (yield* Outbox).pending(10)
        return { patient, visit, events: pending.filter((row) => row.event.type.startsWith('visit.')) }
      }),
      store,
    )
    expect(result.visit).toMatchObject({
      tenantId: TEST_TENANT.id,
      patientId: result.patient.id,
      date: clinicDate(Date.now()),
      coverage: 'SELF_PAY',
      isFirstVisit: true,
      status: 'WAITING',
      hasClinicalData: false,
      version: 1,
      // 일반 접수는 판정에 쓰지 않은 자격 결과를 남기지 않습니다
      eligibility: { status: 'NOT_REQUIRED', nhis: null, copayCode: null, selectedInstitutionCode: null },
    })
    expect(result.visit.statusChangedAt).toBe(result.visit.checkedInAt)
    expect(result.events.map((row) => [row.event.type, row.event.tenantId, row.event.actor, row.event.data])).toEqual([
      [
        'visit.checked_in',
        TEST_TENANT.id,
        { kind: 'USER', id: desk.user.id },
        {
          visitId: result.visit.id,
          patientId: result.patient.id,
          date: result.visit.date,
          coverage: 'SELF_PAY',
          isFirstVisit: true,
          status: 'WAITING',
        },
      ],
    ])
  })

  it('rejects with every blocking reason and writes nothing', async () => {
    const result = await run(
      Effect.gen(function* () {
        const { checkIn } = yield* registered()
        const error = yield* Effect.flip(
          checkIn({
            coverage: 'AUTO_INSURANCE',
            autoInsurance: { limit: 100, accumulatedCost: 101, endDate: '2000-01-01' },
          }),
        )
        const nhis = yield* Effect.flip(checkIn({ coverage: 'NHIS' }))
        return { error, nhis, listed: yield* (yield* Visits).list({}), pending: yield* (yield* Outbox).pending(10) }
      }),
      store,
    )
    expect(result.error).toMatchObject({
      code: 'CHECK_IN_REJECTED',
      errors: ['AUTO_INSURANCE_LIMIT_EXCEEDED', 'AUTO_INSURANCE_CASE_EXPIRED'],
    })
    expect(result.nhis).toMatchObject({ errors: ['NHIS_NOT_ELIGIBLE', 'IDENTITY_VERIFICATION_REQUIRED'] })
    expect(result.listed).toEqual([])
    expect(result.pending.map((row) => row.event.type)).toEqual(['patient.created'])
  })

  it('counts identity checks and first visits from earlier visits that were not canceled', async () => {
    const result = await run(
      Effect.gen(function* () {
        const { checkIn } = yield* registered()
        const visits = yield* Visits
        const first = yield* checkIn({ coverage: 'NHIS', eligibility: NHIS, identityVerified: true })
        const second = yield* checkIn({ coverage: 'NHIS', eligibility: NHIS })
        yield* visits.apply(first.id, 'CANCEL', { reason: '잘못 접수' })
        yield* visits.apply(second.id, 'CANCEL', { reason: '잘못 접수' })
        const afterCancel = yield* Effect.flip(checkIn({ coverage: 'NHIS', eligibility: NHIS }))
        const third = yield* checkIn({ coverage: 'SELF_PAY' })
        return { first, second, afterCancel, third }
      }),
      store,
    )
    expect(result.first).toMatchObject({
      isFirstVisit: true,
      eligibility: { status: 'VERIFIED', identityVerified: true },
    })
    expect(result.second).toMatchObject({ isFirstVisit: false, eligibility: { identityVerified: false } })
    expect(result.afterCancel).toMatchObject({ errors: ['IDENTITY_VERIFICATION_REQUIRED'] })
    expect(result.third.isFirstVisit).toBe(true)
  })

  it('exempts a minor or a pregnant patient from the identity check', async () => {
    const result = await run(
      Effect.gen(function* () {
        const minor = yield* registered('2015-01-01')
        const adult = yield* registered()
        return [
          yield* minor.checkIn({ coverage: 'NHIS', eligibility: NHIS }),
          yield* adult.checkIn({ coverage: 'NHIS', eligibility: NHIS, benefitFlags: { pregnant: true } }),
        ]
      }),
      store,
    )
    expect(result.map((each) => each.benefitFlags)).toEqual([
      { fullSelfPay: false, pregnant: false },
      { fullSelfPay: false, pregnant: true },
    ])
  })

  it('stores the eligibility it judged, with the arrears flag and the selected institution of the clinic', async () => {
    const result = await run(
      Effect.gen(function* () {
        const { checkIn } = yield* registered()
        const enrollee = {
          qualificationCode: '7',
          copayCode: 'M001',
          selectedInstitutionCodes: ['99999999'],
          identityExempt: true,
        }
        const missing = yield* Effect.flip(checkIn({ coverage: 'MEDICAL_AID', eligibility: enrollee }))
        const ownClinic = yield* checkIn({
          coverage: 'MEDICAL_AID',
          eligibility: { ...enrollee, selectedInstitutionCodes: [CLINIC_CODE] },
        })
        const referred = yield* checkIn({
          coverage: 'MEDICAL_AID',
          eligibility: enrollee,
          copayCode: 'B005',
          selectedInstitutionCode: '99999999',
        })
        const arrears = yield* checkIn({
          coverage: 'NHIS',
          eligibility: { ...NHIS, benefitRestrictionCode: '2', identityExempt: true },
        })
        return { missing, ownClinic, referred, arrears }
      }),
      store,
    )
    expect(result.missing).toMatchObject({ errors: ['SELECTED_INSTITUTION_REQUIRED'] })
    expect(result.ownClinic.eligibility).toEqual({
      status: 'VERIFIED',
      nhis: {
        qualificationCode: '7',
        benefitRestrictionCode: null,
        copayCode: 'M001',
        selectedInstitutionCodes: [CLINIC_CODE],
        identityExempt: true,
      },
      identityVerified: false,
      benefitRestricted: false,
      copayCode: null,
      selectedInstitutionCode: null,
    })
    expect(result.referred.eligibility).toMatchObject({ copayCode: 'B005', selectedInstitutionCode: '99999999' })
    expect(result.arrears.eligibility).toMatchObject({ benefitRestricted: true })
  })

  it('refuses a taken visit ID and a patient of another tenant', async () => {
    const result = await run(
      Effect.gen(function* () {
        const { checkIn } = yield* registered()
        const elsewhere = yield* (yield* Patients)
          .register({ name: '김' })
          .pipe(Effect.provideService(CurrentAccess, otherTenant.access))
        const id = 'vis_01JBQ0000000000000000000AA' as NonNullable<CheckInInput['id']>
        const first = yield* checkIn({ id, coverage: 'SELF_PAY', initialStatus: 'IN_TREATMENT' })
        const again = yield* Effect.flip(checkIn({ id, coverage: 'SELF_PAY' }))
        const hidden = yield* Effect.flip((yield* Visits).checkIn({ patientId: elsewhere.id, coverage: 'SELF_PAY' }))
        return { first, again, hidden, stored: yield* (yield* Visits).get(id) }
      }),
      store,
    )
    expect(result.first).toMatchObject({ id: 'vis_01JBQ0000000000000000000AA', status: 'IN_TREATMENT' })
    expect(result.again).toMatchObject({ code: 'VISIT_ALREADY_EXISTS' })
    expect(result.hidden).toMatchObject({ code: 'PATIENT_NOT_FOUND' })
    expect(result.stored).toEqual(result.first)
  })
})
