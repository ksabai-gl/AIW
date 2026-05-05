import { useAppStore, FLOW_TYPE, PROJECT_FLOW } from "../../store/useAppStore";
import {
  LANGUAGES,
  IDE_PLATFORMS,
  LLM_OPTIONS,
  CLOUD_OPTIONS,
  MCP_OPTIONS,
  PROJECT_FLOW_OPTIONS,
} from "../../data/options";
import "./StepReview.css";

export default function StepReview() {
  const { state, actions } = useAppStore();
  const { setup } = state;

  const projectFlowOpt = PROJECT_FLOW_OPTIONS.find(o => o.id === setup.projectFlow);
  const flowLabel = projectFlowOpt?.title || "Custom Flow";
  
  const estimatedAgents = setup.projectFlow === PROJECT_FLOW.CUSTOM 
    ? setup.selectedAgentIds.length 
    : (setup.flowType === FLOW_TYPE.WITH_MIGRATION ? 9 : 8);

  const isCustom = setup.projectFlow === PROJECT_FLOW.CUSTOM;
  const stepNum = isCustom ? 5 : 4;
  const srcLang = LANGUAGES.find((l) => l.id === setup.sourceLanguage)?.label;
  const tgtLang = LANGUAGES.find((l) => l.id === setup.targetLanguage)?.label;
  const platform = IDE_PLATFORMS.find(
    (p) => p.id === setup.ideConfig.platform,
  )?.label;
  const llmRaw = setup.ideConfig.llm;
  const llm =
    llmRaw === "__cli_default__"
      ? "CLI default model"
      : LLM_OPTIONS.find((l) => l.id === llmRaw)?.label || llmRaw;
  const cloud = CLOUD_OPTIONS.find(
    (c) => c.id === setup.ideConfig.cloudDeployment,
  )?.label;
  const mcpLabels = setup.ideConfig.mcpServers
    .map((id) => MCP_OPTIONS.find((m) => m.id === id)?.label)
    .join(", ");

  return (
    <div className="step-review animate-fade-in">
      <div className="step-section-header">
        <div className="step-section-num">Step {stepNum}</div>
        <h2 className="step-section-title">Review Configuration</h2>
        <p className="step-section-desc">
          Double check your project settings before initializing the AI
          Multi-Agent Pipeline.
        </p>
      </div>

      <div className="review-container">
        <div className="review-section">
          <div className="review-section-title">Workflow Strategy</div>
          <div className="review-grid">
            {(setup.targetWorkspace || "").trim() !== "" && (
              <div className="review-item">
                <div className="review-lbl">Target workspace</div>
                <div className="review-val review-val-mono">{(setup.targetWorkspace || "").trim()}</div>
              </div>
            )}
            {(setup.agentBridgeBaseUrl || "").trim() !== "" && (
              <div className="review-item">
                <div className="review-lbl">Agent bridge URL</div>
                <div className="review-val review-val-mono">{(setup.agentBridgeBaseUrl || "").trim()}</div>
              </div>
            )}
            {setup.projectName && (
              <div className="review-item">
                <div className="review-lbl">Project Name</div>
                <div className="review-val highlight">{setup.projectName}</div>
              </div>
            )}
            <div className="review-item">
              <div className="review-lbl">Flow Type</div>
              <div className="review-val highlight">{flowLabel}</div>
            </div>
            <div className="review-item">
              <div className="review-lbl">Source Language</div>
              <div className="review-val">{srcLang}</div>
            </div>
            {setup.flowType === FLOW_TYPE.WITH_MIGRATION && (
              <div className="review-item">
                <div className="review-lbl">Target Language</div>
                <div className="review-val">{tgtLang}</div>
              </div>
            )}
          </div>
        </div>

        <div className="review-section">
          <div className="review-section-title">Execution Stack</div>
          <div className="review-grid">
            <div className="review-item">
              <div className="review-lbl">Platform</div>
              <div className="review-val">{platform}</div>
            </div>
            <div className="review-item">
              <div className="review-lbl">LLM Engine</div>
              <div className="review-val">{llm}</div>
            </div>
            <div className="review-item">
              <div className="review-lbl">Cloud Target</div>
              <div className="review-val">{cloud}</div>
            </div>
            <div className="review-item">
              <div className="review-lbl">MCP Integration</div>
              <div className="review-val">{mcpLabels}</div>
            </div>
            {(setup.ideConfig.cliExecutablePath || "").trim() !== "" && (
              <div className="review-item">
                <div className="review-lbl">CLI executable</div>
                <div className="review-val review-val-mono">
                  {(setup.ideConfig.cliExecutablePath || "").trim()}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="review-info-card">
          <div className="info-icon">💡</div>
          <div className="info-text">
            On initialization,{" "}
            <strong>{estimatedAgents} specialized agents</strong> will be
            provisioned. You can monitor their progress and provide manual
            approvals (HITLP) in the dashboard.
          </div>
        </div>
      </div>

      <div className="step-actions">
        <button
          className="btn-back"
          onClick={() => actions.resetSetupFromStep("ide_config")}
        >
          Back to IDE Config
        </button>
        <button className="btn-launch" onClick={() => actions.completeSetup()}>
          Initialize Pipeline
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M4.5 13.5L13.5 4.5M13.5 4.5V12.5M13.5 4.5H5.5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
