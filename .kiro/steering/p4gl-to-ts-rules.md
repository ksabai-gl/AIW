# Migration Context: Progress 4GL to TypeScript (Node.js)

> **🛑 MANDATORY: Read this file completely before performing any code migration.**
>
> **Agent**: You are the Code Migration Agent. Read `.kiro/steering/p4gl-to-ts-rules.md` fully.
>
> **KEY REFERENCE**: Section 3 contains the Progress → TypeScript type mapping table.

---

## 1. Project Overview
This document serves as the technical context for migrating legacy Progress OpenEdge (ABL/4GL) business logic into a modern, type-safe TypeScript environment running on Node.js. The objective is to perform a **comprehensive migration** that preserves business rules while adopting modern design patterns like Promises, Async/Await, and Dependency Injection.

## 2. Dependency & Inter-link Analysis
To ensure no logic is lost, the following Progress-specific dependencies must be mapped before code conversion:

### A. File Linkages
*   **Include Files (`{file.i}`):** These contain shared definitions. Map these to **TypeScript Interfaces** or **Constants**.
*   **Persistent Procedures (`RUN ... PERSISTENT`):** These maintain state. Map these to **Class Singletons** or **Stateful Services**.
*   **External Calls (`RUN ... IN h_proc`):** Identify these to determine which additional `.p` or `.cls` files must be added to the migration queue.

### B. State Management
*   **Shared Variables (`DEFINE SHARED VAR`):** These create hidden links between programs. In Node.js, refactor these into **Service-level properties** or **Context objects** passed between functions.
*   **Temp-Tables & ProDataSets:** Map these to **Type Aliases** or **Classes** to ensure type safety across the application.

## 3. Translation Mapping


| Progress 4GL Element | TypeScript / Node.js Equivalent |
| :--- | :--- |
| `PROCEDURE` / `FUNCTION` | `async function` or Class Method |
| `TEMP-TABLE` | `Array<Interface>` or `Map<string, Type>` |
| `FOR EACH ... WHERE` | `Array.filter()` or ORM Query (`findMany`) |
| `FIND FIRST ... NO-ERROR` | `db.table.findFirst()` with `try/catch` |
| `ASSIGN` | Direct property assignment or `Object.assign()` |
| `NO-LOCK` / `EXCLUSIVE-LOCK` | Database isolation levels or Transactions |
| `INPUT/OUTPUT PARAMETER` | Object destructuring or Interface return type |

## 4. Migration Execution Workflow
1.  **Scan for Links:** Search the source file for `{}` and `RUN` statements to build a dependency tree.
2.  **Define Models:** Create `.model.ts` files for all detected Temp-Tables and Database schemas.
3.  **Encapsulate Logic:** Convert the main procedural logic into a `.service.ts` class.
4.  **Refactor Error Handling:** Replace `ERROR-STATUS` checks with idiomatic `try...catch` and custom Error classes.
5.  **Unit Testing:** Implement Jest or Mocha tests to validate that the TypeScript output matches the original 4GL business results.

## 5. Migration Queue (Tracking)

| Progress File | Inter-linked Files Found | Status | Target TS File |
| :--- | :--- | :--- | :--- |
| `[MainFile].p` | `[List dependencies here]` | Pending | `[MainFile].service.ts` |
