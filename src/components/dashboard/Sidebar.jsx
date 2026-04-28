import { useRef, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import GLLogo from "../GLLogo";
import {
  IDE_PLATFORMS,
  LLM_OPTIONS,
  CLOUD_OPTIONS,
  MCP_OPTIONS,
  SOURCE_FILE_ACCEPT,
  WORKFLOW_TEMPLATES,
} from "../../data/options";
import "./Sidebar.css";

export default function Sidebar() {
  const { state, actions } = useAppStore();
  const { setup, workflow } = state;
  const fileInputRef = useRef(null);
  const [isTemplatesExpanded, setIsTemplatesExpanded] = useState(true);
  const [isConfigExpanded, setIsConfigExpanded] = useState(true);

  const platform =
    IDE_PLATFORMS.find((p) => p.id === setup.ideConfig.platform)?.label ||
    "Not Set";
  const llm =
    LLM_OPTIONS.find((l) => l.id === setup.ideConfig.llm)?.label || "Not Set";
  const cloud =
    CLOUD_OPTIONS.find((c) => c.id === setup.ideConfig.cloudDeployment)
      ?.label || "Not Set";
  const mcpServers =
    setup.ideConfig.mcpServers
      .map((id) => MCP_OPTIONS.find((m) => m.id === id)?.label)
      .join(", ") || "None";
  const acceptedExtensions = SOURCE_FILE_ACCEPT[setup.sourceLanguage];
  const activeTemplateId =
    setup.selectedTemplateId ||
    WORKFLOW_TEMPLATES.find((template) => template.flowType === setup.flowType)
      ?.id ||
    WORKFLOW_TEMPLATES[0]?.id;
  const activeTemplate = WORKFLOW_TEMPLATES.find(
    (template) => template.id === activeTemplateId,
  );

  const formatFileSize = (sizeInBytes) => {
    if (!Number.isFinite(sizeInBytes) || sizeInBytes < 0) return "-";
    if (sizeInBytes < 1024) return `${sizeInBytes} B`;
    if (sizeInBytes < 1024 * 1024)
      return `${(sizeInBytes / 1024).toFixed(2)} KB`;
    return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFilePick = () => {
    if (!fileInputRef.current) return;
    // Ensure selecting the same file triggers onChange again.
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const [file] = event.target.files || [];
    if (!file) return;

    actions.setSourceFile({
      name: file.name,
      size: file.size,
      type: file.type || null,
      lastModified: file.lastModified || null,
    });
  };

  const handleTemplateSelect = (templateId) => {
    actions.setWorkflowTemplate(templateId);
  };

  const configItems = [
    {
      id: "platform",
      label: "Platform Options",
      value: platform,
      onClick: () => actions.openDashboardConfig("ide_config", "platform"),
    },
    {
      id: "language",
      label: "Language Options",
      value: setup.sourceLanguage?.toUpperCase() || "Not Set",
      onClick: () => actions.openDashboardConfig("language_config"),
    },
    {
      id: "mcp",
      label: "MCP Server Options",
      value: mcpServers,
      onClick: () => actions.openDashboardConfig("ide_config", "mcp"),
    },
    {
      id: "llm",
      label: "LLM Models Options",
      value: llm,
      onClick: () => actions.openDashboardConfig("ide_config", "llm"),
    },
  ];

  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-header">
        <GLLogo size="sm" variant="full" />
      </div>

      <div className="sidebar-section">
        <h5 className="sidebar-title">INPUT</h5>
        <div className="input-card">
          <div className="input-icon">📦</div>
          <div className="input-info">
            <div className="input-filename">
              {setup.sourceFile?.name ||
                `${setup.sourceLanguage?.toUpperCase() || "Source"} File`}
            </div>
            <div className="input-filesize">
              {setup.sourceFile
                ? formatFileSize(setup.sourceFile.size)
                : "No file selected"}
            </div>
          </div>
          {setup.sourceFile ? <div className="input-check">✓</div> : null}
        </div>
        <button
          type="button"
          className="btn-change-file"
          onClick={handleFilePick}
        >
          Change File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedExtensions}
          onChange={handleFileChange}
          hidden
        />
      </div>

      <div className="sidebar-section">
        <h5 className="sidebar-title">PROJECT CONFIG</h5>
        <div className="config-summary-list">
          <div className="config-summary-item">
            <span className="lbl">IDE</span>
            <span className="val">{platform}</span>
          </div>
          <div className="config-summary-item">
            <span className="lbl">LLM</span>
            <span className="val">{llm}</span>
          </div>
          <div className="config-summary-item">
            <span className="lbl">Cloud</span>
            <span className="val">{cloud}</span>
          </div>
          <div className="config-summary-item">
            <span className="lbl">MCP</span>
            <span className="val scrollable" title={mcpServers}>
              {mcpServers}
            </span>
          </div>
        </div>
      </div>

      <div className="sidebar-section">
        <button
          type="button"
          className="section-toggle"
          onClick={() => setIsTemplatesExpanded((prev) => !prev)}
          aria-expanded={isTemplatesExpanded}
        >
          <h5 className="sidebar-title">WORKFLOW TEMPLATES</h5>
          <svg
            className={`section-toggle-icon ${isTemplatesExpanded ? "expanded" : ""}`}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div
          className={`section-collapse ${isTemplatesExpanded ? "open" : ""}`}
        >
          <div
            className="template-list"
            role="tablist"
            aria-label="Workflow templates"
          >
            {WORKFLOW_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`template-item ${template.id === activeTemplateId ? "active" : ""}`}
                onClick={() => handleTemplateSelect(template.id)}
                role="tab"
                aria-selected={template.id === activeTemplateId}
              >
                <span className="template-icon">{template.icon}</span>
                <span className="template-label">{template.label}</span>
                <span className="template-arrow">›</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sidebar-section">
        <button
          type="button"
          className="section-toggle"
          onClick={() => setIsConfigExpanded((prev) => !prev)}
          aria-expanded={isConfigExpanded}
        >
          <h5 className="sidebar-title">CONFIGURATION</h5>
          <svg
            className={`section-toggle-icon ${isConfigExpanded ? "expanded" : ""}`}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className={`section-collapse ${isConfigExpanded ? "open" : ""}`}>
          <div className="config-options-list">
            {configItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="config-option-item"
                onClick={item.onClick}
              >
                <span className="config-option-label">{item.label}</span>
                <span className="config-option-meta" title={item.value}>
                  {item.value}
                </span>
                <span className="config-option-arrow">›</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sidebar-section info">
        <h5 className="sidebar-title">WORKFLOW INFO</h5>
        <div className="info-row">
          <span className="info-lbl">Total Agents</span>
          <span className="info-val">{workflow.agents.length}</span>
        </div>
        <div className="info-row">
          <span className="info-lbl">Estimated Time</span>
          <span className="info-val">
            {activeTemplate?.estimatedTime || "~45-60 mins"}
          </span>
        </div>
        <div className="info-row">
          <span className="info-lbl">Status</span>
          <span className="info-val highlight">
            {workflow.workflowStatus.replace("_", " ").toUpperCase()}
          </span>
        </div>
        <div className="info-row">
          <span className="info-lbl">Last Run</span>
          <span className="info-val">-</span>
        </div>
      </div>

      <div className="sidebar-footer-btn">
        <button
          className="btn-back-setup"
          onClick={() => actions.backToSetup()}
        >
          Reset Entire Setup
        </button>
      </div>
    </aside>
  );
}
