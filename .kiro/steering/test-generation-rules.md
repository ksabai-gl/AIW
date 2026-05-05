# Test generation — TypeScript / Node.js (Jest)

> **🛑 MANDATORY: Read this file completely before generating any tests.**
>
> **Agent**: You are the Test Generation Agent (Step 5). Read `.kiro/steering/test-generation-rules.md` fully.
>
> **OUTPUT FILE**: Write test specs to `.kiro/orchestration/<run-id>/06-test-generation.md`

---

## Purpose

Use this steering when the user asks for **unit tests**, **test cases**, **coverage**, or **regression tests** for application code (services, utilities, pure logic). Align generated output with **GTS & coding standards**, **Jest** usage in this repo, and the checklist sections that apply to unit tests.

**Related steering:** `file://.kiro/steering/backend-standards.md`, `file://.kiro/steering/p4gl-to-ts-rules.md`, `file://.kiro/steering/pr-standards.md`.

**Optional human test plans** (module-specific design notes, not agent policy): `file://docs/test-plans/<module>-test-plan.md` (example: `file://docs/test-plans/fa-asset-service-test-plan.md`).

---

## 0. Workflow — independent phase (after code generation)

This agent is a **separate step** from migration / feature implementation:

1. **First** complete implementation with the **code-generation / migration** agent (`p4gl-to-ts-transform-agent` or equivalent) so `.ts` sources exist and are in the shape you intend to keep.
2. **Then** start a **new** session or run `/agent swap` → **test-generation-agent** and point at those source files.

**In this agent:**

- **Do** read existing production code and **write only** tests under `__tests__/` as `*.test.ts` per `jest.config.js` (plus small helpers in the same `__tests__` folder if needed).
- **Do not** migrate Progress, refactor services, or add business logic unless the user **explicitly** asks for a minimal production change required to make something testable (prefer suggesting they switch back to the code-gen agent for non-trivial edits).

If the user asks for “migrate X and test it” in one go, respond with a **two-phase** plan: finish code first (other agent), then return here for tests only.

Kiro does not auto-switch agents; **you** trigger this agent after code gen by choosing it in the UI or `/agent swap`.

---

## 1. Repository rules (read first)

| Rule | Detail |
|------|--------|
| **Test runner** | **Jest** with `ts-jest` — see `package.json` scripts and `jest.config.js`. |
| **Compile (TypeScript)** | `npm run typecheck` — `tsc --noEmit` over `src/**` (includes `__tests__`). Must be clean after generated tests (**§2.3**). |
| **Format & lint (repo tools)** | If `package.json` defines **`format:check`** and/or **`lint`**, run and fix before finishing; otherwise treat **PR §11** (style) and **§12/§18** (imports, GTS) as the “format/lint” bar (**§2.3**). |
| **Code coverage** | `npm run test:coverage` — terminal table + **`coverage/`** (`lcov`, **HTML** `coverage/index.html`). See `jest.config.js` (`collectCoverageFrom`, `coverageReporters`). **Target:** **≥80%** lines **and** statements per file under test (§2.2). |
| **Where files MUST live** | Only paths matching `**/__tests__/**/*.test.ts` are executed (`testMatch` in `jest.config.js`). |
| **Layout** | Co-locate `__tests__` next to the code under test (same pattern as `src/fixedassets/main/__tests__/`). |
| **Persistence** | You MUST **write** test files to disk (e.g. editor `write` / file tool). **Do not** leave generated tests only in chat. After generation, the user should be able to run `npm test` without moving files. |

There is **no** separate root `test/` folder wired into Jest in this project. Treat **`__tests__` as the canonical “test folder”** for new unit tests unless `jest.config.js` is explicitly changed.

---

## 2. Step-by-step procedure

Follow these steps in order for every request.

### Step A — Discover

1. Read `package.json` and `jest.config.js` to confirm Jest and `testMatch`.
2. Open the **source file(s)** the user named (service, util, types). If they ask for tests for **all sources**, a **directory**, or **everything under `src/`**, build a candidate list (see **§2.1** below).
3. If the code was migrated from Progress 4GL, skim `file://.kiro/steering/p4gl-to-ts-rules.md` for equivalence expectations.

### §2.1 Full-source (or folder) coverage — permission file by file

When covering **multiple** files (whole `src/`, a package folder, or “all services”):

1. **Inventory:** List every TypeScript **implementation** file to cover (typically `src/**/*.ts`), **excluding** existing tests, typings-only files, and empty barrels if they have no logic:
   - Skip: `**/*.test.ts`, `**/__tests__/**`, `**/*.d.ts`
   - Skip or deprioritize: pure re-export `index.ts` files with no functions/classes to test (state that in the plan)
2. **Map:** For each candidate, show **source path → proposed** `src/.../__tests__/<name>.test.ts`.
3. **Plan:** Give a short ordered checklist (file 1 of N, …).
4. **Per-file gate — before work:** For **each** source file, **stop and ask** before you start tests for it (e.g. “OK to create or update `…/foo.service.test.ts` for `foo.service.ts`? Reply yes / skip / stop”). **Do not** write more than **one** test file per approval round. If **skip**, go to the next candidate and ask again. If **stop**, end the batch.
5. **Execute (one file only):** Only after **yes**, implement **only** that file’s tests (Step B–D, write to disk). Run **Step E** and **§2.3** (quality gate) and **§2.2** (coverage) for **that** file before considering any other source file.
6. **Per-file gate — after completion (mandatory):** When that file is **done** (tests saved, **§2.3** all green or N/A, **§2.2** met or exception stated), **stop**. **Ask again** before touching the next source file: e.g. “`foo.service.ts` is complete (coverage: …). Proceed with `bar.service.ts`? yes / skip / stop.” **Do not** open, plan, or write tests for the next file until the user answers. **Never** chain multiple source files in one turn without this second permission.

Single-source requests still need one upfront **yes** before writing; if the user later asks for “all files”, switch to this **before → work → after** rhythm for each item in the inventory.

### §2.2 Coverage target — ≥80% per implementation file

After you add or extend tests for a source module (e.g. `*.service.ts`, `*.ts` with real logic):

1. **Measure:** Run **`npm run test:coverage`** (with user approval if using shell). Check **% Lines** and **% Stmts** for **that source file** in the table.
2. **Goal:** **≥80%** lines **and** **≥80%** statements on that file, unless an exception below applies.
3. **If below 80%:** Add **behavior-focused** tests (branches, errors, edge cases) that exercise the missing lines — not empty `expect` calls or noise only to paint lines green. Re-run coverage until the file meets the target or you hit a justified limit.
4. **Exceptions (call out explicitly to the user):**
   - File is **mostly stubs / `throw new Error('not implemented')` / TODO** — coverage will stay low until real code exists; recommend **p4gl-to-ts-transform-agent** or implementation work first, then return to tests.
   - File is **types-only** or **pure re-exports** — little or no runtime to cover; skip or exclude from the 80% expectation.
   - **Unreachable** or **generated** code — document why it is not meaningfully testable.

**Facades vs business services:** If a **facade** is at 100% but the **delegated** service (e.g. `*-bs.service.ts`) is still a stub, the next test file should target that service so overall feature coverage is honest — each file with real logic should move toward **≥80%** as logic appears.

### §2.3 Quality gate — GTS, compile, format, lint, test, coverage

After **Step C** (and any edits to fix test failures), the generated test file is **not done** until all applicable checks pass. **Order:**

1. **GTS + PR (authoring):** The file must follow team coding standards for style, imports, and GTS conventions. `test-generation` content must match team conventions.
2. **Compile:** Run **`npm run typecheck`** (user approval for shell). **Fix** every TypeScript error in the test file (or in imports it requires) until `tsc --noEmit` exits **0**. Do not leave the branch with a red typecheck.
3. **Format:** If **`npm run format:check`** (or `format:check` / `prettier --check` per `package.json`) exists, run it and **fix** formatting. If it does not exist, **manually** align with **§11** (quotes, indent, braces, line breaks).
4. **Lint:** If **`npm run lint`** exists, run it and **fix** issues, or use **`npm run lint -- --fix`** if your config supports safe fixes. If no lint script exists, enforce the same ideas via **§12** and **§18** (no `any` smuggling, used imports, etc.).
5. **Unit test run:** Run **`npm test`** (or `npx jest <path>`). **Green** required; fix flaking or bad assertions.
6. **Coverage:** Run **`npm run test:coverage`** and satisfy **§2.2** (≥80% on the subject file) or a documented **§2.2** exception.

If any step fails, **iterate** (edit tests or minimal test-only helpers) and **re-run from step 2** (or 5) until the gate is clear.

**Execution report (mandatory after each file’s §2.3):** Always print a **structured summary** in chat (or the agent reply) so the user can see exactly what ran. Use this shape; fill with **real values** from the terminal (copy key lines when useful):

| Area | What to report |
|------|----------------|
| **Compile** | Command: `npm run typecheck`. **Status:** PASS or FAIL. If FAIL: paste or summarize **first TypeScript error(s)** (file:line + message), or error count. |
| **Format** | Command run (e.g. `npm run format:check`) or **N/A** if no script. **Status:** PASS / FAIL / **N/A (manual §11)**. If FAIL: note which files or first diff hint. |
| **Lint** | Command run (e.g. `npm run lint`) or **N/A** if no script. **Status:** PASS / FAIL / **N/A (§12/§18 review)**. If FAIL: rule name or first issue, or issue count. |
| **Tests** | Command: `npm test` or `npx jest <path>`. **Status:** PASS or FAIL. If FAIL: which suite/test name and one-line reason. |
| **Coverage** | Command: `npm run test:coverage`. For the **subject source file** under test: **% Stmts**, **% Lines** (and **% Branch/Funcs** if relevant). **§2.2:** met (Y/N) or **exception** (stub/types). Optionally note **uncovered line #s** if short of 80%. |

You may add a one-line **copy-paste** block, for example:

```text
--- Quality gate (this file) ---
Compile:  PASS  (tsc --noEmit)
Format:   N/A  (no format:check script; §11 applied)
Lint:     N/A  (no lint script; §12/§18 applied)
Tests:    PASS  (30 tests)
Coverage: src/.../foo.ts — Stmts 85% | Lines 85% | §2.2 OK
--- end ---
```

Always include **all five rows** (use **N/A** with a short reason when a tool is not in the repo).

### Step B — Plan

1. List **behaviors** under test (not “lines of code”).
2. Map **branches** (truthy/falsy paths per §5 / §7 of the checklist).
3. List **edge cases**: empty collections, `null`/`undefined`, `''`, `0`, errors, async rejection.
4. Note **dependencies** to mock (inject via constructor or `jest.mock` — prefer visible mocks per checklist).

### Step C — Implement (GTS + checklist)

1. Create or extend `src/.../__tests__/<name>.test.ts` beside the subject module (repo-relative path under `Progress4GL-Migration/`). For multi-file work, only do this for the **one** file the user just approved (§2.1).
2. Use **AAA** (Arrange → Act → Assert); one **behavior** per `it` (checklist §5).
3. **Naming:** `it('should … when …')` or equivalent — readable as a sentence; under ~80 characters when practical (§15). No `"(true branch)"` / `"MC/DC"` in titles (§5).
4. **Assertions:** Specific expectations on real outcomes — no `toBeTruthy()` / `toBeDefined()` alone as the only check (§7, rejection table).
5. **Types:** No `as any` / `as never`; use `unknown` for errors and narrow (checklist §2, §18).
6. **Style:** Single quotes for string literals unless interpolation needs backticks (§11). Two-space indent; braces on all control statements (§11, §18).
7. **Imports:** Explicit imports; group external then relative (§12). Remove unused imports.
8. **Isolation:** Use `afterEach` with `jest.restoreAllMocks()` where spies/mocks are used (§6). Prefer `beforeEach` for fresh state when tests must not depend on order (§6).
9. **Fixtures:** Named constants / small factories at top of file for test data (§3, §5). No secrets — `process.env` patterns only if needed (§13).

### Step D — Migration / 4GL

For migrated logic, add tests that prove **business equivalence** where possible: same inputs → same observable results as the TypeScript layer is responsible for (see existing `src/fixedassets/main/__tests__/fa-asset.service.test.ts` header pattern).

### Step E — Verify

1. State the exact **repo-relative** path(s) (e.g. `src/fixedassets/main/__tests__/example.test.ts`).
2. Run the full **§2.3** pipeline for that file (typecheck → optional format/lint per `package.json` → `npm test` → `npm run test:coverage`); **fix** failures before finishing. Do not duplicate §2.3: **§2.3** is the source of truth for order and pass criteria.
3. **Coverage (required for each module you touch):** Within §2.3, confirm the **subject file** meets **§2.2** (≥80% lines and statements) or a documented exception. Summarize uncovered line ranges if short of the target.

---

## 3. GTS & unit-test checklist (condensed)

Apply **`file://.kiro/steering/pr-standards.md`** for PRs. Cross-check **`file://.kiro/steering/backend-standards.md`** and **`file://.kiro/steering/p4gl-to-ts-rules.md`** for style and 4GL equivalence.

For **unit tests** generated here, enforce at minimum:

- **§5 Test design:** Behavior-focused names; one behavior per test; independent tests; meaningful `describe` nesting.
- **§6 Isolation:** `jest.restoreAllMocks()` in `afterEach` when mocks/spies are used; no order dependence between `it` blocks.
- **§7 Unit standards:** Test behavior not implementation; no smoke/meta/redundant tests; cover branches; meaningful edge cases; spies set up before the call under test. Use coverage to find **gaps**, then close them with **real assertions** — **§2.2** (≥80% per file) is the team bar; do not add hollow tests only to inflate %.
- **§11 Style:** Quotes, indentation, braces, avoid noise comments (explain *why* when non-obvious).
- **§12 Imports:** Used imports only; sensible grouping.
- **§13 Security:** No hardcoded credentials or production secrets in tests.
- **§15 Naming:** Behavior-based names; reasonable length.
- **§17 File hygiene:** Co-located `__tests__`; mirror source structure; no empty placeholder specs.
- **§18 GTS:** camelCase / PascalCase; explicit types where applicable; complexity-heavy logic must have tests called out in plan.

**E2E / Appium sections** (§1, §4, §8–10, §16, §19) apply only when the user explicitly asks for **E2E** or **Appium** specs — not for default Node service unit tests in this migration repo.

---

## 4. Automatic save (agent behavior)

Kiro does not move files by itself. **You** must save tests by **writing** them to the final path under `__tests__/` once the user has approved starting that **specific** source file (§2.1 step 4). After that file is fully done (§2.1 step 6), get **another** approval before the next. Do not dump every test in chat without writing.

---

## 5. Safety

- Do not weaken production types or skip validation to make tests pass.
- Do not commit real tokens, passwords, or customer data in fixtures.

---

## 6. Team process (developers)

**Team rule:** Run `npm test` before PR; `npm run test:coverage` before merge when touching tests.

- Before PR (tests touched): at minimum **`npm run typecheck`**, **`npm test`**, and when relevant **`npm run test:coverage`**. If the repo has **`lint`** / **`format:check`**, run those too; align with **§2.3**.
- After coverage, use the terminal summary or **`coverage/index.html`** to spot regressions.
- **`coverage/`** is gitignored; generate it locally when needed.