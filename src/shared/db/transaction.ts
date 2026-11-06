import { Context, Effect, Layer } from 'effect'
import { SqlClient } from 'effect/sql'

/**
 * 여러 저장소에 걸친 쓰기를 한 트랜잭션으로 묶습니다. 접수가 내원과 진료를 함께 만드는 것처럼, 한 모듈의 저장소
 * `save` 하나로 끝나지 않는 쓰기에 씁니다.
 *
 * 저장소 `save`는 저마다 트랜잭션을 열지만, 바깥 트랜잭션 안에서는 savepoint가 되어 바깥과 함께 커밋·롤백됩니다.
 */
export class Transaction extends Context.Service<
  Transaction,
  {
    /** `effect`를 한 트랜잭션에서 실행합니다. 실패하면 그 안의 쓰기를 모두 되돌립니다. */
    run<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R>
  }
>()('hemr/shared/Transaction') {
  /**
   * 메모리 저장소용입니다. 되돌리지 못하므로 그대로 실행합니다. 호출하는 쪽은 실패할 수 있는 쓰기(버전 비교)를
   * 먼저 하고, 서버가 만든 ID로 새로 넣는 것처럼 실패하지 않는 쓰기를 뒤에 둡니다.
   */
  static readonly layerMemory = Layer.succeed(Transaction, Transaction.of({ run: (effect) => effect }))

  static readonly layerSql = Layer.effect(
    Transaction,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      return Transaction.of({
        run: (effect) => effect.pipe(sql.withTransaction, Effect.catchTag('SqlError', Effect.die)),
      })
    }),
  )
}
