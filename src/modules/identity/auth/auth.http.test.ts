import { Effect, Layer } from 'effect'
import { HttpRouter, HttpServer } from 'effect/http'
import { afterEach, describe, expect, it } from 'vitest'
import { AppLive } from '../../../app.ts'
import { PersistenceMemory } from '../../../persistence.ts'
import type { Membership, Tenant, User } from '../identity.ts'
import { IdentityRepository } from '../identity-repository.ts'
import { TestAuthConfig } from './auth-config.ts'
import { TestPatientCrypto } from '../../patients/patient-crypto.ts'
import { AuthRepository } from './auth-repository.ts'
import { hashPassword } from './password.ts'

const tenant: Tenant = {
  id: 'ten_01JBQ00000000000000000000A' as Tenant['id'],
  name: 'A한의원',
  hiraInstitutionCode: null,
  timezone: 'Asia/Seoul',
  products: ['EMR'],
  features: [],
}
const owner: User = {
  id: 'usr_01JBQ0000000000000000000OW' as User['id'],
  loginId: 'owner',
  name: '김원장',
  phone: null,
  licenseNumber: '12345',
  licenseType: 'KOREAN_MEDICINE_DOCTOR',
}
const membership: Membership = {
  tenantId: tenant.id,
  userId: owner.id,
  role: 'OWNER_DOCTOR',
  employmentType: '상근',
  joinedOn: '2026-01-01',
  status: 'ACTIVE',
  deactivatedFrom: null,
  scope: 'ALL',
  grants: [],
}

const Seed = Layer.effectDiscard(
  Effect.gen(function* () {
    const identity = yield* IdentityRepository
    yield* identity.saveTenant(tenant)
    yield* identity.saveUser(owner).pipe(Effect.orDie)
    yield* identity.saveMembership(membership)
    yield* (yield* AuthRepository).savePassword(owner.id, yield* hashPassword('owner-password'))
  }),
).pipe(Layer.provideMerge(PersistenceMemory()))

let dispose: (() => Promise<void>) | undefined
afterEach(() => dispose?.())

function app() {
  const web = HttpRouter.toWebHandler(
    AppLive.pipe(Layer.provide([Seed, HttpServer.layerServices, TestAuthConfig, TestPatientCrypto])),
    {
      disableLogger: true,
    },
  )
  dispose = web.dispose
  return (method: string, path: string, init: { body?: unknown; token?: string; cookie?: string } = {}) => {
    const headers: Record<string, string> = {}
    if (init.body !== undefined) headers['content-type'] = 'application/json'
    if (init.token !== undefined) headers['authorization'] = `Bearer ${init.token}`
    if (init.cookie !== undefined) headers['cookie'] = init.cookie
    const request: RequestInit = { method, headers }
    if (init.body !== undefined) request.body = JSON.stringify(init.body)
    return web.handler(new Request(`http://localhost/v1${path}`, request))
  }
}

/** 응답 본문입니다. 시험에서 보는 필드만 적습니다. */
interface Body {
  accessToken: string
  permissions: string[]
  code: string
}
const json = (response: Response) => response.json() as Promise<Body>

/** `Set-Cookie`에서 다음 요청에 보낼 `name=value`만 꺼냅니다. */
const cookieOf = (response: Response) => response.headers.get('set-cookie')?.split(';')[0] ?? ''

describe('auth HTTP', () => {
  it('logs in with a refresh cookie that scripts cannot read, and serves /me', async () => {
    const send = app()
    const login = await send('POST', '/auth/sessions', { body: { loginId: 'Owner', password: 'owner-password' } })
    const body = await json(login)

    expect(login.status).toBe(200)
    expect(body).toMatchObject({ expiresIn: 600, tenantId: tenant.id, user: { id: owner.id, loginId: 'owner' } })
    expect(body).not.toHaveProperty('refreshToken')
    const setCookie = login.headers.get('set-cookie') ?? ''
    expect(setCookie).toMatch(/^hemr_refresh=[\w-]{43};/)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=Strict')
    expect(setCookie).toContain('Path=/v1/auth')
    expect(setCookie).toContain('Max-Age=43200')

    const me = await send('GET', '/me', { token: body.accessToken })
    expect(me.status).toBe(200)
    const profile = await json(me)
    expect(profile).toMatchObject({ tenant: { id: tenant.id, products: ['EMR'] }, role: 'OWNER_DOCTOR', scope: 'ALL' })
    expect(profile.permissions).toContain('audit_log:read')
  })

  it('answers every authentication failure with problem details', async () => {
    const send = app()
    const responses = [
      await send('POST', '/auth/sessions', { body: { loginId: 'owner', password: 'wrong' } }),
      await send('POST', '/auth/sessions', { body: { loginId: 'nobody', password: 'wrong' } }),
      await send('GET', '/me'),
      await send('GET', '/me', { token: 'garbage' }),
      await send('POST', '/auth/sessions:refresh'),
      await send('POST', '/auth/sessions:switch-tenant', { body: { tenantId: tenant.id } }),
    ]
    const bodies = await Promise.all(responses.map(json))
    expect(responses.map((each) => each.status)).toEqual([401, 401, 401, 401, 401, 401])
    expect(responses.every((each) => each.headers.get('content-type')?.startsWith('application/problem+json'))).toBe(
      true,
    )
    expect(bodies.map((each) => each.code)).toEqual([
      'INVALID_CREDENTIALS',
      'INVALID_CREDENTIALS',
      'UNAUTHENTICATED',
      'UNAUTHENTICATED',
      'UNAUTHENTICATED',
      'UNAUTHENTICATED',
    ])
    expect(bodies[0]).toEqual(bodies[1])
  })

  it('refreshes with the cookie, then logs out and clears it', async () => {
    const send = app()
    const login = await send('POST', '/auth/sessions', { body: { loginId: 'owner', password: 'owner-password' } })
    const refreshed = await send('POST', '/auth/sessions:refresh', { cookie: cookieOf(login) })

    expect(refreshed.status).toBe(200)
    expect(await refreshed.json()).toMatchObject({ expiresIn: 600 })
    expect(cookieOf(refreshed)).not.toBe(cookieOf(login))

    const logout = await send('DELETE', '/auth/sessions/current', { cookie: cookieOf(refreshed) })
    expect(logout.status).toBe(204)
    expect(logout.headers.get('set-cookie')).toMatch(/^hemr_refresh=; Max-Age=0;.*Path=\/v1\/auth/)

    const after = await send('POST', '/auth/sessions:refresh', { cookie: cookieOf(refreshed) })
    expect(after.status).toBe(401)
    expect(after.headers.get('set-cookie')).toMatch(/^hemr_refresh=; Max-Age=0/)
  })

  it('switches tenant only to an active membership', async () => {
    const send = app()
    const login = await send('POST', '/auth/sessions', { body: { loginId: 'owner', password: 'owner-password' } })
    const { accessToken } = await json(login)

    const ok = await send('POST', '/auth/sessions:switch-tenant', { token: accessToken, body: { tenantId: tenant.id } })
    const denied = await send('POST', '/auth/sessions:switch-tenant', {
      token: accessToken,
      body: { tenantId: 'ten_01JBQ00000000000000000000Z' },
    })
    const invalid = await send('POST', '/auth/sessions:switch-tenant', { token: accessToken, body: { tenantId: 'x' } })

    expect(ok.status).toBe(200)
    expect(denied.status).toBe(403)
    expect(await denied.json()).toMatchObject({ code: 'TENANT_ACCESS_DENIED' })
    expect(invalid.status).toBe(400)
  })

  it('answers a locked account with 423 problem details', async () => {
    const send = app()
    for (let i = 0; i < 4; i++) await send('POST', '/auth/sessions', { body: { loginId: 'owner', password: 'wrong' } })
    const locked = await send('POST', '/auth/sessions', { body: { loginId: 'owner', password: 'wrong' } })
    expect(locked.status).toBe(423)
    expect(await json(locked)).toMatchObject({ code: 'ACCOUNT_LOCKED', type: 'urn:hemr:problem:account-locked' })
  })

  it('leaves the cookie alone on a concurrent refresh, and refreshes into the tenant a tab asks for', async () => {
    const send = app()
    const login = await send('POST', '/auth/sessions', { body: { loginId: 'owner', password: 'owner-password' } })
    const first = await send('POST', '/auth/sessions:refresh', { cookie: cookieOf(login) })
    // 소속이 없는 병원을 물으면 병원 없이 줍니다. 세션의 병원(A)이 아니라 탭이 물은 병원을 본다는 뜻입니다
    const again = await send('POST', '/auth/sessions:refresh?tenantId=ten_01JBQ00000000000000000000Z', {
      cookie: cookieOf(login),
    })

    expect(first.status).toBe(200)
    expect(again.status).toBe(200)
    expect(again.headers.get('set-cookie')).toBeNull()
    expect(await again.json()).toMatchObject({ tenantId: null })
    expect(await first.json()).toMatchObject({ tenantId: tenant.id })
  })

  it('rejects an overlong login id before hashing', async () => {
    const send = app()
    const response = await send('POST', '/auth/sessions', { body: { loginId: 'x'.repeat(65), password: 'p' } })
    expect(response.status).toBe(400)
  })
})
