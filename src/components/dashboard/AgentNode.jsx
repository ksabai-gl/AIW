import { useAppStore, AGENT_STATUS } from "../../store/useAppStore";
import "./AgentNode.css";

export default function AgentNode({
  agent,
  isLastInRow,
  isFirstInRow,
  reversed,
  isSolo,
}) {
  const { actions } = useAppStore();

  const getStatusColor = () => {
    switch (agent.status) {
      case AGENT_STATUS.RUNNING:
        return "var(--info)";
      case AGENT_STATUS.COMPLETED:
        return "var(--success)";
      default:
        return "var(--text-muted)";
    }
  };

  const handleStart = (e) => {
    e.stopPropagation();
    actions.startAgent(agent.id);
  };

  const handleNodeClick = () => {
    actions.setView("agent_detail", agent.id);
  };

  const isRunning = agent.status === AGENT_STATUS.RUNNING;
  const isCompleted = agent.status === AGENT_STATUS.COMPLETED;

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
        className={`agent-node ${isRunning ? "running" : ""} ${isCompleted ? "completed" : ""}`}
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
          <button
            className={`btn-start-agent ${isCompleted ? "success" : ""}`}
            disabled={isRunning}
            onClick={handleStart}
            style={badgeStyle}
          >
            {isCompleted ? (
              <>
                <span className="check-icon">✓</span>
                Completed
              </>
            ) : isRunning ? (
              <>
                <div className="spinner-small"></div>
                Start Agent
              </>
            ) : (
              <>
                <span className="play-icon">▶</span>
                Start Agent
              </>
            )}
          </button>

          <div className="agent-status-row">
            <div className="status-indicator">
              <div
                className="status-dot"
                style={{ backgroundColor: getStatusColor() }}
              ></div>
              <span className="status-text">
                {isRunning ? "Running" : isCompleted ? "Completed" : "Pending"}
              </span>
            </div>
          </div>
        </div>

        {isRunning && (
          <div className="agent-progress-track">
            <div
              className="agent-progress-fill"
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
