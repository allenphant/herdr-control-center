# Pane Relay

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated by the user: a local Node.js service with a dependency-free web interface. The implementation uses the Node.js standard library, browser-native JavaScript, and CSS so it can run alongside Herdr without a package installation step.

## Users

The primary user is a developer running multiple coding agents inside Herdr. They need to leave an existing conversation open when an agent reaches a rolling usage limit, then have a continuation prompt delivered later without returning to the terminal at the reset time.

## Product Purpose

Pane Relay schedules prompts for a manually selected Herdr pane. Success means the prompt reaches the same live conversation at the requested time, or the system refuses delivery and clearly explains why the original conversation could not be verified.

## Positioning

Jobs bind to a Herdr session, an explicit pane ID, and the occupying agent session fingerprint. The scheduler verifies all three again at dispatch time instead of routing by agent kind or display name.

## Operating Context

The product runs locally beside a persistent Herdr session. The user identifies a workspace, tab, and pane from a live, ephemeral preview of its recent terminal output; verifies the current agent identity and state; writes a continuation prompt; chooses a local date and time; and monitors queued and completed deliveries.

## Capabilities and Constraints

- Discover running Herdr sessions and their workspace, tab, pane, and agent state.
- Read a bounded plain-text tail for visible pane choices without persisting terminal content.
- Render the real Herdr tab geometry from normalized pane rectangles, with a list fallback for dense or inconsistent layouts.
- Schedule one-time, daily, or weekly prompts for an explicit pane.
- Attach up to five locally stored images and pass their verified paths to the original agent session.
- Edit queued message content before dispatch and show a live time-to-trigger label.
- Persist schedules and delivery history across application restarts.
- Verify the expected `agent_session` identity immediately before delivery.
- Safely repair a missing Codex or AGY `agent_session` from unique live-process evidence, with automatic and manual GUI triggers.
- Require the fingerprint captured when the user selected the pane to still match when the schedule is created.
- Deliver only through `herdr agent prompt <pane-id>`, never through raw pane text or shell execution.
- Refuse delivery when the pane is missing, has no recognized agent, or contains a different agent session.
- Default to waiting for a settled `idle` or `done` agent state, with a bounded retry window when the pane is still working.
- The original conversation can continue only while the original agent process/session remains available. Agent-specific resume behavior after process exit is outside this product's confirmed scope.
- Herdr 0.8.0 does not expose an atomic compare-and-send operation. Pane Relay compares the fingerprint immediately before `agent prompt`, but a process replacement in the tiny interval between those two CLI operations cannot be eliminated by this client alone.
- The local service binds to loopback only and does not provide remote authentication.
- Pane previews are loaded on demand, kept only in memory, and rate-limited to three concurrent Herdr reads.
- Image attachment files persist locally with owner-only permissions because Herdr's prompt command accepts text rather than binary clipboard payloads.

## Evidence on Hand

The installed Herdr CLI exposes stable JSON for session, workspace, pane, and agent inspection. Its agent records include `pane_id`, `agent_status`, and an `agent_session` object containing a stable source and value. No external benchmarks, customers, or commercial claims are available and none should be invented.

## Product Principles

- Pane first: the selected terminal location is the delivery target.
- Conversation safe: a stale or replaced occupant is a failed job, never a best-effort send.
- Visible state: every scheduled, deferred, sent, canceled, or failed transition is inspectable.
- Spatial recognition: pane position and recent content are both available before the exact destination is selected.
- Local and reversible: configuration stays on the user's machine and scheduled jobs can be paused or canceled.
- Familiar controls: standard date, time, selection, and list interactions take priority over decorative interface patterns.

## Accessibility & Inclusion

The interface must be keyboard operable, use explicit form labels and status text, preserve visible focus, respect reduced motion, and maintain WCAG AA contrast in light and dark modes.
