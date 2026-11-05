import { Layer } from 'effect'
import { IdentityRepository } from './modules/identity/identity-repository.ts'
import { VisitRepository } from './modules/front-desk/visits/visit-repository.ts'
import type { Visit } from './modules/front-desk/visits/visit.ts'
import { sqliteLayer } from './shared/db/migrations.ts'
import { Outbox } from './shared/events/outbox.ts'

/** 저장소와 outbox를 프로세스 메모리에 둡니다. 테스트에 씁니다. */
export const PersistenceMemory = (seed: ReadonlyArray<Visit> = []) =>
  Layer.merge(VisitRepository.layerMemory(seed), IdentityRepository.layerMemory).pipe(
    Layer.provideMerge(Outbox.layerMemory),
  )

/**
 * 저장소와 outbox를 SQLite 파일 하나에 둡니다 (D9). 만들 때 마이그레이션을 적용합니다. `filename`이 `:memory:`면
 * 프로세스가 끝날 때 사라지는 빈 DB입니다.
 */
export const PersistenceSqlite = (filename: string) =>
  Layer.merge(VisitRepository.layerSql, IdentityRepository.layerSql).pipe(
    Layer.provideMerge(Outbox.layerSql),
    Layer.provideMerge(sqliteLayer(filename)),
  )
