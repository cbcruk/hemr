import { Context, Effect, Layer, Option, Ref } from 'effect'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { Visit } from './visit.ts'

/** Storage of visits, swapped per environment by providing a different layer. */
export class VisitRepository extends Context.Service<
  VisitRepository,
  {
    findById(id: Id<'visit'>): Effect.Effect<Option.Option<Visit>>
    save(visit: Visit): Effect.Effect<void>
  }
>()('hemr/front-desk/VisitRepository') {
  /** Keeps visits in process memory, starting from `seed`. */
  static readonly layerMemory = (seed: ReadonlyArray<Visit> = []) =>
    Layer.effect(
      VisitRepository,
      Effect.gen(function* () {
        const store = yield* Ref.make(new Map(seed.map((visit) => [visit.id, visit])))

        return VisitRepository.of({
          findById: (id) => Ref.get(store).pipe(Effect.map((visits) => Option.fromNullishOr(visits.get(id)))),
          save: (visit) => Ref.update(store, (visits) => new Map(visits).set(visit.id, visit)),
        })
      }),
    )
}
