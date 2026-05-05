# Setup, build, Docker, CI

## Layout

```
cursor-agent-bridge/
├── package.json
├── package-lock.json
├── server/index.mjs      # Express API
├── src/                  # React UI (Vite)
├── vite.config.ts
└── ...
```

This folder is a **single npm package** (no nested workspaces).

## Local development

```bash
npm install
npm run dev              # Express + Vite together
# or
npm run dev:server       # API only
npm run dev:ui           # UI only
```

## Build

```bash
npm run build            # Vite production bundle → dist/
```

## Docker

```bash
docker build -t cursor-agent-bridge:latest .
docker run -p 3847:3847 cursor-agent-bridge:latest
```

## CI

See [.github/workflows/build.yml](.github/workflows/build.yml): checkout, `npm install`, `npm run build`, optional tests.

## Clean reinstall

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
```
