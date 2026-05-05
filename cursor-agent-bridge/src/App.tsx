import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from './apiUrl';

const AGENT_BIN_LS_KEY = 'cursor-agent-bridge.userAgentBin';
const KIRO_BIN_LS_KEY = 'cursor-agent-bridge.userKiroBin';
const CLI_BACKEND_LS_KEY = 'cursor-agent-bridge.cliBackend';

type CliBackend = 'cursor' | 'kiro';

/** Sentinel: no `.kiro/agents` entry — send only `userMessage` as the CLI prompt. */
const USER_PROMPT_ONLY_AGENT = '__user_prompt_only__';

const fetchTimeout = (ms: number) =>
  typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? { signal: AbortSignal.timeout(ms) }
    : {};

function normalizeApiPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/** Cursor CLI JSON line often has `result` as the human-readable answer. */
function parsedJsonResultText(parsed: unknown): string | null {
  if (parsed == null || typeof parsed !== 'object') return null;
  const r = (parsed as Record<string, unknown>).result;
  if (typeof r === 'string') return r;
  return null;
}

async function readApiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const normalizedPath = normalizeApiPath(path);
  const primaryUrl = apiUrl(normalizedPath);
  const tried = [primaryUrl];

  const parse = (status: number, text: string): (T & { error?: string }) => {
    if (!text.trim()) {
      throw new Error(
        `Empty response (${status}) from ${normalizedPath}. Start the bridge server in cursor-agent-bridge with npm run dev (server + Vite together).`
      );
    }
    try {
      return JSON.parse(text) as T & { error?: string };
    } catch {
      throw new Error(`Invalid JSON (${status}): ${text.slice(0, 240)}`);
    }
  };

  try {
    const r = await fetch(primaryUrl, init);
    const text = await r.text();
    try {
      const data = parse(r.status, text);
      if (!r.ok) throw new Error(data.error || `${r.status} ${r.statusText}`);
      return data as T;
    } catch (err) {
      // If `VITE_API_URL` points to the wrong place, retry via Vite same-origin `/api/*` proxy.
      if (primaryUrl !== normalizedPath) {
        tried.push(normalizedPath);
        const fallback = await fetch(normalizedPath, init);
        const fallbackText = await fallback.text();
        const fallbackData = parse(fallback.status, fallbackText);
        if (!fallback.ok) throw new Error(fallbackData.error || `${fallback.status} ${fallback.statusText}`);
        return fallbackData as T;
      }
      throw err;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${msg} (tried: ${tried.join(' -> ')})`);
  }
}

type AgentSummary = {
  id: string;
  name: string;
  description: string;
  welcomeMessage: string;
  resources: string[];
};

type CursorHealth = {
  agentCatalogRoot: string;
  workspaceRoot?: string;
  defaultRunWorkspace?: string;
  envTargetWorkspace?: string | null;
  agentBin: string;
  agentBinUsedFrom?: 'request' | 'server';
  serverDefaultAgentBin?: string;
  agentBinResolution?: string;
  agentsNote?: string;
  agentCli: { ok: boolean; version?: string; error?: string; hint?: Record<string, string> };
};

type KiroHealth = {
  agentCatalogRoot: string;
  workspaceRoot?: string;
  defaultRunWorkspace?: string;
  envTargetWorkspace?: string | null;
  kiroBin: string;
  kiroBinUsedFrom?: 'request' | 'server';
  serverDefaultKiroBin?: string;
  kiroBinResolution?: string;
  agentsNote?: string;
  kiroCli: { ok: boolean; version?: string; error?: string; hint?: Record<string, string> };
};

type BridgeHealth = CursorHealth | KiroHealth;

function isKiroHealth(h: BridgeHealth): h is KiroHealth {
  return 'kiroCli' in h;
}

type RunResponse = {
  agentName: string;
  userPromptOnly?: boolean;
  workspaceRoot: string;
  agentCatalogRoot?: string;
  agentCliUsed?: string;
  kiroCliUsed?: string;
  backend?: string;
  outputFormat: string;
  model?: string | null;
  executionMode?: string | null;
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  spawnError?: string;
  hint?: Record<string, string>;
  parsedJson: unknown;
  error?: string;
};

export default function App() {
  const [cliBackend, setCliBackend] = useState<CliBackend>(() => {
    try {
      const v = localStorage.getItem(CLI_BACKEND_LS_KEY);
      if (v === 'kiro' || v === 'cursor') return v;
    } catch {
      /* private mode */
    }
    return 'cursor';
  });
  const persistCliBackend = (v: CliBackend) => {
    setCliBackend(v);
    try {
      localStorage.setItem(CLI_BACKEND_LS_KEY, v);
    } catch {
      /* private mode */
    }
  };

  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  /** Folder for `agent --workspace` (where the agent edits files). */
  const [targetWorkspace, setTargetWorkspace] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [outputFormat, setOutputFormat] = useState<'json' | 'text' | 'stream-json'>('json');
  const [loadingList, setLoadingList] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [llmModels, setLlmModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [agentModes, setAgentModes] = useState<string[]>(['agent']);
  const [agentModesLoading, setAgentModesLoading] = useState(false);
  const [agentModesError, setAgentModesError] = useState<string | null>(null);
  const [agentModesNote, setAgentModesNote] = useState<string | null>(null);
  const [selectedAgentMode, setSelectedAgentMode] = useState('agent');
  const [agentUserPath, setAgentUserPath] = useState(() => {
    try {
      return localStorage.getItem(AGENT_BIN_LS_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [kiroUserPath, setKiroUserPath] = useState(() => {
    try {
      return localStorage.getItem(KIRO_BIN_LS_KEY) ?? '';
    } catch {
      return '';
    }
  });

  const persistAgentPath = (v: string) => {
    setAgentUserPath(v);
    try {
      if (v.trim()) localStorage.setItem(AGENT_BIN_LS_KEY, v);
      else localStorage.removeItem(AGENT_BIN_LS_KEY);
    } catch {
      /* private mode */
    }
  };

  const persistKiroPath = (v: string) => {
    setKiroUserPath(v);
    try {
      if (v.trim()) localStorage.setItem(KIRO_BIN_LS_KEY, v);
      else localStorage.removeItem(KIRO_BIN_LS_KEY);
    } catch {
      /* private mode */
    }
  };

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      await readApiJson<{ ok: boolean }>('/api/ping', { ...fetchTimeout(8000) });
      if (cliBackend === 'cursor') {
        const hq = new URLSearchParams();
        if (agentUserPath.trim()) hq.set('agentBin', agentUserPath.trim());
        const healthPath = hq.toString() ? `/api/health?${hq}` : '/api/health';
        const data = await readApiJson<CursorHealth>(healthPath, { ...fetchTimeout(45000) });
        setHealth(data);
        setTargetWorkspace((prev) => {
          if (prev.trim()) return prev;
          if (data.envTargetWorkspace?.trim()) return data.envTargetWorkspace.trim();
          return '';
        });
      } else {
        const hq = new URLSearchParams();
        if (kiroUserPath.trim()) hq.set('kiroBin', kiroUserPath.trim());
        const healthPath = hq.toString() ? `/api/kiro/health?${hq}` : '/api/kiro/health';
        const data = await readApiJson<KiroHealth>(healthPath, { ...fetchTimeout(45000) });
        setHealth(data);
        setTargetWorkspace((prev) => {
          if (prev.trim()) return prev;
          if (data.envTargetWorkspace?.trim()) return data.envTargetWorkspace.trim();
          return '';
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setHealthError(msg);
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, [agentUserPath, kiroUserPath, cliBackend]);

  const refreshAgents = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const data = await readApiJson<{ agents?: AgentSummary[]; agentCatalogRoot?: string }>(
        '/api/agents',
        { ...fetchTimeout(30000) }
      );
      setAgents(data.agents ?? []);
      setSelectedAgent((prev) => {
        if (prev === USER_PROMPT_ONLY_AGENT) return prev;
        if (prev && (data.agents ?? []).some((a: AgentSummary) => a.name === prev)) return prev;
        return data.agents?.[0]?.name ?? USER_PROMPT_ONLY_AGENT;
      });
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingList(false);
    }
  }, []);

  const refreshModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const qs = new URLSearchParams();
      const wr = targetWorkspace.trim();
      if (wr) qs.set('workspaceRoot', wr);
      if (cliBackend === 'cursor') {
        if (agentUserPath.trim()) qs.set('agentBin', agentUserPath.trim());
      } else if (kiroUserPath.trim()) {
        qs.set('kiroBin', kiroUserPath.trim());
      }
      const suffix = qs.toString() ? `?${qs}` : '';
      const path = cliBackend === 'cursor' ? '/api/models' : '/api/kiro/models';
      const data = await readApiJson<{
        ok: boolean;
        models: string[];
        error?: string;
        stderr?: string;
        exitCode?: number | null;
        stdoutPreview?: string;
        note?: string;
      }>(`${path}${suffix}`, { ...fetchTimeout(120000) });
      if (!data.ok) {
        const blob = `${data.stderr ?? ''}\n${data.stdoutPreview ?? ''}`.toLowerCase();
        if (
          data.exitCode === 0 &&
          (blob.includes('no models available') || blob.includes('no models for this account'))
        ) {
          setLlmModels([]);
          setModelsError(null);
        } else {
          setModelsError(data.error || data.stderr || 'Model list unavailable');
          setLlmModels([]);
        }
      } else {
        setLlmModels(data.models ?? []);
      }
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : String(e));
      setLlmModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, [targetWorkspace, agentUserPath, kiroUserPath, cliBackend]);

  const refreshAgentModes = useCallback(async () => {
    setAgentModesLoading(true);
    setAgentModesError(null);
    setAgentModesNote(null);
    try {
      const qs = new URLSearchParams();
      const wr = targetWorkspace.trim();
      if (wr) qs.set('workspaceRoot', wr);
      if (cliBackend === 'cursor') {
        if (agentUserPath.trim()) qs.set('agentBin', agentUserPath.trim());
      } else if (kiroUserPath.trim()) {
        qs.set('kiroBin', kiroUserPath.trim());
      }
      const suffix = qs.toString() ? `?${qs}` : '';
      const path = cliBackend === 'cursor' ? '/api/agent-modes' : '/api/kiro/agent-modes';
      const data = await readApiJson<{
        ok: boolean;
        modes: string[];
        error?: string;
        stderr?: string;
        note?: string;
      }>(`${path}${suffix}`, { ...fetchTimeout(30000) });
      if (!data.ok) {
        setAgentModesNote(null);
        setAgentModesError(data.error || data.stderr || 'Could not load execution modes from CLI');
        setAgentModes(['agent']);
        setSelectedAgentMode('agent');
      } else {
        if (typeof data.note === 'string' && data.note.trim()) {
          setAgentModesNote(data.note.trim());
        } else {
          setAgentModesNote(null);
        }
        const list = data.modes?.length ? data.modes : ['agent'];
        setAgentModes(list);
        setSelectedAgentMode((prev) => (list.includes(prev) ? prev : list[0]));
      }
    } catch (e) {
      setAgentModesError(e instanceof Error ? e.message : String(e));
      setAgentModes(['agent']);
      setSelectedAgentMode('agent');
    } finally {
      setAgentModesLoading(false);
    }
  }, [targetWorkspace, agentUserPath, kiroUserPath, cliBackend]);

  useEffect(() => {
    refreshHealth();
    refreshAgents();
  }, [refreshHealth, refreshAgents]);

  useEffect(() => {
    if (healthLoading || healthError) return;
    void refreshModels();
  }, [cliBackend, healthLoading, healthError, refreshModels]);

  useEffect(() => {
    if (healthLoading || healthError) return;
    void refreshAgentModes();
  }, [cliBackend, healthLoading, healthError, refreshAgentModes]);

  const runAgent = async () => {
    if (!selectedAgent) return;
    if (selectedAgent === USER_PROMPT_ONLY_AGENT && !userMessage.trim()) return;
    setRunning(true);
    setRunResult(null);
    try {
      const runPath = cliBackend === 'cursor' ? '/api/run' : '/api/kiro/run';
      const body =
        cliBackend === 'cursor'
          ? {
              agentName: selectedAgent,
              userMessage,
              outputFormat,
              workspaceRoot: targetWorkspace.trim() || undefined,
              model: selectedModel.trim() || undefined,
              executionMode: selectedAgentMode || undefined,
              agentBin: agentUserPath.trim() || undefined,
            }
          : {
              agentName: selectedAgent,
              userMessage,
              outputFormat,
              workspaceRoot: targetWorkspace.trim() || undefined,
              model: selectedModel.trim() || undefined,
              executionMode: selectedAgentMode || undefined,
              kiroBin: kiroUserPath.trim() || undefined,
            };
      const data = await readApiJson<RunResponse>(runPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        ...fetchTimeout(600000),
      });
      setRunResult(data);
    } catch (e) {
      setRunResult({
        agentName: selectedAgent,
        userPromptOnly: selectedAgent === USER_PROMPT_ONLY_AGENT,
        workspaceRoot: targetWorkspace,
        outputFormat,
        ok: false,
        exitCode: null,
        stdout: '',
        stderr: e instanceof Error ? e.message : String(e),
        parsedJson: null,
      });
    } finally {
      setRunning(false);
    }
  };

  const selected = agents.find((a) => a.name === selectedAgent);
  const isUserPromptOnly = selectedAgent === USER_PROMPT_ONLY_AGENT;
  const activeCliHint = health
    ? isKiroHealth(health)
      ? health.kiroCli.hint
      : health.agentCli.hint
    : undefined;
  const activeCliOk = health
    ? isKiroHealth(health)
      ? health.kiroCli.ok
      : health.agentCli.ok
    : false;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.25rem' }}>
      <h1 style={{ fontSize: '1.35rem', fontWeight: 600, marginBottom: '0.25rem' }}>
        Kiro agents → Cursor or Kiro CLI
      </h1>
      <p style={{ marginTop: 0, color: '#a8a8b8', fontSize: '0.95rem' }}>
        Agent <strong>definitions</strong> always load from this bridge repo&apos;s{' '}
        <code>.kiro/agents</code>. The <strong>target</strong> path is the CLI working directory (where
        tools may create or edit files).
      </p>

      <div
        style={{
          marginBottom: '1rem',
          padding: '0.65rem 0.85rem',
          background: '#1a1a24',
          border: '1px solid #2a2a3a',
          borderRadius: 8,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.65rem',
        }}
      >
        <label style={{ fontSize: '0.9rem', fontWeight: 600, marginRight: '0.25rem' }}>
          CLI backend
        </label>
        <select
          value={cliBackend}
          onChange={(e) => persistCliBackend(e.target.value as CliBackend)}
          style={{
            padding: '0.45rem 0.65rem',
            borderRadius: 6,
            border: '1px solid #3a3a4a',
            background: '#12121a',
            color: '#eee',
            minWidth: 200,
          }}
        >
          <option value="cursor">Cursor Agent (`agent`)</option>
          <option value="kiro">Kiro CLI (`kiro`)</option>
        </select>
        <span style={{ fontSize: '0.82rem', color: '#a8a8b8' }}>
          Health, models, modes, and Run use the matching bridge API (
          <code>/api/…</code> vs <code>/api/kiro/…</code>).
        </span>
      </div>

      <section
        style={{
          background: '#1a1a24',
          border: '1px solid #2a2a3a',
          borderRadius: 8,
          padding: '1rem',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Environment</h2>
        {healthLoading && <p style={{ marginTop: 0 }}>Loading health…</p>}
        {healthError && (
          <p style={{ color: '#ffb4a8', marginTop: 0, whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
            {healthError}
          </p>
        )}
        {health && !healthLoading && (
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
            <li>
              Agent prompts (catalog): <code>{health.agentCatalogRoot ?? health.workspaceRoot}</code>
            </li>
            <li style={{ color: '#a8a8b8' }}>
              Default target if you leave the field empty:{' '}
              <code>{health.defaultRunWorkspace ?? '—'}</code>
              {health.envTargetWorkspace ? (
                <span> (from env TARGET_WORKSPACE)</span>
              ) : (
                <span> (or set TARGET_WORKSPACE on the server)</span>
              )}
            </li>
            {isKiroHealth(health) ? (
              <>
                <li>
                  Kiro binary (effective): <code>{health.kiroBin}</code>
                  {health.kiroBinUsedFrom === 'request' && (
                    <span style={{ color: '#98d8a0' }}> (from field below)</span>
                  )}
                  {health.kiroBinUsedFrom === 'server' && health.serverDefaultKiroBin && (
                    <span style={{ color: '#a8a8b8' }}>
                      {' '}
                      (server default: <code>{health.serverDefaultKiroBin}</code>
                      {health.kiroBinResolution ? ` — ${health.kiroBinResolution}` : ''})
                    </span>
                  )}
                </li>
                {health.agentsNote && (
                  <li style={{ color: '#a8a8b8' }}>{health.agentsNote}</li>
                )}
                <li>
                  Kiro CLI probe:{' '}
                  {health.kiroCli.ok ? (
                    <span style={{ color: '#98d8a0' }}>OK — {health.kiroCli.version}</span>
                  ) : (
                    <span style={{ color: '#ffb4a8' }}>Not working — {health.kiroCli.error}</span>
                  )}
                </li>
              </>
            ) : (
              <>
                <li>
                  Cursor Agent binary (effective): <code>{health.agentBin}</code>
                  {health.agentBinUsedFrom === 'request' && (
                    <span style={{ color: '#98d8a0' }}> (from field below)</span>
                  )}
                  {health.agentBinUsedFrom === 'server' && health.serverDefaultAgentBin && (
                    <span style={{ color: '#a8a8b8' }}>
                      {' '}
                      (server default: <code>{health.serverDefaultAgentBin}</code>
                      {health.agentBinResolution ? ` — ${health.agentBinResolution}` : ''})
                    </span>
                  )}
                </li>
                {health.agentsNote && (
                  <li style={{ color: '#a8a8b8' }}>{health.agentsNote}</li>
                )}
                <li>
                  Cursor Agent CLI probe:{' '}
                  {health.agentCli.ok ? (
                    <span style={{ color: '#98d8a0' }}>OK — {health.agentCli.version}</span>
                  ) : (
                    <span style={{ color: '#ffb4a8' }}>Not working — {health.agentCli.error}</span>
                  )}
                </li>
              </>
            )}
          </ul>
        )}
        {health && !activeCliOk && activeCliHint && (
          <p style={{ fontSize: '0.88rem', color: '#c9c9d8' }}>
            {activeCliHint.windows && <span>{activeCliHint.windows} </span>}
            {activeCliHint.env && <span>{activeCliHint.env}</span>}
          </p>
        )}
        <p style={{ fontSize: '0.85rem', marginBottom: 0 }}>
          Docs:{' '}
          <a href="https://cursor.com/docs/cli/installation" target="_blank" rel="noreferrer">
            Cursor CLI installation
          </a>
          {cliBackend === 'kiro' && (
            <>
              {' · '}
              <a href="https://kiro.dev" target="_blank" rel="noreferrer">
                Kiro CLI
              </a>
            </>
          )}
        </p>
      </section>

      <section
        style={{
          background: '#1a1a24',
          border: '1px solid #2a2a3a',
          borderRadius: 8,
          padding: '1rem',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.75rem' }}>Run</h2>
        {cliBackend === 'cursor' ? (
          <>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
              Cursor Agent executable (optional)
            </label>
            <p style={{ marginTop: 0, marginBottom: '0.35rem', fontSize: '0.82rem', color: '#a8a8b8' }}>
              Full path to <code>agent</code> / <code>cursor-agent.cmd</code> on this machine. Saved in the
              browser only; sent to your local bridge. Leave empty to use the server default (env /{' '}
              <code>agent.config.json</code>).
            </p>
            <input
              value={agentUserPath}
              onChange={(e) => persistAgentPath(e.target.value)}
              placeholder="e.g. C:/Users/you/AppData/Local/cursor-agent/cursor-agent.cmd"
              style={{
                width: '100%',
                marginBottom: '0.75rem',
                padding: '0.5rem',
                borderRadius: 6,
                border: '1px solid #3a3a4a',
                background: '#12121a',
                color: '#eee',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.85rem',
              }}
            />
          </>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
              Kiro CLI executable (optional)
            </label>
            <p style={{ marginTop: 0, marginBottom: '0.35rem', fontSize: '0.82rem', color: '#a8a8b8' }}>
              Full path to <code>kiro</code> if it is not on PATH. Saved in the browser only; sent as{' '}
              <code>kiroBin</code> to the bridge. Leave empty for server default (env /{' '}
              <code>kiro-agent.config.json</code>).
            </p>
            <input
              value={kiroUserPath}
              onChange={(e) => persistKiroPath(e.target.value)}
              placeholder="e.g. C:/Program Files/Kiro/kiro.exe"
              style={{
                width: '100%',
                marginBottom: '0.75rem',
                padding: '0.5rem',
                borderRadius: 6,
                border: '1px solid #3a3a4a',
                background: '#12121a',
                color: '#eee',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.85rem',
              }}
            />
          </>
        )}

        <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
          Target workspace (
          {cliBackend === 'cursor' ? <code>agent --workspace</code> : (
            <>
              <code>kiro</code> working directory
            </>
          )}
          )
        </label>
        <p style={{ marginTop: 0, marginBottom: '0.35rem', fontSize: '0.82rem', color: '#a8a8b8' }}>
          Paste the project folder where the agent should run (e.g. your new app). Agent JSON prompts
          still come from the catalog path above, not from this folder.
        </p>
        <input
          value={targetWorkspace}
          onChange={(e) => setTargetWorkspace(e.target.value)}
          style={{
            width: '100%',
            marginBottom: '0.75rem',
            padding: '0.5rem',
            borderRadius: 6,
            border: '1px solid #3a3a4a',
            background: '#12121a',
            color: '#eee',
          }}
        />

        <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
          Agent (from <code>.kiro/agents</code>, or None)
        </label>
        {loadingList ? (
          <p>Loading agents…</p>
        ) : listError ? (
          <p style={{ color: '#ffb4a8' }}>{listError}</p>
        ) : (
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            style={{
              width: '100%',
              marginBottom: '0.5rem',
              padding: '0.5rem',
              borderRadius: 6,
              border: '1px solid #3a3a4a',
              background: '#12121a',
              color: '#eee',
            }}
          >
            <option value={USER_PROMPT_ONLY_AGENT}>None (user message only — full prompt from below)</option>
            {agents.map((a) => (
              <option key={a.name} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        {isUserPromptOnly && (
          <p style={{ fontSize: '0.88rem', color: '#b8b8c8', marginTop: 0, marginBottom: '0.5rem' }}>
            No Kiro agent JSON: only the text in the field below is passed to the CLI (no base instructions).
          </p>
        )}
        {selected?.description && (
          <p style={{ fontSize: '0.88rem', color: '#b8b8c8', marginTop: 0 }}>{selected.description}</p>
        )}

        <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
          {isUserPromptOnly ? (
            <>Prompt (full message to CLI)</>
          ) : (
            <>
              Extra user message (appended after base prompt)
            </>
          )}
        </label>
        <textarea
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          placeholder={
            isUserPromptOnly
              ? 'e.g. Explain this codebase, or implement a login page with …'
              : selected?.welcomeMessage || 'e.g. Migrate source-progress/code/.../file.p'
          }
          rows={6}
          style={{
            width: '100%',
            marginBottom: '0.75rem',
            padding: '0.5rem',
            borderRadius: 6,
            border: '1px solid #3a3a4a',
            background: '#12121a',
            color: '#eee',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.88rem',
          }}
        />

        <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
          Execution mode (
          {cliBackend === 'cursor' ? (
            <>
              from <code>agent --help</code> → <code>--mode</code>; <strong>agent</strong> = default full tools
            </>
          ) : (
            <>
              Kiro presets → mapped to <code>kiro chat</code> <code>--trust-all-tools</code> /{' '}
              <code>--trust-tools=…</code> (see note below — not the same as IDE-only Kiro modes)
            </>
          )}
          )
        </label>
        {cliBackend === 'kiro' && agentModesNote && (
          <p style={{ marginTop: 0, marginBottom: '0.4rem', fontSize: '0.82rem', color: '#a8a8b8' }}>
            {agentModesNote}
          </p>
        )}
        {agentModesLoading ? (
          <p style={{ marginTop: 0, fontSize: '0.9rem' }}>Loading modes…</p>
        ) : agentModesError ? (
          <p style={{ color: '#ffb4a8', fontSize: '0.88rem', marginBottom: '0.5rem' }}>{agentModesError}</p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <select
            value={selectedAgentMode}
            onChange={(e) => setSelectedAgentMode(e.target.value)}
            style={{
              flex: '1 1 220px',
              minWidth: 200,
              padding: '0.5rem',
              borderRadius: 6,
              border: '1px solid #3a3a4a',
              background: '#12121a',
              color: '#eee',
            }}
          >
            {agentModes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => refreshAgentModes()}
            disabled={agentModesLoading}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: 6,
              border: '1px solid #4a4a5a',
              background: 'transparent',
              color: '#ddd',
              cursor: agentModesLoading ? 'wait' : 'pointer',
            }}
          >
            Reload modes
          </button>
        </div>

        <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
          --output-format {cliBackend === 'cursor' ? '(Cursor Agent)' : '(not used by Kiro chat)'}
        </label>
        <select
          value={outputFormat}
          onChange={(e) => setOutputFormat(e.target.value as typeof outputFormat)}
          disabled={cliBackend === 'kiro'}
          style={{
            marginBottom: '0.75rem',
            padding: '0.45rem',
            borderRadius: 6,
            border: '1px solid #3a3a4a',
            background: '#12121a',
            color: '#eee',
            opacity: cliBackend === 'kiro' ? 0.55 : 1,
          }}
        >
          <option value="json">json</option>
          <option value="text">text</option>
          <option value="stream-json">stream-json</option>
        </select>

        <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
          LLM model (
          {cliBackend === 'cursor' ? (
            <>
              <code>agent --list-models</code> / Cursor account
            </>
          ) : (
            <code>kiro chat --list-models</code>
          )}
          )
        </label>
        {modelsLoading ? (
          <p style={{ marginTop: 0, fontSize: '0.9rem' }}>Loading models…</p>
        ) : modelsError ? (
          <p style={{ color: '#ffb4a8', fontSize: '0.88rem', marginBottom: '0.5rem' }}>{modelsError}</p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{
              flex: '1 1 220px',
              minWidth: 200,
              padding: '0.5rem',
              borderRadius: 6,
              border: '1px solid #3a3a4a',
              background: '#12121a',
              color: '#eee',
            }}
          >
            <option value="">(CLI default model)</option>
            {llmModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => refreshModels()}
            disabled={modelsLoading}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: 6,
              border: '1px solid #4a4a5a',
              background: 'transparent',
              color: '#ddd',
              cursor: modelsLoading ? 'wait' : 'pointer',
            }}
          >
            Reload models
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => runAgent()}
            disabled={running || !selectedAgent || (isUserPromptOnly && !userMessage.trim())}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: 'none',
              background: '#3b5bdb',
              color: '#fff',
              cursor: running ? 'wait' : 'pointer',
              opacity: running ? 0.85 : 1,
            }}
          >
            {running ? 'Running…' : cliBackend === 'kiro' ? 'Run (Kiro)' : 'Run agent'}
          </button>
          <button
            type="button"
            onClick={() => {
              refreshHealth();
              refreshAgents();
              refreshAgentModes();
              refreshModels();
            }}
            title="Reload env, agents, execution modes, models (uses the executable field for the selected backend)"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: '1px solid #4a4a5a',
              background: 'transparent',
              color: '#ddd',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
        {health && !activeCliOk && (
          <p style={{ fontSize: '0.85rem', color: '#ffb4a8', marginBottom: 0 }}>
            {cliBackend === 'cursor' ? (
              <>
                The <code>agent</code> CLI did not respond to <code>agent --version</code>. You can still try Run;
                install the CLI or set <code>CURSOR_AGENT_BIN</code> on the server process.
              </>
            ) : (
              <>
                The <code>kiro</code> CLI did not respond to <code>kiro --version</code>. You can still try Run;
                install Kiro or set <code>KIRO_AGENT_BIN</code> / <code>kiro-agent.config.json</code> on the server.
              </>
            )}
          </p>
        )}
      </section>

      {runResult && (
        <section
          style={{
            background: '#1a1a24',
            border: '1px solid #2a2a3a',
            borderRadius: 8,
            padding: '1rem',
          }}
        >
          <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Result</h2>
          <p style={{ fontSize: '0.9rem', marginTop: 0 }}>
            exitCode: <code>{runResult.exitCode ?? 'null'}</code> — ok:{' '}
            <strong>{String(runResult.ok)}</strong>
            {' — agent: '}
            <code>
              {runResult.userPromptOnly ? 'None (user message only)' : runResult.agentName}
            </code>
            {runResult.model != null && runResult.model !== '' && (
              <>
                {' '}
                — model: <code>{runResult.model}</code>
              </>
            )}
            {runResult.executionMode != null && runResult.executionMode !== '' && (
              <>
                {' '}
                — mode: <code>{runResult.executionMode}</code>
              </>
            )}
            {(runResult.agentCliUsed || runResult.kiroCliUsed) && (
              <>
                {' '}
                — CLI: <code>{runResult.agentCliUsed ?? runResult.kiroCliUsed}</code>
              </>
            )}
          </p>
          {runResult.parsedJson != null && (
            <>
              <h3 style={{ fontSize: '0.95rem', margin: '0.75rem 0 0.35rem' }}>Agent reply</h3>
              <p style={{ fontSize: '0.82rem', color: '#a8a8b8', marginTop: 0, marginBottom: '0.35rem' }}>
                From <code>parsedJson.result</code> only (full structured payload is in stdout below).
              </p>
              <pre
                style={{
                  background: '#0d0d12',
                  padding: '0.75rem',
                  borderRadius: 6,
                  overflow: 'auto',
                  maxHeight: 480,
                  fontSize: '0.88rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  marginTop: 0,
                }}
              >
                {parsedJsonResultText(runResult.parsedJson) ??
                  '(No string `result` on parsedJson — check raw stdout.)'}
              </pre>
            </>
          )}
          {runResult.stdout && (
            <>
              <h3 style={{ fontSize: '0.95rem', margin: '0.75rem 0 0.35rem' }}>stdout (full CLI response)</h3>
              <p style={{ fontSize: '0.82rem', color: '#a8a8b8', marginTop: 0, marginBottom: '0.35rem' }}>
                Raw line emitted by the agent (includes the full JSON).
              </p>
              <pre
                style={{
                  background: '#0d0d12',
                  padding: '0.75rem',
                  borderRadius: 6,
                  overflow: 'auto',
                  maxHeight: 280,
                  fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {runResult.stdout}
              </pre>
            </>
          )}
          {runResult.stderr && (
            <>
              <h3 style={{ fontSize: '0.95rem', color: '#ffb4a8' }}>stderr</h3>
              <pre
                style={{
                  background: '#1a1010',
                  padding: '0.75rem',
                  borderRadius: 6,
                  overflow: 'auto',
                  maxHeight: 200,
                  fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {runResult.stderr}
              </pre>
            </>
          )}
        </section>
      )}
    </div>
  );
}
