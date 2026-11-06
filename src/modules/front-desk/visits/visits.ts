import { Context, DateTime, Effect, Layer, Option } from 'effect'
import { domainEvent } from '../../../shared/events/domain-event.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
import { CurrentAccess, requirePermissions } from '../../identity/auth/access.ts'
import type { PermissionDenied } from '../../identity/auth/auth-errors.ts'
import { transitionVisit } from './visit-status.ts'
import type { VisitCommand, VisitStatus, VisitTransitionErrorCode } from './visit-status.types.ts'
import { VisitDatePast, VisitHasClinicalData, VisitNotFound, VisitTransitionInvalid } from './visit.ts'
import type { Visit } from './visit.ts'
import { VisitRepository } from './visit-repository.ts'

/** 상태 커맨드에 커맨드 외로 함께 보내는 입력입니다. */
export interface VisitCommandInput {
  /** 내원을 다시 열거나 취소한 사유입니다. */
  reason?: string
  /** 취소할 때 진료·수납 기록도 함께 무효로 할지 여부입니다. */
  cascade?: boolean
  /** `:reopen` 다음에 이어서 옮길 상태입니다. 두 전이를 한 번에 저장합니다. */
  then?: 'WAITING' | 'IN_TREATMENT'
  /** `If-Match`로 받은 버전입니다. 없으면 버전을 검사하지 않습니다. */
  expectedVersion?: number
}

/** 상태 커맨드가 실패할 수 있는 오류입니다. */
export type VisitCommandError =
  VisitNotFound | VisitTransitionInvalid | VisitHasClinicalData | VisitDatePast | VersionMismatch | PermissionDenied

/** `:reopen {then}`의 목표 상태로 가는 커맨드입니다. */
const THEN_COMMANDS: Record<NonNullable<VisitCommandInput['then']>, VisitCommand> = {
  WAITING: 'RETURN_TO_WAITING',
  IN_TREATMENT: 'START_TREATMENT',
}

/** 접수 데스크의 내원 작업입니다. */
export class Visits extends Context.Service<
  Visits,
  {
    /**
     * 내원에 상태 커맨드를 적용하고 새 상태를 저장합니다. 저장할 때마다 `version`이 1 오릅니다. 같은 트랜잭션에서
     * `visit.status_changed` 이벤트를 outbox에 씁니다. `:reopen {then}`은 두 전이를 이벤트 하나(처음 → 마지막
     * 상태)로 냅니다. 중간 상태는 저장되지 않기 때문입니다.
     *
     * `expectedVersion`을 받으면 읽은 뒤 다른 요청이 먼저 저장했을 때 412 `VERSION_MISMATCH`입니다. 받지 않았으면
     * 클라이언트가 잠금을 요청하지 않은 것이라, 새 상태로 다시 읽어 판정하고 저장하기를 3번까지 되풀이합니다.
     *
     * 현재 사용자(`CurrentAccess`)가 고른 병원의 내원만 찾습니다. 다른 병원의 내원은 404 `VISIT_NOT_FOUND`입니다.
     * 이벤트에는 그 병원과 사용자를 적습니다.
     *
     * 커맨드 자체의 권한(`visit:update`·`visit:cancel`)은 엔드포인트 선언이 확인합니다. 연쇄 취소는 본문에 따라
     * 정해지므로 여기서 `visit:cancel`·`receipt:void`·`encounter:retract`를 모두 확인합니다(D3). 내원을 읽기 전에
     * 확인해, 권한이 없으면 내원 상태와 상관없이 403 `PERMISSION_DENIED`입니다. 함께 무효로 할 진료·수납 기록 처리는
     * 그 모듈이 생길 때 더합니다. 담당 환자 범위(`scope: OWN`)는 담당 관계가 생길 때 확인합니다.
     */
    apply(
      id: Id<'visit'>,
      command: VisitCommand,
      input?: VisitCommandInput,
    ): Effect.Effect<Visit, VisitCommandError, CurrentAccess>
  }
>()('hemr/front-desk/Visits') {
  static readonly layer = Layer.effect(
    Visits,
    Effect.gen(function* () {
      const repository = yield* VisitRepository

      const attempt = Effect.fn('Visits.apply')(function* (
        id: Id<'visit'>,
        command: VisitCommand,
        input: VisitCommandInput = {},
      ) {
        const access = yield* CurrentAccess
        if (command === 'CANCEL' && input.cascade === true) {
          yield* requirePermissions('visit:cancel', 'receipt:void', 'encounter:retract')
        }
        const visit = yield* repository.findById(access.tenantId, id).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(new VisitNotFound({})),
              onSome: Effect.succeed,
            }),
          ),
        )
        if (input.expectedVersion !== undefined && input.expectedVersion !== visit.version) {
          return yield* new VersionMismatch({ currentVersion: visit.version })
        }

        const now = yield* DateTime.now
        const options = {
          hasClinicalData: visit.hasClinicalData,
          isPastDate: visit.date < clinicDate(DateTime.toEpochMillis(now)),
          ...(input.cascade === undefined ? {} : { cascade: input.cascade }),
        }
        const steps =
          command === 'REOPEN' && input.then !== undefined ? [command, THEN_COMMANDS[input.then]] : [command]

        // 중간 단계가 실패하면 아무것도 저장하지 않습니다.
        let status = visit.status
        for (const step of steps) {
          const result = transitionVisit(status, step, options)
          if (!result.ok) return yield* toError(result.code, visit, status, step)
          status = result.to
        }

        const { statusReason: _, ...rest } = visit
        const next: Visit = {
          ...rest,
          status,
          statusChangedAt: DateTime.formatIso(now),
          version: visit.version + 1,
          ...(input.reason === undefined ? {} : { statusReason: input.reason }),
        }
        const event = domainEvent(
          'visit.status_changed',
          visit.id,
          next.statusChangedAt,
          { visitId: visit.id, patientId: visit.patientId, from: visit.status, to: status },
          { tenantId: access.tenantId, actor: { kind: 'USER', id: access.userId } },
        )
        // 읽은 뒤 다른 요청이 먼저 저장했으면 저장소가 `VersionMismatch`로 거절합니다
        yield* repository.save(next, { expectedVersion: visit.version, events: [event] })
        return next
      })

      const apply = (id: Id<'visit'>, command: VisitCommand, input: VisitCommandInput = {}) =>
        input.expectedVersion === undefined
          ? attempt(id, command, input).pipe(
              Effect.retry({ while: (error) => error._tag === 'VersionMismatch', times: 3 }),
            )
          : attempt(id, command, input)

      return Visits.of({ apply })
    }),
  )
}

function toError(
  code: VisitTransitionErrorCode,
  visit: Visit,
  currentStatus: VisitStatus,
  command: VisitCommand,
): VisitTransitionInvalid | VisitHasClinicalData | VisitDatePast {
  switch (code) {
    case 'VISIT_TRANSITION_INVALID':
      return new VisitTransitionInvalid({ currentStatus, command })
    case 'VISIT_HAS_CLINICAL_DATA':
      return new VisitHasClinicalData({ currentStatus })
    case 'VISIT_DATE_PAST':
      return new VisitDatePast({ date: visit.date })
  }
}
