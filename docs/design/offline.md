# 오프라인 접수·수납

인터넷이 끊겨도 데스크가 접수·수납을 계속할 수 있게 하는 설계입니다. [결정 D1](review.md#결정-필요)에서 "지원한다"로 정했습니다. 진료기록 작성·서식 발급·청구는 오프라인 범위가 아닙니다.

## 원칙

1. **병원 안에 기준점을 하나 둡니다.** 병원마다 지정된 데스크톱 에이전트 하나가 **엣지**가 됩니다. 오프라인 동안 병원 안 모든 데스크 단말은 엣지를 통해서만 씁니다. 그래서 병원 안 단말끼리는 충돌하지 않고, 충돌은 엣지와 서버 사이에서만 생깁니다
2. **이미 일어난 일은 거부하지 않습니다.** 환자가 왔고 돈을 받았다면 서버는 동기화 때 그 사실을 반드시 기록합니다. 검증에 걸리면 기록을 버리지 않고 충돌로 표시해 사람이 해결하게 합니다
3. **오프라인에서는 금액을 확정하지 않습니다.** 본인부담금·가산·패키지 차감은 서버 규칙이 계산합니다. 오프라인 수납은 "받은 돈"만 기록하고, 금액 확정은 복구 후 서버가 합니다
4. **오프라인 쓰기도 온라인과 같은 커맨드입니다.** 엣지는 커맨드를 큐에 쌓았다가 그대로 서버에 다시 보냅니다. 오프라인 전용 커맨드는 금액을 확정하지 않는 [오프라인 정산](#오프라인-정산) 하나뿐입니다

## 모드

| `edgeMode` | 의미 | 단말 동작 |
|---|---|---|
| `ONLINE` | 엣지가 서버에 연결됨 | 단말은 서버로 직접 요청. 엣지는 캐시만 갱신 |
| `OFFLINE` | 엣지가 서버에 닿지 않음 | 데스크 단말은 엣지로 요청. 오프라인 범위 밖 기능은 비활성 |
| `SYNCING` | 복구 후 큐를 서버에 반영하는 중 | 단말은 서버로 요청. 반영이 끝날 때까지 시재 마감 불가 |

- 모드 판정은 엣지가 합니다. 서버 heartbeat가 30초 동안 실패하면 `OFFLINE`으로 바꾸고 LAN의 단말에 알립니다
- 단말 하나만 인터넷이 끊기고 엣지는 연결된 경우에는 그 단말이 엣지를 거쳐 서버로 요청합니다(프록시). 이때는 `ONLINE`이므로 큐에 쌓이지 않습니다
- 엣지가 `OFFLINE`인데 일부 단말은 서버에 직접 닿는 경우가 있습니다. 서버는 엣지 heartbeat가 끊긴 테넌트에 `edge.mode_changed`를 보내고, 온라인 단말 화면에 "오프라인 단말이 있음" 경고를 띄우게 합니다. 이 사이 생긴 쓰기는 [충돌](#충돌)로 해결합니다

## 범위

| 기능 | 오프라인 | 비고 |
|---|---|---|
| 오늘 예약·대기 목록 보기 | 됨 | 엣지 캐시 |
| 환자 검색 | 됨 | 이름·차트번호·생년월일·전화번호 뒷자리. 주민번호 검색은 안 됨 |
| 신환 등록 | 됨 | 차트번호는 [임대 번호](#차트번호)로 |
| 접수 (`:check-in`) | 됨 | 자격조회는 `UNVERIFIED`로 남기고 복구 후 서버가 조회 |
| 내원 상태 이동 | 됨 | `:start-treatment`, `:return-to-waiting`, `:send-to-checkout`, 베드 배정 |
| 접수 취소 | 됨 | 연쇄 취소(`cascade`)는 안 됨 |
| 수납 | 받은 돈만 기록 | [오프라인 정산](#오프라인-정산) |
| 환불·수납 취소 | 안 됨 | 복구 후 처리 |
| 선수금·패키지 차감 | 안 됨 | 잔액이 최신인지 보장할 수 없음. 복구 후 정산 때 적용 |
| 예약 생성·변경 | 됨 | 서버 검증(수용 한도)은 동기화 때. 넘치면 경고만 |
| 진료기록·처방 | 안 됨 | 종이에 적고 복구 후 입력. 진료의 `serviceAt`(진료 시각)과 입력 시각이 따로 남음 |
| 서식 발급·전자서명·청구·메시지 발송 | 안 됨 | |

## 엣지 캐시

엣지는 온라인일 때 서버 상태를 내려받아 둡니다.

```
GET /edge/snapshot                          처음 한 번, 또는 reset 이후
GET /events/stream?ticket=…&since=          이후에는 이벤트로 증분 갱신
```

- **담는 것:** 활성 환자의 표시 필드(이름, 차트번호, 생년월일, 성별, 전화번호, `rrnMasked`, 최근 보험구분), 오늘~내일 예약, 오늘 내원, 의사·진료항목·치료실, 비급여 항목 이름(가격은 참고용), 사용자 목록과 권한
- **담지 않는 것:** 주민번호 원문과 해시, 진료 본문, 메모 본문, 선수금·패키지 잔액
- 캐시는 기기 키로 암호화해 저장합니다. 기기 페어링을 해제하거나 서버와 7일 이상 연결되지 않으면 지웁니다
- 오프라인 중 엣지가 캐시를 읽은 기록도 접속기록으로 남기고 동기화 때 서버에 올립니다 ([compliance.md](compliance.md#오프라인-캐시))

## 오프라인 로그인

- 끊기기 전에 로그인해 있던 단말은 세션을 그대로 씁니다. 엣지가 세션을 최대 12시간 인정합니다
- 새로 로그인해야 하면 사용자가 미리 등록한 **오프라인 PIN**을 씁니다. 엣지는 PIN 검증값(느린 해시)만 가지고, 5회 실패하면 그 사용자를 오프라인 동안 잠급니다
- 권한은 캐시된 권한으로 판정합니다. 동기화 때 서버가 `occurredAt` 시점의 권한으로 다시 확인하고, 그사이 권한이 빠진 사용자의 커맨드는 충돌로 표시합니다

## 커맨드 큐

```jsonc
POST /edge/sync-batches
Idempotency-Key: <batchId>
{
  "edgeDeviceId": "dev_...",
  "commands": [
    {
      "commandId": "cmd_01J...",          // 엣지가 만든 ULID. 재전송 시 중복 제거 키
      "localSeq": 41,                      // 엣지 안 순서
      "occurredAt": "2026-11-01T10:02:11+09:00",
      "actor": { "userId": "usr_...", "deviceId": "dev_..." },
      "method": "POST",
      "path": "/visits:check-in",
      "body": { "id": "vis_01J...", "patientId": "pat_01J...", ... }
    }
  ]
}
→ 202 { jobId }
```

- 서버는 `localSeq` 순서대로 하나씩 실행합니다. 각 커맨드의 결과는 `APPLIED`, `APPLIED_WITH_CONFLICT`, `REJECTED` 중 하나이고 Job 결과의 `items[]`에 남습니다
- 앞 커맨드가 `REJECTED`면, 그 커맨드가 만든 ID를 참조하는 뒤 커맨드도 실행하지 않고 같은 충돌에 묶습니다
- **ID는 엣지가 만듭니다.** 오프라인에서 만든 환자·내원·결제는 엣지가 접두사 붙은 ULID를 정해 `body.id`로 보내고, 서버는 그 ID를 그대로 씁니다 ([conventions.md](conventions.md#응답-형태)). 그래서 뒤 커맨드가 앞 커맨드의 결과를 참조할 수 있습니다
- **업무 시각은 `occurredAt`입니다.** "오늘" 판정(예약일, 시재 일자)은 `occurredAt`의 병원 시간대 날짜로 합니다. 서버가 받은 시각은 `syncedAt`으로 따로 남습니다. 엣지 시계가 서버 시계와 5분 넘게 어긋나 있었으면 해당 커맨드에 경고를 붙입니다
- 감사 로그의 행위자는 `actor.userId`이고, `via: EDGE_SYNC`와 배치 ID가 함께 남습니다

## 차트번호

- 자동 채번 병원은 엣지가 온라인일 때 번호 묶음을 미리 빌려 둡니다

```
POST /chart-number-leases              { count: 20 }   → { leaseId, numbers: [...] }
POST /chart-number-leases/{id}:release { unusedNumbers }
```

- 엣지는 남은 번호가 5개 아래로 내려가면 새 묶음을 빌립니다. 복구 후 쓰지 않은 번호는 반납하고, 서버는 반납된 번호를 다음 채번에 먼저 씁니다
- 수동 채번 병원은 직원이 입력한 번호를 그대로 쓰고, 동기화 때 중복이면 충돌(`CHART_NUMBER_TAKEN`)로 표시합니다
- 빌린 번호를 다 쓰면 신환은 차트번호 없이 등록하고 화면에 "번호 대기"로 보입니다. 동기화 때 서버가 채번합니다

## 접수

- 오프라인 접수의 자격은 `eligibility.status: UNVERIFIED`로 남습니다
- 동기화 때 서버가 해당 내원마다 자격조회를 자동으로 다시 합니다. 결과가 접수한 보험구분과 다르면 내원에 `warnings: [ELIGIBILITY_MISMATCH]`를 달고 [보험구분 변경](front-desk.md#접수-커맨드) 흐름으로 처리하게 합니다
- 자격이 `UNVERIFIED`인 진료는 청구 집계에서 빠집니다 ([claims.md](claims.md#자격조회-nhic))
- 오프라인에서는 주민번호로 중복 환자를 찾을 수 없습니다. 신환 등록 시 엣지는 이름+생년월일+전화번호로 비슷한 환자를 보여 주기만 합니다. 동기화 때 서버가 주민번호 해시로 중복을 찾으면 `DUPLICATE_PATIENT` 충돌을 만들고, 해결은 [환자 병합](patients.md#엔드포인트)입니다
- 엣지는 주민번호를 테넌트 공개키로 암호화해 큐에 넣습니다. 엣지 자신은 입력 후 원문을 다시 읽을 수 없습니다

## 오프라인 정산

오프라인에서는 받을 금액을 서버 규칙으로 계산할 수 없으므로, 받은 돈과 직원이 안내한 금액만 기록합니다.

```jsonc
POST /visits/{id}:settle-offline        (엣지에서만 받음)
{
  "payments": [
    { "id": "pay_01J...", "method": "CASH", "amount": { "taxable": 0, "taxExempt": 15000 } },
    { "id": "pay_01J...", "method": "CARD", "amount": { ... }, "processorRef": "..." }
  ],
  "quotedAmount": 15000,                 // 직원이 환자에게 안내한 금액
  "memo": ""
}
```

- 엣지에서는 내원이 `COMPLETED`처럼 보여 대기 목록에서 빠집니다
- 동기화 때 서버는 다음을 합니다
  1. 결제를 `UNAPPLIED`로 기록 ([수납 커맨드](front-desk.md#수납-커맨드)의 외부 승인 결제와 같은 상태)
  2. `OfflineSettlement { visitId, paymentIds, quotedAmount, status: PENDING }` 생성
  3. 내원은 `AWAITING_PAYMENT`로 둡니다. 서버의 `COMPLETED`는 항상 영수증이 있다는 뜻이기 때문입니다
- 진료기록을 입력한 뒤 직원이 정산 작업 목록에서 평소처럼 `:quote-checkout` → `:checkout {paymentIds}`를 하면 `OfflineSettlement`가 `RECONCILED`가 됩니다. 확정 금액과 `quotedAmount`가 다르면 차액은 일반 수납과 같이 미수·과수납으로 남습니다

```
GET  /offline-settlements?status=PENDING&date=
GET  /offline-settlements/{id}
```

- 카드 결제는 단말기(VAN)가 자체 회선으로 승인할 수 있을 때만 받습니다. VAN도 끊기면 현금·계좌이체만 받습니다. 이 판단은 단말기 쪽 문제이고 서버 설계와는 무관합니다
- 오프라인 현금은 받은 날 시재에 들어갑니다. 시재 `expectedClosing`은 `UNAPPLIED` 현금 결제도 포함합니다
- 엣지는 종이용 "임시 수납 확인증"을 출력할 수 있습니다. 진료비 계산서·영수증은 정산 후 서버가 발급합니다

## 충돌

```
GET  /sync-conflicts?status=OPEN
GET  /sync-conflicts/{id}
POST /sync-conflicts/{id}:resolve      { resolution, ... }
```

| `code` | 상황 | 해결 선택지 |
|---|---|---|
| `DUPLICATE_PATIENT` | 오프라인 신환이 기존 환자와 주민번호가 같음 | `MERGE_INTO {patientId}` / `KEEP_SEPARATE` |
| `CHART_NUMBER_TAKEN` | 수동 입력 차트번호가 이미 있음 | `ASSIGN_NEW` / `ASSIGN {chartNumber}` |
| `VISIT_ALREADY_EXISTS` | 같은 환자가 같은 날 온라인 단말에서도 접수됨 | `MERGE_VISITS {keepVisitId}` / `KEEP_BOTH` |
| `APPOINTMENT_CHANGED` | 오프라인에서 도착 처리한 예약이 그사이 온라인에서 취소·변경됨 | `RESTORE_AND_ARRIVE` / `IGNORE_APPOINTMENT` |
| `SLOT_OVER_CAPACITY` | 오프라인 예약이 수용 한도를 넘김 | `ACCEPT` / `RESCHEDULE` |
| `STATE_TRANSITION_INVALID` | 내원 상태 이동이 서버 상태에서 불가 (온라인 쪽에서 먼저 바뀜) | `ACCEPT_SERVER_STATE` |
| `PERMISSION_REVOKED` | 행위자의 권한이 `occurredAt` 시점에 없었음 | `APPROVE {by}` / `REVERT` |

- **결제와 접수는 충돌이 있어도 기록합니다.** 위 표에서 결제·내원이 관련된 충돌은 모두 `APPLIED_WITH_CONFLICT`입니다. 해결 전까지 그 내원의 수납은 막히고(`409 SYNC_CONFLICT_OPEN`) 목록에 표시됩니다
- `REJECTED`는 형식 오류처럼 기록할 실체가 없는 경우만입니다
- 시재 마감은 그 날짜에 열린 충돌이나 미반영 배치가 있으면 409 `OFFLINE_SYNC_PENDING`입니다

## 이벤트

| 이벤트 | payload |
|---|---|
| `edge.mode_changed` | `{ edgeDeviceId, mode }` |
| `sync.batch_completed` | `{ batchId, applied, conflicts, rejected }` |
| `sync.conflict_created/resolved` | `{ conflictId, code, subject }` |
| `offline_settlement.created/reconciled` | `{ settlementId, visitId, patientId }` |

동기화로 반영된 커맨드는 온라인 커맨드와 같은 도메인 이벤트(`visit.checked_in`, `payment.recorded` 등)도 냅니다. 이벤트의 `time`은 `syncedAt`이고, `data.occurredAt`에 원래 시각을 넣습니다.

## 엣지가 갖춰야 할 것

[D2](review.md#결정-필요)(에이전트 기술 선택)는 미뤘지만, D1 결정으로 다음 요구는 정해졌습니다. 어떤 기술을 고르든 만족해야 합니다.

- 사용자가 로그인하지 않아도 PC가 켜져 있으면 도는 상시 서비스
- 암호화된 로컬 저장소 (캐시와 커맨드 큐)
- LAN의 데스크 단말에 HTTPS로 API를 제공. 단말 인증은 기기 페어링 인증서로
- 병원당 엣지 하나 지정, 교체 시 큐를 다 비운 뒤 넘김 (`POST /devices/{id}:designate-edge`)
- 큐가 남아 있는 상태로 엣지 PC가 고장 나면 그 커맨드는 잃습니다. 엣지는 큐를 같은 PC의 다른 디스크나 두 번째 데스크 PC에 복제하는 선택지를 둡니다 (구현 시 결정)
