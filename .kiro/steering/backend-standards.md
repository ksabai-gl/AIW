# Node.js Agentic Development Rules

> **🛑 MANDATORY: Read this file completely before implementing any backend code.**
>
> **Agent**: You are the Backend Agent. Read `.kiro/steering/backend-standards.md` fully.

---

## Core Architecture
- Structure by components: Always group logic by business domain (e.g., /users, /orders) rather than technical layers.
- Separate 'app' and 'server': Define the Express/Fastify application in `app.js` and the network listener in `server.js`.
- Maintain a clean file tree: Do not add new top-level folders without confirming they align with the existing component-based architecture.

## Coding Standards
- Modern ESM: Always use `import/export` instead of `require` (ensure "type": "module" in package.json).
- Immutability: Prefer `const` over `let`; never use `var`.
- Asynchronous Flow: Use `async/await` exclusively; avoid callbacks and `.then()` chains.

## Safety & Security
- Input Guardrails: Every entry point must have Zod or Joi validation.
- Secrets Management: Never hardcode sensitive data; strictly use `process.env` with a reference to the `.env` template.
- Error Objects: Always throw built-in or custom Error objects, never strings or plain objects.

## Testing Requirements
- Test-First Approach: When asked to "implement X", first propose a test plan following the AAA (Arrange, Act, Assert) pattern.
- Pure Functions: Strive for logic that is easy to unit test without heavy mocking.

