import { useState, useEffect } from "react";
import { useAppStore, PROJECT_FLOW } from "../../store/useAppStore";
import { PROJECT_FLOW_OPTIONS, ALL_AGENTS } from "../../data/options";
import "./StepFlowSelection.css";

const AGENT_ICONS = {
  search: "🔍",
  "git-merge": "🔄",
  layout: "🎨",
  "list-checks": "📋",
  ticket: "🎫",
  code: "💻",
  "flask-conical": "🧪",
  "git-pull-request": "🚀",
};

const getAgent = (agentId) => ALL_AGENTS.find((a) => a.id === agentId);

export default function StepFlowSelection() {
  const { state, actions } = useAppStore();
  const savedFlow = state.setup.projectFlow;
  const savedName = state.setup.projectName || "";
  const savedWorkspace = state.setup.targetWorkspace || "";

  const [pendingFlow, setPendingFlow] = useState(savedFlow);
  const [projectName, setProjectName] = useState(savedName);
  const [targetWorkspace, setTargetWorkspace] = useState(savedWorkspace);

  useEffect(() => {
    setTargetWorkspace(state.setup.targetWorkspace || "");
  }, [state.setup.targetWorkspace]);

  const selectedOption = PROJECT_FLOW_OPTIONS.find((f) => f.id === pendingFlow);
  const isCustom = pendingFlow === PROJECT_FLOW.CUSTOM;
  const isValid =
    pendingFlow &&
    projectName.trim().length > 0 &&
    targetWorkspace.trim().length > 0;

  const handleContinue = () => {
    if (isValid) {
      actions.setAgentBridgeContext({
        targetWorkspace: targetWorkspace.trim(),
      });
      if (projectName.trim() !== savedName) {
        actions.setProjectName(projectName.trim());
      }
      actions.setFlowType(pendingFlow);
    }
  };

  return (
    <div className="step-flow-selection animate-fade-in">
      <div className="step-section-header">
        <div className="step-section-num">Step 1</div>
        <h2 className="step-section-title">Select Your Workflow Type</h2>
        <p className="step-section-desc">
          Choose the pipeline that best matches your project input source and goals.
        </p>
      </div>

      <div className="flow-setup-context">
        {/* Project Name */}
        <div className="project-name-row">
          <label className="project-name-label" htmlFor="project-name-input">
            Project Name
          </label>
          <input
            id="project-name-input"
            className="project-name-input"
            type="text"
            placeholder="e.g. Inventory Management Modernization"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            maxLength={80}
            autoComplete="off"
          />
        </div>

        {/* Target workspace (CLI working directory when you choose Cursor / Kiro CLI later) */}
        <div className="project-name-row flow-workspace-row">
          <label className="project-name-label" htmlFor="target-workspace-input">
            Target workspace
          </label>
          <input
            id="target-workspace-input"
            className="project-name-input project-name-input-mono"
            type="text"
            placeholder="e.g. C:/dev/my-app or /home/you/repos/my-app"
            value={targetWorkspace}
            onChange={(e) => setTargetWorkspace(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <p className="flow-workspace-hint">
          Absolute path to the project folder for CLI runs:{" "}
          <code>agent --workspace</code> / Kiro cwd. If you pick <strong>Cursor</strong> or{" "}
          <strong>Kiro CLI</strong> in IDE settings, this path is used for model listing and runs. The optional{" "}
          <strong>agent bridge URL</strong> is configured on the IDE step, not here.
        </p>
      </div>

      {/* Workflow Cards — no agents inside */}
      <div className="flow-cards-grid five-cols">
        {PROJECT_FLOW_OPTIONS.map((flow) => {
          const selected = pendingFlow === flow.id;
          return (
            <button
              key={flow.id}
              className={`flow-card ${selected ? "selected" : ""}`}
              onClick={() => setPendingFlow(flow.id)}
            >
              <div className="flow-card-top">
                <div className="flow-icon">{flow.icon}</div>
                <div className="flow-card-meta">
                  <span
                    className="flow-badge"
                    style={{
                      background: `${flow.badgeColor}20`,
                      color: flow.badgeColor,
                      borderColor: `${flow.badgeColor}40`,
                    }}
                  >
                    {flow.badge}
                  </span>
                </div>
                {selected && (
                  <div className="flow-selected-check">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="8" fill="var(--gl-orange)" />
                      <path
                        d="M4.5 8L7 10.5L11.5 6"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <h3 className="flow-title">{flow.title}</h3>
              <p className="flow-subtitle">{flow.subtitle}</p>
              <p className="flow-desc">{flow.description}</p>
            </button>
          );
        })}
      </div>

      {/* Bottom selection panel */}
      {selectedOption && (
        <div className="flow-selection-panel">

          {/* Agent pipeline */}
          <div className="flow-pipeline-section">
            <div className="flow-pipeline-header">
              <span className="flow-pipeline-label">
                {isCustom ? "Available Agents" : "Pipeline Agents"}
              </span>
              {!isCustom && (
                <span className="flow-pipeline-count">
                  {selectedOption.agents.length} agents in sequence
                </span>
              )}
            </div>

            {isCustom ? (
              <div className="flow-custom-info">
                <div className="flow-custom-info-icon">🛠️</div>
                <div>
                  <p className="flow-custom-info-title">Fully Customizable Pipeline</p>
                  <p className="flow-custom-info-desc">
                    In the next step you will handpick exactly which agents run and in what order.
                    All {ALL_AGENTS.length} specialized agents are available to choose from.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flow-pipeline-track">
                {selectedOption.agents.map((agentId, idx) => {
                  const agent = getAgent(agentId);
                  if (!agent) return null;
                  return (
                    <div key={agentId} className="flow-pipeline-step">
                      <div className="fps-card">
                        <div className="fps-top">
                          <span className="fps-num">{idx + 1}</span>
                          <span
                            className="fps-icon"
                            style={{ backgroundColor: `${agent.color}22`, color: agent.color }}
                          >
                            {AGENT_ICONS[agent.icon] || "🤖"}
                          </span>
                          {agent.htlpRequired && (
                            <span className="fps-hitlp" title={agent.htlpLabel}>HITLP</span>
                          )}
                        </div>
                        <p className="fps-name">{agent.shortName}</p>
                        <p className="fps-desc">{agent.description}</p>
                      </div>
                      {idx < selectedOption.agents.length - 1 && (
                        <div className="fps-arrow">
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Next step + Continue */}
          <div className="flow-panel-footer">
            <div className="flow-next-info">
              <span className="flow-next-label">Next Step →</span>
              <span className="flow-next-title">{selectedOption.nextStepLabel}</span>
              <span className="flow-next-desc">{selectedOption.nextStepDesc}</span>
            </div>
            <button className="btn-next" onClick={handleContinue} disabled={!isValid}>
              Continue
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 12L10 8L6 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
