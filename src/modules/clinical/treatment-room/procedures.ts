import { Context, DateTime, Duration, Effect, Layer, Option, Schedule } from 'effect'
import { Transaction } from '../../../shared/db/transaction.ts'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import { newId } from '../../../shared/ids/ids.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { VersionMismatch } from '../../../shared/problem/problem.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import { VisitNotFound } from '../../front-desk/visits/visit.ts'
import type { Visit } from '../../front-desk/visits/visit.ts'
import { VisitRepository } from '../../front-desk/visits/visit-repository.ts'
import { CurrentAccess } from '../../identity/auth/access.ts'
import {
  DEFAULT_PROCEDURE_TIMER_SETTINGS,
  elapseDueTimers,
  setProcedureDuration,
  startProcedures,
  timerEndsAt,
} from './procedure-timer.ts'
import type { ProcedureTimer } from './procedure-timer.ts'
import {
  MAX_PROCEDURES_PER_VISIT,
  ProcedureDurationRejected,
  ProcedureLimitExceeded,
  ProcedureNotFound,
  ProcedureOrderInvalid,
  ProcedureTransitionInvalid,
  ProcedureVisitClosed,
} from './procedure.ts'
import type { Procedure } from './procedure.ts'
import { ProcedureRepository } from './procedure-repository.ts'
import type { ProcedureWrite } from './procedure-repository.ts'

export interface AddProcedureInput {
  name: string
  /** 없으면 설정의 기본 시간(`defaultItemSeconds`)입니다. */
  durationSeconds?: number
  /** 없으면 `STAFF`입니다. */
  assignee?: Procedure['assignee']
  sourcePrescriptionLineId?: Id<'prescriptionLine'>
}

/** 치료실 보드의 내원 하나입니다. */
export interface BoardEntry {
  visit: Visit
  procedures: ReadonlyArray<Procedure>
}

/** 시술 커맨드의 오류입니다. */
export type ProcedureCommandError = ProcedureNotFound | ProcedureTransitionInvalid | ProcedureVisitClosed

/** 누가 바꿨는지입니다. 서버 타이머는 `SYSTEM`입니다. */
type Actor = Required<Pick<DomainEvent, 'tenantId' | 'actor'>>

/**
 * 치료실 시술입니다 (clinical.md 치료실). 모든 작업은 현재 사용자가 고른 병원 안에서 하고, 다른 병원의 시술·내원은
 * 404입니다. 판정은 `procedure-timer.ts`가 하고, 이 서비스는 읽기·판정·쓰기를 한 트랜잭션에서 합니다.
 *
 * 치료실 커맨드는 `If-Match`를 받지 않습니다. 한 화면을 여러 치료사가 빠르게 누르는 곳이라, 같은 시술을 두 번 시작하면
 * 뒤 요청이 상태 전이로 거절(409)되는 것으로 충분합니다.
 */
export class Procedures extends Context.Service<
  Procedures,
  {
    /** 내원의 시술입니다. `order` 순서입니다. 다른 병원의 내원은 404 `VISIT_NOT_FOUND`입니다. */
    listForVisit(visitId: Id<'visit'>): Effect.Effect<ReadonlyArray<Procedure>, VisitNotFound, CurrentAccess>

    /** 그날 취소하지 않은 내원과 그 시술입니다. 접수 시각 순서입니다. 날짜가 없으면 오늘입니다. */
    board(date: string | undefined): Effect.Effect<ReadonlyArray<BoardEntry>, never, CurrentAccess>

    /**
     * 내원에 대기 시술을 맨 뒤에 더합니다. 취소했거나 수납까지 끝난 내원은 409 `PROCEDURE_VISIT_CLOSED`, 시술이 이미
     * `MAX_PROCEDURES_PER_VISIT`개면 422 `PROCEDURE_LIMIT_EXCEEDED`입니다.
     */
    add(
      visitId: Id<'visit'>,
      input: AddProcedureInput,
    ): Effect.Effect<Procedure, VisitNotFound | ProcedureVisitClosed | ProcedureLimitExceeded, CurrentAccess>

    /**
     * 시술 시간을 바꿉니다 (`setProcedureDuration`). 진행 중이면 이미 지난 시간보다 1초 이상 길어야 하고, 아니면 422
     * `PROCEDURE_DURATION_REJECTED`입니다. 완료한 시술은 409 `PROCEDURE_TRANSITION_INVALID`입니다.
     */
    setDuration(
      id: Id<'procedure'>,
      durationSeconds: number,
    ): Effect.Effect<Procedure, ProcedureCommandError | ProcedureDurationRejected, CurrentAccess>

    /** 대기 시술을 지웁니다. 그 밖의 상태는 409입니다. */
    remove(id: Id<'procedure'>): Effect.Effect<void, ProcedureNotFound | ProcedureTransitionInvalid, CurrentAccess>

    /**
     * 시술을 시작합니다 (`startProcedures`). 대기·만료·완료 시술을 시작하고, 정책에 따라 같은 내원의 만료 시술을 함께
     * 완료합니다. 진행 중이면 409입니다. 바뀐 시술을 모두 돌려줍니다.
     */
    start(id: Id<'procedure'>): Effect.Effect<ReadonlyArray<Procedure>, ProcedureCommandError, CurrentAccess>

    /** 내원의 진행 중이 아니고 완료하지 않은 시술을 모두 시작합니다. 바뀐 시술을 모두 돌려줍니다. */
    startAll(
      visitId: Id<'visit'>,
    ): Effect.Effect<ReadonlyArray<Procedure>, VisitNotFound | ProcedureVisitClosed, CurrentAccess>

    /** 진행 중이거나 만료한 시술을 완료합니다. 그 밖의 상태는 409입니다. */
    complete(
      id: Id<'procedure'>,
    ): Effect.Effect<Procedure, ProcedureNotFound | ProcedureTransitionInvalid, CurrentAccess>

    /** 내원의 진행 중·만료 시술을 모두 완료합니다. 대기 시술은 그대로 둡니다. 바뀐 시술을 돌려줍니다. */
    completeAll(visitId: Id<'visit'>): Effect.Effect<ReadonlyArray<Procedure>, VisitNotFound, CurrentAccess>

    /** 진행 중이거나 만료한 시술의 타이머를 지금부터 다시 잽니다. 그 밖의 상태는 409입니다. */
    restartTimer(id: Id<'procedure'>): Effect.Effect<Procedure, ProcedureCommandError, CurrentAccess>

    /** 완료한 시술을 대기로 되돌립니다. 그 밖의 상태는 409입니다. */
    reopen(id: Id<'procedure'>): Effect.Effect<Procedure, ProcedureCommandError, CurrentAccess>

    /** 내원의 시술 순서를 `ids` 순서로 바꿉니다. 모든 시술을 한 번씩 보내야 합니다(422). */
    reorder(
      visitId: Id<'visit'>,
      ids: ReadonlyArray<Id<'procedure'>>,
    ): Effect.Effect<ReadonlyArray<Procedure>, VisitNotFound | ProcedureOrderInvalid, CurrentAccess>

    /**
     * 내원의 진행 중·만료 시술을 완료합니다. 진료 완료가 내원을 대기·수납으로 보낼 때 같은 트랜잭션에서 부릅니다
     * (clinical.md 완료 커맨드 5). 권한은 부르는 쪽이 확인합니다.
     */
    finishRunning(visit: Visit, actor: Actor): Effect.Effect<ReadonlyArray<Procedure>>

    /**
     * 모든 병원에서 타이머가 끝난 진행 중 시술을 `TIMER_ELAPSED`로 바꾸고 `procedure.updated`를 냅니다. 서버가 주기적으로
     * 부릅니다(`ProcedureTimerSweep`). 바꾼 시술 수를 돌려줍니다.
     */
    sweep(nowMs: number): Effect.Effect<number>
  }
>()('hemr/clinical/Procedures') {
  static readonly layer = Layer.effect(
    Procedures,
    Effect.gen(function* () {
      const repository = yield* ProcedureRepository
      const visits = yield* VisitRepository
      const transaction = yield* Transaction
      const settings = DEFAULT_PROCEDURE_TIMER_SETTINGS

      const nowMs = DateTime.now.pipe(Effect.map(DateTime.toEpochMillis))

      const userActor = (access: CurrentAccess['Service']): Actor => ({
        tenantId: access.tenantId,
        actor: { kind: 'USER', id: access.userId },
      })

      const findVisit = (tenantId: Id<'tenant'>, id: Id<'visit'>) =>
        visits
          .findById(tenantId, id)
          .pipe(
            Effect.flatMap(Option.match({ onNone: () => Effect.fail(new VisitNotFound({})), onSome: Effect.succeed })),
          )

      const findProcedure = (tenantId: Id<'tenant'>, id: Id<'procedure'>) =>
        repository
          .findById(tenantId, id)
          .pipe(
            Effect.flatMap(
              Option.match({ onNone: () => Effect.fail(new ProcedureNotFound({})), onSome: Effect.succeed }),
            ),
          )

      /** 시술의 내원입니다. 시술은 내원과 함께 만들어 늘 있으므로 없으면 결함입니다. */
      const visitOf = (procedure: Procedure) =>
        findVisit(procedure.tenantId, procedure.visitId).pipe(
          Effect.catchTag('VisitNotFound', (error) => Effect.die(error)),
        )

      /** 시술을 진행할 수 있는 내원인지입니다. 취소했거나 수납까지 끝난 내원은 닫혔습니다. */
      const requireOpen = (visit: Visit) =>
        visit.status === 'CANCELED' || visit.status === 'COMPLETED'
          ? Effect.fail(new ProcedureVisitClosed({}))
          : Effect.void

      const listOf = (tenantId: Id<'tenant'>, visitId: Id<'visit'>) => repository.listByVisits(tenantId, [visitId])

      const timerOf = (procedure: Procedure): ProcedureTimer => ({
        procedureId: procedure.id,
        status: procedure.status,
        durationSeconds: procedure.durationSeconds,
        startedAt: procedure.startedAt,
        timerEndsAt: procedure.timerEndsAt,
        completedAt: procedure.completedAt,
      })

      /**
       * 판정 결과(`timers`)가 바꾼 시술만 새 버전으로 저장하고 시술마다 `procedure.updated`를 냅니다. 바뀐 시술을
       * 돌려줍니다.
       */
      const persist = (
        current: ReadonlyArray<Procedure>,
        timers: ReadonlyArray<ProcedureTimer>,
        at: string,
        actor: Actor,
      ) =>
        Effect.gen(function* () {
          const byId = new Map(timers.map((each) => [each.procedureId, each]))
          const changed: Procedure[] = []
          for (const procedure of current) {
            const timer = byId.get(procedure.id)
            if (timer === undefined || JSON.stringify(timerOf(procedure)) === JSON.stringify(timer)) continue
            const { procedureId: _, ...fields } = timer
            changed.push({ ...procedure, ...fields, updatedAt: at, version: procedure.version + 1 })
          }
          yield* save(changed, current, at, actor)
          return changed
        })

      const save = (changed: ReadonlyArray<Procedure>, current: ReadonlyArray<Procedure>, at: string, actor: Actor) => {
        if (changed.length === 0) return Effect.void
        const versions = new Map(current.map((each) => [each.id, each.version]))
        const writes: ProcedureWrite[] = changed.map((procedure) => ({
          procedure,
          expectedVersion: versions.get(procedure.id) ?? null,
        }))
        return repository.saveAll(
          writes,
          changed.map((each) => updated(each, at, actor)),
        )
      }

      const updated = (procedure: Procedure, at: string, actor: Actor) =>
        domainEvent(
          'procedure.updated',
          procedure.id,
          at,
          {
            procedureId: procedure.id,
            visitId: procedure.visitId,
            patientId: procedure.patientId,
            status: procedure.status,
          },
          actor,
        )

      /**
       * 한 트랜잭션에서 실행합니다. SQLite는 트랜잭션을 하나씩 실행해 버전이 어긋나지 않지만, 메모리 저장소나 서버
       * 타이머와 겹치면 어긋날 수 있어 처음부터 다시 합니다. 그래도 어긋나면 결함입니다.
       */
      const command = <A, E, R>(effect: Effect.Effect<A, E | VersionMismatch, R>): Effect.Effect<A, E, R> =>
        transaction.run(effect).pipe(
          Effect.retry({ while: (error) => isVersionMismatch(error), times: 3 }),
          Effect.catchIf(isVersionMismatch, (error) => Effect.die(error)),
        ) as Effect.Effect<A, E, R>

      const listForVisit = Effect.fn('Procedures.listForVisit')(function* (visitId: Id<'visit'>) {
        const access = yield* CurrentAccess
        const visit = yield* findVisit(access.tenantId, visitId)
        return yield* listOf(access.tenantId, visit.id)
      })

      const board = Effect.fn('Procedures.board')(function* (date: string | undefined) {
        const access = yield* CurrentAccess
        const day = date ?? clinicDate(yield* nowMs)
        const listed = (yield* visits.list(access.tenantId, { date: day })).filter((each) => each.status !== 'CANCELED')
        const procedures = yield* repository.listByVisits(
          access.tenantId,
          listed.map((each) => each.id),
        )
        return listed.map((visit) => ({ visit, procedures: procedures.filter((each) => each.visitId === visit.id) }))
      })

      const add = Effect.fn('Procedures.add')(function* (visitId: Id<'visit'>, input: AddProcedureInput) {
        const access = yield* CurrentAccess
        return yield* command(
          Effect.gen(function* () {
            const visit = yield* findVisit(access.tenantId, visitId)
            yield* requireOpen(visit)
            const existing = yield* listOf(access.tenantId, visit.id)
            if (existing.length >= MAX_PROCEDURES_PER_VISIT) return yield* new ProcedureLimitExceeded({})
            const at = DateTime.formatIso(yield* DateTime.now)
            const procedure: Procedure = {
              id: newId('procedure'),
              tenantId: access.tenantId,
              visitId: visit.id,
              patientId: visit.patientId,
              name: input.name,
              sourcePrescriptionLineId: input.sourcePrescriptionLineId ?? null,
              order: existing.reduce((last, each) => Math.max(last, each.order + 1), 0),
              assignee: input.assignee ?? 'STAFF',
              durationSeconds: input.durationSeconds ?? settings.defaultItemSeconds,
              status: 'PENDING',
              startedAt: null,
              timerEndsAt: null,
              completedAt: null,
              createdAt: at,
              updatedAt: at,
              version: 1,
            }
            const event = domainEvent(
              'procedure.created',
              procedure.id,
              at,
              { procedureId: procedure.id, visitId: visit.id, patientId: visit.patientId, status: procedure.status },
              userActor(access),
            )
            yield* repository.saveAll([{ procedure, expectedVersion: null }], [event])
            return procedure
          }),
        )
      })

      const setDuration = Effect.fn('Procedures.setDuration')(function* (id: Id<'procedure'>, durationSeconds: number) {
        const access = yield* CurrentAccess
        return yield* command(
          Effect.gen(function* () {
            const current = yield* findProcedure(access.tenantId, id)
            yield* requireOpen(yield* visitOf(current))
            const now = yield* nowMs
            const result = setProcedureDuration(timerOf(current), durationSeconds, now)
            if (!result.ok) {
              // 정수·하한은 엔드포인트 스키마가 먼저 막습니다
              if (result.error === 'PROCEDURE_DURATION_INVALID') return yield* Effect.die(result.error)
              // 완료한 시술은 다른 상태 커맨드처럼 409로 거절합니다 (rule-decisions.md `PROCEDURE_ALREADY_DONE`)
              if (result.error === 'PROCEDURE_ALREADY_DONE') {
                return yield* new ProcedureTransitionInvalid({ currentStatus: current.status })
              }
              return yield* new ProcedureDurationRejected({ reason: result.error })
            }
            const [changed] = yield* persist(
              [current],
              [result.procedure],
              new Date(now).toISOString(),
              userActor(access),
            )
            return changed ?? current
          }),
        )
      })

      const remove = Effect.fn('Procedures.remove')(function* (id: Id<'procedure'>) {
        const access = yield* CurrentAccess
        return yield* command(
          Effect.gen(function* () {
            const current = yield* findProcedure(access.tenantId, id)
            if (current.status !== 'PENDING') {
              return yield* new ProcedureTransitionInvalid({ currentStatus: current.status })
            }
            const at = DateTime.formatIso(yield* DateTime.now)
            const event = domainEvent(
              'procedure.removed',
              current.id,
              at,
              { procedureId: current.id, visitId: current.visitId, patientId: current.patientId },
              userActor(access),
            )
            yield* repository.remove(current, [event])
          }),
        )
      })

      /** 내원의 시술 중 `targetIds`를 시작합니다. 대상이 모두 진행 중이면 `null`입니다. */
      const startIn = (access: CurrentAccess['Service'], visit: Visit, targetIds: ReadonlyArray<string>) =>
        Effect.gen(function* () {
          const current = yield* listOf(access.tenantId, visit.id)
          const now = yield* nowMs
          const result = startProcedures(current.map(timerOf), targetIds, now, settings)
          if (!result.changed) return null
          return yield* persist(current, result.procedures, new Date(now).toISOString(), userActor(access))
        })

      const start = Effect.fn('Procedures.start')(function* (id: Id<'procedure'>) {
        const access = yield* CurrentAccess
        return yield* command(
          Effect.gen(function* () {
            const procedure = yield* findProcedure(access.tenantId, id)
            const visit = yield* visitOf(procedure)
            yield* requireOpen(visit)
            const changed = yield* startIn(access, visit, [procedure.id])
            if (changed === null) return yield* new ProcedureTransitionInvalid({ currentStatus: 'RUNNING' })
            return changed
          }),
        )
      })

      const startAll = Effect.fn('Procedures.startAll')(function* (visitId: Id<'visit'>) {
        const access = yield* CurrentAccess
        return yield* command(
          Effect.gen(function* () {
            const visit = yield* findVisit(access.tenantId, visitId)
            yield* requireOpen(visit)
            const current = yield* listOf(access.tenantId, visit.id)
            const targets = current.filter((each) => each.status !== 'DONE').map((each) => each.id)
            if (targets.length === 0) return []
            return (yield* startIn(access, visit, targets)) ?? []
          }),
        )
      })

      /** 진행 중·만료 시술을 완료로 바꿉니다. 판정 전에 서버 시계로 만료를 다시 봅니다. */
      const finish = (current: ReadonlyArray<Procedure>, targets: ReadonlySet<string>, now: number) => {
        const at = new Date(now).toISOString()
        return elapseDueTimers(current.map(timerOf), now).procedures.map((timer): ProcedureTimer =>
          targets.has(timer.procedureId) && (timer.status === 'RUNNING' || timer.status === 'TIMER_ELAPSED')
            ? { ...timer, status: 'DONE', completedAt: at }
            : timer,
        )
      }

      const complete = Effect.fn('Procedures.complete')(function* (id: Id<'procedure'>) {
        const access = yield* CurrentAccess
        return yield* command(
          Effect.gen(function* () {
            const procedure = yield* findProcedure(access.tenantId, id)
            if (procedure.status !== 'RUNNING' && procedure.status !== 'TIMER_ELAPSED') {
              return yield* new ProcedureTransitionInvalid({ currentStatus: procedure.status })
            }
            const now = yield* nowMs
            const changed = yield* persist(
              [procedure],
              finish([procedure], new Set([procedure.id]), now),
              new Date(now).toISOString(),
              userActor(access),
            )
            return changed[0] ?? procedure
          }),
        )
      })

      const finishIn = (visit: Visit, actor: Actor) =>
        Effect.gen(function* () {
          const current = yield* listOf(visit.tenantId, visit.id)
          const now = yield* nowMs
          return yield* persist(
            current,
            finish(current, new Set(current.map((each) => each.id)), now),
            new Date(now).toISOString(),
            actor,
          )
        })

      const completeAll = Effect.fn('Procedures.completeAll')(function* (visitId: Id<'visit'>) {
        const access = yield* CurrentAccess
        return yield* command(
          Effect.gen(function* () {
            const visit = yield* findVisit(access.tenantId, visitId)
            return yield* finishIn(visit, userActor(access))
          }),
        )
      })

      const restartTimer = Effect.fn('Procedures.restartTimer')(function* (id: Id<'procedure'>) {
        const access = yield* CurrentAccess
        return yield* command(
          Effect.gen(function* () {
            const procedure = yield* findProcedure(access.tenantId, id)
            yield* requireOpen(yield* visitOf(procedure))
            if (procedure.status !== 'RUNNING' && procedure.status !== 'TIMER_ELAPSED') {
              return yield* new ProcedureTransitionInvalid({ currentStatus: procedure.status })
            }
            const now = yield* nowMs
            const at = new Date(now).toISOString()
            const timer: ProcedureTimer = {
              ...timerOf(procedure),
              status: 'RUNNING',
              startedAt: at,
              timerEndsAt: timerEndsAt(at, procedure.durationSeconds),
            }
            const [changed] = yield* persist([procedure], [timer], at, userActor(access))
            return changed ?? procedure
          }),
        )
      })

      const reopen = Effect.fn('Procedures.reopen')(function* (id: Id<'procedure'>) {
        const access = yield* CurrentAccess
        return yield* command(
          Effect.gen(function* () {
            const procedure = yield* findProcedure(access.tenantId, id)
            yield* requireOpen(yield* visitOf(procedure))
            if (procedure.status !== 'DONE') {
              return yield* new ProcedureTransitionInvalid({ currentStatus: procedure.status })
            }
            const timer: ProcedureTimer = {
              ...timerOf(procedure),
              status: 'PENDING',
              startedAt: null,
              timerEndsAt: null,
              completedAt: null,
            }
            const [changed] = yield* persist(
              [procedure],
              [timer],
              DateTime.formatIso(yield* DateTime.now),
              userActor(access),
            )
            return changed ?? procedure
          }),
        )
      })

      const reorder = Effect.fn('Procedures.reorder')(function* (
        visitId: Id<'visit'>,
        ids: ReadonlyArray<Id<'procedure'>>,
      ) {
        const access = yield* CurrentAccess
        return yield* command(
          Effect.gen(function* () {
            const visit = yield* findVisit(access.tenantId, visitId)
            const current = yield* listOf(access.tenantId, visit.id)
            const known = new Set<string>(current.map((each) => each.id))
            if (
              ids.length !== current.length ||
              new Set(ids).size !== ids.length ||
              !ids.every((id) => known.has(id))
            ) {
              return yield* new ProcedureOrderInvalid({})
            }
            const at = DateTime.formatIso(yield* DateTime.now)
            const position = new Map<string, number>(ids.map((id, index) => [id, index]))
            const changed = current
              .filter((each) => each.order !== position.get(each.id))
              .map((each) => ({
                ...each,
                order: position.get(each.id) ?? each.order,
                updatedAt: at,
                version: each.version + 1,
              }))
            yield* save(changed, current, at, userActor(access))
            const byId = new Map(changed.map((each) => [each.id, each]))
            return current.map((each) => byId.get(each.id) ?? each).sort((a, b) => a.order - b.order)
          }),
        )
      })

      const finishRunning = (visit: Visit, actor: Actor) =>
        finishIn(visit, actor).pipe(Effect.catchTag('VersionMismatch', (error) => Effect.die(error)))

      const sweep = (now: number) =>
        Effect.gen(function* () {
          const due = yield* repository.listDue(new Date(now).toISOString())
          let count = 0
          for (const procedure of due) {
            const [timer] = elapseDueTimers([timerOf(procedure)], now).procedures
            if (timer?.status !== 'TIMER_ELAPSED') continue
            const actor: Actor = { tenantId: procedure.tenantId, actor: { kind: 'SYSTEM', id: 'procedure-timer' } }
            // 다른 요청이 먼저 바꿨으면 그 요청이 만료도 판정했으므로 건너뜁니다
            const saved = yield* persist([procedure], [timer], new Date(now).toISOString(), actor).pipe(
              Effect.as(true),
              Effect.catchTag('VersionMismatch', () => Effect.succeed(false)),
            )
            if (saved) count++
          }
          return count
        })

      return Procedures.of({
        listForVisit,
        board,
        add,
        setDuration,
        remove,
        start,
        startAll,
        complete,
        completeAll,
        restartTimer,
        reopen,
        reorder,
        finishRunning,
        sweep,
      })
    }),
  )
}

const isVersionMismatch = (error: unknown): error is VersionMismatch =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'VersionMismatch'

/** 서버 타이머입니다. `interval`마다 만료한 시술을 `TIMER_ELAPSED`로 바꿉니다. 실패하면 로그를 남기고 계속합니다. */
export const ProcedureTimerSweep = (intervalMillis = 1000) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const procedures = yield* Procedures
      yield* DateTime.now.pipe(
        Effect.flatMap((now) => procedures.sweep(DateTime.toEpochMillis(now))),
        Effect.catchCause((cause) => Effect.logError('procedure timer sweep failed', cause)),
        Effect.repeat(Schedule.spaced(Duration.millis(intervalMillis))),
        Effect.forkScoped,
      )
    }),
  )
