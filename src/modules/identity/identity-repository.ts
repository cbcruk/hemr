import { Context, Data, Effect, Layer, Option, Ref } from 'effect'
import { SqlClient } from 'effect/sql'
import type { Id } from '../../shared/ids/ids.types.ts'
import { normalizeLoginId } from './identity.ts'
import type { Membership, Product, Tenant, User } from './identity.ts'
import { isPermission, normalizeGrants } from './permissions.ts'
import type { LicenseType, PermissionGrant } from './permissions.ts'

/** 다른 사용자가 이미 쓰는 로그인 아이디입니다. */
export class LoginIdTaken extends Data.TaggedError('LoginIdTaken')<{ loginId: string }> {}

/**
 * 테넌트·사용자·소속 저장소입니다. 저장은 ID(소속은 테넌트 + 사용자) 기준으로 넣거나 바꿉니다. 소속의 권한 조정은
 * 소속과 함께 통째로 바꾸고, 한 권한에 조정 하나로 맞춰(`normalizeGrants`) 권한 이름 순서로 저장합니다. 카탈로그에서
 * 사라진 권한은 읽을 때 뺍니다. 소속 목록은 테넌트 ID 순서입니다.
 *
 * 로그인 아이디는 `normalizeLoginId`로 맞춰 저장·조회하고 전체에서 유일합니다. 다른 사용자가 이미 쓰는 아이디로
 * 저장하면 `LoginIdTaken`입니다.
 */
export class IdentityRepository extends Context.Service<
  IdentityRepository,
  {
    findTenant(id: Id<'tenant'>): Effect.Effect<Option.Option<Tenant>>
    findUser(id: Id<'user'>): Effect.Effect<Option.Option<User>>
    findUserByLoginId(loginId: string): Effect.Effect<Option.Option<User>>
    findMembership(tenantId: Id<'tenant'>, userId: Id<'user'>): Effect.Effect<Option.Option<Membership>>
    membershipsOf(userId: Id<'user'>): Effect.Effect<ReadonlyArray<Membership>>
    saveTenant(tenant: Tenant): Effect.Effect<void>
    saveUser(user: User): Effect.Effect<void, LoginIdTaken>
    saveMembership(membership: Membership): Effect.Effect<void>
  }
>()('hemr/identity/IdentityRepository') {
  static readonly layerMemory = Layer.effect(
    IdentityRepository,
    Effect.gen(function* () {
      const tenants = yield* Ref.make(new Map<string, Tenant>())
      const users = yield* Ref.make(new Map<string, User>())
      const memberships = yield* Ref.make(new Map<string, Membership>())
      const key = (tenantId: string, userId: string) => `${tenantId}/${userId}`
      // 저장한 뒤 호출한 쪽이 객체를 바꿔도 저장값이 바뀌지 않게 복사해 둡니다
      const find = <A>(ref: Ref.Ref<Map<string, A>>, id: string) =>
        Ref.get(ref).pipe(Effect.map((all) => Option.map(Option.fromNullishOr(all.get(id)), structuredClone)))

      return IdentityRepository.of({
        findTenant: (id) => find(tenants, id),
        findUser: (id) => find(users, id),
        findUserByLoginId: (loginId) =>
          Ref.get(users).pipe(
            Effect.map((all) =>
              Option.map(
                Option.fromNullishOr([...all.values()].find((user) => user.loginId === normalizeLoginId(loginId))),
                structuredClone,
              ),
            ),
          ),
        findMembership: (tenantId, userId) => find(memberships, key(tenantId, userId)),
        membershipsOf: (userId) =>
          Ref.get(memberships).pipe(
            Effect.map((all) =>
              [...all.values()]
                .filter((each) => each.userId === userId)
                .sort((a, b) => (a.tenantId < b.tenantId ? -1 : 1))
                .map((each) => structuredClone(each)),
            ),
          ),
        saveTenant: (tenant) => Ref.update(tenants, (all) => new Map(all).set(tenant.id, structuredClone(tenant))),
        saveUser: (user) =>
          Effect.gen(function* () {
            const stored = { ...user, loginId: normalizeLoginId(user.loginId) }
            const taken = yield* Ref.modify(users, (all) => {
              const clash = [...all.values()].some((each) => each.loginId === stored.loginId && each.id !== user.id)
              return clash ? [true, all] : [false, new Map(all).set(user.id, stored)]
            })
            if (taken) return yield* new LoginIdTaken({ loginId: stored.loginId })
          }),
        saveMembership: (membership) =>
          Ref.update(memberships, (all) =>
            new Map(all).set(key(membership.tenantId, membership.userId), {
              ...structuredClone(membership),
              grants: normalizeGrants(membership.grants),
            }),
          ),
      })
    }),
  )

  /** SQL 테이블 `tenants`·`users`·`memberships`·`permission_grants`에 보관합니다. 마이그레이션 `0002`가 만듭니다. */
  static readonly layerSql = Layer.effect(
    IdentityRepository,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      interface TenantRow {
        id: string
        name: string
        hiraInstitutionCode: string | null
        timezone: string
        products: string
        features: string
      }
      interface UserRow {
        id: string
        loginId: string
        name: string
        phone: string | null
        licenseNumber: string | null
        licenseType: LicenseType | null
      }
      interface MembershipRow {
        tenantId: string
        userId: string
        role: Membership['role']
        employmentType: string | null
        joinedOn: string
        status: Membership['status']
        deactivatedFrom: string | null
        scope: Membership['scope']
      }

      const toTenant = (row: TenantRow): Tenant => ({
        id: row.id as Tenant['id'],
        name: row.name,
        hiraInstitutionCode: row.hiraInstitutionCode,
        timezone: row.timezone,
        products: JSON.parse(row.products) as Product[],
        features: JSON.parse(row.features) as string[],
      })
      const toUser = (row: UserRow): User => ({ ...row, id: row.id as User['id'] })

      const userColumns = sql`id, login_id AS loginId, name, phone, license_number AS licenseNumber,
        license_type AS licenseType`

      const grantsOf = (tenantId: string, userId: string) =>
        sql<{ permission: string; effect: PermissionGrant['effect'] }>`
          SELECT permission, effect FROM permission_grants
          WHERE tenant_id = ${tenantId} AND user_id = ${userId}
          ORDER BY permission
        `
      const toMembership = (row: MembershipRow) =>
        grantsOf(row.tenantId, row.userId).pipe(
          Effect.map((grants): Membership => ({
            ...row,
            tenantId: row.tenantId as Membership['tenantId'],
            userId: row.userId as Membership['userId'],
            grants: grants.flatMap(({ permission, effect }) =>
              isPermission(permission) ? [{ permission, effect }] : [],
            ),
          })),
        )
      const membershipQuery = (where: ReturnType<typeof sql.and>) => sql<MembershipRow>`
        SELECT tenant_id AS tenantId, user_id AS userId, role, employment_type AS employmentType,
          joined_on AS joinedOn, status, deactivated_from AS deactivatedFrom, scope
        FROM memberships WHERE ${where}
        ORDER BY tenant_id
      `

      return IdentityRepository.of({
        findTenant: (id) =>
          sql<TenantRow>`
            SELECT id, name, hira_institution_code AS hiraInstitutionCode, timezone, products, features
            FROM tenants WHERE id = ${id}
          `.pipe(
            Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), toTenant)),
            Effect.orDie,
          ),
        findUser: (id) =>
          sql<UserRow>`SELECT ${userColumns} FROM users WHERE id = ${id}`.pipe(
            Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), toUser)),
            Effect.orDie,
          ),
        findUserByLoginId: (loginId) =>
          sql<UserRow>`SELECT ${userColumns} FROM users WHERE login_id = ${normalizeLoginId(loginId)}`.pipe(
            Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), toUser)),
            Effect.orDie,
          ),
        findMembership: (tenantId, userId) =>
          membershipQuery(sql.and([sql`tenant_id = ${tenantId}`, sql`user_id = ${userId}`])).pipe(
            Effect.flatMap((rows) =>
              rows[0] === undefined ? Effect.succeed(Option.none()) : Effect.map(toMembership(rows[0]), Option.some),
            ),
            Effect.orDie,
          ),
        membershipsOf: (userId) =>
          membershipQuery(sql.and([sql`user_id = ${userId}`])).pipe(
            Effect.flatMap((rows) => Effect.forEach(rows, toMembership)),
            Effect.orDie,
          ),
        saveTenant: (tenant) =>
          sql`
            INSERT INTO tenants ${sql.insert({
              id: tenant.id,
              name: tenant.name,
              hira_institution_code: tenant.hiraInstitutionCode,
              timezone: tenant.timezone,
              products: JSON.stringify(tenant.products),
              features: JSON.stringify(tenant.features),
            })}
            ON CONFLICT (id) DO UPDATE SET name = excluded.name,
              hira_institution_code = excluded.hira_institution_code, timezone = excluded.timezone,
              products = excluded.products, features = excluded.features
          `.pipe(Effect.asVoid, Effect.orDie),
        // 아이디 중복은 유니크 제약 하나로 판정합니다. 먼저 조회하고 쓰면 그 사이에 다른 저장이 끼어들 수 있습니다
        saveUser: (user) => {
          const loginId = normalizeLoginId(user.loginId)
          return sql`
              INSERT INTO users ${sql.insert({
                id: user.id,
                login_id: loginId,
                name: user.name,
                phone: user.phone,
                license_number: user.licenseNumber,
                license_type: user.licenseType,
              })}
              ON CONFLICT (id) DO UPDATE SET login_id = excluded.login_id, name = excluded.name,
                phone = excluded.phone, license_number = excluded.license_number,
                license_type = excluded.license_type
            `.pipe(
            Effect.asVoid,
            Effect.catchTag('SqlError', (error) =>
              error.reason._tag === 'UniqueViolation' ? Effect.fail(new LoginIdTaken({ loginId })) : Effect.die(error),
            ),
          )
        },
        saveMembership: (membership) =>
          Effect.gen(function* () {
            yield* sql`
              INSERT INTO memberships ${sql.insert({
                tenant_id: membership.tenantId,
                user_id: membership.userId,
                role: membership.role,
                employment_type: membership.employmentType,
                joined_on: membership.joinedOn,
                status: membership.status,
                deactivated_from: membership.deactivatedFrom,
                scope: membership.scope,
              })}
              ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = excluded.role,
                employment_type = excluded.employment_type, joined_on = excluded.joined_on,
                status = excluded.status, deactivated_from = excluded.deactivated_from, scope = excluded.scope
            `
            yield* sql`
              DELETE FROM permission_grants
              WHERE tenant_id = ${membership.tenantId} AND user_id = ${membership.userId}
            `
            yield* Effect.forEach(
              normalizeGrants(membership.grants),
              (grant) => sql`
                INSERT INTO permission_grants ${sql.insert({
                  tenant_id: membership.tenantId,
                  user_id: membership.userId,
                  permission: grant.permission,
                  effect: grant.effect,
                })}
              `,
              { discard: true },
            )
          }).pipe(sql.withTransaction, Effect.orDie),
      })
    }),
  )
}
