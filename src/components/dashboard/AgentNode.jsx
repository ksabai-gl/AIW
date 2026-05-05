import { useRef } from "react";
import { useAppStore, AGENT_STATUS } from "../../store/useAppStore";
import { useAgentExecution } from "../../hooks/useAgentExecution";
import "./AgentNode.css";

/** Prevents double-click / double-tap from starting two full bridge runs (duplicate Jira issues). */
const START_AGENT_DEBOUNCE_MS = 1500;

function isAgentQuestion(stdout) {
  if (!stdout || typeof stdout !== "string") return false;
  const trimmed = stdout.trim();
  const lower = trimmed.toLowerCase();
  if (trimmed.slice(-300).includes("?")) return true;
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  const last10 = lines.slice(-10).join("\n");
  if (/^\d+\.\s+\S/m.test(last10)) return true;
  const waitingPhrases = [
    "let me know", "do you want", "would you like", "which option",
    "please choose", "please select", "please confirm", "please clarify",
    "please specify", "what would you", "how can i help", "how would you like",
    "did you mean", "were you trying", "can you clarify", "could you clarify",
    "could you confirm", "what do you", "shall i", "should i",
    "if you want", "i can now", "i can execute", "i can proceed", "should i proceed", "confirm to continue",
  ];
  return waitingPhrases.some((phrase) => lower.includes(phrase));
}

export default function AgentNode({
  agent,
  isLastInRow,
  isFirstInRow,
  reversed,
  isSolo,
  canStart = false,
}) {
  const { actions } = useAppStore();
  const { executeAgent } = useAgentExecution();
  const lastStartAtRef = useRef(0);

  const getStatusColor = () => {
    switch (agent.status) {
      case AGENT_STATUS.RUNNING:
        return "var(--info)";
      case AGENT_STATUS.COMPLETED:
        return "var(--success)";
      case AGENT_STATUS.FAILED:
        return "var(--error, #ef4444)";
      default:
        return "var(--text-muted)";
    }
  };

  const handleStart = async (e) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastStartAtRef.current < START_AGENT_DEBOUNCE_MS) return;
    lastStartAtRef.current = now;
    if (awaitingJiraPublish) {
      actions.setView("agent_detail", agent.id);
      return;
    }
    // executeAgent handles everything: abort previous run, set RUNNING, call API, set COMPLETED/FAILED
    executeAgent(agent.id);
  };

  const handleStop = (e) => {
    e.stopPropagation();
    actions.stopAgent(agent.id);
  };

  const handleNodeClick = () => {
    // Only navigate to detail view if agent is active (can start, running, completed, or failed)
    if (canStart || isRunning || isCompleted || isFailed) {
      actions.setView("agent_detail", agent.id);
    }
  };

  const isRunning = agent.status === AGENT_STATUS.RUNNING;
  const isCompleted = agent.status === AGENT_STATUS.COMPLETED;
  const isFailed = agent.status === AGENT_STATUS.FAILED;
  const isWaitingInput = isCompleted && !agent.dismissedWaiting && isAgentQuestion(agent.output?.stdout);
  const awaitingJiraPublish =
    agent.shortName === "Jira Spec Creator"
    && agent.jiraSpecAwaitingPublish
    && !agent.jiraSpecPublishDone;
  // Completed and failed agents can both be re-run
  const canStartButton = canStart && !isRunning;

  const agentIcons = {
    search: "🔍",
    "git-merge": "⚙️",
    layout: "📋",
    "list-checks": "📝",
    ticket: "🎫",
    code: " </>",
    "flask-conical": "🧪",
    "git-pull-request": "🍴",
    rocket: "🚀",
  };

  const badgeStyle = {
    borderColor: agent.color,
    backgroundColor: `${agent.color}22`,
    color: agent.color,
  };

  const headerIconStyle = {
    color: agent.color,
    borderColor: agent.color,
    backgroundColor: `${agent.color}10`,
  };

  return (
    <div className={`agent-node-wrapper ${isSolo ? "solo" : ""}`}>
      <div
        className={`agent-node ${isRunning ? "running" : ""} ${isCompleted ? "completed" : ""} ${isFailed ? "failed" : ""} ${!(canStart || isRunning || isCompleted || isFailed) ? "locked" : ""}`}
        style={{ borderColor: agent.color }}
        onClick={handleNodeClick}
      >
        <div className="agent-node-header">
          <div className="agent-id-box" style={badgeStyle}>
            {agent.id}
          </div>
          <div className="agent-icon-box" style={headerIconStyle}>
            {agentIcons[agent.icon] || "🤖"}
          </div>
        </div>

        <div className="agent-node-body">
          <h4 className="agent-name">{agent.name}</h4>
          <p className="agent-desc">{agent.description}</p>
        </div>

        <div className="agent-node-footer">
          <div className="agent-action-row">
            <button
              className={`btn-start-agent ${isCompleted ? "success" : ""} ${isFailed ? "error" : ""} ${isRunning ? "running" : ""} ${canStartButton && !isCompleted && !isFailed ? "available" : !canStartButton && !isCompleted && !isFailed ? "locked" : ""}`}
              disabled={
                isRunning || (!isFailed && !isCompleted && !canStartButton && !awaitingJiraPublish)
              }
              onClick={handleStart}
              style={badgeStyle}
            >
              {awaitingJiraPublish ? (
                <>
                  <span className="play-icon">▶</span>
                  Review
                </>
              ) : isCompleted ? (
                <>
                  <span className="check-icon">✓</span>
                  Completed
                </>
              ) : isFailed ? (
                <>
                  <span className="retry-icon">↺</span>
                  Retry
                </>
              ) : isRunning ? (
                <>
                  <div className="spinner-small"></div>
                  Running...
                </>
              ) : (
                <>
                  <span className="play-icon">▶</span>
                  Start Agent
                </>
              )}
            </button>

            {isRunning && (
              <button
                type="button"
                className="btn-stop-agent"
                onClick={handleStop}
              >
                Stop
              </button>
            )}
          </div>

          <div className="agent-status-row">
            <div className="status-indicator">
              <div
                className="status-dot"
                style={{ backgroundColor: isWaitingInput ? "var(--warning, #f59e0b)" : getStatusColor() }}
              ></div>
              <span className="status-text">
                {isRunning
                  ? "Running"
                  : awaitingJiraPublish
                    ? "Awaiting Jira"
                    : isWaitingInput
                      ? "Waiting Input"
                      : isCompleted
                        ? "Completed"
                        : isFailed
                          ? "Error"
                          : "Pending"}
              </span>
            </div>
          </div>
        </div>

        {(isRunning || isCompleted) && (
          <div className="agent-progress-track">
            <div
              className={`agent-progress-fill ${isRunning ? "striped" : "dotted"}`}
              style={{
                width: `${agent.progress}%`,
                backgroundColor: agent.color,
              }}
            ></div>
          </div>
        )}
      </div>

      {!isLastInRow && !isSolo && (
        <div className={`node-connector ${reversed ? "reversed" : ""}`}>
          <div className="connector-arrow">➔</div>
        </div>
      )}
    </div>
  );
}
