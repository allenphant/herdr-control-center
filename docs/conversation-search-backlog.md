# Conversation Search Contract and Roadmap

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
