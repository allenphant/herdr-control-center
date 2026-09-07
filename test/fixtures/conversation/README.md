# 對話 fixture 來源說明

> 語言：繁體中文在前，English 在後。

## 繁體中文

這些 fixture 保留了 2026-09-04 從真實本機 transcript 觀察到的 provider-owned record shape。它們是契約 fixture，不是自行捏造的 API schema。

- `claude-active-branch.jsonl`：取自 Claude Code 2.1.260 JSONL。保留 `last-prompt`、`uuid`、`parentUuid`、`message.role`、字串／陣列內容、assistant 文字／thinking／tool block，以及 rewind fork。
- `codex-original.jsonl` 與 `codex-resumed.jsonl`：取自 Codex CLI 0.152.1 rollout JSONL。保留 `session_meta`、`response_item`、`event_msg`、角色、phase 與內容 block 類型；第二個片段模擬使用相同觀察格式重新接續的 rollout replay。
- `agy-transcript.jsonl`：取自 AGY CLI 1.1.25 concise transcript JSONL。保留 `step_index`、`source`、`type`、`status`、`created_at`、`content`、thinking 與 tool-call 變體。
- `search-benchmark.json`：在暫存 home 目錄中展開成已消毒的 Claude-shaped JSONL 的 deterministic workload recipe。其 record shape 取自 `claude-active-branch.jsonl`；所有生成文字都是 synthetic。

所有原始訊息內容、UUID、timestamp、filesystem path、tool argument 與 account/project metadata 都已替換。fixture 不含任何逐字對話內容。當這些格式發生漂移時，應先從受影響的真實版本重新擷取已消毒 fixture，再修改 parser 預期。

## English

### Conversation fixture provenance

These fixtures preserve provider-owned record shapes observed in real local transcripts on 2026-09-04. They are contract fixtures, not invented API schemas.

* `claude-active-branch.jsonl`: derived from Claude Code 2.1.260 JSONL. Preserves `last-prompt`, `uuid`, `parentUuid`, `message.role`, string/array content, assistant text/thinking/tool blocks, and a rewind fork.
* `codex-original.jsonl` and `codex-resumed.jsonl`: derived from Codex CLI 0.152.1 rollout JSONL. Preserve `session_meta`, `response_item`, `event_msg`, roles, phases, and content block types. The second fragment models a resumed rollout replay using the same observed format.
* `agy-transcript.jsonl`: derived from AGY CLI 1.1.25 concise transcript JSONL. Preserves `step_index`, `source`, `type`, `status`, `created_at`, `content`, thinking, and tool-call variants.
* `search-benchmark.json`: deterministic workload recipe expanded into sanitized Claude-shaped JSONL in a temporary home directory. Its record shape is derived from `claude-active-branch.jsonl`; all generated text is synthetic.

All original message content, UUIDs, timestamps, filesystem paths, tool arguments, and account/project metadata were replaced. The fixtures contain no verbatim conversation text. When these formats drift, capture a new sanitized fixture from the affected real version before changing parser expectations.
