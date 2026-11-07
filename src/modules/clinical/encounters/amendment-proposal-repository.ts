import { Context, Effect, Layer, Option, Ref, Schema } from 'effect'
import { SqlClient } from 'effect/sql'
import type { DomainEvent } from '../../../shared/events/domain-event.ts'
import { Outbox } from '../../../shared/events/outbox.ts'
import type { Id } from '../../../shared/ids/ids.types.ts'
import type { AmendmentProposal } from './amendment-proposal.ts'
import { EncounterChangesPayload } from './encounter-changes-payload.ts'

/**
 * 정정 제안 저장소입니다. `save`는 읽은 버전(`expectedVersion`, 새 제안이면 `null`)이 그대로일 때만 씁니다. 같은
 * 트랜잭션에서 읽고 판정한 뒤 쓰므로 어긋나면 결함입니다.
 */
export class AmendmentProposalRepository extends Context.Service<
  AmendmentProposalRepository,
  {
    findById(tenantId: Id<'tenant'>, id: Id<'amendmentProposal'>): Effect.Effect<Option.Option<AmendmentProposal>>
    /** 진료의 제안입니다. 만든 순서입니다. */
    listByEncounter(
      tenantId: Id<'tenant'>,
      encounterId: Id<'encounter'>,
      status?: AmendmentProposal['status'],
    ): Effect.Effect<ReadonlyArray<AmendmentProposal>>
    save(
      proposal: AmendmentProposal,
      options: { expectedVersion: number | null; events?: ReadonlyArray<DomainEvent> },
    ): Effect.Effect<void>
  }
>()('hemr/clinical/AmendmentProposalRepository') {
  /** 프로세스 메모리에 보관합니다. 이벤트는 `Outbox`에 씁니다. */
  static readonly layerMemory = Layer.effect(
    AmendmentProposalRepository,
    Effect.gen(function* () {
      const store = yield* Ref.make(new Map<string, AmendmentProposal>())
      const outbox = yield* Outbox

      return AmendmentProposalRepository.of({
        findById: (tenantId, id) =>
          Ref.get(store).pipe(
            Effect.map((all) => Option.filter(Option.fromNullishOr(all.get(id)), (each) => each.tenantId === tenantId)),
          ),
        listByEncounter: (tenantId, encounterId, status) =>
          Ref.get(store).pipe(
            Effect.map((all) =>
              [...all.values()]
                .filter(
                  (each) =>
                    each.tenantId === tenantId &&
                    each.encounterId === encounterId &&
                    (status === undefined || each.status === status),
                )
                .sort((a, b) => compare(a.proposedAt, b.proposedAt) || compare(a.id, b.id)),
            ),
          ),
        save: (proposal, options) =>
          Effect.gen(function* () {
            // 비교와 쓰기를 `Ref.modify` 한 번에 합니다
            const ok = yield* Ref.modify(store, (all): [boolean, Map<string, AmendmentProposal>] => {
              const current = all.get(proposal.id)
              if (current !== undefined && current.tenantId !== proposal.tenantId) return [false, all]
              if ((current?.version ?? null) !== options.expectedVersion) return [false, all]
              return [true, new Map(all).set(proposal.id, proposal)]
            })
            if (!ok) return yield* Effect.die(new Error('amendment proposal does not match the stored version'))
            yield* outbox.append(options.events ?? [])
          }),
      })
    }),
  )

  /** SQL `amendment_proposals` 테이블에 보관합니다. 제안과 이벤트를 한 트랜잭션에서 씁니다. */
  static readonly layerSql = Layer.effect(
    AmendmentProposalRepository,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const outbox = yield* Outbox

      interface Row {
        id: string
        tenantId: string
        encounterId: string
        patientId: string
        changes: string
        reason: string
        source: AmendmentProposal['source']
        proposedBy: string
        proposedAt: string
        baseRevision: number
        status: AmendmentProposal['status']
        resolution: string | null
        version: number
      }

      // 변경 본문 스키마가 바뀌어 옛 행을 읽지 못하면 반영 전에 결함으로 드러나게 디코드합니다
      const decodeChanges = Schema.decodeUnknownSync(Schema.fromJsonString(EncounterChangesPayload))

      const toProposal = (row: Row): AmendmentProposal => ({
        ...row,
        id: row.id as AmendmentProposal['id'],
        tenantId: row.tenantId as AmendmentProposal['tenantId'],
        encounterId: row.encounterId as AmendmentProposal['encounterId'],
        patientId: row.patientId as AmendmentProposal['patientId'],
        changes: decodeChanges(row.changes),
        proposedBy: row.proposedBy as AmendmentProposal['proposedBy'],
        resolution: row.resolution === null ? null : (JSON.parse(row.resolution) as AmendmentProposal['resolution']),
      })

      const columns = sql`
        id, tenant_id AS tenantId, encounter_id AS encounterId, patient_id AS patientId, changes, reason, source,
        proposed_by AS proposedBy, proposed_at AS proposedAt, base_revision AS baseRevision, status, resolution, version
      `

      return AmendmentProposalRepository.of({
        findById: (tenantId, id) =>
          sql<Row>`SELECT ${columns} FROM amendment_proposals WHERE id = ${id} AND tenant_id = ${tenantId}`.pipe(
            Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), toProposal)),
            Effect.orDie,
          ),
        listByEncounter: (tenantId, encounterId, status) =>
          sql<Row>`
            SELECT ${columns} FROM amendment_proposals
            WHERE tenant_id = ${tenantId} AND encounter_id = ${encounterId}
              AND ${status === undefined ? sql`1 = 1` : sql`status = ${status}`}
            ORDER BY proposed_at, id
          `.pipe(
            Effect.map((rows) => rows.map(toProposal)),
            Effect.orDie,
          ),
        save: (proposal, options) =>
          Effect.gen(function* () {
            const values = {
              status: proposal.status,
              resolution: proposal.resolution === null ? null : JSON.stringify(proposal.resolution),
              version: proposal.version,
            }
            const written =
              options.expectedVersion === null
                ? yield* sql<{ id: string }>`
                    INSERT INTO amendment_proposals ${sql.insert({
                      id: proposal.id,
                      tenant_id: proposal.tenantId,
                      encounter_id: proposal.encounterId,
                      patient_id: proposal.patientId,
                      changes: JSON.stringify(proposal.changes),
                      reason: proposal.reason,
                      source: proposal.source,
                      proposed_by: proposal.proposedBy,
                      proposed_at: proposal.proposedAt,
                      base_revision: proposal.baseRevision,
                      ...values,
                    })}
                    ON CONFLICT (id) DO NOTHING
                    RETURNING id
                  `
                : yield* sql<{ id: string }>`
                    UPDATE amendment_proposals SET ${sql.update(values)}
                    WHERE id = ${proposal.id} AND tenant_id = ${proposal.tenantId}
                      AND version = ${options.expectedVersion}
                    RETURNING id
                  `
            if (written.length === 0) {
              return yield* Effect.die(new Error('amendment proposal does not match the stored version'))
            }
            yield* outbox.append(options.events ?? [])
          }).pipe(sql.withTransaction, Effect.catchTag('SqlError', Effect.die)),
      })
    }),
  )
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
