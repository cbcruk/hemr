/**
 * 주민등록번호 처리입니다 (compliance.md 개인정보 최소 노출). 원문은 암호화해 저장하고(`PatientCrypto`), 응답에는
 * `rrnMasked`만 넣습니다.
 */

const RRN_PATTERN = /^(\d{2})(\d{2})(\d{2})-?(\d)(\d{6})$/

/**
 * 주민등록번호를 숫자 13자리로 맞춥니다. `900101-1234567`과 `9001011234567`을 받습니다. 형식이나 생년월일이 틀리면
 * `null`입니다.
 *
 * 끝자리 검증 숫자는 보지 않습니다. 2020년 10월부터 뒷자리가 임의 번호라 검증식이 맞지 않는 번호가 정상입니다.
 */
export function normalizeRrn(input: string): string | null {
  const match = RRN_PATTERN.exec(input.trim())
  if (match === null) return null
  const [, yy, mm, dd, gender, rest] = match as unknown as [string, string, string, string, string, string]
  const birthDate = birthDateOf(`${yy}${mm}${dd}${gender}`)
  return birthDate === null ? null : `${yy}${mm}${dd}${gender}${rest}`
}

/** 화면에 보일 가린 번호입니다. 예: `900101-1******` */
export function maskRrn(digits: string): string {
  return `${digits.slice(0, 6)}-${digits.slice(6, 7)}******`
}

/** 성별 자리로 세기를 정합니다. 1·2·5·6은 1900년대, 3·4·7·8은 2000년대, 9·0은 1800년대입니다(5–8은 외국인). */
const CENTURY: Record<string, number> = {
  '1': 1900,
  '2': 1900,
  '5': 1900,
  '6': 1900,
  '3': 2000,
  '4': 2000,
  '7': 2000,
  '8': 2000,
  '9': 1800,
  '0': 1800,
}

/** 앞 7자리에서 생년월일(`YYYY-MM-DD`)을 읽습니다. 없는 날짜면 `null`입니다. */
export function birthDateOf(digits: string): string | null {
  const century = CENTURY[digits[6] ?? '']
  if (century === undefined) return null
  const year = century + Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const day = Number(digits.slice(4, 6))
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.toISOString().slice(0, 10)
}

/** 성별 자리가 홀수면 남성, 짝수면 여성입니다. */
export function sexOf(digits: string): 'MALE' | 'FEMALE' {
  return Number(digits[6]) % 2 === 1 ? 'MALE' : 'FEMALE'
}
