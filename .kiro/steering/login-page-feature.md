# Login page feature (fresh folder)

Use when the user targets an **empty or new project folder** and wants a **standalone login UI** scaffold.

## Defaults (unless the user message specifies otherwise)

- **Stack**: Vite + React 18+ + TypeScript + Tailwind CSS.
- **Scope**: Client-only login **page** (and minimal layout/routing if needed to show it). No backend unless the user asks.
- **Folder**: Treat the given workspace as the app root; create/adjust only files under that root.

## Deliverables

1. **Routes / entry** — A dedicated route or default view that renders the login page (e.g. React Router or a single `App` that shows login first).
2. **Login page UI** — Email or username + password fields, submit button, “Forgot password?” placeholder link (non-functional unless requested), optional “Remember me”.
3. **Validation** — Inline errors or `aria-live` for submit failures; disable double-submit while “loading”.
4. **Accessibility** — Labels tied to inputs (`htmlFor` / `id`), focus order, visible focus, `type="password"` with optional show/hide only if simple.
5. **Styling** — Tailwind only for static layout; follow `.kiro/steering/frontend-standards.md`.
6. **README snippet** — Short “how to run” (`npm install`, `npm run dev`) if the folder is new.

## Security wording (client-only)

- Do **not** hardcode real secrets. Use env placeholders (e.g. `VITE_API_URL`) only if a stub `fetch` is requested.
- State clearly in comments that production auth belongs on the server.

## Output discipline

- List files created or modified at the end.
- If the workspace already has a stack (e.g. Next.js), adapt to it and say what you assumed.
