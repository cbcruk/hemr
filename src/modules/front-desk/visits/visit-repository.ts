import { Context, Effect, Layer, Option, Ref } from 'effect'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { Visit } from './visit.ts'

/** 내원 저장소입니다. 환경마다 다른 Layer를 넣어 구현을 바꿉니다. */
export class VisitRepository extends Context.Service<
  VisitRepository,
  {
    findById(id: Id<'visit'>): Effect.Effect<Option.Option<Visit>>
    save(visit: Visit): Effect.Effect<void>
  }
>()('hemr/front-desk/VisitRepository') {
  /** `seed`로 시작해 프로세스 메모리에 내원을 보관합니다. */
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
