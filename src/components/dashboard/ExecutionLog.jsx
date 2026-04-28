import { useAppStore } from "../../store/useAppStore";
import "./ExecutionLog.css";

export default function ExecutionLog() {
  const { state, actions } = useAppStore();
  const { executionLogs, autoRefresh } = state.workflow;

  return (
    <div className="execution-log">
      <div className="log-header">
        <div className="log-header-left">
          <span className="log-icon">🖥️</span>
          <h5 className="log-title">Execution Log</h5>
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
            {executionLogs.map((log, i) => (
              <div key={i} className={`log-line ${log.type}`}>
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
            <span className="dot dashed info"></span>
            <span>Input / Output</span>
          </div>
          <div className="legend-item">
            <span className="dot solid primary"></span>
            <span>Sequential Flow</span>
          </div>
          <div className="legend-item">
            <span className="dot dotted secondary"></span>
            <span>Conditional Flow</span>
          </div>
          <div className="legend-item">
            <span className="dot solid blue"></span>
            <span>Data Flow</span>
          </div>
        </div>
      </div>
    </div>
  );
}
