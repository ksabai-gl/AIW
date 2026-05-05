import "./SetupWizard.css";
import { useAppStore, SETUP_STEPS, PROJECT_FLOW } from "../store/useAppStore";
import StepFlowSelection from "./setup/StepFlowSelection";
import StepAgentSelection from "./setup/StepAgentSelection";
import StepLanguageConfig from "./setup/StepLanguageConfig";
import StepIdeConfig from "./setup/StepIdeConfig";
import StepReview from "./setup/StepReview";
import GLLogo from "./GLLogo";

// Moved inside component for dynamic rendering

export default function SetupWizard() {
  const { state, actions } = useAppStore();
  const { setup } = state;

  const isCustom = setup.projectFlow === PROJECT_FLOW.CUSTOM;
  const stepMeta = [
    { id: SETUP_STEPS.FLOW_SELECTION, label: "Flow Type", num: 1 },
    ...(isCustom ? [{ id: SETUP_STEPS.AGENT_SELECTION, label: "Agents", num: 2 }] : []),
    { id: SETUP_STEPS.LANGUAGE_CONFIG, label: "Languages", num: isCustom ? 3 : 2 },
    { id: SETUP_STEPS.IDE_CONFIG, label: "IDE & Platform", num: isCustom ? 4 : 3 },
    { id: SETUP_STEPS.REVIEW, label: "Review", num: isCustom ? 5 : 4 },
  ];

  const order = stepMeta.map(s => s.id);

  const isStepEnabled = (stepId) => {
    const idx = order.indexOf(stepId);
    if (idx === 0) return true;
    return setup.completedSteps.includes(order[idx - 1]);
  };

  const isStepCompleted = (stepId) => setup.completedSteps.includes(stepId);
  const isStepActive = (stepId) => setup.currentStep === stepId;

  const handleStepClick = (stepId) => {
    if (!isStepEnabled(stepId)) return;
    if (isStepCompleted(stepId) && !isStepActive(stepId)) {
      actions.resetSetupFromStep(stepId);
    }
  };

  return (
    <div className="setup-wizard">
      {/* Header */}
      <header className="setup-header">
        <div className="setup-header-left">
          <GLLogo size="md" variant="full" />
          <div className="setup-header-divider" />
          <div className="setup-header-title">
            <span className="setup-header-product">AI-Driven SDLC</span>
            <span className="setup-header-sub">Project Setup Wizard</span>
          </div>
        </div>
        <div className="setup-header-badge">
          <span className="badge-dot" />
          Setup Mode
        </div>
      </header>

      {/* Progress Steps */}
      <div className="setup-progress-bar">
        {stepMeta.map((step, idx) => {
          const enabled = isStepEnabled(step.id);
          const completed = isStepCompleted(step.id);
          const active = isStepActive(step.id);
          return (
            <div key={step.id} className="setup-progress-item">
              <button
                className={`step-btn ${active ? "active" : ""} ${completed ? "completed" : ""} ${!enabled ? "disabled" : ""}`}
                onClick={() => handleStepClick(step.id)}
                disabled={!enabled}
                title={
                  !enabled
                    ? "Complete previous step first"
                    : completed
                      ? "Click to reset and redo"
                      : ""
                }
              >
                <div className="step-circle">
                  {completed && !active ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M2.5 7L5.5 10L11.5 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span>{step.num}</span>
                  )}
                </div>
                <span className="step-label">{step.label}</span>
              </button>
              {idx < stepMeta.length - 1 && (
                <div
                  className={`step-connector ${completed ? "filled" : ""}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="setup-content animate-fade-in">
        {setup.currentStep === SETUP_STEPS.FLOW_SELECTION && (
          <StepFlowSelection />
        )}
        {setup.currentStep === SETUP_STEPS.AGENT_SELECTION && (
          <StepAgentSelection />
        )}
        {setup.currentStep === SETUP_STEPS.LANGUAGE_CONFIG && (
          <StepLanguageConfig />
        )}
        {setup.currentStep === SETUP_STEPS.IDE_CONFIG && <StepIdeConfig />}
        {setup.currentStep === SETUP_STEPS.REVIEW && <StepReview />}
      </div>

      {/* Footer */}
      <footer className="setup-footer">
        <span>© 2025 GlobalLogic Inc. — A Hitachi Group Company</span>
        <span>AI-Driven SDLC Platform v2.0</span>
      </footer>
    </div>
  );
}
