import { useRef } from "react";
import {
  useAppStore,
  SETUP_STEPS,
  AGENT_STATUS,
  canStartSequentialAgent,
  deriveWorkflowStatus,
} from "../store/useAppStore";
import { useAgentExecution } from "../hooks/useAgentExecution";
import { WORKFLOW_TEMPLATES } from "../data/options";
import "./Dashboard.css";
import AgentNode from "./dashboard/AgentNode";
import Sidebar from "./dashboard/Sidebar";
import ExecutionLog from "./dashboard/ExecutionLog";
import AgentDetail from "./dashboard/AgentDetail";
import StepLanguageConfig from "./setup/StepLanguageConfig";
import StepIdeConfig from "./setup/StepIdeConfig";
import StepReview from "./setup/StepReview";

const RUN_ALL_DEBOUNCE_MS = 1500;

export default function Dashboard() {
  const { state, actions } = useAppStore();
  const { executeWorkflow } = useAgentExecution();
  const lastRunAllAtRef = useRef(0);
  const { workflow, setup, view, dashboardPanel, dashboardConfigFocus, theme } =
    state;
  const activeTemplate =
    WORKFLOW_TEMPLATES.find(
      (template) => template.id === setup.selectedTemplateId,
    ) ||
    WORKFLOW_TEMPLATES.find((template) => template.flowType === setup.flowType);

  const handleRunAll = () => {
    if (deriveWorkflowStatus(workflow.agents) === "running") return;
    const now = Date.now();
    if (now - lastRunAllAtRef.current < RUN_ALL_DEBOUNCE_MS) return;
    lastRunAllAtRef.current = now;
    /** Continue from the first non-completed step; if all completed, re-run from the start. */
    const firstIncomplete = workflow.agents.find(
      (a) => a.status !== AGENT_STATUS.COMPLETED,
    );
    const start = firstIncomplete ?? workflow.agents[0];
    if (start) void executeWorkflow(start.id);
  };

  const isDetailView = view === "agent_detail";
  const isConfigPanel =
    dashboardPanel === "config" && view === "dashboard" && !isDetailView;
  const isSettingsPanel =
    dashboardPanel === "settings" && view === "dashboard" && !isDetailView;
  let projectSubtitle = `${activeTemplate?.label || "Workflow"} for your configured project`;
  if (isDetailView) {
    projectSubtitle = "Review and manage individual agent output";
  } else if (isConfigPanel) {
    projectSubtitle = "Update your configuration in the main panel";
  } else if (isSettingsPanel) {
    projectSubtitle = "Manage workflow settings and reset options";
  }
  const showWorkflowCanvas =
    !isDetailView && !isConfigPanel && !isSettingsPanel;
  const totalAgents = workflow.agents.length;

  const canStartAgent = (idx) => canStartSequentialAgent(workflow.agents, idx);

  // Calculate dynamic arrow length based on agent count
  let arrowDashes;
  if (totalAgents <= 4) {
    arrowDashes = "---"; // Short arrow for single row (4 agents)
  } else if (totalAgents <= 5) {
    arrowDashes = "-----"; // Medium arrow for 5 agents
  } else {
    arrowDashes = "------"; // Standard arrow for 6+ agents
  }
  const arrowCharacters = arrowDashes;

  // Calculate dynamic end row positioning based on layout
  const hasSecondRow = totalAgents > 4;
  const hasThirdRow = totalAgents > 8;

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
              {isConfigPanel || isSettingsPanel ? (
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
                    disabled={deriveWorkflowStatus(workflow.agents) === "running"}
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
              <button
                type="button"
                className={`theme-switch ${theme}`}
                onClick={() => actions.toggleTheme()}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              >
                <span className="theme-track">
                  <span className="theme-thumb" />
                  <span className="theme-icon sun">☀️</span>
                  <span className="theme-icon moon">🌙</span>
                </span>
              </button>
              <div className="user-profile">
                <div className="avatar">AS</div>
              </div>
            </div>
          )}
        </header>

        {/* Dynamic Content */}
        {isDetailView && <AgentDetail />}
        {isConfigPanel && (
          <div className="workflow-canvas config-panel-canvas">
            <div className="config-panel-scroll">
              {setup.currentStep === SETUP_STEPS.LANGUAGE_CONFIG && (
                <StepLanguageConfig hideStepBadge={true} />
              )}
              {setup.currentStep === SETUP_STEPS.IDE_CONFIG && (
                <StepIdeConfig
                  focusSection={dashboardConfigFocus}
                  hideStepBadge={true}
                />
              )}
              {setup.currentStep === SETUP_STEPS.REVIEW && <StepReview />}
            </div>
          </div>
        )}
        {isSettingsPanel && (
          <div className="workflow-canvas">
            <div className="workflow-scroll-area">
              <div className="settings-panel-card">
                <h3 className="settings-panel-title">Settings</h3>
                <p className="settings-panel-desc">
                  Use this option to reset and return to the initial setup
                  wizard.
                </p>
                <button
                  type="button"
                  className="btn-settings-reset"
                  onClick={() => actions.backToSetup()}
                >
                  Reset Entire Setup
                </button>
              </div>
            </div>
          </div>
        )}
        {showWorkflowCanvas && totalAgents === 0 && (
          <div className="workflow-canvas">
            <div className="empty-state-canvas">
              <div className="empty-state-icon">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <rect width="64" height="64" rx="16" fill="rgba(255,90,31,0.08)" />
                  <path d="M20 32h24M32 20v24" stroke="var(--gl-orange)" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <h2 className="empty-state-title">No Project Yet</h2>
              <p className="empty-state-desc">
                Set up your first project to build and run a multi-agent workflow.
                Choose a flow type, configure your tools, and launch your pipeline.
              </p>
              <div className="empty-state-actions">
                <button
                  type="button"
                  className="btn-primary empty-state-cta"
                  onClick={() => actions.backToSetup()}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v12M2 8h12" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                  Create New Project
                </button>
              </div>
              <div className="empty-state-flows">
                <p className="empty-state-flows-label">Available workflow types</p>
                <div className="empty-state-flow-chips">
                  {["📋 JIRA Spec", "🎨 Design Spec", "🔄 With Migration", "⚡ Without Migration", "🛠️ Custom Flow"].map(label => (
                    <span key={label} className="empty-state-flow-chip">{label}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {showWorkflowCanvas && totalAgents > 0 && (
          <div className="workflow-canvas">
            <div className={`workflow-scroll-area${totalAgents < 5 ? " single-row-canvas" : ""}`}>
              <div className="workflow-track">
                <div className="arrow-start-wrapper">
                  <div className="workflow-badge start">START</div>
                  <span className="green-right-arrow">{arrowCharacters}➜</span>
                </div>

                <div className="agent-nodes-container">
                  <div className="agent-row">
                    {workflow.agents.slice(0, 4).map((agent, i) => (
                      <AgentNode
                        key={agent.id}
                        agent={agent}
                        isLastInRow={i === 3}
                        isFirstInRow={i === 0}
                        canStart={canStartAgent(i)}
                      />
                    ))}
                    {/* END arrow inline after last card when only one row */}
                    {!hasSecondRow && (
                      <div className="arrow-end-wrapper">
                        <span className="green-right-arrow">
                          {arrowCharacters}➜
                        </span>
                        <span className="workflow-badge end">END</span>
                      </div>
                    )}
                  </div>

                  {hasSecondRow && (
                    <>
                      <div className="row-connector-curve downward-to-next">
                        <div className="connector-vertical-line"></div>
                        <div className="connector-horizontal-line"></div>
                        <div className="connector-arrow-to-next">←</div>
                      </div>

                      <div className="agent-row">
                        {workflow.agents.slice(4, 8).map((agent, i) => {
                          const lastIndex = totalAgents - 5;

                          return (
                            <AgentNode
                              key={agent.id}
                              agent={agent}
                              isLastInRow={i === lastIndex}
                              isFirstInRow={i === 0}
                              canStart={canStartAgent(4 + i)}
                            />
                          );
                        })}
                        {/* END arrow inline after last card in second row */}
                        {!hasThirdRow && (
                          <div className="arrow-end-wrapper">
                            <span className="green-right-arrow">
                              {arrowCharacters}➜
                            </span>
                            <span className="workflow-badge end">END</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {hasThirdRow && (
                    <div className="agent-row last">
                      <div className="row-connector-curve-small"></div>
                      <AgentNode
                        agent={workflow.agents[8]}
                        isSolo={true}
                        canStart={canStartAgent(8)}
                      />
                      <div className="arrow-end-wrapper">
                        <span className="green-right-arrow">
                          {arrowCharacters}➜
                        </span>
                        <span className="workflow-badge end">END</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Execution Log */}
        {!isConfigPanel && !isSettingsPanel && <ExecutionLog />}
      </main>
    </div>
  );
}
