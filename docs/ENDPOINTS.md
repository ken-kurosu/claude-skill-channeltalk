# ChannelTalk Internal API Endpoints (発見済)

このスキルが使う API endpoint 一覧。ChannelTalk 公式ドキュメントには載っていない内部 API (desk-api) を含む。

## Open API (公式、x-access-key 認証)
Base: `https://api.channel.io/open/v5`

| method | path | 用途 | 備考 |
|---|---|---|---|
| GET | `/user-chats` | chat 検索 | filter: state, tag, since 等 |
| GET | `/user-chats/{id}` | chat 詳細取得 | userChat object |
| GET | `/user-chats/{id}/messages` | message 一覧 | limit, sortOrder |
| PATCH | `/user-chats/{id}` | tag 等 update | state 変更は不可 |
| PUT | `/user-chats/{id}/snooze?duration=PT{N}H&botName=...` | snooze | botName 必須 |
| POST | `/user-chats/{id}/messages` | bot メッセージ送信 | options で silentToUser 等 |

## Internal Desk API (manager session JWT 認証)
Base: `https://desk-api.channel.io/desk`

### Chat 操作
| method | path | 用途 | body |
|---|---|---|---|
| PUT | `/channels/{cid}/user-chats/{id}/pcp` | chat state 変更 (close/open) | `{tags:[], action:"close"\|"open"}` |

### ALF Rules
Base: `https://front-alf-desk-api.channel.io/desk/channels/{cid}/front-alf/v2`

| method | path | 用途 | body |
|---|---|---|---|
| GET | `/rules` | 全 rule 一覧 | - |
| POST | `/rules` | 新規 rule (paused で作成) | `{title, trigger, instruction, filter}` |
| PUT | `/rules/{id}` | 既存 rule 全更新 | full fields (title, trigger, instruction, filter, state) |
| PUT | `/rules/{id}/pause` | rule 一時停止 | - |
| PUT | `/rules/{id}/live` | rule 有効化 | - |

制約: instruction 上限 **2000 字**

### Workflows
| method | path | 用途 | body |
|---|---|---|---|
| GET | `/channels/{cid}/workflows/{id}` | workflow 詳細 | - |
| PUT | `/channels/{cid}/workflows/{id}/activate` | workflow を active | - |
| PUT | `/channels/{cid}/workflows/{id}/stop` | workflow を stopped | - |

### Workflow Trigger 更新 (3-step)
Workflow の trigger / sections 等は直接 PUT 不可。draft → validate → activate の流れ:

| method | path | 用途 |
|---|---|---|
| (lib/desk_api.js) | `updateDraft(wfId, body)` | draft 更新 |
| (lib/desk_api.js) | `validateWorkflow(wfId, body)` | バリデーション |
| (lib/desk_api.js) | `activateWorkflow(wfId)` | 新 revision を active |

参考: `aikasa-channeltalk-impl/automation/switch_832569_to_notInOperation.js`

### Operation (営業時間)
| method | path | 用途 |
|---|---|---|
| GET | `/channels/{cid}/operations/{opId}` | 営業時間情報 (inOperation, ranges, holidays) |

## CORS / 制約

- `desk-api` 系: GET/PUT/POST は CORS OK、PATCH/DELETE は preflight ブロックされるケースあり
- `x-account` JWT header 必須 (manager session) — Playwright で session 起動して既存 request からキャプチャ
- session JWT は long-lived だが ChannelTalk 側で revoke される可能性あり → Aika 側 `storage_state.json` 再生成は黒須さん operation
