---
inclusion: auto
---

# Agent Orchestration Rules

> **🛑 MANDATORY: Read this file completely before orchestrating any pipeline.**
>
> **Agent**: You are the Orchestrator Agent. Read `.kiro/steering/orchestration-rules.md` fully.
>
> **CRITICAL**: Each sub-agent has its own steering file. Pass the orchestration context as input to each agent.

---

## Overview

This document defines the rules and protocols for orchestrating the multi-agent SDLC pipeline for Progress 4GL to TypeScript migration.

---

## Pipeline Execution Protocol

### 1. Initialization

When starting a pipeline execution:

1. **Generate Run_ID**
   ```
   Format: YYYY-MM-DDTHH-MM-SS_random6
   Example: 2024-01-15T10-30-45_a7x9k2
   ```

2. **Create Directory Structure**
   ```
   .kiro/orchestration/{Run_ID}/
   ├── manifest.json
   ├── progress.log
   └── debug.log
   ```

3. **Initialize Manifest** (CRITICAL — All fields required)
   ```json
   {
     "runId": "{Run_ID}",
     "projectKey": "{JIRA_PROJECT_KEY}",
     "sourceFiles": ["{file_path_1}", "{file_path_2}"],
     "startTime": "{ISO_timestamp}",
     "status": "running",
     "agents": []
   }
   ```

   | Field | Required | Description |
   |-------|----------|-------------|
   | `runId` | Yes | Unique run identifier (format: YYYY-MM-DDTHH-MM-SS_random6) |
   | `projectKey` | **Yes** | Jira project key (e.g., "KAN") — used for ticket prefixes |
   | `sourceFiles` | Yes | Array of Progress 4GL source files being analyzed |
   | `startTime` | Yes | ISO timestamp of pipeline start |
   | `status` | Yes | Current status: "running", "completed", "failed" |
   | `agents` | Yes | Array of agent execution records |

   **CRITICAL**: The `projectKey` MUST match your Jira project.
   - ✅ Correct: `"projectKey": "KAN"` → Tickets: KAN-45, KAN-46
   - ❌ Wrong: Hardcoded "LOG-" → Tickets won't exist in Jira

4. **Validate Input**
   - File exists and is readable
   - Extension is .p, .w, .cls, or .i
   - File size < 10MB

---

### 2. Agent Invocation

For each agent in the pipeline:

1. **Log Start**
   ```
   [HH:MM:SS] Starting Step {N} of 7: {agent_name}
   ```

2. **Prepare Context**
   - Load context files as defined in orchestration-config.json
   - Pass to agent via contextFiles parameter

3. **Invoke Agent**
   ```typescript
   invokeSubAgent({
     name: agentName,
     prompt: taskDescription,
     contextFiles: preparedContext,
     explanation: `Step ${step} of pipeline: ${description}`
   })
   ```

4. **Validate Output**
   - Check output is not empty
   - Validate required sections present
   - Verify format requirements met

5. **Save Output**
   - Write to numbered file (XX-name.md)
   - Update manifest with status

6. **Log Completion**
   ```
   [HH:MM:SS] Completed Step {N}: {agent_name} ({duration}ms)
   ```

---

### 3. Context Enrichment Strategy

Each agent receives cumulative context from previous stages:

| Step | Agent | Context Files |
|------|-------|---------------|
| 1 | progress-code-analyser | source_file |
| 2 | design-doc | source_file, analysis |
| 3 | task-list | source_file, analysis, design |
| 4 | jira-ticket-creator | analysis, design, tasks |
| 5 | p4gl-to-ts-transform | analysis, design, tasks, jira |
| 6 | test-generation | design, transformation |
| 7 | pr-creator | design, tasks, jira, transform, tests |

---

### 4. Validation Gates

Each agent output must pass validation before proceeding:

**Progress Analysis:**
- [ ] Contains "Dependencies" section
- [ ] Contains "Data Structures" section
- [ ] Contains "Procedural Logic" section
- [ ] Contains "Summary for Agentic Memory"

**Design Document:**
- [ ] Contains "Executive Summary"
- [ ] Contains "System Architecture" with Mermaid diagram
- [ ] Contains "Data Model" section
- [ ] Valid markdown syntax

**Task List:**
- [ ] Contains Phase 1: Source Analysis
- [ ] Contains Phase 2: Environment & Target Mapping
- [ ] Contains Phase 3: Incremental Translation
- [ ] Contains Phase 4: Validation & Quality Control
- [ ] Contains Phase 5: Migration Summary

**Jira Tickets:**
- [ ] Contains Jira ticket ID(s)
- [ ] Contains ticket URL(s)
- [ ] Follows QAD template structure

**Transformed Code:**
- [ ] TypeScript files generated
- [ ] Valid TypeScript syntax
- [ ] Includes type definitions

**Test Generation:**
- [ ] Jest test files generated
- [ ] Valid describe/it structure
- [ ] Coverage targets defined

**Pull Request:**
- [ ] Branch name included
- [ ] PR URL included
- [ ] Description follows template

---

### 5. Error Handling Protocol

When an agent fails:

1. **Capture Error**
   ```
   {
     "timestamp": "ISO_timestamp",
     "agent": "agent_name",
     "error": "error_message",
     "stackTrace": "...",
     "attemptCount": N
   }
   ```

2. **Log Error**
   - Write to `.kiro/orchestration/{Run_ID}/error-{agent_name}.log`
   - Update progress.log with failure

3. **Retry Logic**
   ```
   Attempt 1: Wait 5 seconds
   Attempt 2: Wait 15 seconds
   Attempt 3: Wait 45 seconds
   ```

4. **Halt Conditions**
   - Max retries exceeded (3 attempts)
   - Critical validation failure
   - Unrecoverable error

5. **Preserve Context**
   - All successful agent outputs preserved
   - Error logs maintained
   - Manifest updated with failure status

---

### 6. Pipeline Summary Generation

On completion (success or failure):

1. **Create pipeline-summary.md**
   ```markdown
   # Pipeline Summary
   
   ## Run Information
   - Run ID: {Run_ID}
   - Source File: {file_path}
   - Status: {completed|failed}
   - Total Duration: {duration}ms
   
   ## Agent Execution
   | Agent | Status | Duration | Output |
   |-------|--------|----------|--------|
   | ... | ... | ... | ... |
   
   ## Generated Artifacts
   - Analysis: 01-progress-analysis.md
   - Design Doc: 02-design-document.md
   - Task List: 03-task-list.md
   - Jira Tickets: {ticket_ids}
   - TypeScript Files: {file_list}
   - Test Files: {file_list}
   - Pull Request: {pr_url}
   
   ## Metrics
   - Total Agents: 7
   - Successful: {count}
   - Failed: {count}
   - Retried: {count}
   ```

2. **Finalize Manifest**
   - Set endTime
   - Update status to "completed" or "failed"
   - Include all artifact paths

---

### 7. Single Agent Execution Mode

When running a single agent:

1. **Validate Run_ID**
   - Directory exists
   - Manifest is valid

2. **Check Prerequisites**
   - Required context files exist
   - Previous agents completed successfully

3. **Execute Agent**
   - Use same protocols as pipeline
   - Update manifest

4. **Report Results**
   - Show agent output
   - Update summary if exists

---

### 8. Retry from Failure Mode

When retrying from a failed agent:

1. **Load Existing Context**
   - Read manifest.json
   - Identify failed agent
   - Load successful outputs

2. **Resume Pipeline**
   - Start from failed agent
   - Continue through remaining agents

3. **Update Tracking**
   - Increment retry counters
   - Update manifest
   - Regenerate summary

---

## Logging Standards

### Progress Log Format
```
[YYYY-MM-DD HH:MM:SS] [LEVEL] [AGENT] Message
```

### Log Levels
- INFO: Pipeline events, agent start/complete
- WARN: Validation warnings, retry attempts
- ERROR: Agent failures, validation failures
- DEBUG: Context operations, detailed params

### Debug Mode
Enable with environment variable:
```
DEBUG_ORCHESTRATOR=true
```

---

## Performance Guidelines

### Timeouts
- Default per-agent: 5 minutes (300000ms)
- Increase for complex transformations
- Monitor for hung processes

### Resource Management
- Clean up temporary files after pipeline
- Archive old runs after 30 days
- Monitor disk usage in orchestration directory

---

## Best Practices

1. **Always validate inputs** before starting pipeline
2. **Log all significant events** for traceability
3. **Preserve context** even on failure
4. **Provide clear progress updates** to user
5. **Generate comprehensive summaries** for audit
6. **Support idempotent operations** for retry safety
7. **Fail fast** on unrecoverable errors
8. **Document all outputs** in manifest
