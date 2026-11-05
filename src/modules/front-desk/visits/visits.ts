import { Context, DateTime, Effect, Layer, Option } from 'effect'
import type { Id } from '../../../shared/ids/ids.types.ts'
import { transitionVisit } from './visit-status.ts'
import type { VisitCommand, VisitTransitionOptions } from './visit-status.types.ts'
import { VisitHasClinicalData, VisitNotFound, VisitTransitionInvalid } from './visit.ts'
import type { Visit } from './visit.ts'
import { VisitRepository } from './visit-repository.ts'

/** Inputs of a status command beyond the command itself. */
export interface VisitCommandInput extends VisitTransitionOptions {
  /** Why the visit was reopened or canceled. */
  reason?: string
}

/** Errors a status command can fail with. */
export type VisitCommandError = VisitNotFound | VisitTransitionInvalid | VisitHasClinicalData

/** Front-desk operations on visits. */
export class Visits extends Context.Service<
  Visits,
  {
    /**
     * Applies a status command to a visit and stores the new status.
     *
     * Permission checks and the records a cascading cancel voids are not handled yet.
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
