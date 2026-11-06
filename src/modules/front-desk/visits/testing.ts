import { clinicDate } from '../../../shared/time/clinic-date.ts'
import { TEST_TENANT } from '../../identity/auth/testing.ts'
import type { Visit } from './visit.ts'

/** 시험용 내원입니다. 오늘 일반(`SELF_PAY`)으로 접수한 대기 내원이고, `overrides`로 바꿉니다. */
export function testVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'vis_01JBQ000000000000000000001' as Visit['id'],
    tenantId: TEST_TENANT.id,
    patientId: 'pat_01JBQ000000000000000000001' as Visit['patientId'],
    date: clinicDate(Date.now()),
    checkedInAt: '2026-11-05T00:00:00.000Z',
    coverage: 'SELF_PAY',
    isFirstVisit: false,
    eligibility: {
      status: 'NOT_REQUIRED',
      nhis: null,
      identityVerified: false,
      benefitRestricted: false,
      copayCode: null,
      selectedInstitutionCode: null,
    },
    benefitFlags: { fullSelfPay: false, pregnant: false },
    encounterId: null,
    status: 'WAITING',
    statusChangedAt: '2026-11-05T00:00:00.000Z',
    hasClinicalData: false,
    version: 1,
    ...overrides,
  }
}
