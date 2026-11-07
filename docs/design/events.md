# 도메인 이벤트와 실시간 채널

모듈 사이 통신과 단말 실시간 갱신에 쓰는 이벤트를 정의합니다.

## 현행에서 고칠 점

- **모든 메시지가 Socket.IO `message` 이벤트 하나에 `{type, payload}`로 실립니다.** payload 중첩 깊이가 이벤트마다 다릅니다(`payload.payload`, `payload.payload.payload`)
- **이벤트가 "무효화 신호"일 뿐입니다.** payload에 필요한 정보가 없어 `ACTION_WAITING` 하나에 대기 목록 전체를 다시 받아 환자 이름을 찾습니다
- **이벤트가 없는 도메인이 많습니다.** 시술 상태, 패키지, 문서, 전자서명, 외부 예약 요청, 태블릿 문진, CRM 전체. 그래서 폴링(1분 원무, 5초 치료실, 5초 서명)이 남아 있습니다
- **유실 보정이 재연결 시 전체 무효화뿐입니다**

## 형식

모든 이벤트는 같은 envelope입니다. [CloudEvents](https://cloudevents.io/) 필드 이름을 따릅니다.

```jsonc
{
  "id": "evt_01J...",
  "type": "visit.status_changed",
  "time": "2026-11-01T10:02:11+09:00",
  "tenantId": "ten_...",
  "subject": "vis_01J...",            // 주 리소스 ID
  "seq": 18234,                        // 테넌트별 단조 증가
  "actor": { "kind": "USER", "id": "usr_...", "deviceId": "dev_..." },
  "data": { "visitId": "vis_...", "patientId": "pat_...", "patientName": "홍길동", "from": "WAITING", "to": "IN_TREATMENT" }
}
```

- `data`에는 **화면이 즉시 반응하는 데 필요한 최소 필드**를 넣습니다. 전체 리소스는 넣지 않습니다 (개인정보 노출 최소화, payload 크기)
- 주민번호·진료 본문 같은 민감 정보는 이벤트에 넣지 않습니다

## 전달

### 모듈 간 (서버 내부)

- 각 모듈은 상태 변경과 같은 트랜잭션에서 **outbox** 테이블에 이벤트를 씁니다. 릴레이가 outbox를 읽어 버스에 냅니다
- 소비자는 `id`로 중복을 거릅니다 (최소 1회 전달)
- 모듈러 모놀리스 단계에서는 버스가 같은 프로세스 안 큐여도 되지만, outbox 경로는 처음부터 둡니다. 나중에 CRM을 분리할 때 바꿀 것이 없게 합니다
- **구현 (D9):** outbox는 SQLite `outbox` 테이블이고, 저장소가 상태 변경과 같은 트랜잭션에서 씁니다([outbox.ts](../../src/shared/events/outbox.ts)). `seq`는 기록 순서이고, 테넌트가 생기기 전까지 전체에서 단조 증가합니다
  - 릴레이는 프로세스에 워커 하나이고, 1초마다 `seq` 순서로 최대 100건을 버스에 냅니다([outbox-relay.ts](../../src/shared/events/outbox-relay.ts))
  - 한 이벤트가 실패하면 그 뒤 이벤트도 내지 않고 멈춥니다. 같은 리소스의 이벤트 순서가 뒤바뀌지 않게 하기 위해서입니다. 실패한 이벤트는 1초부터 두 배씩 최대 5분까지 기다렸다 다시 시도하고, 횟수 제한 없이 `attempts`·`last_error`를 남깁니다
  - 버스는 같은 프로세스 안 `PubSub`입니다([event-bus.ts](../../src/shared/events/event-bus.ts)). 모듈을 분리할 때 이 Layer만 바꿉니다
  - 최소 1회 전달은 **버스까지**입니다. 같은 프로세스 버스는 구독자가 없거나 처리 중에 죽은 구독자에게 이벤트를 다시 주지 않습니다. 놓치면 안 되는 첫 소비자(SSE, CRM)를 붙일 때는 소비자마다 마지막으로 처리한 `seq`를 저장하고 outbox를 `seq > 마지막` 으로 읽게 합니다
  - `seq` 순서 읽기는 SQLite가 쓰기를 하나씩 직렬화해서 안전합니다. PostgreSQL로 옮기면 동시 트랜잭션의 시퀀스 값이 커밋 순서와 달라질 수 있어, 릴레이·`since` 커서가 행을 건너뛸 수 있습니다. 옮길 때 다시 설계합니다
  - 내보낸 행은 `published_at`을 남기고 지우지 않습니다. 단말 유실 보정(`since`)의 24시간 보관과 정리 작업은 SSE를 붙일 때 정합니다

### 단말 (실시간)

```
POST /events/stream-tickets               → { ticket, expiresAt }
GET  /events/stream?ticket=…&since=18200  Server-Sent Events
```

- **SSE를 기본으로 합니다.** 단말→서버 방향은 일반 HTTP 요청이면 충분하고, 현행 Socket.IO가 하던 일은 서버→단말 알림뿐입니다
- **인증:** 브라우저 `EventSource`는 `Authorization` 헤더를 보낼 수 없습니다. access token을 쿼리스트링에 실으면 프록시·접근 로그에 남으므로 쓰지 않습니다. 대신 클라이언트가 `POST /events/stream-tickets`(access token 필요)로 60초짜리 1회용 티켓을 받아 `GET /events/stream?ticket=…&since=…`로 연결합니다. 티켓은 연결에 한 번 쓰면 무효가 되고, 연결은 access token 만료와 무관하게 최대 1시간 유지한 뒤 서버가 끊어 재인증하게 합니다
- **유실 보정:** 클라이언트는 마지막으로 받은 `seq`를 기억했다가 재연결 시 `since`로 보냅니다. 서버는 보관 기간(24시간) 안이면 빠진 이벤트를 다시 보내고, 넘었으면 `reset` 이벤트를 보내 전체 재조회를 지시합니다. 현행 "재연결 시 오늘 날짜 키 전체 무효화"를 대체합니다
- **구독 범위:** 서버는 사용자의 권한·scope(`OWN`)에 맞는 이벤트만 보냅니다
- 폴링은 남기지 않습니다. 이벤트 경로가 끊겼을 때를 대비한 안전망은 클라이언트 쿼리 캐시의 `staleTime`(예: 5분)으로 충분합니다

## 이벤트 목록

| 모듈 | 이벤트 | 현행 대응 |
|---|---|---|
| Patients | `patient.created/updated/merged`, `patient.photo_updated`, `memo.created/updated/deleted/proposed`, `consent.changed`, `package_contract.status_changed`, `prepaid.changed` | `ACTION_PATIENT_PHOTO`, `ACTION_MEMO` |
| Front Desk | `appointment.created/rescheduled/canceled/no_show`, `booking_request.received/confirmed/rejected/expired`, `visit.checked_in`, `visit.status_changed`, `visit.bed_changed`, `payment.recorded`, `receipt.created/voided`, `payment.refunded`, `cash_drawer.changed` | `ACTION_APPOINTMENT`, `ACTION_APPOINTMENT_PLANNER`, `ACTION_WAITING`, `ACTION_RECEIPT` |
| Clinical | `encounter.created/updated/completed/amended/retracted`, `amendment.proposed`, `prescription_line.approval_changed`, `procedure.created/updated/removed`, `ai_turn.succeeded/failed`, `observation.recorded` | `ACTION_RECORD`, `ACTION_TREATMENT`, `RECORD_LLM_*` |
| Herbal Pharmacy | `herbal_prescription.created/status_changed/delivery_changed`, `external_herbal_order.status_changed`, `external_herbal_order.precheck_failed` | (`ACTION_RECORD`에 섞임) |
| Claims | `claim.aggregated/submitted/submission_failed/outcome_unknown/adjudicated`, `hira_pre_submission.status_changed`, `agent.connected/disconnected`, `nhic_certificate.expiring`, `indemnity.lookup_completed` | 없음 |
| Documents | `document.issued/voided`, `signature_request.status_changed`, `intake.submitted` | 없음 (서명은 5초 폴링) |
| CRM | `contact_task.created/updated/proposed`, `message_campaign.status_changed`, `message.delivered/failed`, `opt_out.changed`, `suppression.created/removed` | 없음 |
| Catalog | `settings.changed`, `reference.dataset_published` | `ACTION_TREATMENT.subType` (`TIMER_CONFIG_UPDATE`, `GROUP_CONFIG_UPDATE`) |
| Offline | `edge.mode_changed`, `sync.batch_completed`, `sync.conflict_created/resolved`, `offline_settlement.created/reconciled` | 없음 |
| 공통 | `job.completed`, `reset` | `LITE_MIGRATION_COMPLETE` |

## 알림 중복 방지

현행은 같은 PC에서 탭 여러 개가 접수 알림음을 동시에 울리지 않도록 로컬 중재 서버(`127.0.0.1:4782x/v1/decide`)를 둡니다. 이건 서버 설계 문제가 아니라 클라이언트 문제이므로 재설계에서는 브라우저 기능으로 해결하길 권합니다.

- 같은 출처의 탭끼리는 `BroadcastChannel` + `navigator.locks`로 리더 탭 하나만 소리를 냅니다
- 데스크톱 에이전트가 있는 PC는 에이전트가 OS 알림을 맡습니다

서버는 이벤트 `id`를 주므로 클라이언트가 "이 이벤트는 이미 알렸다"를 판정할 수 있습니다.
