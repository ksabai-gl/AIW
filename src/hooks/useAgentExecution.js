import { useAppStore, AGENT_STATUS } from "../store/useAppStore";
import { agentBridgeFetchJson } from "../lib/agentBridgeApi";
import { getActualAgentName } from "../data/agentMapping";
import { BRIDGE_CLI_PLATFORMS } from "../data/options";
import { useRef } from "react";
import { flushSync } from "react-dom";

const MAX_PRIOR_AGENT_OUTPUT_CHARS = 80_000;

/**
 * Kiro: `ask` / `supervised` / empty narrow tools and break MCP. Default to `autopilot` (full tools).
 * Cursor: omit mode in the API payload; bridge never passes `--mode plan|ask` (see cursor-agent-bridge).
 */
function resolveExecutionModeForBridge(platformId, raw) {
  const pid = typeof platformId === "string" ? platformId.trim() : "";
  const t = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (pid === "kiro_cli") {
    if (!t || t === "plan" || t === "ask" || t === "supervised" || t === "agent") {
      return "autopilot";
    }
    return raw.trim();
  }
  return undefined;
}

/**
 * Max wait for the bridge (Kiro/Cursor process must finish). Not typical duration: a direct
 * `jira-post` script is seconds; a full Kiro agent run is LLM + many tool steps (often minutes).
 * Keep in sync with `vite.config.js` `server.proxy["/api"].proxyTimeout`.
 */
const AGENT_RUN_FETCH_TIMEOUT_MS = 600_000;

/** Only send `--model` when the value is a real CLI model id (not wizard placeholders). */
function resolveModelForBridge(ideConfig) {
  const llm = ideConfig?.llm;
  if (!llm || typeof llm !== "string") return undefined;
  const t = llm.trim();
  if (!t || t === "__cli_default__") return undefined;
  if (/^llm\d+$/i.test(t)) return undefined;
  const low = t.toLowerCase();
  if (low === "auto" || low === "default" || low === "inherit") return undefined;
  return t;
}

function stripOuterQuotesFromPath(p) {
  if (typeof p !== "string") return p;
  let t = p.trim();
  for (let i = 0; i < 8; i += 1) {
    const next = t.replace(/^["']+|["']+$/g, "").trim();
    if (next === t) break;
    t = next;
  }
  return t;
}

function yieldForStateCommit() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function extractPriorAgentOutputText(output) {
  if (!output || typeof output !== "object") return "";
  const sOut = typeof output.stdout === "string" ? output.stdout.trim() : "";
  if (sOut) return sOut;
  const sErr = typeof output.stderr === "string" ? output.stderr.trim() : "";
  if (sErr) return sErr;
  const rest = { ...output };
  delete rest.stdout;
  delete rest.stderr;
  if (Object.keys(rest).length) return JSON.stringify(rest, null, 2);
  return "";
}

/**
 * Append completed upstream agents' bridge output so each step receives prior step results (same HTTP path as Jira Spec).
 */
function buildUpstreamContext(agents, currentAgentId) {
  const idx = agents.findIndex((a) => a.id === currentAgentId);
  if (idx <= 0) return "";
  const sections = [];
  for (let i = 0; i < idx; i++) {
    const a = agents[i];
    if (a.status !== AGENT_STATUS.COMPLETED) continue;
    const mapped = getActualAgentName(a.shortName || a.name);
    const header = `#### Prior step: ${a.name} (agent: \`${mapped}\`)`;
    const text = extractPriorAgentOutputText(a.output);
    if (!text) {
      sections.push(`${header}\n_No captured stdout from this step._\n`);
      continue;
    }
    let body = text;
    if (body.length > MAX_PRIOR_AGENT_OUTPUT_CHARS) {
      body = `${body.slice(0, MAX_PRIOR_AGENT_OUTPUT_CHARS)}\n\n... [truncated at ${MAX_PRIOR_AGENT_OUTPUT_CHARS} characters]`;
    }
    sections.push(`${header}\n\n${body}\n`);
  }
  if (!sections.length) return "";
  return [
    "### PIPELINE_CONTEXT_FROM_PRIOR_AGENTS",
    "",
    "Use the following outputs from earlier steps in this workflow as primary context for this run.",
    "",
    ...sections,
  ].join("\n");
}

// Module-level run counter per agentId.
// Each new executeAgent call increments the counter.
// When the API responds, we check if the run ID still matches — if not, discard.
const currentRunId = new Map();

export function useAgentExecution() {
  const { state, actions } = useAppStore();

  const stateRef = useRef(state);
  stateRef.current = state;

  const executeAgent = async (agentId, userMessage = "") => {
    // Assign a new run ID — any previous run that resolves later will see a mismatched ID and discard
    const myRunId = (currentRunId.get(agentId) ?? 0) + 1;
    currentRunId.set(agentId, myRunId);

    const agentBefore = stateRef.current.workflow.agents.find((a) => a.id === agentId);
    const isJiraSpecCreator = agentBefore?.shortName === "Jira Spec Creator";
    const isJiraPublishOnly =
      isJiraSpecCreator && typeof userMessage === "string" && userMessage.trim().length > 0;

    // Publishing must not reset the card (or downstream agents); drafting resets as usual.
    flushSync(() => {
      if (!isJiraPublishOnly) {
        actions.resetAgent(agentId);
      }
      actions.startAgent(agentId);
    });

    try {
      const currentState = stateRef.current;
      const agent = currentState.workflow.agents.find((a) => a.id === agentId);
      if (!agent) {
        actions.addLog({ timestamp: new Date().toLocaleTimeString(), agent: "System", message: "Error: Agent not found", type: "error" });
        if (currentRunId.get(agentId) === myRunId) actions.failAgent(agentId);
        return null;
      }

      const { ideConfig, targetWorkspace, agentBridgeBaseUrl, sourceFile } = currentState.setup;

      const platformId = ideConfig?.platform || "";
      const isPlatformKiro = platformId === "kiro_cli";
      const apiPath = isPlatformKiro ? "/api/kiro/run" : "/api/run";
      const baseUrl = agentBridgeBaseUrl || "";

      let actualAgentName = getActualAgentName(agent.shortName || agent.name);
      if (isJiraSpecCreator) {
        actualAgentName = isJiraPublishOnly
          ? "jira-ticket-publisher-agent"
          : "jira-spec-drafter-agent";
      }

      // Agents that operate on the workspace directly (git diff, existing files)
      // do NOT need the uploaded input file — only skip the guard for them
      const WORKSPACE_ONLY_AGENTS = new Set([
        "PR Agent", "Jira Publish", "Test Gen", "Code Gen",
        "pr-creator-agent", "jira-ticket-publisher-agent", "test-generation-agent", "p4gl-to-ts-transform-agent",
      ]);
      const needsInputFile =
        !isJiraPublishOnly
        && !WORKSPACE_ONLY_AGENTS.has(agent.shortName)
        && !WORKSPACE_ONLY_AGENTS.has(actualAgentName);

      if (needsInputFile && sourceFile?.name && !sourceFile?.content) {
        actions.addLog({
          timestamp: new Date().toLocaleTimeString(),
          agent: agent.shortName,
          message: `⚠ File "${sourceFile.name}" content is not loaded (${sourceFile.content?.length ?? 0} chars). Please re-upload the file.`,
          type: "error",
        });
        if (currentRunId.get(agentId) === myRunId) actions.failAgent(agentId);
        return null;
      }

      if (!BRIDGE_CLI_PLATFORMS.includes(platformId)) {
        actions.addLog({
          timestamp: new Date().toLocaleTimeString(),
          agent: agent.shortName,
          message:
            `IDE must be Cursor (Agent CLI) or Kiro CLI to run pipeline agents via the bridge. Current: "${platformId || "not set"}".`,
          type: "error",
        });
        if (currentRunId.get(agentId) === myRunId) actions.failAgent(agentId);
        return null;
      }

      let effectiveUserMessage = userMessage || "";
      if (needsInputFile && sourceFile?.content) {
        const fileHeader = [
          `### INPUT_FILE: ${sourceFile.name}`,
          `### IMPORTANT: The complete text content of the uploaded file is provided below.`,
          `### Use this content directly. Do NOT attempt to read this file from disk.`,
          ``,
          sourceFile.content,
        ].join("\n");
        effectiveUserMessage = effectiveUserMessage
          ? `${fileHeader}\n\n### USER_INSTRUCTION\n\n${effectiveUserMessage}`
          : fileHeader;
      }

      const upstreamCtx = buildUpstreamContext(currentState.workflow.agents, agentId);
      if (upstreamCtx) {
        effectiveUserMessage = effectiveUserMessage
          ? `${effectiveUserMessage}\n\n${upstreamCtx}`
          : upstreamCtx;
      }

      const resolvedModel = resolveModelForBridge(ideConfig);
      const resolvedExecutionMode = resolveExecutionModeForBridge(platformId, ideConfig?.executionMode);
      const payload = {
        agentName: actualAgentName,
        userMessage: effectiveUserMessage,
        workspaceRoot: targetWorkspace || "",
        outputFormat: "json",
        ...(resolvedModel ? { model: resolvedModel } : {}),
        ...(typeof resolvedExecutionMode === "string" && resolvedExecutionMode
          ? { executionMode: resolvedExecutionMode }
          : {}),
      };
      if (ideConfig?.cliExecutablePath) {
        payload[isPlatformKiro ? "kiroBin" : "agentBin"] = stripOuterQuotesFromPath(
          ideConfig.cliExecutablePath
        );
      }

      actions.addLog({
        timestamp: new Date().toLocaleTimeString(),
        agent: agent.shortName,
        message: `Starting agent execution... (Mapped: "${agent.shortName}" → "${actualAgentName}"${needsInputFile && sourceFile?.name ? ` | Input: ${sourceFile.name} (${sourceFile.content?.length ?? 0} chars)` : ""})`,
        type: "info",
      });

      if (isPlatformKiro) {
        actions.addLog({
          timestamp: new Date().toLocaleTimeString(),
          agent: agent.shortName,
          message:
            "Kiro runs an LLM plus MCP tools (many round-trips). That is slower than a direct Jira REST/MCP script, which skips the model.",
          type: "info",
        });
      }

      // Debug: log first 200 chars of what we're sending
      console.log("[executeAgent] payload.userMessage preview:", payload.userMessage?.slice(0, 200));

      // Await the real API response
      const result = await agentBridgeFetchJson(baseUrl, apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify(payload),
        timeoutMs: AGENT_RUN_FETCH_TIMEOUT_MS,
        cache: "no-store",
      });

      // ── STALE CHECK: if a newer run started while we were waiting, discard this result ──
      if (currentRunId.get(agentId) !== myRunId) {
        return null;
      }

      if (result.error) {
        actions.addLog({ timestamp: new Date().toLocaleTimeString(), agent: agent.shortName, message: `Error: ${result.error}`, type: "error" });
        actions.failAgent(agentId, result);
        return null;
      }

      // Detect Kiro service errors that exit 0 but have no stdout and a dispatch/network error in stderr
      const kiroServiceError = result.ok !== false
        && !result.stdout?.trim()
        && /dispatch failure|io error|failed to send|unknown error/i.test(result.stderr || "");

      const cliSucceeded = !kiroServiceError
        && result.ok !== false
        && (result.exitCode === undefined || result.exitCode === 0);

      if (result.stderr?.trim()) {
        // Extract the human-readable Kiro error if present
        const kiroErrorMatch = result.stderr.match(/Kiro is having trouble responding right now[^\n]*/);
        if (kiroErrorMatch) {
          actions.addLog({ timestamp: new Date().toLocaleTimeString(), agent: agent.shortName, message: `⚠ ${kiroErrorMatch[0]} — Kiro service is unreachable. Check your internet connection or try again later.`, type: "error" });
        } else {
          result.stderr.trim().split("\n").forEach((line) => {
            if (line.trim()) actions.addLog({ timestamp: new Date().toLocaleTimeString(), agent: agent.shortName, message: `[stderr] ${line}`, type: cliSucceeded ? "info" : "error" });
          });
        }
      }

      if (!cliSucceeded) {
        const exitInfo = result.exitCode !== undefined ? ` (exit code ${result.exitCode})` : "";
        actions.addLog({ timestamp: new Date().toLocaleTimeString(), agent: agent.shortName, message: `Execution failed${exitInfo}`, type: "error" });
        actions.failAgent(agentId, result);
        return null;
      }

      if (result.stdout) {
        try {
          let output = result.stdout;
          if (output.trim().startsWith("{") || output.trim().startsWith("[")) {
            output = JSON.stringify(JSON.parse(output), null, 2);
          }
          output.split("\n").forEach((line) => {
            if (line.trim()) actions.addLog({ timestamp: new Date().toLocaleTimeString(), agent: agent.shortName, message: line, type: "output" });
          });
        } catch {
          actions.addLog({ timestamp: new Date().toLocaleTimeString(), agent: agent.shortName, message: result.stdout, type: "output" });
        }
      }

      // → COMPLETED — only after real API response AND run ID still matches
      actions.addLog({ timestamp: new Date().toLocaleTimeString(), agent: agent.shortName, message: "Execution completed successfully", type: "success" });
      if (isJiraSpecCreator) {
        actions.completeAgent(agentId, result, {
          jiraSpecCreatorStep: isJiraPublishOnly ? "publish" : "draft",
        });
      } else {
        actions.completeAgent(agentId, result);
      }
      await yieldForStateCommit();
      return result;

    } catch (error) {
      if (currentRunId.get(agentId) !== myRunId) return null;
      const agentOnError = stateRef.current.workflow.agents.find((a) => a.id === agentId);
      actions.addLog({ timestamp: new Date().toLocaleTimeString(), agent: agentOnError?.shortName || "Unknown", message: `Error: ${error.message}`, type: "error" });
      actions.failAgent(agentId);
      await yieldForStateCommit();
      return null;
    }
  };

  const executeWorkflow = async (startAgentId) => {
    const snapshot = stateRef.current.workflow.agents;
    const startIdx = snapshot.findIndex((a) => a.id === startAgentId);
    if (startIdx === -1) return;

    for (let i = startIdx; i < snapshot.length; i++) {
      const agent = stateRef.current.workflow.agents[i];
      if (!agent) break;
      // eslint-disable-next-line no-await-in-loop
      const result = await executeAgent(agent.id);
      // eslint-disable-next-line no-await-in-loop
      await yieldForStateCommit();
      if (result === null) {
        actions.addLog({
          timestamp: new Date().toLocaleTimeString(),
          agent: agent.shortName,
          message: "Stopping workflow due to error",
          type: "error",
        });
        break;
      }
      if (result?.stop_workflow) {
        actions.addLog({ timestamp: new Date().toLocaleTimeString(), agent: agent.shortName, message: "Workflow stopped by agent", type: "info" });
        break;
      }

      const updated = stateRef.current.workflow.agents.find((a) => a.id === agent.id);
      if (
        result !== null
        && agent.shortName === "Jira Spec Creator"
        && updated?.jiraSpecAwaitingPublish
        && !updated?.jiraSpecPublishDone
      ) {
        actions.addLog({
          timestamp: new Date().toLocaleTimeString(),
          agent: agent.shortName,
          message:
            "Jira spec draft finished — click **Review** on the card, then **Create in Jira** here after you confirm the text (then continue the pipeline).",
          type: "info",
        });
        break;
      }

      if (agent.pipelinePauseAfter && result !== null) {
        actions.addLog({
          timestamp: new Date().toLocaleTimeString(),
          agent: agent.shortName,
          message:
            "Step finished — review output below before continuing the pipeline.",
          type: "info",
        });
        break;
      }
    }
  };

  return { executeAgent, executeWorkflow };
}
