import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import http from 'node:http';
import type { Connect, Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Read on every /api request so the proxy never sticks to a stale port (fixes Express 404 on /api/*). */
function readBridgePort(mode: string): string {
  const portFile = path.join(__dirname, '.dev-api-port');
  try {
    if (existsSync(portFile)) {
      const n = readFileSync(portFile, 'utf8').trim();
      if (/^\d+$/.test(n)) return n;
    }
  } catch {
    /* ignore */
  }
  const env = loadEnv(mode, __dirname, '');
  return (
    env.AGENT_BRIDGE_PORT ||
    process.env.AGENT_BRIDGE_PORT ||
    '3847'
  );
}

function installBridgeApiProxy(mode: string, middlewares: Connect.Server) {
  middlewares.use((req, res, next) => {
    const url = req.url ?? '';
    if (!url.startsWith('/api')) {
      next();
      return;
    }
    const port = readBridgePort(mode);
    const targetHost = '127.0.0.1';
    const headers = { ...req.headers } as http.OutgoingHttpHeaders;
    headers.host = `${targetHost}:${port}`;
    const opts: http.RequestOptions = {
      protocol: 'http:',
      hostname: targetHost,
      port: Number(port),
      path: url,
      method: req.method,
      headers,
    };
    const proxyReq = http.request(opts, (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(
        `Bad gateway: no API at http://${targetHost}:${port}. Start the bridge server (node server/index.mjs) or set AGENT_BRIDGE_PORT.`
      );
    });
    req.on('aborted', () => {
      proxyReq.destroy();
    });
    req.pipe(proxyReq);
  });
}

function bridgeApiProxyPlugin(mode: string): Plugin {
  return {
    name: 'cursor-agent-bridge-dynamic-api-proxy',
    enforce: 'pre',
    configureServer(server) {
      installBridgeApiProxy(mode, server.middlewares);
    },
    configurePreviewServer(server) {
      installBridgeApiProxy(mode, server.middlewares);
    },
  };
}

export default defineConfig(({ mode }) => {
  // eslint-disable-next-line no-console
  console.log(
    '[cursor-agent-bridge/vite] /api → bridge: port from .dev-api-port (per request) or AGENT_BRIDGE_PORT'
  );

  return {
    plugins: [react(), bridgeApiProxyPlugin(mode)],
    server: {
      port: 5173,
      strictPort: true,
    },
    preview: {
      port: 4173,
      strictPort: true,
    },
  };
});
