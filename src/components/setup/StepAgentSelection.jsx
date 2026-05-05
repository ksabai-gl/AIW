import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import { ALL_AGENTS, KICKOFF_SOURCES } from "../../data/options";
import "./StepAgentSelection.css";

export default function StepAgentSelection() {
  const { state, actions } = useAppStore();
  const savedAgents = state.setup.selectedAgentIds || [];
  const savedSource = state.setup.kickoffSource || "custom_flow";
  
  const [selectedAgents, setSelectedAgents] = useState(savedAgents);
  const [inputSource, setInputSource] = useState(savedSource);

  const toggleAgent = (agentId) => {
    setSelectedAgents(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  const handleNext = () => {
    if (selectedAgents.length > 0) {
      actions.setKickoffSource(inputSource);
      actions.setCustomAgents(selectedAgents);
    }
  };

  const isValid = selectedAgents.length > 0;

  return (
    <div className="step-agent-selection animate-fade-in">
      <div className="step-section-header">
        <div className="step-section-num">Step 1.5</div>
        <h2 className="step-section-title">Configure Custom Workflow</h2>
        <p className="step-section-desc">
          Select your primary input source and the specialized AI agents you want to include in your custom pipeline.
        </p>
      </div>

      <div className="custom-setup-section">
        <h3 className="section-title">1. Select Input Source</h3>
        <div className="input-source-grid">
          {KICKOFF_SOURCES.map((source) => (
            <button
              key={source.id}
              className={`source-option-btn ${inputSource === source.id ? "selected" : ""}`}
              onClick={() => setInputSource(source.id)}
            >
              {source.label}
            </button>
          ))}
        </div>
      </div>

      <div className="custom-setup-section">
        <h3 className="section-title">2. Select Pipeline Agents</h3>
        <div className="agent-selection-grid">
          {ALL_AGENTS.map((agent) => {
            const selected = selectedAgents.includes(agent.id);
            return (
              <button
                key={agent.id}
                className={`agent-select-card ${selected ? "selected" : ""}`}
                onClick={() => toggleAgent(agent.id)}
              >
                <div className="agent-select-header">
                  <div className="agent-select-icon" style={{ backgroundColor: `${agent.color}20`, color: agent.color }}>
                    <span className="icon-placeholder">
                      {agent.icon === "search" && "🔍"}
                      {agent.icon === "git-merge" && "🔄"}
                      {agent.icon === "layout" && "🎨"}
                      {agent.icon === "list-checks" && "📋"}
                      {agent.icon === "ticket" && "🎫"}
                      {agent.icon === "code" && "💻"}
                      {agent.icon === "flask-conical" && "🧪"}
                      {agent.icon === "git-pull-request" && "🚀"}
                    </span>
                  </div>
                  {selected && <div className="agent-check">✓</div>}
                </div>
                <h3 className="agent-select-name">{agent.shortName}</h3>
                <p className="agent-select-desc">{agent.description}</p>
                {agent.htlpRequired && <span className="agent-htlp-badge">HITLP Enabled</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="step-actions">
        <button 
          className="btn-next" 
          disabled={!isValid} 
          onClick={handleNext}
        >
          Continue to Languages
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
  );
}
