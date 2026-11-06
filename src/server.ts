import { mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname } from 'node:path'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { Effect, Layer, Option, PubSub } from 'effect'
import { HttpRouter } from 'effect/http'
import { AppLive } from './app.ts'
import { VisitRepository } from './modules/front-desk/visits/visit-repository.ts'
import { AuthConfig, isDevMode } from './modules/identity/auth/auth-config.ts'
import { AuthRepository } from './modules/identity/auth/auth-repository.ts'
import { hashPassword } from './modules/identity/auth/password.ts'
import type { Membership, Tenant, User } from './modules/identity/identity.ts'
import { IdentityRepository } from './modules/identity/identity-repository.ts'
import type { Visit } from './modules/front-desk/visits/visit.ts'
import { PersistenceSqlite } from './persistence.ts'
import { EventBus } from './shared/events/event-bus.ts'
import { OutboxRelay } from './shared/events/outbox-relay.ts'
import { clinicDate } from './shared/time/clinic-date.ts'

const port = Number(process.env['PORT'] ?? 3000)
/** SQLite 파일 경로입니다. `:memory:`면 재시작할 때마다 비어 있습니다. */
const databaseFile = process.env['DATABASE_FILE'] ?? 'data/hemr.sqlite'
if (databaseFile !== ':memory:') mkdirSync(dirname(databaseFile), { recursive: true })

/** 사용자 관리 API가 생기기 전까지 로컬에서 로그인해 볼 병원과 대표원장입니다. 비밀번호는 `DEV_PASSWORD`입니다. */
const devTenant: Tenant = {
  id: 'ten_01JBQ000000000000000000001' as Tenant['id'],
  name: '개발 한의원',
  hiraInstitutionCode: null,
  timezone: 'Asia/Seoul',
  products: ['EMR'],
  features: [],
}
/**
 * 접수 기능이 생기기 전까지 로컬에서 상태 커맨드를 시험해 볼 샘플 내원입니다. 진료일은 처음 넣은 날입니다. 병원은 위
 * 개발 한의원입니다.
 */
const today = clinicDate(Date.now())
const devVisits: Visit[] = [
  {
    id: 'vis_01JBQ000000000000000000001' as Visit['id'],
    tenantId: devTenant.id,
    patientId: 'pat_01JBQ000000000000000000001' as Visit['patientId'],
    date: today,
    status: 'WAITING',
    statusChangedAt: new Date().toISOString(),
    hasClinicalData: false,
    version: 1,
  },
  {
    id: 'vis_01JBQ000000000000000000002' as Visit['id'],
    tenantId: devTenant.id,
    patientId: 'pat_01JBQ000000000000000000002' as Visit['patientId'],
    date: today,
    status: 'IN_TREATMENT',
    statusChangedAt: new Date().toISOString(),
    hasClinicalData: true,
    version: 1,
  },
]

const devOwner: User = {
  id: 'usr_01JBQ000000000000000000001' as User['id'],
  loginId: 'owner',
  name: '개발 원장',
  phone: null,
  licenseNumber: null,
  licenseType: 'KOREAN_MEDICINE_DOCTOR',
}
const devMembership: Membership = {
  tenantId: devTenant.id,
  userId: devOwner.id,
  role: 'OWNER_DOCTOR',
  employmentType: '상근',
  joinedOn: '2026-01-01',
  status: 'ACTIVE',
  deactivatedFrom: null,
  scope: 'ALL',
  grants: [],
}

/**
 * 샘플 내원과 개발 계정이 없으면 넣습니다. 이미 있으면 그대로 둡니다. 알려진 비밀번호의 대표원장 계정이라 로컬 개발
 * 모드(`HEMR_DEV=1`)에서만 넣습니다.
 */
const DevSeed = Layer.effectDiscard(
  Effect.gen(function* () {
    if (!isDevMode()) return
    const repository = yield* VisitRepository
    yield* Effect.forEach(devVisits, (visit) =>
      repository.save(visit, { expectedVersion: null }).pipe(Effect.catchTag('VersionMismatch', () => Effect.void)),
    )
    const identity = yield* IdentityRepository
    const auth = yield* AuthRepository
    if (Option.isSome(yield* identity.findUser(devOwner.id))) return
    yield* identity.saveTenant(devTenant)
    yield* identity.saveUser(devOwner).pipe(Effect.orDie)
    yield* identity.saveMembership(devMembership)
    yield* auth.savePassword(devOwner.id, yield* hashPassword(process.env['DEV_PASSWORD'] ?? 'hemr-dev-password'))
    yield* Effect.logInfo('dev account created', { loginId: devOwner.loginId })
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
  Layer.provide(AuthConfig.layerFromEnv),
  Layer.provideMerge(Persistence),
  Layer.launch,
  NodeRuntime.runMain,
)
