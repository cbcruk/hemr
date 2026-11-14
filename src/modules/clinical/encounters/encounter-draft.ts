import type { Encounter } from './encounter.ts'

/**
 * 진료에 기록한 내용이 있는지입니다. 내원을 `cascade` 없이 취소할 수 있는지 정할 때 씁니다. 편집기가 비운 본문에 남기는
 * 빈 태그(`<p><br></p>`)와 공백은 내용으로 치지 않고, 그림(`<img>`)은 글자가 없어도 내용입니다. 상병이나 처방 라인이
 * 하나라도 있으면 내용입니다.
 */
export function hasClinicalContent(encounter: Encounter): boolean {
  const body = encounter.note.body
  const text = body
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
  return text !== '' || /<img\b/i.test(body) || encounter.diagnoses.length > 0 || encounter.prescriptionLines.length > 0
}
