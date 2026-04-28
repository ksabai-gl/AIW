import { useAppStore, FLOW_TYPE } from "../../store/useAppStore";
import "./StepFlowSelection.css";

const FLOWS = [
  {
    id: FLOW_TYPE.WITH_MIGRATION,
    icon: "🔄",
    title: "With Migration",
    subtitle: "Code Migration + Analysis",
    description:
      "Includes a dedicated Code Migration Agent that converts your source language to the target language before analysis and code generation. Ideal for legacy modernization projects.",
    steps: [
      "Code Analyser Agent",
      "Code Migration Agent",
      "Design Spec Agent",
      "Task List Spec Agent",
      "Jira Spec Agent",
      "Code Generation Agent",
      "Test Generation Agent",
      "PR Creation Agent",
      // 'Deployment Agent',
    ],
    agents: 9,
    time: "60–90 mins",
    badge: "Legacy Modernization",
    badgeColor: "#8B5CF6",
  },
  {
    id: FLOW_TYPE.WITHOUT_MIGRATION,
    icon: "⚡",
    title: "Without Migration",
    subtitle: "Direct Analysis & Generation",
    description:
      "Skips the migration stage and goes straight to code analysis, design spec, and code generation. Best for greenfield or same-technology modernization projects.",
    steps: [
      "Code Analyser Agent",
      "Design Spec Agent",
      "Task List Spec Agent",
      "Jira Spec Agent",
      "Code Generation Agent",
      "Test Generation Agent",
      "PR Creation Agent",
      // 'Deployment Agent',
    ],
    agents: 8,
    time: "45–60 mins",
    badge: "Greenfield / Modernization",
    badgeColor: "#22C55E",
  },
];

export default function StepFlowSelection() {
  const { state, actions } = useAppStore();
  const selectedFlow = state.setup.flowType;

  return (
    <div className="step-flow-selection animate-fade-in">
      <div className="step-section-header">
        <div className="step-section-num">Step 1</div>
        <h2 className="step-section-title">Select Your Workflow Type</h2>
        <p className="step-section-desc">
          Choose the pipeline that best matches your project — with or without a
          migration stage.
        </p>
      </div>

      <div className="flow-cards-grid">
        {FLOWS.map((flow) => {
          const selected = selectedFlow === flow.id;
          return (
            <button
              key={flow.id}
              className={`flow-card ${selected ? "selected" : ""}`}
              onClick={() => actions.setFlowType(flow.id)}
            >
              {/* Card top */}
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

              {/* Stats row */}
              <div className="flow-stats">
                <div className="flow-stat">
                  <span className="flow-stat-val">{flow.agents}</span>
                  <span className="flow-stat-lbl">Agents</span>
                </div>
                <div className="flow-stat-divider" />
                <div className="flow-stat">
                  <span className="flow-stat-val">{flow.time}</span>
                  <span className="flow-stat-lbl">Est. Time</span>
                </div>
              </div>

              {/* Steps list */}
              <div className="flow-steps">
                {flow.steps.map((step, i) => (
                  <div key={i} className="flow-step-item">
                    <span className="flow-step-num">{i + 1}</span>
                    <span className="flow-step-name">{step}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
