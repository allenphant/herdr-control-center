import assert from "node:assert/strict";
import test from "node:test";
import {
  HerdrClient,
  fingerprintFromAgent,
  fingerprintsEqual,
} from "../src/herdr-client.js";

test("fingerprintFromAgent extracts the stable Herdr conversation identity", () => {
  const fingerprint = fingerprintFromAgent({
    agent: "codex",
    agent_session: {
      agent: "codex",
      kind: "id",
      source: "herdr:codex",
      value: "conversation-123",
    },
  });

  assert.deepEqual(fingerprint, {
    agent: "codex",
    kind: "id",
    source: "herdr:codex",
    value: "conversation-123",
  });
  assert.equal(fingerprintsEqual(fingerprint, { ...fingerprint }), true);
  assert.equal(
    fingerprintsEqual(fingerprint, { ...fingerprint, value: "different" }),
    false,
  );
});

test("sendPrompt targets the explicit Herdr session and pane without a shell", async () => {
  const calls = [];
  const runner = async (binary, args) => {
    calls.push({ binary, args });
    return {
      stdout: JSON.stringify({ id: "prompt", result: { type: "agent_prompt" } }),
      stderr: "",
    };
  };
  const client = new HerdrClient({ binary: "/opt/herdr", runner });

  await client.sendPrompt("project-a", "w2:pM", "繼續原本工作");

  assert.deepEqual(calls, [
    {
      binary: "/opt/herdr",
      args: [
        "--session",
        "project-a",
        "agent",
        "prompt",
        "w2:pM",
        "繼續原本工作",
      ],
    },
  ]);
});

test("readPane returns text from the explicit Herdr session and pane", async () => {
  const calls = [];
  const runner = async (binary, args) => {
    calls.push({ binary, args });
    return { stdout: "最後一段工作內容\n等待下一步", stderr: "" };
  };
  const client = new HerdrClient({ binary: "/opt/herdr", runner });

  const output = await client.readPane("project-a", "w2:pM", 18);

  assert.equal(output, "最後一段工作內容\n等待下一步");
  assert.deepEqual(calls[0], {
    binary: "/opt/herdr",
    args: [
      "--session",
      "project-a",
      "pane",
      "read",
      "w2:pM",
      "--source",
      "recent-unwrapped",
      "--lines",
      "18",
      "--format",
      "text",
    ],
  });
});

test("getPaneLayout reads the real rect layout for an explicit pane", async () => {
  const calls = [];
  const layout = {
    area: { x: 0, y: 0, width: 120, height: 40 },
    panes: [{ pane_id: "w1:p1", rect: { x: 0, y: 0, width: 120, height: 40 } }],
  };
  const runner = async (binary, args) => {
    calls.push({ binary, args });
    return { stdout: JSON.stringify({ result: { layout } }), stderr: "" };
  };
  const client = new HerdrClient({ binary: "/opt/herdr", runner });

  assert.deepEqual(await client.getPaneLayout("project-a", "w1:p1"), layout);
  assert.deepEqual(calls[0], {
    binary: "/opt/herdr",
    args: ["--session", "project-a", "pane", "layout", "--pane", "w1:p1"],
  });
});

test("listFocusState reads each running session's global snapshot focus", async () => {
  const calls = [];
  const runner = async (_binary, args) => {
    calls.push(args);
    if (args.join(" ") === "session list --json") {
      return {
        stdout: JSON.stringify({ sessions: [
          { name: "default", running: true },
          { name: "stopped", running: false },
        ] }),
        stderr: "",
      };
    }
    return {
      stdout: JSON.stringify({ result: { snapshot: { focused_pane_id: "w2:p5" } } }),
      stderr: "",
    };
  };
  const client = new HerdrClient({ runner });

  const result = await client.listFocusState();

  assert.deepEqual(result.sessions, [{ name: "default", focusedPaneId: "w2:p5" }]);
  assert.deepEqual(calls[1], ["--session", "default", "api", "snapshot"]);
});

test("getPaneProcessInfo reads the explicit pane process metadata", async () => {
  const calls = [];
  const processInfo = {
    foreground_processes: [{ pid: 42, argv: ["codex", "resume", "session-id"] }],
  };
  const runner = async (binary, args) => {
    calls.push({ binary, args });
    return { stdout: JSON.stringify({ result: { process_info: processInfo } }), stderr: "" };
  };
  const client = new HerdrClient({ binary: "/opt/herdr", runner });

  assert.deepEqual(await client.getPaneProcessInfo("project-a", "w1:p1"), processInfo);
  assert.deepEqual(calls[0].args, [
    "--session",
    "project-a",
    "pane",
    "process-info",
    "--pane",
    "w1:p1",
  ]);
});

test("reportAgentSession accepts Herdr success with empty stdout", async () => {
  const calls = [];
  const runner = async (binary, args) => {
    calls.push({ binary, args });
    return { stdout: "", stderr: "" };
  };
  const client = new HerdrClient({ binary: "/opt/herdr", runner });

  await client.reportAgentSession("project-a", "w1:p1", {
    agent: "codex",
    source: "herdr:codex",
    sessionId: "01a031b4-5500-7221-9006-1c3857b5e416",
  });

  assert.deepEqual(calls[0].args, [
    "--session",
    "project-a",
    "pane",
    "report-agent-session",
    "w1:p1",
    "--source",
    "herdr:codex",
    "--agent",
    "codex",
    "--agent-session-id",
    "01a031b4-5500-7221-9006-1c3857b5e416",
  ]);
});

test("listTopology keeps panes grouped under their Herdr session", async () => {
  const runner = async (_binary, args) => {
    const command = args.join(" ");
    if (command === "session list --json") {
      return {
        stdout: JSON.stringify({
          sessions: [{ name: "default", running: true, default: true }],
        }),
        stderr: "",
      };
    }
    if (command.endsWith("workspace list")) {
      return {
        stdout: JSON.stringify({ result: { workspaces: [{ workspace_id: "w1", label: "Dev" }] } }),
        stderr: "",
      };
    }
    if (command.includes("tab list")) {
      return {
        stdout: JSON.stringify({ result: { tabs: [{ tab_id: "w1:t1" }] } }),
        stderr: "",
      };
    }
    if (command.includes("pane list")) {
      return {
        stdout: JSON.stringify({ result: { panes: [{ pane_id: "w1:p1", tab_id: "w1:t1" }] } }),
        stderr: "",
      };
    }
    throw new Error(`Unexpected command: ${command}`);
  };

  const client = new HerdrClient({ runner });
  const topology = await client.listTopology();

  assert.equal(topology.sessions[0].name, "default");
  assert.equal(topology.sessions[0].workspaces[0].panes[0].pane_id, "w1:p1");
});
