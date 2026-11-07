import { describe, expect, it } from 'vitest'
import { lineAmount, procedureFeeCode, procedureFeeLines } from './procedure-fee-modifiers.ts'
import type { PrescriptionFeeLine, ProcedureContext } from './procedure-fee-modifiers.ts'

const CHILD: ProcedureContext = {
  serviceAt: { date: '2026-03-04', time: '10:00' },
  birthDate: '2023-01-01',
  ageSurcharge: true,
}

const ACUPUNCTURE: PrescriptionFeeLine = {
  feeCode: '40011',
  category: '33001001',
  name: '경혈침술',
  unitPrice: 1000,
  amount: 1000,
  dailyDose: 1,
  days: 1,
}

const MASTER = new Map([
  ['40011', { name: '경혈침술', unitPrice: 1000 }],
  ['40011600', { name: '경혈침술-1~6세', claimName: '', unitPrice: 1600 }],
])

describe('시술·투약 산정코드 (procedureFeeCode)', () => {
  it('진료일보다 늦은 생년월일이면 연령 자리를 붙이지 않습니다', () => {
    expect(procedureFeeCode(ACUPUNCTURE, { ...CHILD, birthDate: '2026-03-10' })).toBeNull()
  })

  it('사용자가 지정한 8자리 코드는 바꾸지 않습니다', () => {
    expect(procedureFeeCode({ ...ACUPUNCTURE, feeCode: '40011300' }, CHILD)).toBeNull()
  })

  it('서버가 계산한 코드가 이미 맞으면 null입니다', () => {
    expect(procedureFeeCode({ ...ACUPUNCTURE, feeCode: '40011600', feeCodeComputed: true }, CHILD)).toBeNull()
  })

  it('시간대 자리는 표에 있는 코드 종류에만 붙입니다', () => {
    const night = { timeSurcharge: 'NIGHT' } as const
    expect(procedureFeeCode({ ...ACUPUNCTURE, ...night }, CHILD)).toBe('40011610')
    expect(procedureFeeCode({ feeCode: '20010', category: '32001001', ...night }, CHILD)).toBeNull()
  })

  it('진찰료 코드는 계산한 코드로 표시되거나 시간대를 지정해도 바꾸지 않습니다', () => {
    const consultation = { feeCode: '10100100', category: '31001001', feeCodeComputed: true }
    expect(procedureFeeCode(consultation, CHILD)).toBeNull()
    expect(procedureFeeCode({ feeCode: '10100', category: '31001001', timeSurcharge: 'NIGHT' }, CHILD)).toBeNull()
  })

  it('연령 가산 설정을 끄면 계산한 코드를 기본코드로 되돌립니다', () => {
    const computed = { ...ACUPUNCTURE, feeCode: '40011600', feeCodeComputed: true }
    expect(procedureFeeCode(computed, { ...CHILD, ageSurcharge: false })).toBe('40011')
  })

  it('경혈침술이 아니면 침법 자리를 붙이지 않습니다', () => {
    expect(procedureFeeCode({ feeCode: '40030', category: '33001003', acupunctureMethod: 'WARMING' }, CHILD)).toBe(
      '40030600',
    )
  })
})

describe('처방 줄 산정코드 적용 (procedureFeeLines)', () => {
  it('바꾼 줄을 계산한 코드로 표시하고 산정명칭이 비면 이름을 처방명으로 씁니다', () => {
    const { lines } = procedureFeeLines({ ...CHILD, lines: [ACUPUNCTURE], feeMaster: MASTER })
    expect(lines).toEqual([
      {
        ...ACUPUNCTURE,
        feeCode: '40011600',
        feeCodeComputed: true,
        name: '경혈침술-1~6세',
        unitPrice: 1600,
        amount: 1600,
      },
    ])
  })

  it('산정코드가 더 붙지 않으면 계산한 코드를 기본코드로 되돌립니다', () => {
    const computed = { ...ACUPUNCTURE, feeCode: '40011600', feeCodeComputed: true, unitPrice: 1600, amount: 1600 }
    const { lines } = procedureFeeLines({ ...CHILD, birthDate: '1990-01-01', lines: [computed], feeMaster: MASTER })
    expect(lines).toEqual([{ ...ACUPUNCTURE, feeCodeComputed: false }])
  })

  it('마스터에 없는 코드는 한 번만 알리고 줄은 그대로 둡니다', () => {
    const master = new Map()
    const result = procedureFeeLines({ ...CHILD, lines: [ACUPUNCTURE, { ...ACUPUNCTURE, days: 2 }], feeMaster: master })
    expect(result.lines).toEqual([ACUPUNCTURE, { ...ACUPUNCTURE, days: 2 }])
    expect(result.warnings).toEqual([{ code: 'FEE_CODE_NOT_IN_MASTER', feeCodes: ['40011600'] }])
  })

  it('비대면이면 현행처럼 서버가 계산한 코드도 그대로 둡니다', () => {
    const computed = { ...ACUPUNCTURE, feeCode: '40011600', feeCodeComputed: true }
    const result = procedureFeeLines({
      ...CHILD,
      birthDate: '1990-01-01',
      lines: [computed],
      feeMaster: MASTER,
      telemedicine: true,
    })
    expect(result.lines).toEqual([computed])
  })

  it('결과 줄에 입력 줄의 다른 필드가 남습니다', () => {
    const { lines } = procedureFeeLines({ ...CHILD, lines: [{ ...ACUPUNCTURE, id: 'a' }], feeMaster: MASTER })
    expect(lines[0]?.id).toBe('a')
  })

  it('비대면이면 줄을 바꾸지 않고 경고도 없습니다', () => {
    const result = procedureFeeLines({ ...CHILD, lines: [ACUPUNCTURE], feeMaster: MASTER, telemedicine: true })
    expect(result).toEqual({ lines: [ACUPUNCTURE], warnings: [] })
  })
})

describe('줄 금액 (lineAmount)', () => {
  it('부동소수 오차 없이 한 번만 반올림(0.5는 올림)합니다', () => {
    expect(lineAmount(650, 2, 3)).toBe(3900)
    expect(lineAmount(333, 0.5, 3)).toBe(500)
    expect(lineAmount(1001, 0.1, 3)).toBe(300)
  })

  it('음수·소수 단가와 소수점 아래 6자리를 넘는 투여량을 거부합니다', () => {
    expect(() => lineAmount(-1, 1, 1)).toThrow(RangeError)
    expect(() => lineAmount(1.5, 1, 1)).toThrow(RangeError)
    expect(() => lineAmount(100, 0.1234567, 1)).toThrow(RangeError)
  })
})
