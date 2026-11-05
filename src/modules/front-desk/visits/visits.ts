import { Context, DateTime, Effect, Layer, Option } from 'effect'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { VersionMismatch } from '../../../shared/problem/problem.ts'
import { clinicDate } from '../../../shared/time/clinic-date.ts'
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
  VisitNotFound | VisitTransitionInvalid | VisitHasClinicalData | VisitDatePast | VersionMismatch

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
     * 내원에 상태 커맨드를 적용하고 새 상태를 저장합니다. 저장할 때마다 `version`이 1 오릅니다.
     *
     * 권한 확인과, 연쇄 취소 때 함께 무효로 할 기록 처리는 아직 없습니다.
     */
    apply(id: Id<'visit'>, command: VisitCommand, input?: VisitCommandInput): Effect.Effect<Visit, VisitCommandError>
  }
>()('hemr/front-desk/Visits') {
  static readonly layer = Layer.effect(
    Visits,
    Effect.gen(function* () {
      const repository = yield* VisitRepository

      const apply = Effect.fn('Visits.apply')(function* (
        id: Id<'visit'>,
        command: VisitCommand,
        input: VisitCommandInput = {},
      ) {
        const visit = yield* repository.findById(id).pipe(
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
        yield* repository.save(next)
        return next
      })

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
