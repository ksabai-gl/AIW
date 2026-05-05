import { useState, useMemo, useEffect } from "react";
import { useAppStore, PROJECT_FLOW } from "../../store/useAppStore";
import {
  IDE_PLATFORMS,
  LLM_OPTIONS,
  CLOUD_OPTIONS,
  MCP_OPTIONS,
  isBridgeCliPlatform,
} from "../../data/options";
import { fetchCursorModels, fetchKiroModels, readWorkspaceEnvForMcp, configureMcpFromEnv } from "../../lib/agentBridgeApi";
import "./StepIdeConfig.css";

/** Older bridge or edge case: ok false but CLI exited 0 with “no models” plain text. */
function isBridgeEmptyModelsCliSuccessFallback(data) {
  if (!data || data.ok === true || data.exitCode !== 0) return false;
  const blob = `${data.stderr ?? ""}\n${data.stdoutPreview ?? ""}`.toLowerCase();
  return (
    blob.includes("no models available") ||
    blob.includes("no models for this account") ||
    /no .+ models? (?:available|listed)/i.test(blob)
  );
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function ChangeSummary({ saved, next }) {
  const rows = [];
  const platform = (id) => IDE_PLATFORMS.find((p) => p.id === id)?.label || id;
  const llm = (id) => {
    if (!id) return id;
    if (id === "__cli_default__") return "CLI default model";
    return LLM_OPTIONS.find((l) => l.id === id)?.label || id;
  };
  const cloud = (id) => CLOUD_OPTIONS.find((c) => c.id === id)?.label || id;
  const mcp = (ids) =>
    (ids || []).map((id) => MCP_OPTIONS.find((m) => m.id === id)?.label || id).join(", ") || "None";

  if (saved.platform !== next.platform)
    rows.push({ label: "Platform", from: platform(saved.platform) || "—", to: platform(next.platform) });
  if (saved.llm !== next.llm)
    rows.push({ label: "LLM", from: llm(saved.llm) || "—", to: llm(next.llm) });
  if (saved.cloudDeployment !== next.cloudDeployment)
    rows.push({ label: "Cloud", from: cloud(saved.cloudDeployment) || "—", to: cloud(next.cloudDeployment) });
  const sortStr = (a, b) => a.localeCompare(b);
  if (!deepEqual([...(saved.mcpServers || [])].sort(sortStr), [...(next.mcpServers || [])].sort(sortStr)))
    rows.push({ label: "MCP Servers", from: mcp(saved.mcpServers), to: mcp(next.mcpServers) });
  if (
    (saved.cliExecutablePath || "") !== (next.cliExecutablePath || "") &&
    (isBridgeCliPlatform(saved.platform) || isBridgeCliPlatform(next.platform))
  ) {
    rows.push({
      label: "CLI executable",
      from: saved.cliExecutablePath?.trim() || "—",
      to: next.cliExecutablePath?.trim() || "—",
    });
  }

  return (
    <div className="ide-change-summary">
      {rows.map((r) => (
        <div key={r.label} className="ide-change-row">
          <span className="ide-change-label">{r.label}</span>
          <span className="ide-change-from">{r.from}</span>
          <span className="ide-change-arrow">→</span>
          <span className="ide-change-to">{r.to}</span>
        </div>
      ))}
    </div>
  );
}

export default function StepIdeConfig({
  focusSection = null,
  hideStepBadge = false,
}) {
  const { state, actions } = useAppStore();
  const { ideConfig: savedConfig, projectFlow, targetWorkspace, agentBridgeBaseUrl = "" } = state.setup;

  const isCustom = projectFlow === PROJECT_FLOW.CUSTOM;
  const stepNum = isCustom ? 4 : 3;

  const [config, setConfig] = useState({
    platform: savedConfig.platform || "",
    llm: savedConfig.llm || "",
    cloudDeployment: savedConfig.cloudDeployment || "",
    mcpServers: savedConfig.mcpServers || [],
    cliExecutablePath: savedConfig.cliExecutablePath || "",
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [bridgeModels, setBridgeModels] = useState([]);
  const [bridgeModelsLoading, setBridgeModelsLoading] = useState(false);
  const [bridgeModelsError, setBridgeModelsError] = useState(null);
  const [bridgeModelsNote, setBridgeModelsNote] = useState(null);

  // MCP connect state
  const [mcpEnvStatus, setMcpEnvStatus] = useState(null); // null | { ok, found, error }
  const [mcpEnvLoading, setMcpEnvLoading] = useState(false);
  const [mcpConfiguring, setMcpConfiguring] = useState(false);
  const [mcpConfigResult, setMcpConfigResult] = useState(null); // null | { ok, message, error }
  const [mcpInstallStatus, setMcpInstallStatus] = useState(null); // null | { results }

  const updateConfig = (key, value) => {
    if (key === "mcpServers") {
      const newMcp = config.mcpServers.includes(value)
        ? config.mcpServers.filter((id) => id !== value)
        : [...config.mcpServers, value];
      setConfig((prev) => ({ ...prev, mcpServers: newMcp }));
    } else if (key === "platform") {
      setConfig((prev) => {
        const next = { ...prev, platform: value };
        if (prev.platform === value) return next;
        const wasBridge = isBridgeCliPlatform(prev.platform);
        const nowBridge = isBridgeCliPlatform(value);
        if (nowBridge && !wasBridge) {
          next.llm = "__cli_default__";
          next.cliExecutablePath = "";
        } else if (!nowBridge && wasBridge) {
          next.llm = "";
          next.cliExecutablePath = "";
        } else if (nowBridge && wasBridge) {
          next.cliExecutablePath = "";
          next.llm = "__cli_default__";
        }
        return next;
      });
    } else {
      setConfig((prev) => ({ ...prev, [key]: value }));
    }
  };

  const [bridgeRefreshTick, setBridgeRefreshTick] = useState(0);

  useEffect(() => {
    if (!isBridgeCliPlatform(config.platform)) {
      setBridgeModels([]);
      setBridgeModelsError(null);
      setBridgeModelsNote(null);
      setBridgeModelsLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setBridgeModelsLoading(true);
      setBridgeModelsError(null);
      setBridgeModelsNote(null);
      const ws = (targetWorkspace || "").trim();
      const base = (agentBridgeBaseUrl || "").trim();
      const bin = (config.cliExecutablePath || "").trim();
      try {
        const data =
          config.platform === "cursor_cli"
            ? await fetchCursorModels({
                baseUrl: base,
                workspaceRoot: ws,
                agentBin: bin,
              })
            : await fetchKiroModels({
                baseUrl: base,
                workspaceRoot: ws,
                kiroBin: bin,
              });
        if (cancelled) return;
        if (data.ok && Array.isArray(data.models)) {
          setBridgeModels(data.models);
          setBridgeModelsError(null);
          setBridgeModelsNote(
            typeof data.note === "string" && data.note.trim() ? data.note.trim() : null
          );
        } else if (isBridgeEmptyModelsCliSuccessFallback(data)) {
          setBridgeModels([]);
          setBridgeModelsError(null);
          setBridgeModelsNote(
            (typeof data.stdoutPreview === "string" && data.stdoutPreview.trim()) ||
              "No models are listed for this account. You can still use the CLI default model."
          );
        } else {
          setBridgeModels([]);
          setBridgeModelsNote(null);
          setBridgeModelsError(data.error || "Could not load models from bridge");
        }
      } catch (e) {
        if (!cancelled) {
          setBridgeModels([]);
          setBridgeModelsNote(null);
          setBridgeModelsError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setBridgeModelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    config.platform,
    config.cliExecutablePath,
    targetWorkspace,
    agentBridgeBaseUrl,
    bridgeRefreshTick,
  ]);

  /** Wizard Step 1 collects workspace; dashboard config may omit it (bridge uses server default). */
  const bridgeNeedsWorkspace =
    isBridgeCliPlatform(config.platform) &&
    !(targetWorkspace || "").trim() &&
    !hideStepBadge;

  const isValid =
    config.platform &&
    config.llm &&
    config.cloudDeployment &&
    config.mcpServers.length > 0 &&
    !bridgeNeedsWorkspace;

  const isDirty = useMemo(() => {
    const cmp = (a, b) => a.localeCompare(b);
    const mcpChanged = !deepEqual(
      [...(savedConfig.mcpServers || [])].sort(cmp),
      [...config.mcpServers].sort(cmp)
    );
    return (
      savedConfig.platform !== config.platform ||
      savedConfig.llm !== config.llm ||
      savedConfig.cloudDeployment !== config.cloudDeployment ||
      (savedConfig.cliExecutablePath || "") !== (config.cliExecutablePath || "") ||
      mcpChanged
    );
  }, [savedConfig, config]);

  const showPlatform = !focusSection || focusSection === "platform";
  const showLlm = !focusSection || focusSection === "llm";
  const showCloud = !focusSection || focusSection === "cloud";
  const showMcp = !focusSection || focusSection === "mcp";

  const handleReadEnv = async () => {
    if (!targetWorkspace) {
      setMcpEnvStatus({ ok: false, error: "Target workspace not set. Configure it in the project setup." });
      return;
    }
    setMcpEnvLoading(true);
    setMcpEnvStatus(null);
    setMcpConfigResult(null);
    try {
      const result = await readWorkspaceEnvForMcp({ baseUrl: agentBridgeBaseUrl, workspaceRoot: targetWorkspace });
      setMcpEnvStatus(result);
    } catch (e) {
      setMcpEnvStatus({ ok: false, error: e.message });
    } finally {
      setMcpEnvLoading(false);
    }
  };

  const handleConfigureMcp = async () => {
    if (!targetWorkspace) return;
    setMcpConfiguring(true);
    setMcpConfigResult(null);
    setMcpInstallStatus(null);
    const servers = config.mcpServers.length > 0 ? config.mcpServers : ["jira", "github"];
    try {
      setMcpConfigResult({
        ok: null,
        message: "Installing MCP packages into workspace bundle and writing mcp.json…",
      });
      const result = await configureMcpFromEnv({
        baseUrl: agentBridgeBaseUrl,
        workspaceRoot: targetWorkspace,
        servers,
      });
      setMcpConfigResult(result);
      setMcpInstallStatus(result.installStatus || null);
    } catch (e) {
      setMcpConfigResult({ ok: false, error: e.message });
    } finally {
      setMcpConfiguring(false);
    }
  };

  const handleSaveClick = () => {
    if (!isValid) return;
    if (hideStepBadge && isDirty) {
      setShowConfirm(true);
    } else {
      commitSave();
    }
  };

  const commitSave = () => {
    actions.setIdeConfig(config);
    if (hideStepBadge) {
      actions.closeDashboardConfig();
    }
    setShowConfirm(false);
  };

  return (
    <div className="step-ide-config animate-fade-in">
      {/* Header */}
      <div className="ide-config-header">
        <div className="ide-config-header-left">
          {!hideStepBadge && <div className="step-section-num">Step {stepNum}</div>}
          <div>
            <h2 className="step-section-title">IDE & Intelligence</h2>
            <p className="step-section-desc">
              Select your execution platform, LLM engine, cloud deployment, and MCP servers.
            </p>
          </div>
        </div>
        <div className="ide-header-actions">
          {hideStepBadge && (
            <button
              type="button"
              className="btn-ide-cancel"
              onClick={() => actions.closeDashboardConfig()}
            >
              Cancel
            </button>
          )}
          <button
            className={`btn-ide-save ${isValid ? "" : "disabled"} ${isDirty ? "dirty" : ""}`}
            disabled={!isValid}
            onClick={handleSaveClick}
          >
            {hideStepBadge ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Save Changes
              </>
            ) : (
              <>
                Review & Launch
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 10L9 7 5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Dirty warning banner */}
      {hideStepBadge && isDirty && (
        <div className="ide-dirty-banner">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5L14.5 13H1.5L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8 6v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.75" fill="currentColor" />
          </svg>
          <span>
            <strong>Unsaved changes detected.</strong> Updating your configuration will regenerate
            the agent pipeline — any running progress will be reset.
          </span>
        </div>
      )}

      {/* Validation hint — show which fields are still missing */}
      {!isValid && (
        <div className="ide-validation-row">
          {!config.platform && <span className="ide-validation-chip">Platform required</span>}
          {config.platform && bridgeNeedsWorkspace && (
            <span className="ide-validation-chip">Target workspace required (Step 1)</span>
          )}
          {config.platform && !bridgeNeedsWorkspace && !config.llm && (
            <span className="ide-validation-chip">LLM required</span>
          )}
          {config.llm && !config.cloudDeployment && <span className="ide-validation-chip">Cloud deployment required</span>}
          {config.cloudDeployment && config.mcpServers.length === 0 && (
            <span className="ide-validation-chip">Select at least 1 MCP server</span>
          )}
        </div>
      )}

      {config.platform && isBridgeCliPlatform(config.platform) && (
        <div className="ide-cli-path-panel">
          <div className="ide-cli-path-header">
            <span className="ide-cli-path-title">
              {config.platform === "cursor_cli" ? "Cursor Agent CLI" : "Kiro CLI"}
            </span>
            <span className="ide-cli-path-badge">cursor-agent-bridge</span>
          </div>
          <p className="ide-cli-path-desc">
            Connects to <code>cursor-agent-bridge</code> for model lists and runs. Leave the bridge URL empty
            to use this app’s <code>/api</code> proxy (Vite → <code>http://127.0.0.1:3847</code>). Model calls
            use your <strong>target workspace</strong> from Step 1.
          </p>
          <label className="ide-cli-path-label" htmlFor="ide-agent-bridge-url-input">
            Agent bridge base URL (optional)
          </label>
          <input
            id="ide-agent-bridge-url-input"
            type="text"
            className="ide-cli-path-input ide-cli-path-input-spaced"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. http://127.0.0.1:3847 — leave empty for same-origin /api proxy"
            value={agentBridgeBaseUrl}
            onChange={(e) =>
              actions.setAgentBridgeContext({ agentBridgeBaseUrl: e.target.value })
            }
          />
          <label className="ide-cli-path-label" htmlFor="ide-cli-executable-input">
            {config.platform === "cursor_cli"
              ? "Cursor Agent executable (agent / cursor-agent.cmd)"
              : "Kiro executable (kiro / kiro.exe)"}
          </label>
          <input
            id="ide-cli-executable-input"
            type="text"
            className="ide-cli-path-input"
            autoComplete="off"
            spellCheck={false}
            placeholder={
              config.platform === "cursor_cli"
                ? "e.g. C:/Users/you/AppData/Local/cursor-agent/cursor-agent.cmd"
                : "e.g. C:/Program Files/Kiro/kiro.exe"
            }
            value={config.cliExecutablePath}
            onChange={(e) => updateConfig("cliExecutablePath", e.target.value)}
          />
        </div>
      )}

      {/* Four-column config grid */}
      <div className="ide-config-grid">
        {/* Platform */}
        {showPlatform && (
          <div className="ide-config-col">
            <div className="ide-col-header">
              <span className="ide-col-icon">🖥️</span>
              <h3 className="ide-col-title">Execution Platform</h3>
              {config.platform && <span className="ide-col-check">✓</span>}
            </div>
            <div className="ide-option-list">
              {IDE_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`ide-option ${config.platform === p.id ? "selected" : ""}`}
                  onClick={() => updateConfig("platform", p.id)}
                >
                  <span className="ide-option-icon">{p.icon}</span>
                  <span className="ide-option-label">{p.label}</span>
                  {config.platform === p.id && <span className="ide-option-tick">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* LLM */}
        {showLlm && (
          <div className={`ide-config-col ${config.platform ? "" : "locked"}`}>
            <div className="ide-col-header">
              <span className="ide-col-icon">🧠</span>
              <h3 className="ide-col-title">LLM Engine</h3>
              {config.llm && <span className="ide-col-check">✓</span>}
              {config.platform ? null : <span className="ide-col-lock">Select platform first</span>}
            </div>
            <div className="ide-option-list">
              {isBridgeCliPlatform(config.platform) ? (
                <>
                  {bridgeModelsLoading && (
                    <p className="ide-bridge-status">Loading models from bridge…</p>
                  )}
                  {bridgeModelsError && !bridgeModelsLoading && (
                    <p className="ide-bridge-error">{bridgeModelsError}</p>
                  )}
                  {bridgeModelsNote && !bridgeModelsLoading && !bridgeModelsError && (
                    <p className="ide-bridge-note">{bridgeModelsNote}</p>
                  )}
                  <button
                    type="button"
                    disabled={!config.platform || bridgeNeedsWorkspace}
                    className={`ide-option ${config.llm === "__cli_default__" ? "selected" : ""}`}
                    onClick={() => updateConfig("llm", "__cli_default__")}
                  >
                    <div className="ide-option-text">
                      <span className="ide-option-label">CLI default model</span>
                      <span className="ide-option-sub">Let the CLI pick the model</span>
                    </div>
                    {config.llm === "__cli_default__" && <span className="ide-option-tick">✓</span>}
                  </button>
                  {bridgeModels.map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={!config.platform || bridgeNeedsWorkspace}
                      className={`ide-option ${config.llm === m ? "selected" : ""}`}
                      onClick={() => updateConfig("llm", m)}
                    >
                      <div className="ide-option-text">
                        <span className="ide-option-label">{m}</span>
                        <span className="ide-option-sub">From CLI account</span>
                      </div>
                      {config.llm === m && <span className="ide-option-tick">✓</span>}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="ide-bridge-reload"
                    disabled={bridgeModelsLoading || bridgeNeedsWorkspace}
                    onClick={() => setBridgeRefreshTick((t) => t + 1)}
                  >
                    Reload models
                  </button>
                </>
              ) : (
                LLM_OPTIONS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    disabled={!config.platform}
                    className={`ide-option ${config.llm === l.id ? "selected" : ""}`}
                    onClick={() => updateConfig("llm", l.id)}
                  >
                    <div className="ide-option-text">
                      <span className="ide-option-label">{l.label}</span>
                      <span className="ide-option-sub">{l.provider}</span>
                    </div>
                    {config.llm === l.id && <span className="ide-option-tick">✓</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Cloud */}
        {showCloud && (
          <div className={`ide-config-col ${config.llm ? "" : "locked"}`}>
            <div className="ide-col-header">
              <span className="ide-col-icon">☁️</span>
              <h3 className="ide-col-title">Cloud Deployment</h3>
              {config.cloudDeployment && <span className="ide-col-check">✓</span>}
              {config.llm ? null : <span className="ide-col-lock">Select LLM first</span>}
            </div>
            <div className="ide-option-list">
              {CLOUD_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={!config.llm}
                  className={`ide-option ${config.cloudDeployment === c.id ? "selected" : ""}`}
                  onClick={() => updateConfig("cloudDeployment", c.id)}
                >
                  <span className="ide-option-icon">{c.icon}</span>
                  <span className="ide-option-label">{c.label}</span>
                  {config.cloudDeployment === c.id && <span className="ide-option-tick">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MCP */}
        {showMcp && (
          <div className={`ide-config-col ${config.cloudDeployment ? "" : "locked"}`}>
            <div className="ide-col-header">
              <span className="ide-col-icon">🔌</span>
              <h3 className="ide-col-title">MCP Servers</h3>
              {config.mcpServers.length > 0 && (
                <span className="ide-col-badge">{config.mcpServers.length} selected</span>
              )}
              {config.cloudDeployment ? null : <span className="ide-col-lock">Select cloud first</span>}
            </div>
            <div className="ide-option-list">
              {MCP_OPTIONS.map((m) => {
                const checked = config.mcpServers.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!config.cloudDeployment}
                    className={`ide-option multi ${checked ? "selected" : ""}`}
                    onClick={() => updateConfig("mcpServers", m.id)}
                  >
                    <span className="ide-option-icon">{m.icon}</span>
                    <span className="ide-option-label">{m.label}</span>
                    <span className={`ide-option-checkbox ${checked ? "checked" : ""}`}>
                      {checked && "✓"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* MCP Connect — reads .env from workspace and writes mcp.json */}
            {config.mcpServers.length > 0 && config.cloudDeployment && (
              <div className="mcp-connect-panel">
                <div className="mcp-connect-header">
                  <span className="mcp-connect-title">Connect via workspace .env</span>
                  <span className="mcp-connect-hint">
                    Reads credentials from <code>{targetWorkspace || "<workspace>"}/.env</code>
                  </span>
                </div>

                {/* Step 1: Read .env */}
                {!mcpEnvStatus && (
                  <button
                    type="button"
                    className="btn-mcp-action"
                    onClick={handleReadEnv}
                    disabled={mcpEnvLoading || !targetWorkspace}
                  >
                    {mcpEnvLoading ? "Reading .env…" : "🔍 Check .env credentials"}
                  </button>
                )}

                {/* .env read result */}
                {mcpEnvStatus && (
                  <div className={`mcp-env-result ${mcpEnvStatus.ok ? "ok" : "error"}`}>
                    {mcpEnvStatus.ok ? (
                      <>
                        <p className="mcp-env-found-title">✓ Credentials found:</p>
                        {Object.entries(mcpEnvStatus.found || {}).map(([service, keys]) => (
                          <div key={service} className="mcp-env-service">
                            <span className="mcp-env-service-name">
                              {service === "jira" ? "📋 Jira" : service === "github" ? "🐙 GitHub" : service}
                            </span>
                            <div className="mcp-env-keys">
                              {Object.entries(keys).map(([k, v]) => (
                                <span key={k} className="mcp-env-key">
                                  <code>{k}</code>: <code className="mcp-env-val">{v}</code>
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                        {Object.keys(mcpEnvStatus.found || {}).length === 0 && (
                          <p className="mcp-env-missing">No MCP credentials found in .env</p>
                        )}
                      </>
                    ) : (
                      <p className="mcp-env-error">✕ {mcpEnvStatus.error}</p>
                    )}

                    <div className="mcp-connect-actions">
                      <button
                        type="button"
                        className="btn-mcp-secondary"
                        onClick={() => { setMcpEnvStatus(null); setMcpConfigResult(null); }}
                      >
                        Re-check
                      </button>
                      {mcpEnvStatus.ok && Object.keys(mcpEnvStatus.found || {}).length > 0 && (
                        <button
                          type="button"
                          className="btn-mcp-action"
                          onClick={handleConfigureMcp}
                          disabled={mcpConfiguring}
                        >
                          {mcpConfiguring ? "Configuring…" : "⚡ Write mcp.json"}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Configure result */}
                {mcpConfigResult && (
                  <div className={`mcp-config-result ${mcpConfigResult.ok === true ? "ok" : mcpConfigResult.ok === false ? "error" : "pending"}`}>
                    {mcpConfigResult.ok === null ? (
                      <p>⏳ {mcpConfigResult.message}</p>
                    ) : mcpConfigResult.ok ? (
                      <>
                        {mcpInstallStatus && (
                          <div className="mcp-install-status">
                            {typeof mcpInstallStatus === "object" && !Array.isArray(mcpInstallStatus)
                              ? Object.entries(mcpInstallStatus).map(([srv, st]) => (
                                  <p key={srv}>✓ {srv}: ready ({String(st)})</p>
                                ))
                              : null}
                          </div>
                        )}
                        <p>✓ {mcpConfigResult.message}</p>
                        <code className="mcp-config-path">{mcpConfigResult.mcpJsonPath}</code>
                        {mcpConfigResult.bundlesDir && (
                          <p className="mcp-bundle-hint">
                            Local packages: <code>{mcpConfigResult.bundlesDir}</code>
                          </p>
                        )}
                      </>
                    ) : (
                      <p>✕ {mcpConfigResult.error}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div
          className="ide-confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ide-confirm-title"
          onClick={() => setShowConfirm(false)}
          onKeyDown={(e) => e.key === "Escape" && setShowConfirm(false)}
        >
          <div className="ide-confirm-modal" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <div className="ide-confirm-icon">⚠️</div>
            <h3 id="ide-confirm-title" className="ide-confirm-title">Apply configuration changes?</h3>
            <p className="ide-confirm-desc">
              The following changes will be applied. This will regenerate the agent
              pipeline and reset any running progress.
            </p>
            <ChangeSummary saved={savedConfig} next={config} />
            <div className="ide-confirm-actions">
              <button
                type="button"
                className="btn-ide-modal-cancel"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-ide-modal-confirm"
                onClick={commitSave}
              >
                Yes, Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
