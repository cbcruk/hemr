import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto'
import { Context, Effect, Layer, Redacted } from 'effect'
import type { Id } from '../../shared/ids/ids.types.ts'
import { isDevMode } from '../identity/auth/auth-config.ts'

/**
 * 환자 개인정보 필드 암호화입니다 (compliance.md). 지금은 주민등록번호만 씁니다.
 *
 * - 암호화: AES-256-GCM이고 행(병원 + 환자)을 연관 데이터로 묶어, 다른 환자의 암호문을 옮겨 붙이면 풀리지 않습니다.
 *   형식은 `v1.<iv>.<암호문>.<태그>`(base64url)입니다
 * - 중복 확인용 색인: 병원별 키의 HMAC-SHA256입니다. 같은 번호라도 병원마다 값이 달라, 색인만으로 병원 사이를 이을 수
 *   없습니다
 *
 * 두 키는 마스터 키 하나에서 HKDF로 나눕니다. 마스터 키를 바꾸려면 다시 암호화하는 작업이 필요합니다(미룸).
 */
export class PatientCrypto extends Context.Service<
  PatientCrypto,
  {
    sealRrn(tenantId: Id<'tenant'>, patientId: Id<'patient'>, rrn: string): string
    /** 풀리지 않으면(키가 다르거나 다른 행의 암호문) 예외를 던집니다. 저장소가 망가진 경우라 defect로 다룹니다. */
    openRrn(tenantId: Id<'tenant'>, patientId: Id<'patient'>, sealed: string): string
    rrnIndex(tenantId: Id<'tenant'>, rrn: string): string
  }
>()('hemr/patients/PatientCrypto') {
  /** 마스터 키(32바이트 이상)로 만듭니다. */
  static layer(masterKey: Redacted.Redacted<Uint8Array>): Layer.Layer<PatientCrypto> {
    return Layer.succeed(PatientCrypto, patientCrypto(Redacted.value(masterKey)))
  }

  /**
   * `PATIENT_DATA_KEY`(base64, 32바이트 이상)를 씁니다. 없으면 서버가 시작하지 않습니다. 로컬 개발 모드(`HEMR_DEV=1`)에서만
   * 고정된 개발용 키를 씁니다. 재시작해도 개발 DB를 읽을 수 있어야 해서 프로세스마다 새로 만들지 않습니다.
   */
  static readonly layerFromEnv: Layer.Layer<PatientCrypto> = Layer.effect(
    PatientCrypto,
    Effect.gen(function* () {
      const fromEnv = process.env['PATIENT_DATA_KEY']
      if (fromEnv === undefined) {
        if (!isDevMode()) return yield* Effect.die('PATIENT_DATA_KEY is required (or set HEMR_DEV=1)')
        yield* Effect.logWarning('PATIENT_DATA_KEY is not set; using the fixed development key')
        return patientCrypto(DEV_KEY)
      }
      const key = Buffer.from(fromEnv, 'base64')
      // 잘못된 글자를 버리고 읽는 경우가 있어, 다시 인코딩해 같은지 봅니다
      if (key.toString('base64').replace(/=+$/, '') !== fromEnv.trim().replace(/=+$/, '')) {
        return yield* Effect.die('PATIENT_DATA_KEY is not valid base64')
      }
      if (key.length < 32) return yield* Effect.die('PATIENT_DATA_KEY must be at least 32 bytes (base64)')
      return patientCrypto(key)
    }),
  )
}

/** 공개 저장소에 있는 키입니다. 개발과 테스트 밖에서 쓰면 안 됩니다. */
const DEV_KEY = createHmac('sha256', 'hemr').update('development patient data key').digest()

/** 고정 키를 쓰는 테스트용 암호화입니다. */
export const TestPatientCrypto = PatientCrypto.layer(Redacted.make(DEV_KEY))

/** 마스터 키로 암호화 구현을 만듭니다. 테스트가 Layer 없이 직접 쓸 수 있게 내보냅니다. */
export function patientCrypto(master: Uint8Array): PatientCrypto['Service'] {
  const derive = (info: string) => Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), info, 32))
  const encryptionKey = derive('hemr/patient/rrn-encryption')
  const indexKey = derive('hemr/patient/rrn-index')
  const aad = (tenantId: string, patientId: string) => Buffer.from(`${tenantId}/${patientId}`)

  return {
    sealRrn: (tenantId, patientId, rrn) => {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv).setAAD(aad(tenantId, patientId))
      const body = Buffer.concat([cipher.update(rrn, 'utf8'), cipher.final()])
      return ['v1', iv, body, cipher.getAuthTag()]
        .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
        .join('.')
    },
    openRrn: (tenantId, patientId, sealed) => {
      const [version, iv, body, tag] = sealed.split('.')
      if (version !== 'v1' || iv === undefined || body === undefined || tag === undefined) {
        throw new Error('unknown sealed RRN format')
      }
      // 짧은 태그를 받으면 위조가 쉬워지므로 16바이트 태그만 받습니다
      const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(iv, 'base64url'), {
        authTagLength: 16,
      })
        .setAAD(aad(tenantId, patientId))
        .setAuthTag(Buffer.from(tag, 'base64url'))
      return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8')
    },
    rrnIndex: (tenantId, rrn) =>
      createHmac('sha256', createHmac('sha256', indexKey).update(tenantId).digest()).update(rrn).digest('base64url'),
  }
}
