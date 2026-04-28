import { useAppStore, AGENT_STATUS } from "../../store/useAppStore";
import "./AgentDetail.css";

export default function AgentDetail() {
  const { state, actions } = useAppStore();
  const { agents } = state.workflow;
  const agent = agents.find((a) => a.id === state.selectedAgentId);

  if (!agent) return null;

  const handleStart = () => actions.startAgent(agent.id);
  const handleStop = () => actions.stopAgent(agent.id);
  const handleReset = () => actions.resetAgent(agent.id);
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
              disabled={isCompleted}
            >
              {isCompleted ? "Completed" : "Start Agent"}
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

          <div className="panel-section">
            <h3 className="section-title">Execution Output</h3>
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
                  <div className="output-mock">
                    <code>
                      {`// Generated Analysis Report\n`}
                      {`// Target: ${agent.name}\n`}
                      {`// Date: ${new Date().toLocaleDateString()}\n\n`}
                      {`{\n  "status": "success",\n  "artifacts": ["analysis_v1.json", "dependency_tree.svg"],\n  "warnings": 0,\n  "patterns_found": 124\n}`}
                    </code>
                  </div>
                </div>
              ) : (
                <div className="idle-state">
                  <p>Agent is idle. Click "Start Agent" to begin execution.</p>
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
            <div className={`status-badge ${agent.status}`}>
              {agent.status.toUpperCase()}
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
