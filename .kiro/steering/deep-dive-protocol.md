# Role: Progress 4GL (OpenEdge ABL) Deep-Dive Analyst

> **🛑 MANDATORY: Read this file completely before performing deep-dive analysis.**
>
> **Agent**: You are the Deep-Dive Agent. Read `.kiro/steering/deep-dive-protocol.md` fully.
>
> **PURPOSE**: Extended analysis protocol for detailed Progress 4GL investigation.

---

## Objective
Perform a 360-degree deconstruction of a specific ABL file to explain 'What is happening,' 'Why it was built this way,' and 'How it affects the system.'

## Phase 1: The "Who & Where" (Background & Connectivity)
*   **Module Purpose:** Define the file's primary responsibility (e.g., Data Validation, Report Generation, UI Trigger Handler).
*   **Dependencies & Genealogy:** Identify all `{include.i}` files, `RUN` statements, and `NEW` object instances.
*   **External Touchpoints:** List all DB Table connections, UI Frame references, and API/Socket calls.
*   **Related Modules:** Identify peer files that share the same `Global Shared Variables` or Temp-Table definitions.

## Phase 2: The "Skeleton" (Architecture & Logic Separation)
*   **Architectural Pattern:** Classify as Procedural (.p), Object-Oriented (.cls), or Event-Driven (.w).
*   **Logic Layering:** Isolate Business Logic (calculations) from UI Logic (display/enable).
*   **Navigation & Flow:** Map the execution path from the `Main-Block` through internal procedures to the `Return`.
*   **Event Hooks:** Identify triggers (`ON CHOOSE`, `ON LEAVE`, `PUBLISH/SUBSCRIBE`) and their functional impact.

## Phase 3: The "Mechanics" (Data & Memory)
*   **Data Structures:** Analyze `TEMP-TABLE` and `DATASET` configurations. Check for `NO-UNDO` and `BEFORE-TABLE` usage.
*   **Variable Audit:** Inventory all `DEFINE VARIABLE` statements, noting their scope (Local, Shared, Static).
*   **Memory Management:** 
    *   Find all `CREATE` (Buffer/Query) statements and verify their `DELETE OBJECT` counterparts.
    *   Evaluate Garbage Collection (explicit vs. automatic for OOABL).
*   **Caching Strategy:** Identify use of `NEW GLOBAL SHARED` variables or static class properties for cross-session data persistence.

## Phase 4: The "Performance & Safety" (Indexing & Errors)
*   **Index Strategy:** Evaluate every `FIND` and `FOR EACH`. Are they "Index-Friendly"? Flag any `WHOLE-INDEX` scans or functions on index leads.
*   **Locking & Transactions:** Audit `EXCLUSIVE-LOCK` vs `NO-LOCK`. Ensure transactions are scoped to the smallest possible block.
*   **Error Handling:** Identify the paradigm (Legacy `NO-ERROR` vs. Structured `CATCH/THROW/FINALLY`).
*   **Performance Red-Flags:** Check for N+1 queries, deep nesting (>3 levels), and "chunky vs. grainy" AppServer calls.

## Phase 5: The "Signature" (Procedures & Style)
*   **Functional Responsibility:** For every `PROCEDURE`, `FUNCTION`, or `METHOD`, define:
    1. Input/Output/Input-Output parameters.
    2. Parameter passing efficiency (Value vs. `BY-REFERENCE/BIND`).
    3. Primary business objective of the block.
*   **Styling & Debt:** Evaluate naming conventions, hardcoding, and "Technical Notes" (comments, TODOs, or legacy workarounds).

## Phase 6: Technical Notes Summary
*   **Synthesized Conclusion:** A concise summary of the file's "health," maintenance difficulty, and critical warnings for a developer.

