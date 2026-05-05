import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import GLLogo from "../GLLogo";
import {
  IDE_PLATFORMS,
  LLM_OPTIONS,
  CLOUD_OPTIONS,
  MCP_OPTIONS,
  LANGUAGES,
  SOURCE_FILE_ACCEPT,
  KICKOFF_SOURCE_CONFIG,
  WORKFLOW_TEMPLATES,
  PROJECT_FLOW_OPTIONS,
  ALL_AGENTS,
} from "../../data/options";
import "./Sidebar.css";

export default function Sidebar() {
  const { state, actions } = useAppStore();
  const { setup, workflow, projects, activeProjectId } = state;
  const fileInputRef = useRef(null);
  const [isTemplatesExpanded, setIsTemplatesExpanded] = useState(false);
  const [previewFlowId, setPreviewFlowId] = useState(null);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const defaultWidth = 320;
    if (typeof globalThis === "undefined" || !globalThis.localStorage) {
      return defaultWidth;
    }
    const rawWidth = Number(globalThis.localStorage.getItem("dashboard-sidebar-width"));
    if (!Number.isFinite(rawWidth)) return defaultWidth;
    return Math.min(480, Math.max(300, rawWidth));
  });

  const platform =
    IDE_PLATFORMS.find((p) => p.id === setup.ideConfig.platform)?.label || "Not Set";
  const llm =
    LLM_OPTIONS.find((l) => l.id === setup.ideConfig.llm)?.label || "Not Set";
  const cloud =
    CLOUD_OPTIONS.find((c) => c.id === setup.ideConfig.cloudDeployment)?.label || "Not Set";
  const mcpServers =
    setup.ideConfig.mcpServers
      .map((id) => MCP_OPTIONS.find((m) => m.id === id)?.label)
      .join(", ") || "None";
  const sourceLanguageLabel =
    LANGUAGES.find((l) => l.id === setup.sourceLanguage)?.label || "Not Set";
  const targetLanguageLabel =
    LANGUAGES.find((l) => l.id === setup.targetLanguage)?.label || "Not Set";
  const kickoffConfig = KICKOFF_SOURCE_CONFIG[setup.kickoffSource || "custom_flow"];
  const acceptedExtensions =
    kickoffConfig?.accept || SOURCE_FILE_ACCEPT[setup.sourceLanguage];
  const inputDocumentLabel =
    kickoffConfig?.inputLabel || `${setup.sourceLanguage?.toUpperCase() || "Source"} File`;

  const flowOption = PROJECT_FLOW_OPTIONS.find((o) => o.id === setup.projectFlow);
  const workflowName = flowOption?.title || "Custom Workflow";

  const activeTemplateId =
    setup.selectedTemplateId ||
    WORKFLOW_TEMPLATES.find((t) => t.flowType === setup.flowType)?.id ||
    WORKFLOW_TEMPLATES[0]?.id;
  const activeTemplate = WORKFLOW_TEMPLATES.find((t) => t.id === activeTemplateId);

  const formatFileSize = (sizeInBytes) => {
    if (!Number.isFinite(sizeInBytes) || sizeInBytes < 0) return "-";
    if (sizeInBytes < 1024) return `${sizeInBytes} B`;
    if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(2)} KB`;
    return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFilePick = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const [file] = event.target.files || [];
    if (!file) return;

    // Read file content so it can be passed to the agent as context
    const reader = new FileReader();
    reader.onload = (e) => {
      actions.setSourceFile({
        name: file.name,
        size: file.size,
        type: file.type || null,
        lastModified: file.lastModified || null,
        content: e.target.result, // full text content
      });
    };
    reader.onerror = () => {
      // Store metadata only if read fails (e.g. binary file)
      actions.setSourceFile({
        name: file.name,
        size: file.size,
        type: file.type || null,
        lastModified: file.lastModified || null,
        content: null,
      });
    };
    reader.readAsText(file);
  };

  const handleProjectSwitch = (e) => {
    const val = e.target.value;
    if (val === "__new__") {
      actions.newProject();
    } else {
      actions.switchProject(val);
    }
  };

  const handleSidebarResizeStart = (event) => {
    event.preventDefault();
    setIsResizingSidebar(true);
  };

  useEffect(() => {
    if (!isResizingSidebar || typeof globalThis === "undefined") return undefined;
    const handleMouseMove = (event) => {
      const nextWidth = Math.min(480, Math.max(300, event.clientX));
      setSidebarWidth(nextWidth);
    };
    const handleMouseUp = () => setIsResizingSidebar(false);
    globalThis.addEventListener("mousemove", handleMouseMove);
    globalThis.addEventListener("mouseup", handleMouseUp);
    return () => {
      globalThis.removeEventListener("mousemove", handleMouseMove);
      globalThis.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    if (typeof globalThis === "undefined" || !globalThis.localStorage) return;
    globalThis.localStorage.setItem("dashboard-sidebar-width", String(sidebarWidth));
  }, [sidebarWidth]);

  return (
    <aside
      className={`dashboard-sidebar ${isResizingSidebar ? "resizing" : ""}`}
      style={{ width: `${sidebarWidth}px` }}
    >
      <div className="sidebar-header sticky-top">
        <GLLogo size="sm" variant="full" />
        <button
          type="button"
          className="sidebar-home-btn"
          onClick={() => actions.setView("dashboard", null)}
          title="Dashboard Home"
          aria-label="Go to dashboard home"
        >
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1h-4v-4H8v4H4a1 1 0 01-1-1V9.5z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Home
        </button>
      </div>

      <div className="sidebar-scroll-area">

        {/* ── PROJECTS ── */}
        <div className="sidebar-section">
          <h5 className="sidebar-title">PROJECTS</h5>
          <div className="project-select-wrap">
            <select
              className="kickoff-select project-select"
              value={activeProjectId || ""}
              onChange={handleProjectSwitch}
            >
              {projects.length === 0 && (
                <option value="" disabled>
                  No saved projects
                </option>
              )}
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
              <option value="__new__">＋ New Project…</option>
            </select>
          </div>
          <button
            type="button"
            className="btn-new-project"
            onClick={() => actions.newProject()}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M6.5 1v11M1 6.5h11"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            New Project
          </button>
        </div>

        {/* ── INPUT ── */}
        <div className="sidebar-section">
          <h5 className="sidebar-title">INPUT</h5>
          <div className="input-card">
            <div className="input-icon">📦</div>
            <div className="input-info">
              <div className="input-filename">
                {setup.sourceFile?.name || inputDocumentLabel}
              </div>
              <div className="input-filesize">
                {setup.sourceFile ? formatFileSize(setup.sourceFile.size) : "No file selected"}
              </div>
            </div>
            {setup.sourceFile ? <div className="input-check">✓</div> : null}
          </div>
          <button type="button" className="btn-change-file" onClick={handleFilePick}>
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

        {/* ── PROJECT CONFIG ── */}
        <div className="sidebar-section">
          <div className="section-title-row">
            <h5 className="sidebar-title">PROJECT CONFIG</h5>
            <button
              type="button"
              className="project-config-edit-btn"
              onClick={() =>
                actions.openDashboardConfig(
                  setup.kickoffSource === "modernization" ? "language_config" : "ide_config",
                )
              }
              aria-label="Edit project configuration"
            >
              ✎
            </button>
          </div>
          <div className="config-summary-list">
            <div className="config-summary-item">
              <span className="lbl">Workflow</span>
              <span className="val" title={workflowName}>{workflowName}</span>
            </div>
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
              <span className="val scrollable" title={mcpServers}>{mcpServers}</span>
            </div>
            {(setup.sourceLanguage) && (
              <div className="config-summary-item">
                <span className="lbl">Language</span>
                <span className="val">{sourceLanguageLabel}</span>
              </div>
            )}
            {(setup.targetLanguage) && (
              <div className="config-summary-item">
                <span className="lbl">Target</span>
                <span className="val">{targetLanguageLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── WORKFLOW INFO ── */}
        <div className="sidebar-section info">
          <h5 className="sidebar-title">WORKFLOW INFO</h5>
          <div className="info-row">
            <span className="info-lbl">Total Agents</span>
            <span className="info-val">{workflow.agents.length}</span>
          </div>
          <div className="info-row">
            <span className="info-lbl">Estimated Time</span>
            <span className="info-val">{activeTemplate?.estimatedTime || "~45-60 mins"}</span>
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

        {/* ── AVAILABLE WORKFLOWS (at bottom) ── */}
        <div className="sidebar-section sidebar-templates-section">
          <button
            type="button"
            className="section-toggle"
            onClick={() => setIsTemplatesExpanded((prev) => !prev)}
            aria-expanded={isTemplatesExpanded}
          >
            <h5 className="sidebar-title">AVAILABLE WORKFLOWS</h5>
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
          <div className={`section-collapse ${isTemplatesExpanded ? "open" : ""}`}>
            <div className="template-list" role="tablist" aria-label="Available workflows">
              {PROJECT_FLOW_OPTIONS.map((flow) => (
                <button
                  key={flow.id}
                  type="button"
                  className={`template-item ${flow.id === previewFlowId ? "active" : ""}`}
                  onClick={() => setPreviewFlowId(prev => prev === flow.id ? null : flow.id)}
                  role="tab"
                  aria-selected={flow.id === previewFlowId}
                >
                  <span className="template-icon">{flow.icon}</span>
                  <span className="template-label">{flow.title}</span>
                  <span className="template-arrow">{flow.id === previewFlowId ? "✕" : "›"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      <div className="sidebar-footer-btn sticky-bottom">
        <button className="btn-sidebar-settings" onClick={() => actions.openDashboardSettings()}>
          Settings
        </button>
      </div>

      <button
        type="button"
        className="sidebar-resize-handle"
        onMouseDown={handleSidebarResizeStart}
        aria-label="Resize sidebar"
      />

      {/* ── Flow preview panel ── */}
      {previewFlowId && (() => {
        const pf = PROJECT_FLOW_OPTIONS.find(f => f.id === previewFlowId);
        if (!pf) return null;
        return (
          <div className="flow-preview-panel" style={{ left: sidebarWidth }}>
            {/* Fixed header */}
            <div className="flow-preview-header">
              <span className="flow-preview-icon">{pf.icon}</span>
              <div className="flow-preview-title-wrap">
                <span className="flow-preview-title">{pf.title}</span>
                <span className="flow-preview-subtitle">{pf.subtitle}</span>
              </div>
              <button
                type="button"
                className="flow-preview-close"
                onClick={() => setPreviewFlowId(null)}
                aria-label="Close preview"
              >✕</button>
            </div>

            {/* Scrollable body */}
            <div className="flow-preview-body">
              <p className="flow-preview-desc">{pf.description}</p>

              {pf.badge && (
                <span
                  className="flow-preview-badge"
                  style={{ background: `${pf.badgeColor}20`, color: pf.badgeColor, borderColor: `${pf.badgeColor}50` }}
                >
                  {pf.badge}
                </span>
              )}

              <div className="flow-preview-section-label">Pipeline Agents</div>
              <div className="flow-preview-agents">
                {pf.agents.length === 0 ? (
                  <p className="flow-preview-custom-note">
                    🛠️ Agents are selected during setup based on your requirements.
                  </p>
                ) : (
                  pf.agents.map((agentKey, idx) => {
                    const agentDef = ALL_AGENTS.find(a => a.id === agentKey);
                    return (
                      <div key={agentKey} className="flow-preview-agent-row">
                        <span className="flow-preview-agent-num">{idx + 1}</span>
                        <span className="flow-preview-agent-name">
                          {agentDef?.name || agentKey.replaceAll("_", " ").replaceAll(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Always-visible footer */}
            <div className="flow-preview-footer">
              <span className="flow-preview-next-label">Next Step</span>
              <span className="flow-preview-next-val">{pf.nextStepLabel}</span>
            </div>
          </div>
        );
      })()}
    </aside>
  );
}
