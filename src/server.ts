import { mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname } from 'node:path'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { Effect, Layer, Option, PubSub } from 'effect'
import { HttpRouter } from 'effect/http'
import { AppLive } from './app.ts'
import { ProcedureTimerSweep, Procedures } from './modules/clinical/treatment-room/procedures.ts'
import { AuthConfig, isDevMode } from './modules/identity/auth/auth-config.ts'
import { AuthRepository } from './modules/identity/auth/auth-repository.ts'
import { hashPassword } from './modules/identity/auth/password.ts'
import type { Membership, Tenant, User } from './modules/identity/identity.ts'
import { IdentityRepository } from './modules/identity/identity-repository.ts'
import { PatientCrypto } from './modules/patients/patient-crypto.ts'
import { PersistenceSqlite } from './persistence.ts'
import { EventBus } from './shared/events/event-bus.ts'
import { OutboxRelay } from './shared/events/outbox-relay.ts'
import { policyWorker } from './shared/events/policy.ts'
import { createVisitDraft } from './modules/clinical/encounters/encounter-draft.policy.ts'
import { finishProceduresAfterEncounter } from './modules/clinical/treatment-room/procedure-finish.policy.ts'
import { moveVisitAfterEncounter } from './modules/front-desk/visits/visit-after-encounter.policy.ts'
import { retractCanceledDraft } from './modules/clinical/encounters/encounter-retraction.policy.ts'

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
 * 개발 계정이 없으면 넣습니다. 이미 있으면 그대로 둡니다. 알려진 비밀번호의 대표원장 계정이라 로컬 개발
 * 모드(`HEMR_DEV=1`)에서만 넣습니다.
 */
const DevSeed = Layer.effectDiscard(
  Effect.gen(function* () {
    if (!isDevMode()) return
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

/** 등록한 정책을 1초마다 돌립니다(events.md 정책과 사가). 정책마다 outbox 커서를 따로 둡니다. */
const Policies = policyWorker([
  createVisitDraft,
  retractCanceledDraft,
  moveVisitAfterEncounter,
  finishProceduresAfterEncounter,
]).pipe(Layer.provide(Procedures.layer))

/** 진행 중인 시술의 타이머 만료를 1초마다 판정합니다. 클라이언트가 없어도 서버가 `TIMER_ELAPSED`로 바꿉니다. */
const TimerSweep = ProcedureTimerSweep().pipe(Layer.provide(Procedures.layer))

HttpRouter.serve(AppLive).pipe(
  Layer.provide(DevSeed),
  Layer.provide(TimerSweep),
  Layer.provide(Events),
  Layer.provide(Policies),
  Layer.provide(NodeHttpServer.layer(createServer, { port })),
  Layer.provide(AuthConfig.layerFromEnv),
  Layer.provide(PatientCrypto.layerFromEnv),
  Layer.provideMerge(Persistence),
  Layer.launch,
  NodeRuntime.runMain,
)
