# Cursor Agent Bridge — visual architecture

See [WORKFLOW-ARCHITECTURE.md](./WORKFLOW-ARCHITECTURE.md) for full detail.

## Overall system

```
┌─────────────────────────────────────────────────────────────────────┐
│                         YOUR LOCAL MACHINE                           │
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐   │
│  │ Browser UI  │    │ Cursor CLI  │    │ Kiro CLI                │   │
│  │ (Vite app)  │    │ `agent`     │    │ `kiro`                  │   │
│  └──────┬──────┘    └──────▲──────┘    └──────────▲──────────────┘   │
│         │                  │                       │                  │
│         │ fetch /api/*     │ spawn               │ spawn             │
│         ▼                  │                       │                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Express bridge (server/index.mjs)                │   │
│  │              e.g. localhost:3847                              │   │
│  │  /api/run  /api/models  /api/agent-modes  /api/kiro/*  …      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

- **Browser**: talks to the bridge over HTTP (dev: Vite proxies `/api` to the bridge).
- **Cursor / Kiro**: invoked by the bridge as subprocesses (`agent …` or `kiro chat …`).

## Run flow (Cursor backend)

```
Browser          Express                    Cursor Agent CLI
   │                │                              ▲
   │ POST /api/run  │  load .kiro/agents, spawn    │
   └───────────────►│──────────────────────────────┘
                    │  JSON response → UI
```

## Security boundary

Untrusted input arrives over HTTP from the browser (same machine in typical dev). The bridge resolves paths, applies timeouts, and spawns CLIs — treat the server as the trust boundary.
