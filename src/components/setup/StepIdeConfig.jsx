import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import {
  IDE_PLATFORMS,
  LLM_OPTIONS,
  CLOUD_OPTIONS,
  MCP_OPTIONS,
} from "../../data/options";
import "./StepIdeConfig.css";

export default function StepIdeConfig({ focusSection = null }) {
  const { state, actions } = useAppStore();
  const savedConfig = state.setup.ideConfig;

  const [config, setConfig] = useState({
    platform: savedConfig.platform || "",
    llm: savedConfig.llm || "",
    cloudDeployment: savedConfig.cloudDeployment || "",
    mcpServers: savedConfig.mcpServers || [],
  });

  const updateConfig = (key, value) => {
    if (key === "mcpServers") {
      const newMcp = config.mcpServers.includes(value)
        ? config.mcpServers.filter((id) => id !== value)
        : [...config.mcpServers, value];
      setConfig((prev) => ({ ...prev, mcpServers: newMcp }));
    } else {
      setConfig((prev) => ({ ...prev, [key]: value }));
    }
  };

  const isValid =
    config.platform &&
    config.llm &&
    config.cloudDeployment &&
    config.mcpServers.length > 0;
  const showPlatform = !focusSection || focusSection === "platform";
  const showLlm = !focusSection || focusSection === "llm";
  const showCloud = !focusSection || focusSection === "cloud";
  const showMcp = !focusSection || focusSection === "mcp";

  const handleNext = () => {
    if (isValid) {
      actions.setIdeConfig(config);
    }
  };

  return (
    <div className="step-ide-config animate-fade-in">
      <div className="step-section-header">
        <div className="step-section-num">Step 3</div>
        <h2 className="step-section-title">IDE & Intelligence</h2>
        <p className="step-section-desc">
          Select your execution platform, LLM engine, and MCP servers to power
          the transformation.
        </p>
      </div>

      <div className="config-grid">
        {/* Platform selection */}
        {showPlatform && (
          <div className="config-card">
            <h3 className="config-card-title">Execution Platform</h3>
            <div className="option-list">
              {IDE_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  className={`option-item ${config.platform === p.id ? "selected" : ""}`}
                  onClick={() => updateConfig("platform", p.id)}
                >
                  <span className="option-icon">{p.icon}</span>
                  <div className="option-text">
                    <div className="option-label">{p.label}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* LLM Selection */}
        {showLlm && (
          <div className={`config-card ${!config.platform ? "disabled" : ""}`}>
            <h3 className="config-card-title">LLM Engine</h3>
            <div className="option-list">
              {LLM_OPTIONS.map((l) => (
                <button
                  key={l.id}
                  disabled={!config.platform}
                  className={`option-item ${config.llm === l.id ? "selected" : ""}`}
                  onClick={() => updateConfig("llm", l.id)}
                >
                  <div className="option-text">
                    <div className="option-label">{l.label}</div>
                    <div className="option-sub">{l.provider}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cloud selection */}
        {showCloud && (
          <div className={`config-card ${!config.llm ? "disabled" : ""}`}>
            <h3 className="config-card-title">Cloud Deployment</h3>
            <div className="option-list">
              {CLOUD_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  disabled={!config.llm}
                  className={`option-item ${config.cloudDeployment === c.id ? "selected" : ""}`}
                  onClick={() => updateConfig("cloudDeployment", c.id)}
                >
                  <span className="option-icon">{c.icon}</span>
                  <div className="option-text">
                    <div className="option-label">{c.label}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MCP selection - MULTI SELECT */}
        {showMcp && (
          <div
            className={`config-card ${!config.cloudDeployment ? "disabled" : ""}`}
          >
            <div className="config-card-header">
              <h3 className="config-card-title">MCP Servers</h3>
              <span className="selection-badge">
                {config.mcpServers.length} Selected
              </span>
            </div>
            <div className="option-list mcp">
              {MCP_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  disabled={!config.cloudDeployment}
                  className={`option-item ${config.mcpServers.includes(m.id) ? "selected" : ""}`}
                  onClick={() => updateConfig("mcpServers", m.id)}
                >
                  <span className="option-icon">{m.icon}</span>
                  <div className="option-text">
                    <div className="option-label">{m.label}</div>
                  </div>
                  {config.mcpServers.includes(m.id) && (
                    <div className="multi-check">✓</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="step-actions">
        <button className="btn-next" disabled={!isValid} onClick={handleNext}>
          Review & Launch
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
