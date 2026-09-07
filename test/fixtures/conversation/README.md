# Conversation fixture provenance

These fixtures preserve provider-owned record shapes observed in real local transcripts on 2026-09-04. They are contract fixtures, not invented API schemas.

* `claude-active-branch.jsonl`: derived from Claude Code 2.1.260 JSONL. Preserves `last-prompt`, `uuid`, `parentUuid`, `message.role`, string/array content, assistant text/thinking/tool blocks, and a rewind fork.
* `codex-original.jsonl` and `codex-resumed.jsonl`: derived from Codex CLI 0.152.1 rollout JSONL. Preserve `session_meta`, `response_item`, `event_msg`, roles, phases, and content block types. The second fragment models a resumed rollout replay using the same observed format.
* `agy-transcript.jsonl`: derived from AGY CLI 1.1.25 concise transcript JSONL. Preserves `step_index`, `source`, `type`, `status`, `created_at`, `content`, thinking, and tool-call variants.
* `search-benchmark.json`: deterministic workload recipe expanded into sanitized Claude-shaped JSONL in a temporary home directory. Its record shape is derived from `claude-active-branch.jsonl`; all generated text is synthetic.

All original message content, UUIDs, timestamps, filesystem paths, tool arguments, and account/project metadata were replaced. The fixtures contain no verbatim conversation text. When these formats drift, capture a new sanitized fixture from the affected real version before changing parser expectations.
