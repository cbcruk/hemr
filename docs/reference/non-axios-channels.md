## Non-axios channels

### Direct `fetch`

| Method | URL | Notes |
|---|---|---|
| `POST` | `{bot stream url}` | URL comes from `GET /api/bot-stream-url` (same origin) → `{ url, enabled }`. Sends `Authorization: Bearer`, body `{ product, ... }`. Streaming chatbot answer. |
| `PUT` | `{signed url}` | Direct-to-storage upload with explicit `Content-Type`. The API first returns `signedUrl` / `originSignedUrl` / `thumbnailSignedUrl` (e.g. `POST /tablet/consent-documents/upload`, `POST /tablet/questionnaire-templates/upload-images`, canvas and onboarding uploads). Sites: `index-CBEIvlV0.js`, `attachments-CRa-dBXP.js:58`, `CanvasView-BGdo1pKi.js:320`, `OnboardingView-m88425Qg.js:868`. |
| `GET` | `{signed url}` | Downloads of stored images / files from signed URLs (`CanvasView-BGdo1pKi.js:284`, `image-DxUl8TV2.js:12`, `ClaimHiraView-hepxiFdR.js:2889`, `TreatmentViewBoardRecordsList…-BhuZ6DBm.js:545`). |

### Local notification arbiter (`http://127.0.0.1:{47821|47822|47823}`)

Coordinates alert ringing across multiple open EMR tabs/apps on the same machine. Ports are tried in order; client id is kept in `localStorage["emr:alert-arbiter-client-id"]`. In Electron it uses `window.electronAPI.notificationArbiter` instead.

| Method | Path | Body |
|---|---|---|
| `POST` | `/v1/decide` | `key`, `clientId`, `late` |
| `GET` | `/v1/status` | |
| `POST` | `/v1/web-focus` | `clientId`, ... |

### Other local endpoints

| URL | Notes |
|---|---|
| `http://localhost:65001` | axios instance created but never assigned or called — dead code in this build; purpose not determinable statically. |
| `http://localhost:4747` | Passed as the `endpoint` prop to a conditionally rendered component in the app shell. |

### WebSocket — Socket.IO `https://socket.upstream.co.kr`

Auth token via `getAuthToken` (same access token). All traffic uses the single Socket.IO `message` event with a `{ type, payload }` envelope; the client store dispatches it to `subscribe(type, handler)` listeners.

| Message `type` | Effect in client |
|---|---|
| `ACTION_WAITING` | Refresh waiting list |
| `ACTION_APPOINTMENT` | Refresh appointments |
| `ACTION_APPOINTMENT_PLANNER` | Refresh appointment planner |
| `ACTION_TREATMENT` | Refresh treatment lists |
| `ACTION_RECEIPT` | Refresh receipt for `payload.date`, `환자Id`, `수납Id` |
| `ACTION_RECORD` | Refresh records for `환자Id` + `진료Id` / `진료Ids`, invalidate record queries |
| `ACTION_MEMO` | Invalidate patient memos, refresh for `payload.date` |
| `ACTION_PATIENT_PHOTO` | Invalidate patient photo / info queries for `환자Id` |
| `SOO_MIGRATION_COMPLETE` | TheSoo → Upstream migration finished (`payload.payload.payload.success`); invalidates all queries |
