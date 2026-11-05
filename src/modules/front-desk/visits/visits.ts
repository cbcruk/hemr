import { Context, DateTime, Effect, Layer, Option } from 'effect'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { transitionVisit } from './visit-status.ts'
import type { VisitCommand, VisitTransitionOptions } from './visit-status.types.ts'
import { VisitHasClinicalData, VisitNotFound, VisitTransitionInvalid } from './visit.ts'
import type { Visit } from './visit.ts'
import { VisitRepository } from './visit-repository.ts'

/** 상태 커맨드에 커맨드 외로 함께 보내는 입력입니다. */
export interface VisitCommandInput extends VisitTransitionOptions {
  /** 내원을 다시 열거나 취소한 사유입니다. */
  reason?: string
}

/** 상태 커맨드가 실패할 수 있는 오류입니다. */
export type VisitCommandError = VisitNotFound | VisitTransitionInvalid | VisitHasClinicalData

/** 접수 데스크의 내원 작업입니다. */
export class Visits extends Context.Service<
  Visits,
  {
    /**
     * 내원에 상태 커맨드를 적용하고 새 상태를 저장합니다.
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

        const result = transitionVisit(visit.status, command, input)
        if (!result.ok) {
          return yield* result.code === 'VISIT_HAS_CLINICAL_DATA'
            ? Effect.fail(new VisitHasClinicalData({ currentStatus: visit.status }))
            : Effect.fail(new VisitTransitionInvalid({ currentStatus: visit.status, command }))
        }

        const { statusReason: _, ...rest } = visit
        const next: Visit = {
          ...rest,
          status: result.to,
          statusChangedAt: DateTime.formatIso(yield* DateTime.now),
          ...(input.reason === undefined ? {} : { statusReason: input.reason }),
        }
        yield* repository.save(next)
        return next
      })

      return Visits.of({ apply })
    }),
  )
}
