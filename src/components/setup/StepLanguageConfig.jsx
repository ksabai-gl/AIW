import { useState, useEffect } from "react";
import { useAppStore, FLOW_TYPE } from "../../store/useAppStore";
import { LANGUAGES } from "../../data/options";
import "./StepLanguageConfig.css";

export default function StepLanguageConfig() {
  const { state, actions } = useAppStore();
  const {
    flowType,
    sourceLanguage: savedSrc,
    targetLanguage: savedTgt,
  } = state.setup;

  const [sourceLanguage, setSourceLanguage] = useState(savedSrc || "");
  const [targetLanguage, setTargetLanguage] = useState(savedTgt || "");

  const isMigration = flowType === FLOW_TYPE.WITH_MIGRATION;
  const isValid = sourceLanguage && (!isMigration || targetLanguage);

  const handleNext = () => {
    if (isValid) {
      actions.setLanguageConfig({ sourceLanguage, targetLanguage });
    }
  };

  return (
    <div className="step-language-config animate-fade-in">
      <div className="step-section-header">
        <div className="step-section-num">Step 2</div>
        <h2 className="step-section-title">Configure Languages</h2>
        <p className="step-section-desc">
          {isMigration
            ? "Specify the source legacy language and the target modern language for migration."
            : "Specify the primary language for analysis and code generation."}
        </p>
      </div>

      <div className="language-selection-container">
        <div className="language-block">
          <label className="input-label">Source Language</label>
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

        {isMigration && (
          <div className="language-connector">
            <div className="connector-line"></div>
            <div className="connector-arrow">➔</div>
          </div>
        )}

        {isMigration && (
          <div className="language-block">
            <label className="input-label">Target Language</label>
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
