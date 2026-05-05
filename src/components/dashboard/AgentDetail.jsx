import { useState, useRef, useEffect } from "react";
import { useAppStore, AGENT_STATUS, canStartSequentialAgent } from "../../store/useAppStore";
import { useAgentExecution } from "../../hooks/useAgentExecution";
import "./AgentDetail.css";

const START_AGENT_DEBOUNCE_MS = 1500;

/**
 * Detect if the agent's stdout is a clarifying question rather than a completed task.
 * Returns true when the output is asking for user input rather than delivering results.
 */
function isAgentQuestion(stdout) {
  if (!stdout || typeof stdout !== "string") return false;
  const trimmed = stdout.trim();
  const lower = trimmed.toLowerCase();

  // Contains a question mark anywhere in the last 300 chars
  if (trimmed.slice(-300).includes("?")) return true;

  // Contains numbered options like "1." "2." "3." near the end
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  const last10 = lines.slice(-10).join("\n");
  if (/^\d+\.\s+\S/m.test(last10)) return true;

  // Common "waiting for input" phrases anywhere in the output
  const waitingPhrases = [
    "let me know",
    "do you want",
    "would you like",
    "which option",
    "please choose",
    "please select",
    "please confirm",
    "please clarify",
    "please specify",
    "what would you",
    "how can i help",
    "how would you like",
    "did you mean",
    "were you trying",
    "can you clarify",
    "could you clarify",
    "could you confirm",
    "what do you",
    "shall i",
    "should i",
    "if you want",
    "i can now",
    "i can execute",
    "i can proceed",
    "should i proceed",
    "confirm to continue",
  ];
  return waitingPhrases.some((phrase) => lower.includes(phrase));
}

/**
 * Cursor/Kiro often return one JSON object whose readable prose lives in `result` (with real `\n`
 * after parse). Showing raw stdout prints a single line of escapes — extract for display.
 */
function formatAgentStdoutForDisplay(raw) {
  if (raw == null || typeof raw !== "string") return "";
  const t = raw.trim();
  if (!t) return "";

  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    const parsed = tryParse(t);
    if (parsed !== null && typeof parsed === "object") {
      if (typeof parsed.result === "string" && parsed.result.trim()) {
        return parsed.result.trim();
      }
      if (typeof parsed.message === "string" && parsed.message.trim() && !parsed.result) {
        return parsed.message.trim();
      }
      return JSON.stringify(parsed, null, 2);
    }
  }

  // Wrapped JSON string
  if (t.startsWith('"') && t.endsWith('"')) {
    const inner = tryParse(t);
    if (typeof inner === "string") return formatAgentStdoutForDisplay(inner);
  }

  // Literal \n two-char sequences (corrupt double-encoding) — best-effort
  if (t.includes("\\n") && !t.includes("\n")) {
    return t.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  }

  return raw;
}

export default function AgentDetail() {
  const { state, actions } = useAppStore();
  const { executeAgent } = useAgentExecution();
  const { agents } = state.workflow;
  const agent = agents.find((a) => a.id === state.selectedAgentId);

  const [replyText, setReplyText] = useState("");
  const [jiraPublishEdit, setJiraPublishEdit] = useState("");
  const lastStartAtRef = useRef(0);

  useEffect(() => {
    const cur = agents.find((a) => a.id === state.selectedAgentId);
    if (cur?.shortName === "Jira Spec Creator") {
      const awaiting = cur.jiraSpecAwaitingPublish && !cur.jiraSpecPublishDone;
      const fromDraft = cur?.output?.stdout?.trim();
      if (awaiting && fromDraft) {
        setJiraPublishEdit((prev) => (prev.trim() ? prev : fromDraft));
      }
      return;
    }
    if (cur?.shortName === "Jira Publish") {
      const draft = agents.find((a) => a.shortName === "Jira Spec Draft");
      const fromDraft = draft?.output?.stdout?.trim();
      if (fromDraft) {
        setJiraPublishEdit((prev) => (prev.trim() ? prev : fromDraft));
      }
    }
  }, [agents, state.selectedAgentId]);

  if (!agent) return null;

  const agentIdx = agents.findIndex((a) => a.id === agent.id);
  const canStart = canStartSequentialAgent(agents, agentIdx);

  const handleStart = () => {
    const now = Date.now();
    if (now - lastStartAtRef.current < START_AGENT_DEBOUNCE_MS) return;
    lastStartAtRef.current = now;
    if (agent.shortName === "Jira Spec Creator") {
      if (agent.jiraSpecAwaitingPublish && !agent.jiraSpecPublishDone) {
        if (!jiraPublishEdit.trim()) {
          actions.addLog({
            timestamp: new Date().toLocaleTimeString(),
            agent: "System",
            message: "Confirm the Jira description in the text box below, then click “Create in Jira”.",
            type: "error",
          });
          return;
        }
        void executeAgent(agent.id, jiraPublishEdit);
        return;
      }
      void executeAgent(agent.id);
      return;
    }
    if (agent.shortName === "Jira Publish") {
      if (!jiraPublishEdit.trim()) {
        actions.addLog({
          timestamp: new Date().toLocaleTimeString(),
          agent: "System",
          message: "Confirm the Jira description in the text box below, then click Start or “Create in Jira”.",
          type: "error",
        });
        return;
      }
      void executeAgent(agent.id, jiraPublishEdit);
      return;
    }
    void executeAgent(agent.id);
  };
  const handleStop = () => actions.stopAgent(agent.id);
  const handleReset = () => {
    setReplyText("");
    actions.resetAgent(agent.id);
  };

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    const reply = replyText.trim();
    setReplyText("");
    void executeAgent(agent.id, reply);
  };

  const handleMarkComplete = () => {
    setReplyText("");
    actions.dismissAgentWaiting(agent.id);
    actions.addLog({
      timestamp: new Date().toLocaleTimeString(),
      agent: agent.shortName || agent.name,
      message: "Marked as complete by user (no further input required).",
      type: "success",
    });
  };

  const handleApprove = () => {
    actions.setHtlpStatus(agent.id, "approved");
    actions.addLog({
      timestamp: new Date().toLocaleTimeString(),
      agent: "HITLP",
      message: `User approved output for ${agent.name}.`,
      type: "success",
    });
  };
  const handleReject = () => {
    actions.setHtlpStatus(agent.id, "rejected");
    actions.addLog({
      timestamp: new Date().toLocaleTimeString(),
      agent: "HITLP",
      message: `User rejected output for ${agent.name}. Resetting for rework.`,
      type: "error",
    });
  };

  const isRunning = agent.status === AGENT_STATUS.RUNNING;
  const isCompleted = agent.status === AGENT_STATUS.COMPLETED;
  const isFailed = agent.status === AGENT_STATUS.FAILED;
  const canStartButton = canStart && !isRunning;

  const awaitingJiraPublishDetail =
    agent.shortName === "Jira Spec Creator"
    && agent.jiraSpecAwaitingPublish
    && !agent.jiraSpecPublishDone;
  const showJiraConfirmPanel =
    agent.shortName === "Jira Publish" || awaitingJiraPublishDetail;

  const agentOutputRaw = agent.output?.stdout || "";
  const agentOutputDisplay = formatAgentStdoutForDisplay(agentOutputRaw);
  const isWaitingForInput =
    isCompleted && !agent.dismissedWaiting && isAgentQuestion(agentOutputDisplay);

  let primaryStartLabel = "Start Agent";
  if (awaitingJiraPublishDetail) primaryStartLabel = "Confirm below";
  else if (isCompleted) primaryStartLabel = isWaitingForInput ? "Re-run" : "Run again";
  else if (isFailed) primaryStartLabel = "Retry";
  else if (isRunning) primaryStartLabel = "Running…";

  return (
    <div className="agent-detail-view animate-fade-in">
      <header className="detail-header">
        <button
          className="btn-back"
          onClick={() => actions.setView("dashboard")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M19 12H5M5 12L12 19M5 12L12 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Workflow
        </button>
        <div className="detail-title-block">
          <div className="agent-id">AGENT #{agent.id}</div>
          <h2 className="agent-name">{agent.name}</h2>
        </div>
        <div className="detail-actions">
          {isRunning ? (
            <button className="btn-stop" onClick={handleStop}>
              Stop Agent
            </button>
          ) : (
            <button
              className="btn-start"
              onClick={handleStart}
              disabled={
                isRunning
                || awaitingJiraPublishDetail
                || (!isFailed && !isCompleted && !canStartButton)
              }
            >
              {primaryStartLabel}
            </button>
          )}
          <button className="btn-reset" onClick={handleReset}>
            Reset
          </button>
        </div>
      </header>

      <div className="detail-content-grid">
        <div className="detail-main-panel">
          <div className="panel-section">
            <h3 className="section-title">Agent Objective</h3>
            <p className="agent-full-desc">{agent.description}</p>
          </div>

          {showJiraConfirmPanel && (
            <div className="panel-section jira-publish-panel">
              <h3 className="section-title">Confirm before Jira create</h3>
              <p className="jira-publish-hint">
                The draft is in your workspace. Edit the payload below (summary + body sections), then
                click Create in Jira — only <strong>one</strong> issue will be created.
              </p>
              <textarea
                className="jira-publish-textarea"
                value={jiraPublishEdit}
                onChange={(e) => setJiraPublishEdit(e.target.value)}
                placeholder="Edit the confirmed ticket text from the draft output…"
                rows={14}
                spellCheck
                disabled={isRunning}
              />
              <div className="jira-publish-actions">
                <button
                  type="button"
                  className="btn-send-reply"
                  onClick={handleStart}
                  disabled={isRunning || !jiraPublishEdit.trim()}
                >
                  Create in Jira
                </button>
              </div>
            </div>
          )}

          <div className="panel-section">
            <h3 className="section-title">
              Execution Output
              {isWaitingForInput && (
                <span className="waiting-badge">⏳ Waiting for your reply</span>
              )}
            </h3>
            <div className="output-console">
              {isRunning ? (
                <div className="running-state">
                  <div className="spinner"></div>
                  <p>Agent is currently processing data...</p>
                  <div className="progress-bar-large">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${agent.progress}%`,
                        backgroundColor: agent.color,
                      }}
                    ></div>
                  </div>
                  <span className="progress-val">{agent.progress}%</span>
                </div>
              ) : isCompleted ? (
                <div className="completed-state">
                  <div className="output-console-content">
                    {agentOutputDisplay ? (
                      <pre className="output-text output-text-body">{agentOutputDisplay}</pre>
                    ) : agent.output?.parsedJson ? (
                      <pre className="output-text">{JSON.stringify(agent.output.parsedJson, null, 2)}</pre>
                    ) : (
                      <div className="output-mock">
                        <code>
                          {`// Agent completed successfully\n`}
                          {`// No text output captured.\n`}
                          {`// Check your workspace for generated files.`}
                        </code>
                      </div>
                    )}
                  </div>

                  {/* Reply input — shown when agent asked a question */}
                  {isWaitingForInput && (
                    <div className="agent-reply-box">
                      <p className="reply-label">
                        The agent is waiting for your input. Type your reply below:
                      </p>
                      <textarea
                        className="reply-textarea"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your answer or choice (e.g. '1' or 'Implement the LoginPage.tsx component')..."
                        rows={3}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleSendReply();
                          }
                        }}
                      />
                      <div className="reply-actions">
                        <button
                          className="btn-mark-complete"
                          onClick={handleMarkComplete}
                          title="Dismiss waiting state — mark this agent as done without re-running"
                        >
                          ✓ Mark as Complete
                        </button>
                        <span className="reply-hint">Ctrl+Enter to send reply</span>
                        <button
                          className="btn-send-reply"
                          onClick={handleSendReply}
                          disabled={!replyText.trim()}
                        >
                          ▶ Send Reply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : isFailed ? (
                <div className="idle-state">
                  <p className="failed-banner">Execution failed.</p>
                  {agent.output?.stderr ? (
                    <pre className="output-text error-text">{agent.output.stderr}</pre>
                  ) : agent.output?.stdout ? (
                    <pre className="output-text error-text output-text-body">
                      {formatAgentStdoutForDisplay(agent.output.stdout)}
                    </pre>
                  ) : (
                    <p>See execution log for details. Use Retry to run again.</p>
                  )}
                </div>
              ) : (
                <div className="idle-state">
                  <p>Agent is idle. Click Start Agent to begin execution.</p>
                </div>
              )}
            </div>
          </div>

          {agent.htlpRequired && (
            <div className="panel-section hitlp">
              <h3 className="section-title">Human-In-The-Loop Approval</h3>
              <div className="hitlp-card">
                <div className="hitlp-info">
                  <span className="hitlp-label">{agent.htlpLabel}</span>
                  <p className="hitlp-desc">
                    Manual review is required before moving to the next stage.
                  </p>
                </div>
                <div className="hitlp-actions">
                  <button
                    className={`btn-approve ${agent.htlpStatus === "approved" ? "active" : ""}`}
                    onClick={handleApprove}
                    disabled={!isCompleted && !isRunning}
                  >
                    Approve
                  </button>
                  <button
                    className={`btn-reject ${agent.htlpStatus === "rejected" ? "active" : ""}`}
                    onClick={handleReject}
                    disabled={!isCompleted && !isRunning}
                  >
                    Reject
                  </button>
                  <button
                    className="btn-sme"
                    disabled={!isCompleted && !isRunning}
                  >
                    SME Review
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="detail-side-panel">
          <div className="side-card">
            <h4 className="card-title">Status</h4>
            <div className={`status-badge ${isWaitingForInput ? "waiting" : agent.status}`}>
              {isWaitingForInput ? "WAITING INPUT" : agent.status.toUpperCase()}
            </div>
          </div>
          <div className="side-card">
            <h4 className="card-title">Logs</h4>
            <div className="mini-logs">
              {agent.logs?.length > 0 ? (
                agent.logs.map((l, i) => (
                  <div key={i} className="mini-log-line">
                    {l}
                  </div>
                ))
              ) : (
                <div className="no-logs">
                  No specific logs for this agent yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
