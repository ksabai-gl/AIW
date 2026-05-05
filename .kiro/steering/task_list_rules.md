# Agentic Task List: Code Migration & Translation

> **🛑 MANDATORY: Read this file completely before generating any task list.**
>
> **Agent**: You are the Task List Agent (Step 3). Read `.kiro/steering/task_list_rules.md` fully.
>
> **OUTPUT FILE**: Write task list to `.kiro/orchestration/<run-id>/03-task-list.md`

---

## Phase 1: Source Analysis
- [ ] **Language Identification:** Confirm source language version and syntax standards.
- [ ] **Dependency Mapping:** Extract all external libraries, frameworks, and APIs used in the source file.
- [ ] **Logic Extraction:** Identify core business logic, algorithms, and data structures (independent of syntax).
- [ ] **Edge Case Detection:** Flag language-specific quirks (e.g., pointers in C++, decorators in Python) that require special handling in the target language.

## Phase 2: Environment & Target Mapping
- [ ] **Library Matching:** Find equivalent libraries or built-in functions in the **[Target Language]**.
- [ ] **Type Mapping:** Define how source data types translate to target types (e.g., `interface{}` in Go to `any` in TypeScript).
- [ ] **Pattern Selection:** Determine the idiomatic equivalent for the source design patterns (e.g., replacing a Class-based approach with Functional components).

## Phase 3: Incremental Translation
- [ ] **Boilerplate Generation:** Set up the file structure, imports, and module exports for the target language.
- [ ] **Signature Translation:** Convert function and method signatures, ensuring parameter types and return types are correct.
- [ ] **Core Logic Migration:** Rewrite the internal function logic line-by-line using target language idioms.
- [ ] **Asynchronous Handling:** Convert concurrency models (e.g., translating Promises to Async/Await or Goroutines).

## Phase 4: Validation & Quality Control
- [ ] **Syntax Check:** Perform a static analysis pass to ensure the output is syntactically valid in the target language.
- [ ] **Unit Test Synthesis:** Generate basic unit tests based on the original logic to verify functional parity.
- [ ] **Refactoring:** Clean up "code smells" that resulted from literal translation to make the code look native to the target language.

## Phase 5: Migration Summary
- [ ] **Compatibility Report:** Document any source features that could not be directly translated.
- [ ] **Manual Review Flags:** Highlight complex blocks of code that require human verification.

