import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { PersistenceMemory, PersistenceSqlite } from '../../../persistence.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { Visits } from '../../front-desk/visits/visits.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import { testMember } from '../../identity/auth/testing.ts'
import { TestPatientCrypto } from '../../patients/patient-crypto.ts'
import { Patients } from '../../patients/patients.ts'
import { Encounters } from '../encounters/encounters.ts'
import { ProcedureTimerSweep, Procedures } from './procedures.ts'

const doctor = testMember({ role: 'OWNER_DOCTOR' })

type Services = Procedures | Encounters | Visits | Patients | Outbox | CurrentAccess

const run = <A, E>(program: Effect.Effect<A, E, Services>, store: 'memory' | 'sqlite', sweep = false) =>
  Effect.runPromise(
    program.pipe(
      Effect.provideService(CurrentAccess, doctor.access),
      Effect.provide(
        Encounters.layer.pipe(
          Layer.provideMerge(sweep ? ProcedureTimerSweep(20) : Layer.empty),
          Layer.provideMerge(Procedures.layer),
          Layer.provideMerge(Visits.layer),
          Layer.provideMerge(Patients.layer),
          Layer.provideMerge(doctor.seed),
          Layer.provideMerge(store === 'memory' ? PersistenceMemory() : PersistenceSqlite(':memory:')),
          Layer.provideMerge(TestPatientCrypto),
        ),
      ),
    ),
  )

/** 접수해 오늘 대기 내원을 만듭니다. */
const checkedIn = Effect.gen(function* () {
  const patient = yield* (yield* Patients).register({ name: '홍길동' })
  return yield* (yield* Visits).checkIn({ patientId: patient.id, coverage: 'SELF_PAY' })
})

/** 시술 이벤트의 종류입니다. */
const procedureEvents = Effect.gen(function* () {
  const pending = yield* (yield* Outbox).pending(100)
  return pending.map((row) => row.event.type).filter((type) => type.startsWith('procedure.'))
})

describe.each(['memory', 'sqlite'] as const)('Procedures (%s)', (store) => {
  it('adds pending procedures at the end with default duration and assignee', async () => {
    const result = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const procedures = yield* Procedures
        yield* procedures.add(visit.id, { name: '침' })
        yield* procedures.add(visit.id, { name: '부항', durationSeconds: 600, assignee: 'DOCTOR' })
        return { listed: yield* procedures.listForVisit(visit.id), events: yield* procedureEvents }
      }),
      store,
    )
    expect(result.listed).toMatchObject([
      { name: '침', order: 0, durationSeconds: 300, assignee: 'STAFF', status: 'PENDING', version: 1 },
      { name: '부항', order: 1, durationSeconds: 600, assignee: 'DOCTOR', status: 'PENDING' },
    ])
    expect(result.events).toEqual(['procedure.created', 'procedure.created'])
  })

  it('starts a procedure, refuses to start it again and lets the server timer elapse it', async () => {
    const result = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const procedures = yield* Procedures
        const added = yield* procedures.add(visit.id, { name: '침', durationSeconds: 60 })
        const [started] = yield* procedures.start(added.id)
        const again = yield* Effect.flip(procedures.start(added.id))
        const later = Date.parse(started!.timerEndsAt!) + 1
        const swept = yield* procedures.sweep(later)
        const sweptAgain = yield* procedures.sweep(later)
        return { started, again, swept, sweptAgain, listed: yield* procedures.listForVisit(visit.id) }
      }),
      store,
    )
    expect(result.started).toMatchObject({ status: 'RUNNING', version: 2 })
    expect(Date.parse(result.started!.timerEndsAt!) - Date.parse(result.started!.startedAt!)).toBe(60_000)
    expect(result.again).toMatchObject({ code: 'PROCEDURE_TRANSITION_INVALID', currentStatus: 'RUNNING' })
    expect(result.swept).toBe(1)
    expect(result.sweptAgain).toBe(0)
    expect(result.listed).toMatchObject([{ status: 'TIMER_ELAPSED', version: 3 }])
  })

  it('completes elapsed procedures of the visit when the next one starts', async () => {
    const result = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const procedures = yield* Procedures
        const first = yield* procedures.add(visit.id, { name: '침', durationSeconds: 1 })
        const second = yield* procedures.add(visit.id, { name: '부항' })
        const [started] = yield* procedures.start(first.id)
        yield* procedures.sweep(Date.parse(started!.timerEndsAt!))
        const changed = yield* procedures.start(second.id)
        return { changed: changed.map((each) => [each.name, each.status]) }
      }),
      store,
    )
    expect(result.changed).toEqual([
      ['침', 'DONE'],
      ['부항', 'RUNNING'],
    ])
  })

  it('starts and completes all procedures of a visit and reopens a done one', async () => {
    const result = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const procedures = yield* Procedures
        const first = yield* procedures.add(visit.id, { name: '침' })
        yield* procedures.add(visit.id, { name: '부항' })
        const started = yield* procedures.startAll(visit.id)
        const completed = yield* procedures.completeAll(visit.id)
        const reopened = yield* procedures.reopen(first.id)
        const reopenPending = yield* Effect.flip(procedures.reopen(first.id))
        const completePending = yield* Effect.flip(procedures.complete(first.id))
        return { started, completed, reopened, reopenPending, completePending }
      }),
      store,
    )
    expect(result.started.map((each) => each.status)).toEqual(['RUNNING', 'RUNNING'])
    expect(result.completed.map((each) => each.status)).toEqual(['DONE', 'DONE'])
    expect(result.reopened).toMatchObject({ status: 'PENDING', startedAt: null, completedAt: null })
    expect(result.reopenPending).toMatchObject({ currentStatus: 'PENDING' })
    expect(result.completePending).toMatchObject({ currentStatus: 'PENDING' })
  })

  it('restarts the timer, changes duration and refuses a done procedure', async () => {
    const result = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const procedures = yield* Procedures
        const added = yield* procedures.add(visit.id, { name: '침', durationSeconds: 60 })
        yield* procedures.start(added.id)
        const longer = yield* procedures.setDuration(added.id, 600)
        const restarted = yield* procedures.restartTimer(added.id)
        yield* procedures.complete(added.id)
        const done = yield* Effect.flip(procedures.setDuration(added.id, 60))
        const restartDone = yield* Effect.flip(procedures.restartTimer(added.id))
        return { longer, restarted, done, restartDone }
      }),
      store,
    )
    expect(Date.parse(result.longer.timerEndsAt!) - Date.parse(result.longer.startedAt!)).toBe(600_000)
    expect(result.restarted).toMatchObject({ status: 'RUNNING', durationSeconds: 600 })
    expect(result.done).toMatchObject({ code: 'PROCEDURE_TRANSITION_INVALID', currentStatus: 'DONE' })
    expect(result.restartDone).toMatchObject({ currentStatus: 'DONE' })
  })

  it('removes pending procedures only and reorders with a full permutation', async () => {
    const result = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const procedures = yield* Procedures
        const a = yield* procedures.add(visit.id, { name: 'A' })
        const b = yield* procedures.add(visit.id, { name: 'B' })
        const c = yield* procedures.add(visit.id, { name: 'C' })
        yield* procedures.start(c.id)
        const removeRunning = yield* Effect.flip(procedures.remove(c.id))
        const partial = yield* Effect.flip(procedures.reorder(visit.id, [c.id, a.id]))
        const repeated = yield* Effect.flip(procedures.reorder(visit.id, [c.id, a.id, a.id]))
        const reordered = yield* procedures.reorder(visit.id, [c.id, a.id, b.id])
        yield* procedures.remove(a.id)
        const missing = yield* Effect.flip(procedures.remove(a.id))
        return {
          removeRunning,
          partial,
          repeated,
          reordered,
          missing,
          listed: yield* procedures.listForVisit(visit.id),
        }
      }),
      store,
    )
    expect(result.removeRunning).toMatchObject({ currentStatus: 'RUNNING' })
    expect(result.partial).toMatchObject({ code: 'PROCEDURE_ORDER_INVALID' })
    expect(result.repeated).toMatchObject({ code: 'PROCEDURE_ORDER_INVALID' })
    expect(result.reordered.map((each) => [each.name, each.order])).toEqual([
      ['C', 0],
      ['A', 1],
      ['B', 2],
    ])
    expect(result.missing).toMatchObject({ code: 'PROCEDURE_NOT_FOUND' })
    expect(result.listed.map((each) => each.name)).toEqual(['C', 'B'])
  })

  it('refuses procedure commands on a canceled visit and hides it from the board', async () => {
    const result = await run(
      Effect.gen(function* () {
        const procedures = yield* Procedures
        const open = yield* checkedIn
        const canceled = yield* checkedIn
        const added = yield* procedures.add(canceled.id, { name: '침' })
        yield* procedures.add(open.id, { name: '부항' })
        yield* (yield* Visits).apply(canceled.id, 'CANCEL', { reason: '중복 접수' })
        return {
          add: yield* Effect.flip(procedures.add(canceled.id, { name: '침' })),
          start: yield* Effect.flip(procedures.start(added.id)),
          board: (yield* procedures.board(undefined)).map((each) => [each.visit.id, each.procedures.length]),
          open: open.id,
        }
      }),
      store,
    )
    expect(result.add).toMatchObject({ code: 'PROCEDURE_VISIT_CLOSED' })
    expect(result.start).toMatchObject({ code: 'PROCEDURE_VISIT_CLOSED' })
    expect(result.board).toEqual([[result.open, 1]])
  })

  it('finishes running procedures when the encounter sends the visit to checkout', async () => {
    const result = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const procedures = yield* Procedures
        const encounters = yield* Encounters
        const running = yield* procedures.add(visit.id, { name: '침' })
        yield* procedures.add(visit.id, { name: '부항' })
        yield* procedures.start(running.id)
        const encounterId = visit.encounterId as Id<'encounter'>
        yield* encounters.update(
          encounterId,
          { diagnoses: { upsert: [{ code: 'U23.4', kind: 'PRIMARY' }] } },
          { expectedVersion: 1 },
        )
        yield* encounters.complete(encounterId, { nextVisitStatus: 'AWAITING_PAYMENT', expectedVersion: 2 })
        return (yield* procedures.listForVisit(visit.id)).map((each) => each.status)
      }),
      store,
    )
    expect(result).toEqual(['DONE', 'PENDING'])
  })

  it('leaves running procedures when the encounter sends the visit to the treatment room', async () => {
    const result = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const procedures = yield* Procedures
        const encounters = yield* Encounters
        const running = yield* procedures.add(visit.id, { name: '침' })
        yield* procedures.start(running.id)
        const encounterId = visit.encounterId as Id<'encounter'>
        yield* encounters.update(
          encounterId,
          { diagnoses: { upsert: [{ code: 'U23.4', kind: 'PRIMARY' }] } },
          { expectedVersion: 1 },
        )
        yield* encounters.complete(encounterId, { expectedVersion: 2 })
        return (yield* procedures.listForVisit(visit.id)).map((each) => each.status)
      }),
      store,
    )
    expect(result).toEqual(['RUNNING'])
  })

  it('finishes running procedures when the desk already sent the visit to checkout', async () => {
    const result = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const procedures = yield* Procedures
        const encounters = yield* Encounters
        const running = yield* procedures.add(visit.id, { name: '침' })
        yield* procedures.start(running.id)
        yield* (yield* Visits).apply(visit.id, 'SEND_TO_CHECKOUT')
        const encounterId = visit.encounterId as Id<'encounter'>
        yield* encounters.update(
          encounterId,
          { diagnoses: { upsert: [{ code: 'U23.4', kind: 'PRIMARY' }] } },
          { expectedVersion: 1 },
        )
        yield* encounters.complete(encounterId, { nextVisitStatus: 'AWAITING_PAYMENT', expectedVersion: 2 })
        const pending = yield* (yield* Outbox).pending(100)
        return {
          statuses: (yield* procedures.listForVisit(visit.id)).map((each) => each.status),
          actors: pending.filter((row) => row.event.type === 'procedure.updated').map((row) => row.event.actor?.kind),
        }
      }),
      store,
    )
    expect(result.statuses).toEqual(['DONE'])
    expect(result.actors).toEqual(['USER', 'USER'])
  })

  it('writes the server timer expiry as a system event', async () => {
    const actors = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const procedures = yield* Procedures
        const added = yield* procedures.add(visit.id, { name: '침', durationSeconds: 1 })
        const [started] = yield* procedures.start(added.id)
        yield* procedures.sweep(Date.parse(started!.timerEndsAt!))
        const pending = yield* (yield* Outbox).pending(100)
        return pending
          .filter((row) => row.event.type === 'procedure.updated')
          .map((row) => [row.event.actor?.kind, (row.event.data as { status: string }).status])
      }),
      store,
    )
    expect(actors).toEqual([
      ['USER', 'RUNNING'],
      ['SYSTEM', 'TIMER_ELAPSED'],
    ])
  })

  it('refuses more procedures than the per-visit limit', async () => {
    const result = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const procedures = yield* Procedures
        for (let i = 0; i < 100; i++) yield* procedures.add(visit.id, { name: `시술 ${i}` })
        return yield* Effect.flip(procedures.add(visit.id, { name: '하나 더' }))
      }),
      store,
    )
    expect(result).toMatchObject({ code: 'PROCEDURE_LIMIT_EXCEEDED' })
  })
})

describe('ProcedureTimerSweep', () => {
  it('expires running procedures in the background', async () => {
    const status = await run(
      Effect.gen(function* () {
        const visit = yield* checkedIn
        const procedures = yield* Procedures
        const added = yield* procedures.add(visit.id, { name: '침', durationSeconds: 1 })
        yield* procedures.start(added.id)
        yield* Effect.sleep('1200 millis')
        return (yield* procedures.listForVisit(visit.id))[0]?.status
      }),
      'memory',
      true,
    )
    expect(status).toBe('TIMER_ELAPSED')
  })
})
