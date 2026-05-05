/** When set, all API calls go here (bypasses Vite proxy). Must match `AGENT_BRIDGE_PORT` on the server. */
export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '').trim() ?? '';
  const p = path.startsWith('/') ? path : `/${path}`;
  if (base) return `${base}${p}`;
  return p;
}
