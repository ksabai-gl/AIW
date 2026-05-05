import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { spawn, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_ROOT = path.join(__dirname, '..');

/** Load `cursor-agent-bridge/.env` so server + Vite share `AGENT_BRIDGE_PORT` without shell exports. */
function loadBridgeEnvFile() {
  const p = path.join(BRIDGE_ROOT, '.env');
  if (!existsSync(p)) return;
  try {
    const text = readFileSync(p, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadBridgeEnvFile();

/** Repository root (parent of cursor-agent-bridge/) */
const DEFAULT_WORKSPACE = path.resolve(BRIDGE_ROOT, '..');
const PREFERRED_PORT = Number(process.env.PORT || process.env.AGENT_BRIDGE_PORT || 3847);
let ACTIVE_PORT = PREFERRED_PORT;
const HOST = process.env.AGENT_BRIDGE_HOST || '0.0.0.0';
const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS || 0);
const DEV_API_PORT_FILE = path.join(BRIDGE_ROOT, '.dev-api-port');

/** Sentinel posted as `agentName` when the prompt is only the UI user message (no catalog agent). */
const USER_PROMPT_ONLY_AGENT = '__user_prompt_only__';

function clearDevApiPortFile() {
  try {
    if (existsSync(DEV_API_PORT_FILE)) unlinkSync(DEV_API_PORT_FILE);
  } catch {
    /* ignore */
  }
}

/** Drop stale port hint so Vite does not proxy to a previous process until we listen. */
clearDevApiPortFile();

/**
 * Dropdown list: GET /api/agents reads the workspace `.kiro/agents` directory,
 * loads every `*.json`, and uses each file's `name` field (not a hardcoded list).
 */
function detectAgentOnPath() {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('where.exe', ['agent'], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      const first = out.split(/\r?\n/).find((line) => line.trim().length);
      if (first && existsSync(first.trim())) return first.trim();
    } else {
      const out = execFileSync('/bin/sh', ['-c', 'command -v agent'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
      if (out) return out.split('\n')[0].trim();
    }
  } catch {
    /* not on PATH */
  }
  return null;
}

let AGENT_BIN_RESOLUTION = 'default';

function isBareExecutableName(s) {
  const t = s.trim();
  return !/[\\/]/.test(t) && !/^[A-Za-z]:/.test(t);
}

function resolvedPathExistsAsFile(p) {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

function resolveAgentBinary() {
  const env = process.env.CURSOR_AGENT_BIN?.trim();
  if (env) {
    if (isBareExecutableName(env)) {
      AGENT_BIN_RESOLUTION = 'CURSOR_AGENT_BIN';
      return env;
    }
    const candidate = path.resolve(env);
    if (resolvedPathExistsAsFile(candidate)) {
      AGENT_BIN_RESOLUTION = 'CURSOR_AGENT_BIN';
      return candidate;
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[cursor-agent-bridge] CURSOR_AGENT_BIN file not found, ignoring: ${candidate}`
    );
  }

  const cfgPath = path.join(BRIDGE_ROOT, 'agent.config.json');
  if (existsSync(cfgPath)) {
    try {
      const j = JSON.parse(readFileSync(cfgPath, 'utf8'));
      if (typeof j.agentBin === 'string' && j.agentBin.trim()) {
        const candidate = path.resolve(BRIDGE_ROOT, j.agentBin.trim());
        if (resolvedPathExistsAsFile(candidate)) {
          AGENT_BIN_RESOLUTION = 'agent.config.json';
          return candidate;
        }
        // eslint-disable-next-line no-console
        console.warn(
          `[cursor-agent-bridge] agent.config.json agentBin not found (e.g. still the example path). Ignoring; using PATH. ${candidate}`
        );
      }
    } catch {
      /* ignore bad config */
    }
  }

  const detected = detectAgentOnPath();
  if (detected) {
    AGENT_BIN_RESOLUTION = 'PATH';
    return detected;
  }

  AGENT_BIN_RESOLUTION = 'default';
  return 'agent';
}

const AGENT_BIN = resolveAgentBinary();

/** Optional path/command from UI (`agentBin` query/body). Empty → server `AGENT_BIN`. */
function resolveEffectiveAgentBin(override) {
  if (typeof override !== 'string') return AGENT_BIN;
  const t = override.trim().replace(/^["']|["']$/g, '');
  if (!t) return AGENT_BIN;
  if (isBareExecutableName(t)) return t;
  return path.resolve(t);
}

// ─── Kiro CLI binary resolution & subprocess helpers (optional second backend) ───

let KIRO_BIN_RESOLUTION = 'default';

function detectKiroOnPath() {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('where.exe', ['kiro'], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      const first = out.split(/\r?\n/).find((line) => line.trim().length);
      if (first && existsSync(first.trim())) return first.trim();
    } else {
      const out = execFileSync('/bin/sh', ['-c', 'command -v kiro'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
      if (out) return out.split('\n')[0].trim();
    }
  } catch {
    /* not on PATH */
  }
  return null;
}

function resolveKiroBinary() {
  const env = process.env.KIRO_AGENT_BIN?.trim();
  if (env) {
    if (isBareExecutableName(env)) {
      KIRO_BIN_RESOLUTION = 'KIRO_AGENT_BIN';
      return env;
    }
    const candidate = path.resolve(env);
    if (resolvedPathExistsAsFile(candidate)) {
      KIRO_BIN_RESOLUTION = 'KIRO_AGENT_BIN';
      return candidate;
    }
    // eslint-disable-next-line no-console
    console.warn(`[cursor-agent-bridge] KIRO_AGENT_BIN file not found, ignoring: ${candidate}`);
  }

  const cfgPath = path.join(BRIDGE_ROOT, 'kiro-agent.config.json');
  if (existsSync(cfgPath)) {
    try {
      const j = JSON.parse(readFileSync(cfgPath, 'utf8'));
      if (typeof j.kiroBin === 'string' && j.kiroBin.trim()) {
        const candidate = path.resolve(BRIDGE_ROOT, j.kiroBin.trim());
        if (resolvedPathExistsAsFile(candidate)) {
          KIRO_BIN_RESOLUTION = 'kiro-agent.config.json';
          return candidate;
        }
        // eslint-disable-next-line no-console
        console.warn(
          `[cursor-agent-bridge] kiro-agent.config.json kiroBin not found. Ignoring; using PATH. ${candidate}`
        );
      }
    } catch {
      /* ignore bad config */
    }
  }

  const detected = detectKiroOnPath();
  if (detected) {
    KIRO_BIN_RESOLUTION = 'PATH';
    return detected;
  }

  KIRO_BIN_RESOLUTION = 'default';
  return 'kiro';
}

const KIRO_BIN = resolveKiroBinary();

/** UI paste / JSON sometimes sends `\"C:\\...\\kiro-cli.exe\"` — strip until we get a usable path. */
function normalizeKiroBinOverride(raw) {
  if (typeof raw !== 'string') return '';
  let t = raw.trim();
  for (let i = 0; i < 8; i += 1) {
    const next = t.replace(/^["']+|["']+$/g, '').trim();
    if (next === t) break;
    t = next;
  }
  t = t.replace(/^\\"+|\\"+$/g, '').trim();
  return t;
}

function resolveEffectiveKiroBin(override) {
  if (typeof override !== 'string') return KIRO_BIN;
  const t = normalizeKiroBinOverride(override);
  if (!t) return KIRO_BIN;
  if (isBareExecutableName(t)) return t;
  return path.resolve(t);
}

function spawnShellForKiro(kiroBin) {
  const bin = kiroBin ?? KIRO_BIN;
  if (process.platform !== 'win32') return false;
  const lower = bin.toLowerCase();
  if (lower.endsWith('.cmd') || lower.endsWith('.bat') || lower.endsWith('.ps1')) return true;
  return !path.isAbsolute(bin);
}

function kiroInstallHint() {
  return {
    windows:
      'Install Kiro CLI, then ensure `kiro` is on PATH (or set KIRO_AGENT_BIN / kiro-agent.config.json).',
    unix: 'Install Kiro CLI and ensure the binary is on PATH.',
    env: 'Use `kiroBin` query/body, or set KIRO_AGENT_BIN / kiro-agent.config.json on the server.',
  };
}

/** Env for Kiro subprocesses: push CLI toward plain output (API/JSON is not a TTY). */
function kiroSubprocessEnv() {
  return {
    ...process.env,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    TERM: 'dumb',
    CI: '1',
  };
}

/** Same sane defaults as Kiro; Cursor Agent needs PATH for `npx` + Jira MCP child processes. */
function cursorSubprocessEnv() {
  return {
    ...process.env,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    TERM: 'dumb',
    CI: '1',
  };
}

/**
 * Cursor CLI: only `plan` and `ask` are documented `--mode` values — both are read-only (no MCP tools).
 * Headless `/api/run` always uses the default agent profile (full tools, MCP, shell). We never pass
 * `--mode` so plan/ask/autopilot stored in the UI cannot break Jira `jira_post`.
 */
function cursorAgentModeArgv(_executionMode) {
  void _executionMode;
  return [];
}

/**
 * Cursor persists an "approved MCP" list. `--approve-mcps` does not always override it; without
 * `mcp enable`, the CLI can reject every Jira/GitHub tool call in `--print` mode.
 * See: https://cursor.com/docs/cli/mcp — run `agent mcp enable <id>` for each project server.
 */
function readCursorMcpServerIds(workspaceRoot) {
  const mcpPath = path.join(workspaceRoot, '.cursor', 'mcp.json');
  if (!existsSync(mcpPath)) return [];
  try {
    const j = JSON.parse(readFileSync(mcpPath, 'utf8'));
    const servers = j.mcpServers && typeof j.mcpServers === 'object' ? j.mcpServers : {};
    return Object.keys(servers).filter((k) => !servers[k]?.disabled);
  } catch {
    return [];
  }
}

function spawnCursorMcpEnable(bin, workspaceRoot, serverId) {
  return new Promise((resolve) => {
    const child = spawn(bin, ['mcp', 'enable', serverId], {
      cwd: workspaceRoot,
      windowsHide: true,
      shell: spawnShellForAgent(bin),
      env: cursorSubprocessEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let errBuf = '';
    child.stderr?.on('data', (d) => {
      errBuf += d.toString();
    });
    const t = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      resolve({ ok: false, stderr: errBuf || 'timeout', timeout: true });
    }, 15000);
    child.on('close', (code) => {
      clearTimeout(t);
      resolve({ ok: code === 0, exitCode: code, stderr: errBuf });
    });
    child.on('error', (e) => {
      clearTimeout(t);
      resolve({ ok: false, stderr: errBuf + e.message });
    });
  });
}

async function ensureCursorMcpServersEnabled(workspaceRoot, agentBinRaw) {
  const ids = readCursorMcpServerIds(workspaceRoot);
  if (!ids.length) return { enabled: [], note: 'no .cursor/mcp.json server entries' };
  const bin = resolveEffectiveAgentBin(agentBinRaw);
  const enabled = [];
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    const r = await spawnCursorMcpEnable(bin, workspaceRoot, id);
    if (r.ok || (r.stderr && /already|exist/i.test(r.stderr))) {
      enabled.push(id);
    } else if (!r.timeout) {
      // eslint-disable-next-line no-console
      console.warn(`[cursor-agent-bridge] mcp enable ${id}:`, (r.stderr || '').slice(0, 400));
    }
  }
  return { enabled, requested: ids };
}

/**
 * Strip CSI/OSC terminal sequences Kiro prints (colors, cursor, progress). Without this, Express
 * JSON shows `\u001b[32m`-style escapes because that is literally what the child wrote to stdout.
 */
function stripKiroTerminalOutput(s) {
  if (typeof s !== 'string') return '';
  let t = s.replace(/\r\n/g, '\n');
  t = t.replace(/\x1b\[[\d;?]*[A-Za-z]/g, '');
  t = t.replace(/\x1b\][^\x07]*\x07/g, '');
  t = t.replace(/\x1b\][^\x1b]*\x1b\\/g, '');
  return t;
}

function probeKiroBinary(options = {}) {
  const maxMs = typeof options.maxMs === 'number' ? options.maxMs : 8000;
  const bin = resolveEffectiveKiroBin(options.kiroBin);
  return new Promise((resolve) => {
    let settled = false;
    let t;
    const done = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      resolve(payload);
    };
    const child = spawn(bin, ['--version'], {
      windowsHide: true,
      shell: spawnShellForKiro(bin),
      env: kiroSubprocessEnv(),
    });
    let out = '';
    let err = '';
    child.stdout?.on('data', (d) => {
      out += d.toString();
    });
    child.stderr?.on('data', (d) => {
      err += d.toString();
    });
    child.on('error', (e) => {
      done({ ok: false, error: e.message, hint: kiroInstallHint() });
    });
    t = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      done({ ok: false, error: 'timeout probing kiro', hint: kiroInstallHint() });
    }, maxMs);
    child.on('close', (code) => {
      if (code === 0) {
        done({ ok: true, version: stripKiroTerminalOutput(`${out}\n${err}`).trim() });
      } else {
        done({
          ok: false,
          error: stripKiroTerminalOutput(err || out || `exit ${code}`),
          hint: kiroInstallHint(),
        });
      }
    });
  });
}

function spawnKiroCollect(argv, options = {}) {
  const cwd = options.cwd ?? options.workspaceRoot ?? getAgentCatalogRoot();
  const timeoutMs = options.timeoutMs ?? 0;
  const bin = resolveEffectiveKiroBin(options.kiroBin);
  return new Promise((resolve) => {
    const child = spawn(bin, argv, {
      cwd,
      windowsHide: true,
      shell: spawnShellForKiro(bin),
      env: kiroSubprocessEnv(),
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    let timeoutId;
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        try {
          child.kill('SIGTERM');
        } catch {
          /* ignore */
        }
        stderr += `\n[bridge] spawnKiroCollect timeout ${timeoutMs}ms`;
      }, timeoutMs);
    }
    child.on('error', (e) => {
      if (timeoutId) clearTimeout(timeoutId);
      resolve({
        exitCode: null,
        stdout: stripKiroTerminalOutput(stdout),
        stderr: stripKiroTerminalOutput(`${stderr}\n${e.message}`),
      });
    });
    child.on('close', (exitCode) => {
      if (timeoutId) clearTimeout(timeoutId);
      resolve({
        exitCode,
        stdout: stripKiroTerminalOutput(stdout),
        stderr: stripKiroTerminalOutput(stderr),
      });
    });
  });
}

function spawnShellForAgent(agentBin) {
  const bin = agentBin ?? AGENT_BIN;
  if (process.platform !== 'win32') return false;
  const lower = bin.toLowerCase();
  if (lower.endsWith('.cmd') || lower.endsWith('.bat') || lower.endsWith('.ps1')) {
    return true;
  }
  return !path.isAbsolute(bin);
}

/**
 * Windows `cmd.exe` (used when shell:true with .cmd) limits the command line to ~8191 chars.
 * Large `combinedPrompt` (e.g. agent + inlined steering) exceeds that. The Cursor CLI accepts a
 * path to a .txt file as the prompt argument and reads the file contents.
 */
function attachPromptArgForWindows({ bin, combinedPrompt, args }) {
  const minLen = Number(process.env.BRIDGE_PROMPT_FILE_MIN_LEN || 2500);
  const needsFile =
    process.platform === 'win32' &&
    typeof combinedPrompt === 'string' &&
    combinedPrompt.length > minLen &&
    (spawnShellForAgent(bin) || path.isAbsolute(bin));

  if (!needsFile) {
    return { args: [...args, combinedPrompt], cleanupPromptFile: null };
  }

  const fp = path.join(
    tmpdir(),
    `cursor-bridge-prompt-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}.txt`
  );
  writeFileSync(fp, combinedPrompt, 'utf8');
  const cleanupPromptFile = () => {
    try {
      unlinkSync(fp);
    } catch {
      /* ignore */
    }
  };
  return { args: [...args, fp], cleanupPromptFile };
}

/**
 * Kiro prompt attachment: always use stdin for the prompt.
 *
 * Passing long prompts as argv hits Windows CreateProcess limits (~32k chars).
 * Passing a temp file path as argv causes Kiro to treat it as a literal message.
 * Piping via stdin avoids both problems — Kiro reads the prompt from stdin when
 * no message argument is provided.
 */
function attachKiroPromptArg({ bin, combinedPrompt, args }) {
  void bin;
  // Never pass the prompt as an argv argument — always pipe via stdin.
  // Return args without the prompt appended; runKiroAgent will pipe it via child.stdin.
  return { args: [...args], combinedPrompt, cleanupPromptFile: null, useStdin: true };
}

/** Directory that contains `.kiro/agents` (prompt JSON). Fixed to this bridge install unless overridden. */
function getAgentCatalogRoot() {
  const fromEnv =
    process.env.AGENT_CATALOG_ROOT?.trim() || process.env.KIRO_AGENT_CATALOG_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return DEFAULT_WORKSPACE;
}

/**
 * Folder passed to `agent --workspace` (where tools run). Body wins, then TARGET_WORKSPACE,
 * then legacy WORKSPACE_ROOT, then catalog root as last resort.
 */
function resolveRunWorkspace(fromBody) {
  const b = typeof fromBody === 'string' && fromBody.trim() ? path.resolve(fromBody.trim()) : '';
  if (b) return b;
  const t = process.env.TARGET_WORKSPACE?.trim();
  if (t) return path.resolve(t);
  const w = process.env.WORKSPACE_ROOT?.trim();
  if (w) return path.resolve(w);
  return getAgentCatalogRoot();
}

function agentsDir(workspaceRoot) {
  return path.join(workspaceRoot, '.kiro', 'agents');
}

async function listAgents(workspaceRoot) {
  const dir = agentsDir(workspaceRoot);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const agents = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.json')) continue;
    const full = path.join(dir, e.name);
    const raw = await fs.readFile(full, 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!data.name) continue;
    agents.push({
      id: data.name,
      name: data.name,
      description: data.description ?? '',
      welcomeMessage: data.welcomeMessage ?? '',
      resources: Array.isArray(data.resources) ? data.resources : [],
    });
  }
  agents.sort((a, b) => a.name.localeCompare(b.name));
  return agents;
}

async function readAgentJson(catalogRoot, agentName) {
  const dir = agentsDir(catalogRoot);
  const files = await fs.readdir(dir);
  const match = files.find(
    (f) => f.endsWith('.json') && path.basename(f, '.json') === agentName
  );
  const filePath = match
    ? path.join(dir, match)
    : path.join(dir, `${agentName}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function catalogResourceToPath(catalogRoot, uri) {
  if (typeof uri !== 'string') return null;
  const u = uri.replace(/^file:\/\//i, '').replace(/^\/+/, '');
  if (!u || u.includes('..')) return null;
  return path.resolve(catalogRoot, u);
}

/** Base `prompt` plus inlined `resources` files so `--workspace` can be a target folder without `.kiro`. */
async function buildSystemPromptFromAgent(catalogRoot, agentName) {
  const data = await readAgentJson(catalogRoot, agentName);
  if (!data) return null;
  const base = typeof data.prompt === 'string' ? data.prompt : '';
  if (!base.trim()) return null;
  const resources = Array.isArray(data.resources) ? data.resources : [];
  const MAX_BYTES = 200_000;
  let extra = '';
  for (const uri of resources) {
    const fp = catalogResourceToPath(catalogRoot, uri);
    if (!fp) continue;
    try {
      const st = await fs.stat(fp);
      if (!st.isFile() || st.size > MAX_BYTES) continue;
      const body = await fs.readFile(fp, 'utf8');
      extra += `\n\n### STEERING_FILE (${path.relative(catalogRoot, fp)})\n\n${body}`;
    } catch {
      /* missing optional resource */
    }
  }
  return base + extra;
}

function buildCombinedPrompt(systemPrompt, userMessage) {
  const user = (userMessage ?? '').trim();
  if (!user) {
    return systemPrompt;
  }
  /** Use `###` section headers — lines starting with `--` are parsed as CLI flags by the agent. */
  return [
    '### AGENT_BASE_INSTRUCTIONS (follow these for the whole run)',
    '',
    systemPrompt,
    '',
    '### USER_MESSAGE',
    '',
    user,
  ].join('\n');
}

function probeAgentBinary(options = {}) {
  const maxMs = typeof options.maxMs === 'number' ? options.maxMs : 8000;
  const bin = resolveEffectiveAgentBin(options.agentBin);
  return new Promise((resolve) => {
    let settled = false;
    let t;
    const done = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      resolve(payload);
    };
    const child = spawn(bin, ['--version'], {
      windowsHide: true,
      shell: spawnShellForAgent(bin),
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    let out = '';
    let err = '';
    child.stdout?.on('data', (d) => {
      out += d.toString();
    });
    child.stderr?.on('data', (d) => {
      err += d.toString();
    });
    child.on('error', (e) => {
      done({ ok: false, error: e.message, hint: installHint() });
    });
    t = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      done({ ok: false, error: 'timeout probing agent', hint: installHint() });
    }, maxMs);
    child.on('close', (code) => {
      if (code === 0) {
        done({ ok: true, version: (out + err).trim() });
      } else {
        done({
          ok: false,
          error: err || out || `exit ${code}`,
          hint: installHint(),
        });
      }
    });
  });
}

function installHint() {
  return {
    windows:
      "Install Cursor Agent CLI: PowerShell — irm 'https://cursor.com/install?win32=true' | iex — then ensure `agent` is on PATH (see Cursor CLI docs).",
    unix: 'Install: curl https://cursor.com/install -fsS | bash — then ensure ~/.local/bin is on PATH.',
    env: 'Use the UI “Cursor Agent executable” field, or set CURSOR_AGENT_BIN / agent.config.json on the server.',
  };
}

function spawnAgentCollect(argv, options = {}) {
  const cwd = options.cwd ?? options.workspaceRoot ?? getAgentCatalogRoot();
  const timeoutMs = options.timeoutMs ?? 0;
  const bin = resolveEffectiveAgentBin(options.agentBin);
  return new Promise((resolve) => {
    const child = spawn(bin, argv, {
      cwd,
      windowsHide: true,
      shell: spawnShellForAgent(bin),
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    let timeoutId;
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        try {
          child.kill('SIGTERM');
        } catch {
          /* ignore */
        }
        stderr += `\n[bridge] spawnAgentCollect timeout ${timeoutMs}ms`;
      }, timeoutMs);
    }
    child.on('error', (e) => {
      if (timeoutId) clearTimeout(timeoutId);
      resolve({
        exitCode: null,
        stdout: stripKiroTerminalOutput(stdout),
        stderr: stripKiroTerminalOutput(`${stderr}\n${e.message}`),
      });
    });
    child.on('close', (exitCode) => {
      if (timeoutId) clearTimeout(timeoutId);
      resolve({
        exitCode,
        stdout: stripKiroTerminalOutput(stdout),
        stderr: stripKiroTerminalOutput(stderr),
      });
    });
  });
}

/** Strip SGR ANSI sequences (\x1b[ … m). Cursor CLI still emits color in some modes. */
function stripAnsi(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

const CLI_MODEL_LINE_SKIP = /^(available models|tip:)/i;

/** Turn one CLI `models` line into a bare model id for `--model`. */
function normalizeCliModelId(raw) {
  const line = stripAnsi(raw).trim();
  if (!line || line.length > 200 || CLI_MODEL_LINE_SKIP.test(line)) return null;
  if (/^available models\b/i.test(line)) return null;
  const withDesc = line.match(/^([a-zA-Z][a-zA-Z0-9_.-]*)\s+-\s+/);
  if (withDesc) return withDesc[1];
  /** Kiro / markdown list: `* model-id   1.00x credits  …` or `  model-id   0.25x …` */
  const kiroPlain = line.match(/^\*?\s*([a-zA-Z][a-zA-Z0-9_.-]*)(?:\s{2,}|\s+\d)/);
  if (kiroPlain) return kiroPlain[1];
  if (/^[a-zA-Z][a-zA-Z0-9_.-]{1,78}$/.test(line)) return line;
  return null;
}

function cleanModelCatalog(rawList) {
  const out = [];
  const seen = new Set();
  for (const raw of rawList) {
    const id = normalizeCliModelId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function extractModelsFromJson(j) {
  if (j == null) return [];
  if (typeof j === 'string') {
    const lines = j.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length > 1) return lines;
    return j.trim() ? [j.trim()] : [];
  }
  if (Array.isArray(j)) {
    return j
      .map((x) =>
        typeof x === 'string'
          ? x
          : x?.id ??
            x?.model_id ??
            x?.name ??
            x?.model_name ??
            x?.model ??
            x?.value ??
            x?.slug
      )
      .filter((s) => typeof s === 'string' && s.trim().length > 0);
  }
  if (Array.isArray(j.models)) return extractModelsFromJson(j.models);
  if (Array.isArray(j.data)) return extractModelsFromJson(j.data);
  if (Array.isArray(j.availableModels)) return extractModelsFromJson(j.availableModels);
  if (typeof j.model === 'string') return [j.model];
  if (j.result != null) return extractModelsFromJson(j.result);
  return [];
}

function parseModelsList(stdout, stderr) {
  const blob = `${stdout}\n${stderr}`.trim();
  const models = [];
  if (!blob) return models;

  const lines = blob.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (!line.startsWith('{') && !line.startsWith('[')) continue;
    try {
      const j = JSON.parse(line);
      const got = extractModelsFromJson(j);
      if (got.length) return [...new Set(got)];
    } catch {
      /* next line */
    }
  }
  try {
    const j = JSON.parse(blob);
    const got = extractModelsFromJson(j);
    if (got.length) return [...new Set(got)];
  } catch {
    /* fallthrough */
  }

  const noise = /^(usage|error|warning|----)/i;
  for (const line of lines) {
    if (line.startsWith('{') || line.startsWith('[')) continue;
    if (line.length < 2 || line.length > 400) continue;
    if (noise.test(stripAnsi(line))) continue;
    models.push(line);
  }
  return [...new Set(models)];
}

/**
 * Parse `--mode` choices from `agent --help` output (Cursor CLI).
 * Always includes `agent` for the default full-tools mode (no `--mode` flag).
 */
function parseExecutionModesFromHelp(text) {
  const t = stripAnsi(text).replace(/\r\n/g, '\n');
  const lower = t.toLowerCase();
  const idx = lower.indexOf('--mode');
  if (idx === -1) {
    return { modes: ['agent'] };
  }
  const window = t.slice(idx, idx + 2200);
  const choiceMatch = window.match(/\(choices:\s*([^)]+)\)/i);
  const modes = new Set(['agent']);
  if (choiceMatch) {
    const inner = choiceMatch[1];
    for (const match of inner.matchAll(/"([^"]+)"/g)) {
      const id = match[1].trim().toLowerCase();
      if (id && /^[a-z][a-z0-9_-]*$/i.test(id)) modes.add(id);
    }
  }
  const rest = [...modes].filter((m) => m !== 'agent').sort((a, b) => a.localeCompare(b));
  return { modes: ['agent', ...rest] };
}

async function listAgentModesFromCli(workspaceRoot, options = {}) {
  const attempts = [['--help'], ['help']];
  let last = { exitCode: -1, stdout: '', stderr: '' };
  for (const argv of attempts) {
    // eslint-disable-next-line no-await-in-loop
    const r = await spawnAgentCollect(argv, {
      workspaceRoot,
      timeoutMs: 20000,
      agentBin: options.agentBin,
    });
    last = r;
    const blob = `${r.stdout}\n${r.stderr}`;
    if (!blob.toLowerCase().includes('--mode')) continue;
    const { modes } = parseExecutionModesFromHelp(blob);
    if (modes.length >= 1) {
      return { ok: true, modes, argvJoined: argv.join(' ') };
    }
  }
  return {
    ok: false,
    modes: [],
    exitCode: last.exitCode,
    stderr: last.stderr,
    stdoutPreview: (last.stdout || '').slice(0, 800),
  };
}

/**
 * Cursor/Kiro may exit 0 with plain text and no parseable model list, e.g.
 * "No models available for this account." — treat as success with zero models (CLI default).
 */
function isEmptyModelCatalogCliMessage(stdout, stderr) {
  const blob = `${stdout || ''}\n${stderr || ''}`.trim();
  if (!blob) return false;
  const lower = blob.toLowerCase();
  if (lower.includes('no models available')) return true;
  if (lower.includes('no models for this account')) return true;
  if (/no .+ models? (?:available|listed)/i.test(blob)) return true;
  return false;
}

async function listModelsFromCli(workspaceRoot, options = {}) {
  const attempts = [
    ['--print', '--output-format', 'json', '--list-models', '--workspace', workspaceRoot],
    ['models', '--print', '--output-format', 'json', '--workspace', workspaceRoot],
    ['--print', '--output-format', 'json', '--list-models'],
    ['models', '--print', '--output-format', 'json'],
  ];
  let last = { exitCode: -1, stdout: '', stderr: '' };
  for (const argv of attempts) {
    // eslint-disable-next-line no-await-in-loop
    const r = await spawnAgentCollect(argv, {
      workspaceRoot,
      timeoutMs: 120000,
      agentBin: options.agentBin,
    });
    last = r;
    const raw = parseModelsList(r.stdout, r.stderr);
    const models = cleanModelCatalog(raw);
    if (models.length > 0) {
      return { ok: true, models, argvJoined: argv.join(' ') };
    }
    if (r.exitCode === 0 && isEmptyModelCatalogCliMessage(r.stdout, r.stderr)) {
      return {
        ok: true,
        models: [],
        argvJoined: argv.join(' '),
        note:
          'No models are listed for this Cursor account. You can still use the CLI default model, or adjust login/account in Cursor.',
      };
    }
  }
  return {
    ok: false,
    models: [],
    exitCode: last.exitCode,
    stderr: last.stderr,
    stdoutPreview: (last.stdout || '').slice(0, 800),
  };
}

async function listKiroModelsFromCli(workspaceRoot, options = {}) {
  /** Kiro CLI uses `-f` / `--format` (not all builds accept `--format` after other flags). */
  const attempts = [
    ['chat', '--list-models', '--format', 'json'],
    ['chat', '--list-models', '-f', 'json'],
    ['chat', '--list-models', '--format', 'json-pretty'],
    ['chat', '--list-models', '-f', 'json-pretty'],
    ['chat', '--list-models'],
  ];
  let last = { exitCode: -1, stdout: '', stderr: '' };
  for (const argv of attempts) {
    // eslint-disable-next-line no-await-in-loop
    const r = await spawnKiroCollect(argv, {
      workspaceRoot,
      timeoutMs: 120000,
      kiroBin: options.kiroBin,
    });
    last = r;
    const raw = parseModelsList(r.stdout, r.stderr);
    const models = cleanModelCatalog(raw);
    if (models.length > 0) {
      return { ok: true, models, argvJoined: argv.join(' ') };
    }
    if (r.exitCode === 0 && isEmptyModelCatalogCliMessage(r.stdout, r.stderr)) {
      return {
        ok: true,
        models: [],
        argvJoined: argv.join(' '),
        note:
          'No models are listed by the Kiro CLI for this account. You can still use the CLI default model.',
      };
    }
  }
  return {
    ok: false,
    models: [],
    exitCode: last.exitCode,
    stderr: last.stderr,
    stdoutPreview: (last.stdout || '').slice(0, 800),
  };
}

/**
 * Kiro `kiro chat` does not expose Cursor-style `--mode` or IDE labels (autopilot / supervised / …).
 * The UI lists these presets anyway; we map them to the real `trust` flags from `chat --help`.
 */
const KIRO_CHAT_EXECUTION_MODES = ['autopilot', 'supervised', 'ask', 'plan'];

function kiroTrustArgvFromMode(executionMode) {
  const m =
    typeof executionMode === 'string' ? executionMode.trim().toLowerCase() : '';
  if (m === 'ask') {
    return ['--trust-tools='];
  }
  if (m === 'supervised') {
    return ['--trust-tools=fs_read,glob'];
  }
  /** plan: same full tools as autopilot; steering/prompt usually drives “plan first” behavior */
  if (m === 'plan' || m === 'autopilot' || m === 'agent' || !m) {
    return ['--trust-all-tools'];
  }
  return ['--trust-all-tools'];
}

async function listKiroAgentModesFromCli(workspaceRoot, options = {}) {
  void workspaceRoot;
  void options;
  return {
    ok: true,
    modes: [...KIRO_CHAT_EXECUTION_MODES],
    argvJoined: 'static-presets',
    note:
      '`kiro chat` has no `--mode` flag (unlike Cursor `agent`). These options are bridge presets: ' +
      'autopilot → `--trust-all-tools`; ask → `--trust-tools=` (no tools); supervised → read/search-only tools; ' +
      'plan → same tools as autopilot (rely on agent prompt for plan-first).',
  };
}

function kiroShouldPassModelFlag(model) {
  const m = typeof model === 'string' ? model.trim() : '';
  if (!m) return false;
  const low = m.toLowerCase();
  if (low === 'auto' || low === 'default' || low === 'cli_default') return false;
  return true;
}

/**
 * Kiro is spawned with cwd = target `workspaceRoot` (MCP, .env, file tools use that folder).
 * Agent JSON + steering always come from this server’s agent catalog (`getAgentCatalogRoot` via
 * `buildSystemPromptFromAgent` → `combinedPrompt` on stdin). No copy of `.kiro/agents` into the
 * user’s project is required — `npm install` + `npm run dev:all` in the nUI repo is enough.
 */
function runKiroAgent({ workspaceRoot, combinedPrompt, model, executionMode, kiroBin }) {
  const bin = resolveEffectiveKiroBin(kiroBin);
  const modelArg = kiroShouldPassModelFlag(model) ? ['--model', model.trim()] : [];
  const trustArg = kiroTrustArgvFromMode(executionMode);
  const stdinPayload = combinedPrompt;

  const baseArgs = [
    'chat',
    '--no-interactive',
    '--require-mcp-startup',
    ...trustArg,
    '--wrap',
    'never',
    ...modelArg,
  ];
  const { args, cleanupPromptFile, useStdin } = attachKiroPromptArg({
    bin,
    combinedPrompt: stdinPayload,
    args: baseArgs,
  });

  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: workspaceRoot,
      windowsHide: true,
      shell: spawnShellForKiro(bin),
      env: kiroSubprocessEnv(),
      // Use pipe for stdin so we can write the prompt directly
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Write the prompt to stdin and close it
    if (useStdin && stdinPayload) {
      try {
        child.stdin.write(stdinPayload, 'utf8');
        child.stdin.end();
      } catch {
        /* stdin may already be closed */
      }
    } else if (child.stdin) {
      child.stdin.end();
    }

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (e) => {
      if (cleanupPromptFile) cleanupPromptFile();
      const out = stripKiroTerminalOutput(stdout);
      const err = stripKiroTerminalOutput(
        stderr + (e.message ? `\n${e.message}` : '')
      );
      resolve({
        ok: false,
        exitCode: null,
        stdout: out,
        stderr: err,
        spawnError: e.message,
        hint: kiroInstallHint(),
        kiroAgentProfile: 'catalog_inline',
      });
    });

    let timeoutId;
    if (AGENT_TIMEOUT_MS > 0) {
      timeoutId = setTimeout(() => {
        try {
          child.kill('SIGTERM');
        } catch {
          /* ignore */
        }
        stderr += `\n[bridge] killed after ${AGENT_TIMEOUT_MS}ms (set AGENT_TIMEOUT_MS=0 to disable)`;
      }, AGENT_TIMEOUT_MS);
    }

    child.on('close', (exitCode) => {
      if (cleanupPromptFile) cleanupPromptFile();
      if (timeoutId) clearTimeout(timeoutId);
      resolve({
        ok: exitCode === 0,
        exitCode,
        stdout: stripKiroTerminalOutput(stdout),
        stderr: stripKiroTerminalOutput(stderr),
        kiroAgentProfile: 'catalog_inline',
      });
    });
  });
}

async function runCursorAgent({ workspaceRoot, combinedPrompt, outputFormat, model, executionMode, agentBin }) {
  let mcpPreamble = '';
  try {
    const pre = await ensureCursorMcpServersEnabled(workspaceRoot, agentBin);
    if (pre.requested?.length) {
      mcpPreamble = `[bridge] Cursor MCP pre-flight: enable ${pre.requested.join(', ')} → ok: ${(pre.enabled || []).join(', ') || 'none'}\n`;
    }
  } catch (e) {
    mcpPreamble = `[bridge] Cursor MCP pre-flight error: ${e?.message || e}\n`;
  }

  const bin = resolveEffectiveAgentBin(agentBin);
  const fmt = outputFormat === 'text' || outputFormat === 'stream-json' ? outputFormat : 'json';
  const modeArgs = cursorAgentModeArgv(executionMode);
  // Workspace early so CLI resolves `.cursor/mcp.json` before tools run.
  const baseArgs = [
    '--print',
    '--output-format',
    fmt,
    '--workspace',
    workspaceRoot,
    ...modeArgs,
    ...(typeof model === 'string' && model.trim() ? ['--model', model.trim()] : []),
    '--trust',
    '--force',
    '--yolo',
    '--approve-mcps',
    '--sandbox',
    'disabled',
  ];
  const { args, cleanupPromptFile } = attachPromptArgForWindows({
    bin,
    combinedPrompt,
    args: baseArgs,
  });

  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: workspaceRoot,
      windowsHide: true,
      shell: spawnShellForAgent(bin),
      env: cursorSubprocessEnv(),
    });
    let stdout = '';
    let stderr = mcpPreamble;
    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (e) => {
      if (cleanupPromptFile) cleanupPromptFile();
      resolve({
        ok: false,
        exitCode: null,
        stdout,
        stderr: stderr + (e.message ? `\n${e.message}` : ''),
        spawnError: e.message,
        hint: installHint(),
      });
    });

    let timeoutId;
    if (AGENT_TIMEOUT_MS > 0) {
      timeoutId = setTimeout(() => {
        try {
          child.kill('SIGTERM');
        } catch {
          /* ignore */
        }
        stderr += `\n[bridge] killed after ${AGENT_TIMEOUT_MS}ms (set AGENT_TIMEOUT_MS=0 to disable)`;
      }, AGENT_TIMEOUT_MS);
    }

    child.on('close', (exitCode) => {
      if (cleanupPromptFile) cleanupPromptFile();
      if (timeoutId) clearTimeout(timeoutId);
      resolve({
        ok: exitCode === 0,
        exitCode,
        stdout,
        stderr,
      });
    });
  });
}

const app = express();
app.use(
  cors({
    origin: [/http:\/\/localhost:\d+/, /http:\/\/127\.0\.0\.1:\d+/],
  })
);
app.use(express.json({ limit: '4mb' }));
const FRONTEND_DIST_DIR = path.resolve(BRIDGE_ROOT, '..', 'dist');

app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, service: 'cursor-agent-bridge', apiPort: ACTIVE_PORT });
});

app.get('/api/health', async (req, res) => {
  const agentCatalogRoot = getAgentCatalogRoot();
  const defaultRunWorkspace = resolveRunWorkspace('');
  const agentBinRaw = typeof req.query.agentBin === 'string' ? req.query.agentBin : '';
  const effectiveAgentBin = resolveEffectiveAgentBin(agentBinRaw);
  const probe = await probeAgentBinary({ maxMs: 6000, agentBin: agentBinRaw });
  res.json({
    ok: true,
    agentCatalogRoot,
    /** Same as agentCatalogRoot — kept for older clients. */
    workspaceRoot: agentCatalogRoot,
    defaultRunWorkspace,
    envTargetWorkspace: process.env.TARGET_WORKSPACE?.trim() || null,
    agentBin: effectiveAgentBin,
    agentBinUsedFrom: agentBinRaw.trim() ? 'request' : 'server',
    serverDefaultAgentBin: AGENT_BIN,
    agentBinResolution: AGENT_BIN_RESOLUTION,
    agentCli: probe,
    agentsDir: agentsDir(agentCatalogRoot),
    agentsNote:
      'Agent dropdown: JSON from agentCatalogRoot/.kiro/agents only. Target folder below is only for `agent --workspace`.',
  });
});

app.get('/api/agent-modes', async (req, res) => {
  try {
    const workspaceRoot = resolveRunWorkspace(
      typeof req.query.workspaceRoot === 'string' ? req.query.workspaceRoot : ''
    );
    const agentBinRaw = typeof req.query.agentBin === 'string' ? req.query.agentBin : '';
    const out = await listAgentModesFromCli(workspaceRoot, { agentBin: agentBinRaw });
    if (out.ok) {
      res.json({
        ok: true,
        workspaceRoot,
        modes: out.modes,
        argvJoined: out.argvJoined,
        note:
          'Modes are parsed from `agent --help` (choices after --mode). "agent" is the default full-tools mode (no --mode flag).',
      });
      return;
    }
    res.json({
      ok: false,
      workspaceRoot,
      modes: [],
      error: 'Could not read execution modes from Cursor CLI help output.',
      exitCode: out.exitCode,
      stderr: out.stderr?.slice(0, 2000),
      stdoutPreview: out.stdoutPreview,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, modes: [], ok: false });
  }
});

app.get('/api/models', async (req, res) => {
  try {
    const workspaceRoot = resolveRunWorkspace(
      typeof req.query.workspaceRoot === 'string' ? req.query.workspaceRoot : ''
    );
    const agentBinRaw = typeof req.query.agentBin === 'string' ? req.query.agentBin : '';
    const out = await listModelsFromCli(workspaceRoot, { agentBin: agentBinRaw });
    if (out.ok) {
      res.json({
        ok: true,
        workspaceRoot,
        models: out.models,
        argvJoined: out.argvJoined,
        ...(typeof out.note === 'string' && out.note.trim() ? { note: out.note.trim() } : {}),
      });
      return;
    }
    res.json({
      ok: false,
      workspaceRoot,
      models: [],
      error: 'Could not parse model list from Cursor CLI.',
      exitCode: out.exitCode,
      stderr: out.stderr?.slice(0, 2000),
      stdoutPreview: out.stdoutPreview,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, models: [], ok: false });
  }
});

app.get('/api/agents', async (_req, res) => {
  try {
    const agentCatalogRoot = getAgentCatalogRoot();
    const agents = await listAgents(agentCatalogRoot);
    res.json({ agentCatalogRoot, agents });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/run', async (req, res) => {
  try {
    const runWorkspace = resolveRunWorkspace(
      typeof req.body?.workspaceRoot === 'string' ? req.body.workspaceRoot : ''
    );
    const agentCatalogRoot = getAgentCatalogRoot();
    const agentName =
      typeof req.body?.agentName === 'string' ? req.body.agentName.trim() : req.body?.agentName;
    const userMessage = req.body?.userMessage ?? '';
    const outputFormat = req.body?.outputFormat;
    const model = typeof req.body?.model === 'string' ? req.body.model : '';
    const executionMode =
      typeof req.body?.executionMode === 'string' ? req.body.executionMode : '';
    const agentBinRaw = typeof req.body?.agentBin === 'string' ? req.body.agentBin : '';

    if (!agentName || typeof agentName !== 'string') {
      res.status(400).json({ error: 'agentName is required' });
      return;
    }

    let combinedPrompt;
    if (agentName === USER_PROMPT_ONLY_AGENT) {
      const u = String(userMessage ?? '').trim();
      if (!u) {
        res.status(400).json({
          error:
            'userMessage is required when Agent is None (user message only).',
        });
        return;
      }
      combinedPrompt = u;
    } else {
      const systemPrompt = await buildSystemPromptFromAgent(agentCatalogRoot, agentName);
      if (!systemPrompt) {
        res.status(404).json({ error: `Unknown agent: ${agentName}` });
        return;
      }
      combinedPrompt = buildCombinedPrompt(systemPrompt, userMessage);
    }

    const result = await runCursorAgent({
      workspaceRoot: runWorkspace,
      combinedPrompt,
      outputFormat,
      model,
      executionMode,
      agentBin: agentBinRaw,
    });

    let parsedJson = null;
    if (result.stdout && (outputFormat === 'json' || !outputFormat || outputFormat === 'stream-json')) {
      try {
        parsedJson = JSON.parse(result.stdout);
      } catch {
        parsedJson = null;
      }
    }

    res.json({
      agentName,
      userPromptOnly: agentName === USER_PROMPT_ONLY_AGENT,
      workspaceRoot: runWorkspace,
      agentCatalogRoot,
      agentCliUsed: resolveEffectiveAgentBin(agentBinRaw),
      outputFormat: outputFormat || 'json',
      model: model?.trim() || null,
      executionMode: executionMode?.trim() || null,
      ...result,
      parsedJson,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Kiro CLI HTTP surface (same `.kiro/agents` catalog; different subprocess binary) ───

app.get('/api/kiro/health', async (req, res) => {
  const agentCatalogRoot = getAgentCatalogRoot();
  const defaultRunWorkspace = resolveRunWorkspace('');
  const kiroBinRaw = typeof req.query.kiroBin === 'string' ? req.query.kiroBin : '';
  const effectiveKiroBin = resolveEffectiveKiroBin(kiroBinRaw);
  const probe = await probeKiroBinary({ maxMs: 6000, kiroBin: kiroBinRaw });
  res.json({
    ok: true,
    agentCatalogRoot,
    workspaceRoot: agentCatalogRoot,
    defaultRunWorkspace,
    envTargetWorkspace: process.env.TARGET_WORKSPACE?.trim() || null,
    kiroBin: effectiveKiroBin,
    kiroBinUsedFrom: kiroBinRaw.trim() ? 'request' : 'server',
    serverDefaultKiroBin: KIRO_BIN,
    kiroBinResolution: KIRO_BIN_RESOLUTION,
    kiroCli: probe,
    agentsDir: agentsDir(agentCatalogRoot),
    agentsNote:
      'Agent JSON from agentCatalogRoot/.kiro/agents. Target workspace is where Kiro tools run (same as Cursor flow).',
  });
});

app.get('/api/kiro/agent-modes', async (req, res) => {
  try {
    const workspaceRoot = resolveRunWorkspace(
      typeof req.query.workspaceRoot === 'string' ? req.query.workspaceRoot : ''
    );
    const kiroBinRaw = typeof req.query.kiroBin === 'string' ? req.query.kiroBin : '';
    const out = await listKiroAgentModesFromCli(workspaceRoot, { kiroBin: kiroBinRaw });
    if (out.ok) {
      res.json({
        ok: true,
        workspaceRoot,
        modes: out.modes,
        argvJoined: out.argvJoined,
        note: out.note,
      });
      return;
    }
    res.json({
      ok: false,
      workspaceRoot,
      modes: [],
      error: 'Could not read execution modes from Kiro CLI help output.',
      exitCode: out.exitCode,
      stderr: out.stderr?.slice(0, 2000),
      stdoutPreview: out.stdoutPreview,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, modes: [], ok: false });
  }
});

app.get('/api/kiro/models', async (req, res) => {
  try {
    const workspaceRoot = resolveRunWorkspace(
      typeof req.query.workspaceRoot === 'string' ? req.query.workspaceRoot : ''
    );
    const kiroBinRaw = typeof req.query.kiroBin === 'string' ? req.query.kiroBin : '';
    const out = await listKiroModelsFromCli(workspaceRoot, { kiroBin: kiroBinRaw });
    if (out.ok) {
      res.json({
        ok: true,
        workspaceRoot,
        models: out.models,
        argvJoined: out.argvJoined,
        ...(typeof out.note === 'string' && out.note.trim() ? { note: out.note.trim() } : {}),
      });
      return;
    }
    res.json({
      ok: false,
      workspaceRoot,
      models: [],
      error: 'Could not parse model list from Kiro CLI.',
      exitCode: out.exitCode,
      stderr: out.stderr?.slice(0, 2000),
      stdoutPreview: out.stdoutPreview,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, models: [], ok: false });
  }
});

app.post('/api/kiro/run', async (req, res) => {
  try {
    const runWorkspace = resolveRunWorkspace(
      typeof req.body?.workspaceRoot === 'string' ? req.body.workspaceRoot : ''
    );
    const agentCatalogRoot = getAgentCatalogRoot();
    const agentName =
      typeof req.body?.agentName === 'string' ? req.body.agentName.trim() : req.body?.agentName;
    const userMessage = req.body?.userMessage ?? '';
    const outputFormat = req.body?.outputFormat;
    const model = typeof req.body?.model === 'string' ? req.body.model : '';
    const executionMode =
      typeof req.body?.executionMode === 'string' ? req.body.executionMode : '';
    const kiroBinRaw = typeof req.body?.kiroBin === 'string' ? req.body.kiroBin : '';

    if (!agentName || typeof agentName !== 'string') {
      res.status(400).json({ error: 'agentName is required' });
      return;
    }

    let combinedPrompt;
    if (agentName === USER_PROMPT_ONLY_AGENT) {
      const u = String(userMessage ?? '').trim();
      if (!u) {
        res.status(400).json({
          error: 'userMessage is required when Agent is None (user message only).',
        });
        return;
      }
      combinedPrompt = u;
    } else {
      const systemPrompt = await buildSystemPromptFromAgent(agentCatalogRoot, agentName);
      if (!systemPrompt) {
        res.status(404).json({ error: `Unknown agent: ${agentName}` });
        return;
      }
      combinedPrompt = buildCombinedPrompt(systemPrompt, userMessage);
    }

    const result = await runKiroAgent({
      workspaceRoot: runWorkspace,
      combinedPrompt,
      model,
      executionMode,
      kiroBin: kiroBinRaw,
    });

    let parsedJson = null;
    if (result.stdout && (outputFormat === 'json' || !outputFormat || outputFormat === 'stream-json')) {
      try {
        parsedJson = JSON.parse(result.stdout);
      } catch {
        parsedJson = null;
      }
    }

    res.json({
      agentName,
      userPromptOnly: agentName === USER_PROMPT_ONLY_AGENT,
      workspaceRoot: runWorkspace,
      agentCatalogRoot,
      kiroCliUsed: resolveEffectiveKiroBin(kiroBinRaw),
      outputFormat: outputFormat || 'json',
      model: model?.trim() || null,
      executionMode: executionMode?.trim() || null,
      backend: 'kiro',
      ...result,
      parsedJson,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Workspace Read/Write Operations for VS Code & External Clients ───

app.post('/api/workspace/read', async (req, res) => {
  try {
    const pattern = typeof req.body?.pattern === 'string' ? req.body.pattern.trim() : '';
    const workspaceRoot = resolveRunWorkspace(
      typeof req.body?.workspaceRoot === 'string' ? req.body.workspaceRoot : ''
    );

    if (!pattern) {
      res.status(400).json({ error: 'pattern is required' });
      return;
    }

    const glob = await import('glob');
    const files = await glob.glob(pattern, { cwd: workspaceRoot, nodir: true });
    const results = [];

    for (const file of files.slice(0, 100)) {
      try {
        const fullPath = path.join(workspaceRoot, file);
        const stat = statSync(fullPath);
        if (stat.size > 1024 * 1024) continue;
        const content = readFileSync(fullPath, 'utf8');
        results.push({
          path: file,
          size: stat.size,
          content,
        });
      } catch {
        /* skip unreadable files */
      }
    }

    res.json({
      ok: true,
      workspaceRoot,
      pattern,
      fileCount: results.length,
      files: results,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/workspace/write', async (req, res) => {
  try {
    const filePath = typeof req.body?.filePath === 'string' ? req.body.filePath.trim() : '';
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    const workspaceRoot = resolveRunWorkspace(
      typeof req.body?.workspaceRoot === 'string' ? req.body.workspaceRoot : ''
    );

    if (!filePath) {
      res.status(400).json({ error: 'filePath is required' });
      return;
    }

    const fullPath = path.resolve(workspaceRoot, filePath);
    const normalizedRoot = path.resolve(workspaceRoot);

    if (!fullPath.startsWith(normalizedRoot)) {
      res.status(403).json({ error: 'path traversal not allowed' });
      return;
    }

    const dir = path.dirname(fullPath);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }

    await fs.writeFile(fullPath, content, 'utf8');

    res.json({
      ok: true,
      filePath,
      workspaceRoot,
      size: content.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/workspace/delete', async (req, res) => {
  try {
    const filePath = typeof req.body?.filePath === 'string' ? req.body.filePath.trim() : '';
    const workspaceRoot = resolveRunWorkspace(
      typeof req.body?.workspaceRoot === 'string' ? req.body.workspaceRoot : ''
    );

    if (!filePath) {
      res.status(400).json({ error: 'filePath is required' });
      return;
    }

    const fullPath = path.resolve(workspaceRoot, filePath);
    const normalizedRoot = path.resolve(workspaceRoot);

    if (!fullPath.startsWith(normalizedRoot)) {
      res.status(403).json({ error: 'path traversal not allowed' });
      return;
    }

    if (existsSync(fullPath)) {
      await fs.rm(fullPath, { recursive: true });
    }

    res.json({
      ok: true,
      filePath,
      workspaceRoot,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── MCP: Read .env from target workspace and return MCP-relevant credentials ───

/**
 * Parse a .env file and return key-value pairs.
 * Only returns keys that are relevant to MCP servers (Jira, GitHub).
 */
function parseDotEnv(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

const MCP_ENV_KEYS = {
  jira: ['ATLASSIAN_SITE_NAME', 'ATLASSIAN_USER_EMAIL', 'ATLASSIAN_API_TOKEN', 'JIRA_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY'],
  github: ['GITHUB_PERSONAL_ACCESS_TOKEN', 'GITHUB_TOKEN'],
};

app.post('/api/mcp/read-env', async (req, res) => {
  try {
    const workspaceRoot = resolveRunWorkspace(
      typeof req.body?.workspaceRoot === 'string' ? req.body.workspaceRoot : ''
    );
    const envPath = path.join(workspaceRoot, '.env');

    if (!existsSync(envPath)) {
      res.json({ ok: false, error: `No .env file found at ${envPath}`, found: {}, workspaceRoot });
      return;
    }

    const text = readFileSync(envPath, 'utf8');
    const all = parseDotEnv(text);

    // Extract only MCP-relevant keys, mask values for security (show first 4 chars + ***)
    const found = {};
    for (const [service, keys] of Object.entries(MCP_ENV_KEYS)) {
      for (const key of keys) {
        if (all[key]) {
          if (!found[service]) found[service] = {};
          const val = all[key];
          found[service][key] = val.length > 4 ? `${val.slice(0, 4)}${'*'.repeat(Math.min(val.length - 4, 8))}` : '****';
        }
      }
    }

    res.json({ ok: true, found, workspaceRoot, envPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Workspace-local MCP dependencies (never global/npm -g — avoids IDE/agent startup surprises). */
const MCP_PACKAGES = {
  jira: '@aashari/mcp-server-atlassian-jira',
  github: '@modelcontextprotocol/server-github',
};

const MCP_BUNDLE_DIR_SEGMENTS = ['.kiro', 'settings', 'mcp-bundles'];

function getMcpBundlesDir(workspaceRoot) {
  return path.join(workspaceRoot, ...MCP_BUNDLE_DIR_SEGMENTS);
}

function resolveInstalledMcpEntryScript(bundlesDir, packageName) {
  const base = path.join(bundlesDir, 'node_modules', ...packageName.split('/'));
  const candidates = [
    path.join(base, 'dist', 'index.js'),
    path.join(base, 'build', 'index.js'),
    path.join(base, 'index.js'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Run `npm install` in a directory (local node_modules).
 * Returns { ok, stdout, stderr, exitCode }.
 */
function runNpmInstallInDir(cwd) {
  return new Promise((resolve) => {
    const spawnOpts =
      process.platform === 'win32'
        ? { cwd, windowsHide: true, shell: true }
        : { cwd, windowsHide: true, shell: false };
    let child;
    try {
      child = spawn('npm', ['install'], spawnOpts);
    } catch (e) {
      resolve({ ok: false, stdout: '', stderr: String(e?.message || e), exitCode: null });
      return;
    }
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      resolve({ ok: code === 0, stdout, stderr, exitCode: code });
    });
    child.on('error', (e) => {
      resolve({ ok: false, stdout, stderr: stderr + e.message, exitCode: null });
    });
  });
}

/**
 * Ensure `.kiro/settings/mcp-bundles/package.json` lists MCP packages and `npm install` has been run.
 * Kiro/agent only needs to spawn `node <abs path>` — no install at agent run time.
 */
async function ensureWorkspaceMcpBundles(workspaceRoot, serverKeys) {
  const bundlesDir = getMcpBundlesDir(workspaceRoot);
  await fs.mkdir(bundlesDir, { recursive: true });

  const gitignorePath = path.join(bundlesDir, '.gitignore');
  if (!existsSync(gitignorePath)) {
    await fs.writeFile(gitignorePath, 'node_modules/\n', 'utf8');
  }

  const pkgPath = path.join(bundlesDir, 'package.json');
  let prevDeps = {};
  if (existsSync(pkgPath)) {
    try {
      prevDeps = { ...(JSON.parse(readFileSync(pkgPath, 'utf8')).dependencies || {}) };
    } catch {
      prevDeps = {};
    }
  }

  const mergedDeps = { ...prevDeps };
  for (const key of serverKeys) {
    const nm = MCP_PACKAGES[key];
    if (nm) mergedDeps[nm] = mergedDeps[nm] || '*';
  }

  const pkgJson = {
    name: 'kiro-mcp-bundles',
    private: true,
    version: '1.0.0',
    description: 'Local MCP server packages for this workspace (managed by orchestration UI).',
    dependencies: mergedDeps,
  };

  const nextText = `${JSON.stringify(pkgJson, null, 2)}\n`;
  const prevText = existsSync(pkgPath) ? readFileSync(pkgPath, 'utf8') : '';
  const depsChanged = prevText !== nextText;
  await fs.writeFile(pkgPath, nextText, 'utf8');

  let missing = false;
  for (const key of serverKeys) {
    const nm = MCP_PACKAGES[key];
    if (nm && !resolveInstalledMcpEntryScript(bundlesDir, nm)) missing = true;
  }

  if (depsChanged || missing) {
    const npmRes = await runNpmInstallInDir(bundlesDir);
    if (!npmRes.ok) {
      return {
        ok: false,
        bundlesDir,
        pkgPath,
        stderr: npmRes.stderr,
        stdout: npmRes.stdout,
      };
    }
  }

  const resolved = {};
  for (const key of serverKeys) {
    const nm = MCP_PACKAGES[key];
    if (!nm) continue;
    const script = resolveInstalledMcpEntryScript(bundlesDir, nm);
    if (!script) {
      return {
        ok: false,
        bundlesDir,
        pkgPath,
        error: `After npm install, entry script not found for ${nm}`,
      };
    }
    resolved[key] = { command: 'node', args: [script], packageName: nm };
  }

  return { ok: true, bundlesDir, pkgPath, resolved };
}

// ─── MCP: Install packages into workspace bundle (same location configure uses) ─

app.post('/api/mcp/install', async (req, res) => {
  try {
    const workspaceRoot = resolveRunWorkspace(
      typeof req.body?.workspaceRoot === 'string' ? req.body.workspaceRoot : ''
    );
    const servers = Array.isArray(req.body?.servers) ? req.body.servers : ['jira', 'github'];

    if (!workspaceRoot) {
      res.status(400).json({
        ok: false,
        error: 'workspaceRoot is required. MCP packages install under <workspace>/.kiro/settings/mcp-bundles (not globally).',
      });
      return;
    }

    const unknown = servers.filter((s) => !MCP_PACKAGES[s]);
    if (unknown.length) {
      res.status(400).json({ ok: false, error: `Unknown MCP server: ${unknown.join(', ')}` });
      return;
    }

    const bundle = await ensureWorkspaceMcpBundles(workspaceRoot, servers);
    if (!bundle.ok) {
      res.status(500).json({
        ok: false,
        error: bundle.error || bundle.stderr || 'npm install in mcp-bundles failed',
        bundlesDir: bundle.bundlesDir,
        pkgPath: bundle.pkgPath,
      });
      return;
    }

    const results = {};
    for (const server of servers) {
      const r = bundle.resolved[server];
      results[server] = {
        ok: true,
        localBundle: true,
        bundlesDir: bundle.bundlesDir,
        command: r.command,
        path: r.args[0],
      };
    }

    res.json({
      ok: true,
      results,
      bundlesDir: bundle.bundlesDir,
      pkgPath: bundle.pkgPath,
      hint: 'Dependencies live under workspace .kiro/settings/mcp-bundles — agent runs node on these paths only (no install at run time).',
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ─── MCP: Configure mcp.json from workspace .env ─────────────────────────────

app.post('/api/mcp/configure', async (req, res) => {
  try {
    const workspaceRoot = resolveRunWorkspace(
      typeof req.body?.workspaceRoot === 'string' ? req.body.workspaceRoot : ''
    );
    const selectedServers = Array.isArray(req.body?.servers) ? req.body.servers : ['jira', 'github'];

    const envPath = path.join(workspaceRoot, '.env');
    if (!existsSync(envPath)) {
      res.status(400).json({ ok: false, error: `No .env file found at ${envPath}. Create it with your Jira/GitHub credentials.` });
      return;
    }

    const envVars = parseDotEnv(readFileSync(envPath, 'utf8'));

    let jiraSiteName;
    let jiraEmail;
    let jiraToken;
    if (selectedServers.includes('jira')) {
      jiraSiteName = envVars.ATLASSIAN_SITE_NAME || envVars.JIRA_URL || '';
      jiraEmail = envVars.ATLASSIAN_USER_EMAIL || envVars.JIRA_EMAIL || '';
      jiraToken = envVars.ATLASSIAN_API_TOKEN || envVars.JIRA_API_TOKEN || '';
      if (!jiraSiteName || !jiraEmail || !jiraToken) {
        res.status(400).json({
          ok: false,
          error: 'Jira credentials missing from .env. Required: ATLASSIAN_SITE_NAME, ATLASSIAN_USER_EMAIL, ATLASSIAN_API_TOKEN',
          missing: {
            ATLASSIAN_SITE_NAME: !jiraSiteName,
            ATLASSIAN_USER_EMAIL: !jiraEmail,
            ATLASSIAN_API_TOKEN: !jiraToken,
          },
        });
        return;
      }
    }

    let githubToken;
    if (selectedServers.includes('github')) {
      githubToken = envVars.GITHUB_PERSONAL_ACCESS_TOKEN || envVars.GITHUB_TOKEN || '';
      if (!githubToken) {
        res.status(400).json({
          ok: false,
          error: 'GitHub credentials missing from .env. Required: GITHUB_PERSONAL_ACCESS_TOKEN',
          missing: { GITHUB_PERSONAL_ACCESS_TOKEN: true },
        });
        return;
      }
    }

    const bundle = await ensureWorkspaceMcpBundles(workspaceRoot, selectedServers);
    if (!bundle.ok) {
      res.status(500).json({
        ok: false,
        error: bundle.error || bundle.stderr || 'npm install in .kiro/settings/mcp-bundles failed',
        bundlesDir: bundle.bundlesDir,
        pkgPath: bundle.pkgPath,
      });
      return;
    }

    const installStatus = Object.fromEntries(
      selectedServers.map((k) => [k, 'workspace_bundle'])
    );

    const mcpServers = {};

    if (selectedServers.includes('jira')) {
      const jiraCmd = bundle.resolved.jira;
      mcpServers.jira = {
        command: jiraCmd.command,
        args: jiraCmd.args,
        env: {
          ATLASSIAN_SITE_NAME: jiraSiteName,
          ATLASSIAN_USER_EMAIL: jiraEmail,
          ATLASSIAN_API_TOKEN: jiraToken,
          ...(envVars.JIRA_PROJECT_KEY ? { JIRA_PROJECT_KEY: envVars.JIRA_PROJECT_KEY } : {}),
        },
        disabled: false,
        autoApprove: ['jira_get', 'jira_post', 'jira_put', 'jira_patch', 'jira_delete'],
      };
    }

    if (selectedServers.includes('github')) {
      const githubCmd = bundle.resolved.github;
      mcpServers.github = {
        command: githubCmd.command,
        args: githubCmd.args,
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: githubToken },
        disabled: false,
        autoApprove: [
          'create_or_update_file', 'push_files', 'create_pull_request',
          'create_branch', 'get_file_contents', 'list_commits',
          'get_pull_request', 'list_pull_requests', 'merge_pull_request',
        ],
        disabledTools: [
          'create_repository', 'create_issue', 'fork_repository',
          'list_issues', 'update_issue', 'add_issue_comment', 'search_issues',
        ],
      };
    }

    // Merge with existing mcp.json if present (Kiro + Cursor may each have prior edits)
    const mcpJsonPath = path.join(workspaceRoot, '.kiro', 'settings', 'mcp.json');
    const cursorMcpJsonPath = path.join(workspaceRoot, '.cursor', 'mcp.json');
    let existingKiro = {};
    if (existsSync(mcpJsonPath)) {
      try {
        existingKiro = JSON.parse(readFileSync(mcpJsonPath, 'utf8'));
      } catch {
        /* ignore malformed existing file */
      }
    }
    let existingCursor = {};
    if (existsSync(cursorMcpJsonPath)) {
      try {
        existingCursor = JSON.parse(readFileSync(cursorMcpJsonPath, 'utf8'));
      } catch {
        /* ignore */
      }
    }

    const merged = {
      mcpServers: {
        ...(existingKiro.mcpServers || {}),
        ...(existingCursor.mcpServers || {}),
        ...mcpServers,
      },
    };

    const mcpDir = path.dirname(mcpJsonPath);
    if (!existsSync(mcpDir)) {
      await fs.mkdir(mcpDir, { recursive: true });
    }
    const cursorDir = path.dirname(cursorMcpJsonPath);
    if (!existsSync(cursorDir)) {
      await fs.mkdir(cursorDir, { recursive: true });
    }

    const mergedBody = JSON.stringify(merged, null, 2);
    await fs.writeFile(mcpJsonPath, mergedBody, 'utf8');
    // Cursor Agent CLI loads project MCP from `.cursor/mcp.json` (Kiro uses `.kiro/settings/mcp.json`).
    await fs.writeFile(cursorMcpJsonPath, mergedBody, 'utf8');

    res.json({
      ok: true,
      mcpJsonPath,
      cursorMcpJsonPath,
      workspaceRoot,
      bundlesDir: bundle.bundlesDir,
      pkgPath: bundle.pkgPath,
      configured: Object.keys(mcpServers),
      installStatus,
      message: `MCP configured: ${Object.keys(mcpServers).join(', ')} → ${mcpJsonPath} and ${cursorMcpJsonPath} (Cursor CLI + Kiro; bundles in ${bundle.bundlesDir})`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// In single-service deployments (Render Web Service), serve the built frontend from repo /dist.
if (existsSync(FRONTEND_DIST_DIR)) {
  app.use(express.static(FRONTEND_DIST_DIR));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST_DIR, 'index.html'));
  });
}


function startHttpServerWithFallback(startPort, maxAttempts = 20) {
  const tryPort = (port, attemptsLeft) => {
    ACTIVE_PORT = port;
    const httpServer = app.listen(port, HOST, () => {
      try {
        writeFileSync(DEV_API_PORT_FILE, `${ACTIVE_PORT}\n`, 'utf8');
      } catch {
        /* ignore */
      }
      // eslint-disable-next-line no-console
      console.log(
        `[cursor-agent-bridge] http://${HOST}:${ACTIVE_PORT}  catalog=${getAgentCatalogRoot()}  agent=${AGENT_BIN}  kiro=${KIRO_BIN}`
      );
      if (ACTIVE_PORT !== PREFERRED_PORT) {
        // eslint-disable-next-line no-console
        console.warn(
          `[cursor-agent-bridge] Preferred port ${PREFERRED_PORT} was busy, using ${ACTIVE_PORT}.`
        );
      }
    });

    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[cursor-agent-bridge] Port ${port} is busy; retrying on ${port + 1}...`
        );
        tryPort(port + 1, attemptsLeft - 1);
        return;
      }
      if (err.code === 'EADDRINUSE') {
        // eslint-disable-next-line no-console
        console.error(
          `[cursor-agent-bridge] Could not find a free port starting at ${startPort}.`
        );
      } else {
        // eslint-disable-next-line no-console
        console.error('[cursor-agent-bridge] listen error:', err.message);
      }
      process.exit(1);
    });
  };

  tryPort(startPort, maxAttempts);
}

startHttpServerWithFallback(PREFERRED_PORT);

process.on('SIGINT', () => {
  clearDevApiPortFile();
  process.exit(0);
});

process.on('SIGTERM', () => {
  clearDevApiPortFile();
  process.exit(0);
});

process.on('exit', () => {
  clearDevApiPortFile();
});
