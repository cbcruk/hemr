import { createServer } from 'node:http'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { Layer } from 'effect'
import { HttpRouter } from 'effect/http'
import { AppLive } from './app.ts'
import { VisitRepository } from './modules/front-desk/visits/visit-repository.ts'
import type { Visit } from './modules/front-desk/visits/visit.ts'
import { clinicDate } from './shared/time/clinic-date.ts'

const port = Number(process.env['PORT'] ?? 3000)

/** 접수 기능이 생기기 전까지 로컬에서 상태 커맨드를 시험해 볼 샘플 내원입니다. 진료일은 서버를 띄운 날입니다. */
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

HttpRouter.serve(AppLive).pipe(
  Layer.provide([VisitRepository.layerMemory(devVisits), NodeHttpServer.layer(createServer, { port })]),
  Layer.launch,
  NodeRuntime.runMain,
)
