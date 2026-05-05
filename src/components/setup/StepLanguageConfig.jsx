import { useState } from "react";
import { useAppStore, FLOW_TYPE, PROJECT_FLOW } from "../../store/useAppStore";
import { LANGUAGES, PROJECT_FLOW_OPTIONS } from "../../data/options";
import "./StepLanguageConfig.css";

const FLOW_LANGUAGE_CONFIG = {
  jira_spec: {
    sourceLabel: "Target Language",
    sourceHint: "Language for generated code output",
    showTarget: false,
    stepDesc: "Choose the language for code generation output from the JIRA specification.",
  },
  design_spec: {
    sourceLabel: "Target Language",
    sourceHint: "Language for generated code output",
    showTarget: false,
    stepDesc: "Choose the language for code generation output from the design specification.",
  },
  code_with_migration: {
    sourceLabel: "Source Language (Legacy)",
    sourceHint: "The existing legacy codebase language",
    targetLabel: "Target Language (Modern)",
    targetHint: "The modern language to migrate to",
    showTarget: true,
    stepDesc: "Specify the legacy source language and the modern target language for migration.",
  },
  code_without_migration: {
    sourceLabel: "Source Language",
    sourceHint: "Primary language for analysis and code generation",
    showTarget: false,
    stepDesc: "Specify the primary language for analysis and code generation.",
  },
  custom: {
    sourceLabel: "Source Language",
    sourceHint: "Primary language for your pipeline",
    showTarget: false,
    stepDesc: "Specify the primary language for your custom pipeline.",
  },
};

export default function StepLanguageConfig({ hideStepBadge = false }) {
  const { state, actions } = useAppStore();
  const {
    projectFlow,
    flowType,
    kickoffSource,
    sourceLanguage: savedSrc,
    targetLanguage: savedTgt,
  } = state.setup;

  const [sourceLanguage, setSourceLanguage] = useState(savedSrc || "");
  const [targetLanguage, setTargetLanguage] = useState(savedTgt || "");

  const isCustom = projectFlow === PROJECT_FLOW.CUSTOM;
  const stepNum = isCustom ? 3 : 2;

  const isMigration =
    flowType === FLOW_TYPE.WITH_MIGRATION || kickoffSource === "modernization";

  const flowConfig = FLOW_LANGUAGE_CONFIG[projectFlow] || FLOW_LANGUAGE_CONFIG.custom;
  const showTarget = flowConfig.showTarget || isMigration;
  const isValid = sourceLanguage && (!showTarget || targetLanguage);

  const selectedFlowOption = PROJECT_FLOW_OPTIONS.find((o) => o.id === projectFlow);

  const handleNext = () => {
    if (isValid) {
      actions.setLanguageConfig({ sourceLanguage, targetLanguage });
    }
  };

  return (
    <div className="step-language-config animate-fade-in">
      <div className="step-section-header">
        {!hideStepBadge && <div className="step-section-num">Step {stepNum}</div>}
        <h2 className="step-section-title">
          {selectedFlowOption?.nextStepLabel || "Configure Languages"}
        </h2>
        <p className="step-section-desc">{flowConfig.stepDesc}</p>
      </div>

      <div className="language-selection-container">
        <div className="language-block">
          <label className="input-label">{flowConfig.sourceLabel}</label>
          {flowConfig.sourceHint && (
            <p className="language-hint">{flowConfig.sourceHint}</p>
          )}
          <div className="language-grid">
            {LANGUAGES.map((lang) => (
              <button
                key={`src-${lang.id}`}
                className={`lang-option ${sourceLanguage === lang.id ? "selected" : ""}`}
                onClick={() => setSourceLanguage(lang.id)}
              >
                <span className="lang-icon">{lang.icon}</span>
                <span className="lang-name">{lang.label}</span>
              </button>
            ))}
          </div>
        </div>

        {showTarget && (
          <div className="language-connector">
            <div className="connector-line"></div>
            <div className="connector-arrow">➔</div>
          </div>
        )}

        {showTarget && (
          <div className="language-block">
            <label className="input-label">
              {flowConfig.targetLabel || "Target Language"}
            </label>
            {flowConfig.targetHint && (
              <p className="language-hint">{flowConfig.targetHint}</p>
            )}
            <div className="language-grid">
              {LANGUAGES.filter((l) => l.id !== sourceLanguage).map((lang) => (
                <button
                  key={`tgt-${lang.id}`}
                  className={`lang-option ${targetLanguage === lang.id ? "selected" : ""} tgt`}
                  onClick={() => setTargetLanguage(lang.id)}
                >
                  <span className="lang-icon">{lang.icon}</span>
                  <span className="lang-name">{lang.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="step-actions">
        <button className="btn-next" disabled={!isValid} onClick={handleNext}>
          Continue to IDE Config
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
