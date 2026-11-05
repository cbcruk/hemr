import { mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname } from 'node:path'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { Effect, Layer, PubSub } from 'effect'
import { HttpRouter } from 'effect/http'
import { AppLive } from './app.ts'
import { VisitRepository } from './modules/front-desk/visits/visit-repository.ts'
import type { Visit } from './modules/front-desk/visits/visit.ts'
import { PersistenceSqlite } from './persistence.ts'
import { EventBus } from './shared/events/event-bus.ts'
import { OutboxRelay } from './shared/events/outbox-relay.ts'
import { clinicDate } from './shared/time/clinic-date.ts'

const port = Number(process.env['PORT'] ?? 3000)
/** SQLite 파일 경로입니다. `:memory:`면 재시작할 때마다 비어 있습니다. */
const databaseFile = process.env['DATABASE_FILE'] ?? 'data/hemr.sqlite'
if (databaseFile !== ':memory:') mkdirSync(dirname(databaseFile), { recursive: true })

/** 접수 기능이 생기기 전까지 로컬에서 상태 커맨드를 시험해 볼 샘플 내원입니다. 진료일은 처음 넣은 날입니다. */
const today = clinicDate(Date.now())
const devVisits: Visit[] = [
  {
    id: 'vis_01JBQ000000000000000000001' as Visit['id'],
    patientId: 'pat_01JBQ000000000000000000001' as Visit['patientId'],
    date: today,
    status: 'WAITING',
    statusChangedAt: new Date().toISOString(),
    hasClinicalData: false,
    version: 1,
  },
  {
    id: 'vis_01JBQ000000000000000000002' as Visit['id'],
    patientId: 'pat_01JBQ000000000000000000002' as Visit['patientId'],
    date: today,
    status: 'IN_TREATMENT',
    statusChangedAt: new Date().toISOString(),
    hasClinicalData: true,
    version: 1,
  },
]

/** 샘플 내원이 없으면 넣습니다. 이미 있으면 그대로 둡니다. */
const DevSeed = Layer.effectDiscard(
  Effect.gen(function* () {
    const repository = yield* VisitRepository
    yield* Effect.forEach(devVisits, (visit) =>
      repository.save(visit, { expectedVersion: null }).pipe(Effect.catchTag('VersionMismatch', () => Effect.void)),
    )
  }),
)

/** 버스에 나간 이벤트를 로그로 남깁니다. 소비 모듈이 생기기 전까지 릴레이 동작을 눈으로 보는 용도입니다. */
const EventLog = Layer.effectDiscard(
  Effect.gen(function* () {
    const subscription = yield* (yield* EventBus).subscribe
    yield* PubSub.take(subscription).pipe(
      Effect.flatMap((event) => Effect.logInfo('event', { seq: event.seq, type: event.type, subject: event.subject })),
      Effect.forever,
      Effect.forkScoped,
    )
  }),
)

const Persistence = PersistenceSqlite(databaseFile)
const Events = OutboxRelay.polling().pipe(
  Layer.provideMerge(OutboxRelay.make()),
  Layer.provideMerge(EventLog),
  Layer.provideMerge(EventBus.layerInProcess),
)

HttpRouter.serve(AppLive).pipe(
  Layer.provide(DevSeed),
  Layer.provide(Events),
  Layer.provide(NodeHttpServer.layer(createServer, { port })),
  Layer.provideMerge(Persistence),
  Layer.launch,
  NodeRuntime.runMain,
)
