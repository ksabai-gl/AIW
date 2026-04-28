import { useAppStore, AGENT_STATUS, SETUP_STEPS } from "../store/useAppStore";
import { WORKFLOW_TEMPLATES } from "../data/options";
import "./Dashboard.css";
import AgentNode from "./dashboard/AgentNode";
import Sidebar from "./dashboard/Sidebar";
import ExecutionLog from "./dashboard/ExecutionLog";
import AgentDetail from "./dashboard/AgentDetail";
import StepLanguageConfig from "./setup/StepLanguageConfig";
import StepIdeConfig from "./setup/StepIdeConfig";
import StepReview from "./setup/StepReview";

export default function Dashboard() {
  const { state, actions } = useAppStore();
  const { workflow, setup, view, dashboardPanel, dashboardConfigFocus } = state;
  const activeTemplate =
    WORKFLOW_TEMPLATES.find(
      (template) => template.id === setup.selectedTemplateId,
    ) ||
    WORKFLOW_TEMPLATES.find((template) => template.flowType === setup.flowType);

  const handleRunAll = () => {
    // Start the first idle agent
    const firstIdle = workflow.agents.find(
      (a) => a.status === AGENT_STATUS.IDLE,
    );
    if (firstIdle) {
      actions.startAgent(firstIdle.id);
    }
  };

  const isDetailView = view === "agent_detail";
  const isConfigPanel =
    dashboardPanel === "config" && view === "dashboard" && !isDetailView;
  let projectSubtitle = `${activeTemplate?.label || "Workflow"} for your configured project`;
  if (isDetailView) {
    projectSubtitle = "Review and manage individual agent output";
  } else if (isConfigPanel) {
    projectSubtitle = "Update your configuration in the main panel";
  }
  const showWorkflowCanvas = !isDetailView && !isConfigPanel;
  const totalAgents = workflow.agents.length;

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Top Navigation */}
        <header className="dashboard-top-bar">
          <div className="top-bar-left">
            <h1 className="project-title">
              {isDetailView ? "Agent Inspector" : "Multi-Agent Workflow"}
            </h1>
            <p className="project-subtitle">{projectSubtitle}</p>
          </div>
          {!isDetailView && (
            <div className="top-bar-actions">
              {isConfigPanel ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => actions.closeDashboardConfig()}
                >
                  Back to Workflow
                </button>
              ) : (
                <>
                  <button className="btn-secondary">Save Workflow</button>
                  <button
                    className="btn-primary"
                    onClick={handleRunAll}
                    disabled={workflow.workflowStatus === "running"}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M4 3L11 7L4 11V3Z"
                        fill="white"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Run All Agents
                  </button>
                </>
              )}
              <div className="user-profile">
                <div className="icon-btn">☀️</div>
                <div className="avatar">AS</div>
              </div>
            </div>
          )}
        </header>

        {/* Dynamic Content */}
        {isDetailView && <AgentDetail />}
        {isConfigPanel && (
          <div className="workflow-canvas">
            <div className="workflow-scroll-area">
              {setup.currentStep === SETUP_STEPS.LANGUAGE_CONFIG && (
                <StepLanguageConfig />
              )}
              {setup.currentStep === SETUP_STEPS.IDE_CONFIG && (
                <StepIdeConfig focusSection={dashboardConfigFocus} />
              )}
              {setup.currentStep === SETUP_STEPS.REVIEW && <StepReview />}
            </div>
          </div>
        )}
        {showWorkflowCanvas && (
          <div className="workflow-canvas">
            <div className="workflow-scroll-area">
              <div className="workflow-track">
                <div className="start-row">
                  <div className="workflow-badge start">START </div>
                  <span class="green-right-arrow">------➜</span>
                </div>

                <div className="agent-nodes-container">
                  <div className="agent-row">
                    {workflow.agents.slice(0, 4).map((agent, i) => (
                      <AgentNode
                        key={agent.id}
                        agent={agent}
                        isLastInRow={i === 3}
                        isFirstInRow={i === 0}
                      />
                    ))}
                  </div>

                  <div className="row-connector-curve downward-to-next">
                    <div className="connector-vertical-line"></div>
                    <div className="connector-horizontal-line"></div>
                    <div className="connector-arrow-to-next">←</div>
                  </div>

                  <div className="agent-row">
                    {workflow.agents.slice(4, 8).map((agent, i) => (
                      <AgentNode
                        key={agent.id}
                        agent={agent}
                        isLastInRow={
                          (totalAgents === 8 && i === 3) ||
                          (totalAgents === 7 && i === 2)
                        }
                        isFirstInRow={i === 0}
                      />
                    ))}
                  </div>

                  {workflow.agents.length > 8 && (
                    <div className="agent-row last">
                      <div className="row-connector-curve-small"></div>
                      <AgentNode agent={workflow.agents[8]} isSolo={true} />
                    </div>
                  )}
                </div>

                <div
                  className={
                    totalAgents === 7 ? "end-row-for-seven-agents" : "end-row"
                  }
                >
                  <span className="green-right-arrow">----➜</span>
                  <span className="workflow-badge end">END</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Execution Log */}
        {!isConfigPanel && <ExecutionLog />}
      </main>
    </div>
  );
}
