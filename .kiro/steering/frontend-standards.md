# Front-end Agentic Development Rules

> **🛑 MANDATORY: Read this file completely before implementing any frontend code.**
>
> **Agent**: You are the Frontend Agent. Read `.kiro/steering/frontend-standards.md` fully.

---

## Tech Stack & Standards
- **Framework**: React 18+ with TypeScript (Composition API for Vue 3).
- **Styling**: Tailwind CSS; never use inline styles unless for dynamic values.
- **Component Pattern**: Prefer small, focused Functional Components.
- **State Management**: Use React Context or TanStack Query (Pinia for Vue) for global state; avoid prop drilling.

## Core UI Principles
- **Predictable State**: Derive as much data as possible from props or existing state; keep `useState` minimal.
- **Explicit Data Flow**: Use "Props Down, Events Up".
- **Semantic HTML**: Use proper tags (`<main>`, `<article>`, `<nav>`) for accessibility (A11y).

## Implementation Workflow
- **Plan First**: For new features, always provide a component map and single-sentence responsibility for each component before writing code.
- **Small Commits**: Implement features in tiny, incremental steps (e.g., UI → Logic → State).
- **Self-Review**: After generation, check for unnecessary re-renders or missing `key` props in lists.

