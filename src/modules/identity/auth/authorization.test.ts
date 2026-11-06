import { Effect, Exit, Layer, Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'
import { describe, expect, it } from 'vitest'
import { Api } from '../../../api.ts'
import { Access } from './access.ts'
import { Authentication } from './authentication.ts'
import { Authorization, accessCheck, accessViolations } from './authorization.ts'

const success = Schema.Struct({})
const get = (name: string) => HttpApiEndpoint.get(name, `/${name}`, { success })

describe('accessViolations', () => {
  it('finds nothing in the real API', () => {
    expect(accessViolations(Api)).toEqual([])
  })

  it('catches an undeclared endpoint and a rule without the middleware that checks it', () => {
    const api = HttpApi.make('test').add(
      HttpApiGroup.make('sample').add(
        get('undeclared'),
        get('public').annotate(Access, Access.public),
        get('publicWithAuth').middleware(Authentication).annotate(Access, Access.public),
        get('signedIn').middleware(Authentication).annotate(Access, Access.signedIn),
        get('signedInWithoutAuth').annotate(Access, Access.signedIn),
        get('signedInWithAuthorization').middleware(Authorization).annotate(Access, Access.signedIn),
        get('permissions').middleware(Authorization).annotate(Access, Access.requires('visit:read')),
        get('permissionsWithAuthenticationOnly')
          .middleware(Authentication)
          .annotate(Access, Access.requires('visit:read')),
      ),
    )

    expect(accessViolations(api)).toEqual([
      { endpoint: 'sample.undeclared', problem: 'NOT_DECLARED' },
      { endpoint: 'sample.publicWithAuth', problem: 'PUBLIC_WITH_AUTHENTICATION' },
      { endpoint: 'sample.signedInWithoutAuth', problem: 'SIGNED_IN_WITHOUT_AUTHENTICATION' },
      { endpoint: 'sample.signedInWithAuthorization', problem: 'AUTHORIZATION_WITHOUT_PERMISSIONS' },
      { endpoint: 'sample.permissionsWithAuthenticationOnly', problem: 'PERMISSIONS_WITHOUT_AUTHORIZATION' },
    ])
  })

  it('accepts a rule declared on the group', () => {
    const api = HttpApi.make('test').add(HttpApiGroup.make('sample').add(get('a')).annotate(Access, Access.public))
    expect(accessViolations(api)).toEqual([])
  })
})

describe('accessCheck', () => {
  const build = (layer: Layer.Layer<never>) => Effect.runPromiseExit(Effect.scoped(Layer.build(layer)))

  it('refuses to start an API with an undeclared endpoint', async () => {
    const api = HttpApi.make('test').add(HttpApiGroup.make('sample').add(get('undeclared')))
    const exit = await build(accessCheck(api))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(String(Exit.isFailure(exit) && exit.cause)).toContain('sample.undeclared NOT_DECLARED')
  })

  it('starts the real API', async () => {
    expect(Exit.isSuccess(await build(accessCheck(Api)))).toBe(true)
  })
})
