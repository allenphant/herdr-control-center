# Conversation Search Contract and Roadmap

> Languages: [English](#conversation-search-contract-and-roadmap) · [繁體中文](#繁體中文)

> Scope: search the native conversation bound to the currently selected Herdr pane, or search indexed history across inactive conversations.
> Phase 0 contract validated against local Claude Code 2.1.260, Codex CLI 0.152.1, and AGY CLI 1.1.25 recordings on 2026-09-04.

## Product outcome

From a pane card, the user can search the complete visible user/assistant conversation, page through every matching message, and open a stable context window around a result. From the header's global entry, the user can search older inactive conversations without selecting a pane first. The browser never supplies or receives a transcript path.

## Delivery sieve

### Phase 1 — Implemented

* Search the conversation identified by the selected pane's live Herdr fingerprint.
* Search all discoverable inactive Claude, Codex, and AGY conversations through the global search entry.
* Support `herdr:claude`, `herdr:codex`, and `herdr:antigravity_cli`.
* Normalize all providers into one `NormalizedMessage` contract shared by search and context viewing.
* Return every matching message through revision-bound cursor pagination.
* Cache normalized messages in memory and read only appended transcript bytes while a source remains append-only.
* Persist the global normalized index at `~/.cache/herdr-control-center/conversation-index.json`, updating changed sources incrementally and replacing the file atomically.
* Fail closed when the fingerprint, provider format, cursor revision, or conversation identity is ambiguous.

### Phase 2 — Nice to have

* Search options for case sensitivity and whole words.
* Keyboard previous/next navigation, match highlighting, and virtualized long conversations.
* Cache observability and configurable memory limits.

### Phase 3 — Future

* SQLite FTS index, ranking, and advanced filters when the JSON index is no longer sufficient.
* Optional semantic search. Embeddings are not part of the MVP.
* AGY protobuf/database fallback if the concise transcript disappears.

## Canonical contract

```js
NormalizedMessage = {
  provider: "claude" | "codex" | "agy",
  conversationId: string,
  anchor: string,
  ordinal: number,
  role: "user" | "assistant",
  timestamp: string | null,
  text: string,
}
```

Contract rules:

* `anchor` is unique within one transcript revision and is derived from provider-owned IDs, never message text.
* `ordinal` is the canonical display order after branch filtering and fragment merging.
* `text` contains only content visible as user or assistant conversation. Tool calls, tool results, reasoning, system instructions, checkpoints, and metadata are excluded.
* Search and context responses are projections of the same cached `NormalizedMessage[]`; no second parser is allowed.
* A transcript revision is a SHA-256 digest of provider identity plus the exact source bytes used to build the messages.

Provider mapping:

| Provider | Conversation source | Visible records | Anchor seed | Special rule |
| --- | --- | --- | --- | --- |
| Claude | `~/.claude/projects/*/<session-id>.jsonl` | non-meta user text and assistant `text` blocks | record `uuid` + content index | Walk `parentUuid` ancestors from the latest non-sidechain graph record; discard rewound branches |
| Codex | `~/.codex/sessions/**/rollout-*-<thread-id>.jsonl` | `response_item` → `message`, user `input_text`, assistant `output_text` | response item `id` + content index | Merge all fragments for the same `session_meta.payload.id`; deduplicate replayed items |
| AGY | `~/.gemini/antigravity-cli/brain/<conversation-id>/.system_generated/logs/transcript.jsonl` | `USER_EXPLICIT/USER_INPUT/DONE` and `MODEL/PLANNER_RESPONSE/DONE` with content | `step_index` + type + occurrence | Exclude `GENERIC`, `SYSTEM`, `CHECKPOINT`, RUNNING, thinking, and tool calls |

## API contract

### `POST /api/conversation/search`

Request:

```json
{
  "sessionName": "default",
  "paneId": "w1:p3",
  "expectedFingerprint": {
    "agent": "codex",
    "kind": "id",
    "source": "herdr:codex",
    "value": "00000000-0000-7000-8000-000000000020"
  },
  "query": "needle",
  "roles": ["user", "assistant"],
  "limit": 20,
  "cursor": null
}
```

Response fields: `provider`, `conversationId`, `revision`, `query`, `hits`, and `nextCursor`. Each hit contains `anchor`, `ordinal`, `role`, `timestamp`, `snippet`, and UTF-16 `matchRanges` suitable for browser string slicing.

### `POST /api/conversation/context`

The request uses the same pane target and fingerprint plus `anchor`, `before`, and `after`. The response returns the canonical messages around that anchor and the current revision.

The server must fetch the live pane agent immediately before reading transcript data and compare it with `expectedFingerprint`. HTTP 409 is returned if the occupant changed, a cursor revision is stale, or an anchor no longer exists. Unsupported or malformed provider data returns 422; missing transcript data returns 404.

### `POST /api/conversation/global-search`

Global search does not require a live pane. It accepts `query`, optional `agent` (`codex`, `claude`, or `agy`), `roles`, `limit`, and `cursor`, and searches the persistent normalized index across all discoverable provider transcripts.

### `POST /api/conversation/global-context`

Global context accepts a constrained historical fingerprint plus `anchor`, `revision`, `before`, and `after`. The server validates the fingerprint against its fixed provider roots before reading the indexed conversation, then returns the same canonical context shape as the selected-pane endpoint.

## Data flow

```text
Pane card
   |
   | session + pane + expected fingerprint + query
   v
Loopback API
   |
   +--> Herdr agent get --> compare live fingerprint --mismatch--> 409
   |
   +--> provider locator --> fixed home-root transcript path(s)
                              |
                              +--> append-aware conversation cache
                              |
                              +--> persistent global JSON index
                                      |
                                      v
                               NormalizedMessage[]
                                  |             |
                                  v             v
                               search       context viewer
```

## Security and privacy invariants

* Reject non-UUID conversation IDs before filesystem lookup.
* The request cannot contain a path or provider override.
* Resolve sources only beneath fixed per-provider roots; do not follow a browser-supplied filename.
* Revalidate the Herdr fingerprint for every search/context request.
* Never return native record payloads, tool content, reasoning, system content, or local source paths.
* Selected-conversation cache is process-local and bounded by LRU entries.
* The global index is durable JSON under the user's cache directory, contains only normalized visible messages and source signatures, and is written through an atomic replacement.
* A service restart may rebuild or incrementally update the global index; native transcript paths remain internal and are never returned.
* JSONL parse errors fail closed unless the only invalid data is an incomplete final appended line, which remains buffered until complete.

## Acceptance tests

* Claude fixture proves active-branch selection and exclusion of tool/thinking/system content.
* Codex fixtures prove resumed-fragment merge and replay deduplication.
* AGY fixture proves source/type/status allowlisting.
* Search proves role filters, all match ranges, deterministic pagination, and stale-cursor rejection.
* Repository tests use temporary home roots and prove unchanged cache reuse, appended-byte ingestion, truncation rebuild, and LRU eviction.
* API tests prove live fingerprint validation for selected-pane search, historical fingerprint validation for global context, and absence of any path parameter.
* Global search tests prove cross-provider discovery, persistent index reuse, changed-source rebuilds, pagination, and context lookup without a selected pane.
* Benchmark fixtures measure, rather than assume, the targets: warm search under 50 ms; ordinary cold load under 300 ms; large conversation first page under 1 second.

## Measured baseline

Measured on 2026-09-07 with Node.js v24.16.0 on Linux/x64, Intel Core i7-7700K. These are machine-local observations, not universal latency guarantees. Run `npm run benchmark:conversation-search` to regenerate the synthetic workload and enforce the thresholds.

| Workload | Messages | Measured | Target |
| --- | ---: | ---: | ---: |
| Ordinary cold load + first search | 1,200 | 12.32 ms | < 300 ms |
| Large cold load + first page | 12,000 | 91.52 ms | < 1,000 ms |
| Large warm cached search | 12,000 | 3.73 ms | < 50 ms |

The workload recipe is `test/fixtures/conversation/search-benchmark.json`. The runner expands it into a temporary, sanitized Claude-shaped transcript, validates hit count, cursor presence, and revision format, then removes the temporary data.

After deployment, run `npm run verify:conversation-search:live`. It discovers currently active searchable panes from the loopback topology endpoint and verifies each available provider through the deployed search API. The probe prints only provider status and hit count, never conversation IDs or message text.

An additional read-only probe against the three real current local transcripts on the same machine measured cold/warm service calls of Claude 22.97/0.21 ms, Codex 53.88/4.64 ms, and AGY 14.13/0.13 ms. No native conversation content was printed or persisted by the probe.

## Current implementation and roadmap

The provider fixtures, canonical contract, adapters, transcript discovery, revisioning, append-aware cache, persistent global index, fingerprint-verified API routes, pane-card search UI, header global search UI, and browser coverage are implemented.

The remaining roadmap is limited to optional capabilities: search case sensitivity and whole-word filters, keyboard result navigation, cache observability, SQLite FTS ranking, semantic search, and an AGY fallback if the concise transcript disappears.

## 繁體中文

> 範圍：搜尋目前選定 Herdr pane 綁定的原生 conversation，或搜尋跨 inactive conversation 的歷史索引。
> Phase 0 契約已於 2026-09-04 以本機 Claude Code 2.1.260、Codex CLI 0.152.1 與 AGY CLI 1.1.25 的紀錄驗證。

### 產品結果

使用者可以從 pane card 搜尋完整可見的 user/assistant 對話，瀏覽所有命中訊息，並開啟命中位置附近的穩定 context。也可以從 header 的「全域搜尋」搜尋較早的 inactive conversation，不必先選 pane。瀏覽器不會提供或收到 transcript path。

### 交付範圍

#### Phase 1 — 已實作

- 搜尋目前選定 pane 的 live Herdr fingerprint 所識別的 conversation。
- 透過全域搜尋入口搜尋可發現的 Claude、Codex 與 AGY inactive conversation。
- 支援 `herdr:claude`、`herdr:codex` 與 `herdr:antigravity_cli`。
- 所有 provider 正規化成 search 與 context 共用的 `NormalizedMessage` 契約。
- 以 revision-bound cursor pagination 回傳每一筆命中。
- 對單一 conversation 使用記憶體 cache，來源只追加時只讀取 appended bytes。
- 在 `~/.cache/herdr-control-center/conversation-index.json` 保存 global normalized index；只增量更新變更來源，並以 atomic replacement 寫入。
- fingerprint、provider format、cursor revision 或 conversation identity 不明確時 fail closed。

#### Phase 2 — Nice to have

- 大小寫與 whole-word 搜尋選項。
- 鍵盤上一筆/下一筆導覽、命中標記與 virtualized 長對話。
- Cache observability 與可設定的記憶體限制。

#### Phase 3 — 未來

- 當 JSON index 不足時導入 SQLite FTS、排序與進階篩選。
- 可選的 semantic search；Embeddings 不屬於 MVP。
- 如果精簡 transcript 消失，再加入 AGY protobuf/database fallback。

### Canonical contract

```js
NormalizedMessage = {
  provider: "claude" | "codex" | "agy",
  conversationId: string,
  anchor: string,
  ordinal: number,
  role: "user" | "assistant",
  timestamp: string | null,
  text: string,
}
```

契約規則：

- `anchor` 在同一 transcript revision 內唯一，由 provider 自己的 ID 推導，不能由訊息文字產生。
- `ordinal` 是完成 branch filtering 與 fragment merging 後的 canonical 顯示順序。
- `text` 只包含使用者或 Assistant 看得到的 conversation 內容；排除 tool call/result、reasoning、system instruction、checkpoint 與 metadata。
- Search 與 context 都是同一份 cached `NormalizedMessage[]` 的 projection，不允許第二套 parser。
- Transcript revision 是 provider identity 加上建立訊息時使用的完整 source bytes 之 SHA-256 digest。

### API 契約

`POST /api/conversation/search` 與 `POST /api/conversation/context` 用於目前選定 pane。request 包含 session、pane、`expectedFingerprint`、query、roles、limit/cursor 或 anchor/revision/before/after；server 每次都會先重新驗證 live fingerprint。

`POST /api/conversation/global-search` 不需要 live pane，接受 query、可選的 `agent`（`codex`、`claude`、`agy`）、roles、limit 與 cursor，搜尋所有可發現的 provider transcript 的持久 normalized index。

`POST /api/conversation/global-context` 接受受限 historical fingerprint、anchor、revision、before 與 after。Server 會先依固定 provider root 驗證 fingerprint，再回傳與目前 pane context endpoint 相同的 canonical context shape。

occupant 改變、cursor revision 過期或 anchor 消失時回傳 HTTP 409；provider 不支援或資料格式錯誤回傳 422；找不到 transcript 回傳 404。瀏覽器不可傳入 path 或 provider override。

### 資料流

```text
Pane card 或 Header 全域搜尋
          |
          v
      Loopback API
          |
          +--> 目前 pane：Herdr agent get -> 比對 live fingerprint
          |
          +--> 歷史搜尋：固定 home-root provider locator
                                  |
                                  +--> append-aware conversation cache
                                  |
                                  +--> persistent global JSON index
                                           |
                                           v
                                    NormalizedMessage[]
                                       |             |
                                       v             v
                                    search       context viewer
```

### 安全與隱私不變量

- 在 filesystem lookup 前拒絕非 UUID conversation ID。
- request 不能包含 path 或 provider override。
- 來源只能位於各 provider 的固定 root 下，不能追隨瀏覽器提供的檔名。
- 目前 pane 的每次 search/context 都要重新驗證 Herdr fingerprint；global context 則驗證受限 historical fingerprint 與固定來源 root。
- 絕不回傳原生 record payload、tool content、reasoning、system content 或本機 source path。
- Selected-conversation cache 是 process-local 且受 LRU 限制；global index 是使用者 cache 目錄下的持久 JSON，只保存 normalized 可見訊息與 source signature。
- Global index 以 atomic replacement 寫入；服務重啟後可重建或增量更新。
- JSONL parse error 會 fail closed，只有不完整的最後 appended line 會保留等待後續內容。

### 驗收測試

- Claude fixture 驗證 active branch 選擇，以及排除 tool/thinking/system 內容。
- Codex fixtures 驗證 resumed fragment merge 與 replay deduplication。
- AGY fixture 驗證 source/type/status allowlist。
- Search 驗證 role filter、所有 match range、deterministic pagination 與 stale-cursor rejection。
- Repository tests 使用 temporary home root，驗證 unchanged cache reuse、appended-byte ingestion、truncation rebuild 與 LRU eviction。
- API tests 驗證 selected-pane live fingerprint、global historical fingerprint 與沒有 path parameter。
- Global search tests 驗證跨 provider discovery、persistent index reuse、changed-source rebuild、pagination 與無 selected pane 的 context lookup。
- Benchmark 必須實際量測 warm search、ordinary cold load 與大型 conversation first page，不把目標當成既成事實。

### 已完成實作與 roadmap

Provider fixtures、canonical contract、adapters、transcript discovery、revisioning、append-aware cache、persistent global index、fingerprint-verified API、pane-card search UI、header global search UI 與 browser coverage 都已完成。

剩餘 roadmap 只包含可選能力：大小寫與 whole-word filter、鍵盤結果導覽、cache observability、SQLite FTS ranking、semantic search，以及精簡 transcript 消失時的 AGY fallback。
