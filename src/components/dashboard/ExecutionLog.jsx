import { useAppStore } from "../../store/useAppStore";
import "./ExecutionLog.css";

export default function ExecutionLog() {
  const { state, actions } = useAppStore();
  const { executionLogs, autoRefresh } = state.workflow;

  const getLogTypeLabel = (type) => {
    const labels = {
      info: "ℹ️",
      success: "✅",
      error: "❌",
      output: "📤",
      warning: "⚠️",
    };
    return labels[type] || "📝";
  };

  return (
    <div className="execution-log">
      <div className="log-header">
        <div className="log-header-left">
          <span className="log-icon">🖥️</span>
          <h5 className="log-title">Execution Log</h5>
          <span className="log-count">({executionLogs.length})</span>
        </div>
        <div className="log-header-right">
          <div className="auto-refresh">
            <span className="label">Auto Refresh</span>
            <button
              className={`toggle-btn ${autoRefresh ? "on" : ""}`}
              onClick={() => actions.toggleAutoRefresh()}
            >
              <div className="toggle-thumb"></div>
            </button>
          </div>
        </div>
      </div>

      <div className="log-content">
        {executionLogs.length === 0 ? (
          <div className="empty-log">
            <div className="empty-icon">📭</div>
            <p>No executions yet. Click on any agent to start the workflow.</p>
          </div>
        ) : (
          <div className="log-lines">
            {executionLogs.map((log) => (
              <div
                key={`${log.timestamp}-${log.agent}-${log.message}`}
                className={`log-line ${log.type || "info"}`}
              >
                <span className="log-type-icon">{getLogTypeLabel(log.type)}</span>
                <span className="log-time">[{log.timestamp}]</span>
                <span className="log-agent">{log.agent}:</span>
                <span className="log-msg">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="log-legend">
        <div className="legend-title">Legend</div>
        <div className="legend-items">
          <div className="legend-item">
            <span className="dot info"></span>
            <span>Info</span>
          </div>
          <div className="legend-item">
            <span className="dot success"></span>
            <span>Success</span>
          </div>
          <div className="legend-item">
            <span className="dot error"></span>
            <span>Error</span>
          </div>
          <div className="legend-item">
            <span className="dot output"></span>
            <span>Output</span>
          </div>
        </div>
      </div>
    </div>
  );
}
