/**
 * Build absolute URL for cursor-agent-bridge HTTP API.
 * @param {string} baseUrl - e.g. `http://127.0.0.1:3847` or empty for same-origin (Vite proxy).
 * @param {string} path - e.g. `/api/models`
 */
export function agentBridgeApiUrl(baseUrl, path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const t = typeof baseUrl === "string" ? baseUrl.trim().replace(/\/$/, "") : "";
  if (t) return `${t}${p}`;
  return p;
}

export async function agentBridgeFetchJson(baseUrl, path, init = {}) {
  const url = agentBridgeApiUrl(baseUrl, path);
  const { timeoutMs = 120000, signal: externalSignal, ...fetchInit } = init;
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = setTimeout(() => ctrl?.abort(), timeoutMs);

  // If caller provided an external abort signal, forward it to our controller
  const onExternalAbort = () => ctrl?.abort();
  externalSignal?.addEventListener("abort", onExternalAbort);

  try {
    const r = await fetch(url, {
      ...fetchInit,
      signal: ctrl?.signal,
      headers: { Accept: "application/json", ...fetchInit.headers },
    });
    const text = await r.text();
    let data;
    try {
      data = text.trim() ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Invalid JSON from bridge (${r.status}): ${text.slice(0, 200)}`);
    }
    if (!r.ok) throw new Error(data.error || `${r.status} ${r.statusText}`);
    return data;
  } catch (err) {
    const name = err?.name || "";
    const msg = typeof err?.message === "string" ? err.message : String(err || "");
    const isAbort = name === "AbortError";
    const isNetworkFailure =
      isAbort ||
      err instanceof TypeError ||
      /failed to fetch|networkerror|load failed|aborted/i.test(msg);
    if (!isNetworkFailure || msg.startsWith("Invalid JSON from bridge")) {
      throw err;
    }

    const baseHint =
      "Start cursor-agent-bridge on port 3847 (default). Empty base URL uses this app’s `/api` path; with Vite, that proxies to http://127.0.0.1:3847 — if the bridge is down or the CLI run exceeds the proxy idle timeout, DevTools shows empty response and “Failed to fetch”.";
    const directHint =
      "Set Agent Bridge base URL to http://127.0.0.1:3847 in project setup to bypass the Vite proxy.";

    if (isAbort) {
      throw new Error(
        `${msg} Request timed out or was aborted after ${timeoutMs}ms — ${url}. ${baseHint} ${directHint}`,
      );
    }
    throw new Error(`${msg} (${url}). ${baseHint} ${directHint}`);
  } finally {
    clearTimeout(t);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

/** Cursor Agent CLI: GET /api/models */
export async function fetchCursorModels({ baseUrl, workspaceRoot, agentBin }) {
  const qs = new URLSearchParams();
  if (workspaceRoot?.trim()) qs.set("workspaceRoot", workspaceRoot.trim());
  if (agentBin?.trim()) qs.set("agentBin", agentBin.trim());
  const suffix = qs.toString() ? `?${qs}` : "";
  return agentBridgeFetchJson(baseUrl, `/api/models${suffix}`, { timeoutMs: 120000 });
}

/** Kiro CLI: GET /api/kiro/models */
export async function fetchKiroModels({ baseUrl, workspaceRoot, kiroBin }) {
  const qs = new URLSearchParams();
  if (workspaceRoot?.trim()) qs.set("workspaceRoot", workspaceRoot.trim());
  if (kiroBin?.trim()) qs.set("kiroBin", kiroBin.trim());
  const suffix = qs.toString() ? `?${qs}` : "";
  return agentBridgeFetchJson(baseUrl, `/api/kiro/models${suffix}`, { timeoutMs: 120000 });
}

export async function fetchBridgePing(baseUrl) {
  return agentBridgeFetchJson(baseUrl, "/api/ping", { timeoutMs: 8000 });
}

/** Read MCP-relevant credentials from the target workspace .env file */
export async function readWorkspaceEnvForMcp({ baseUrl, workspaceRoot }) {
  return agentBridgeFetchJson(baseUrl, "/api/mcp/read-env", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceRoot }),
    timeoutMs: 10000,
  });
}

/** Write .kiro/settings/mcp.json in the target workspace using credentials from its .env */
export async function configureMcpFromEnv({ baseUrl, workspaceRoot, servers }) {
  // Bridge runs `npm install` under workspace `.kiro/settings/mcp-bundles` when needed — can take several minutes first time.
  return agentBridgeFetchJson(baseUrl, "/api/mcp/configure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceRoot, servers }),
    timeoutMs: 900_000,
  });
}

/** Install MCP packages into `<workspaceRoot>/.kiro/settings/mcp-bundles` (same as configure uses). Requires workspaceRoot. */
export async function installMcpPackages({ baseUrl, workspaceRoot, servers }) {
  return agentBridgeFetchJson(baseUrl, "/api/mcp/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceRoot, servers }),
    timeoutMs: 900_000,
  });
}

