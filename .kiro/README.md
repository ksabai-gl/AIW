# Progress 4GL to TypeScript Migration - Agent Orchestration System

## Overview

This system provides an AI-driven, multi-agent SDLC workflow for migrating Progress 4GL (ABL/OpenEdge) code to TypeScript. The orchestration pipeline automates the complete migration process from code analysis through pull request creation.

## Quick Start

### 1. Run Complete Pipeline

```bash
# Invoke the orchestrator with a Progress 4GL file
@orchestrator-agent Migrate source-progress/code/progress/mfg/us/fa/fapl.p
```

### 2. Run Individual Agents

```bash
# Code Analysis
@progress-code-analyser-agent Analyze source-progress/code/progress/mfg/us/fa/fapl.p

# Generate Design Document
@design-doc-agent Generate design doc for the analyzed code

# Create Task List
@task-list-agent Create task list for TypeScript migration

# Create Jira Ticket
@jira-ticket-creator-agent Create Jira ticket for this migration

# Transform Code
@p4gl-to-ts-transform-agent Transform the Progress code to TypeScript

# Generate Tests
@test-generation-agent Generate Jest tests for the TypeScript code

# Create Pull Request
@pr-creator-agent Create PR with the migrated code
```

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR AGENT                                  │
│   Coordinates sequential execution with context passing & error recovery    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    │                               │                               │
    ▼                               ▼                               ▼
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Step 1  │───▶│ Step 2  │───▶│ Step 3  │───▶│ Step 4  │───▶│ Step 5  │
│ Analyze │    │ Design  │    │  Tasks  │    │  Jira   │    │Transform│
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                                                 │
    ┌────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────┐    ┌─────────┐
│ Step 6  │───▶│ Step 7  │───▶ Pull Request Created
│  Tests  │    │   PR    │
└─────────┘    └─────────┘
```

## Agent Reference

| Agent | Purpose | MCP Dependencies |
|-------|---------|------------------|
| `orchestrator-agent` | Coordinates full pipeline | None (invokes others) |
| `progress-code-analyser-agent` | Analyzes P4GL code structure | None |
| `design-doc-agent` | Generates design documentation | None |
| `task-list-agent` | Creates migration task breakdown | None |
| `jira-ticket-creator-agent` | Creates Jira tickets | Jira MCP |
| `p4gl-to-ts-transform-agent` | Transforms P4GL to TypeScript | None |
| `test-generation-agent` | Generates Jest test cases | None |
| `pr-creator-agent` | Creates GitHub pull requests | GitHub MCP |

## Configuration

### MCP Servers (`.kiro/settings/mcp.json`)

All MCP server configurations are centralized here:

```json
{
  "mcpServers": {
    "jira": { ... },
    "github": { ... }
  }
}
```

### GitHub Settings (`.kiro/settings/pr-config.json`)

Configure default repository and PR settings:

```json
{
  "github": {
    "owner": "your-github-username",
    "defaultRepo": "your-repository",
    "baseBranch": "main"
  }
}
```

### Orchestration Settings (`.kiro/settings/orchestration-config.json`)

Configure pipeline behavior:

```json
{
  "timeoutPerAgent": 300000,
  "maxRetryAttempts": 3,
  "outputDirectory": ".kiro/orchestration"
}
```

## Setup Checklist

### Required Configuration

- [ ] **GitHub Token**: Add to `.kiro/settings/mcp.json`
  ```
  Go to: https://github.com/settings/tokens
  Required scopes: repo, workflow
  ```
  
- [ ] **Jira Credentials**: Already configured in `.kiro/settings/mcp.json`
  - Site: ai-workbench-sdlc

### Security Setup

Add these to `.gitignore`:
```
.kiro/settings/mcp.json
.kiro/settings/*.json
```

## Directory Structure

```
.kiro/
├── agents/                    # Agent configurations
│   ├── orchestrator-agent.json
│   ├── progress-code-analyser-agent.json
│   ├── design-doc-agent.json
│   ├── task-list-agent.json
│   ├── jira-ticket-creator-agent.json
│   ├── p4gl-to-ts-transform-agent.json
│   ├── test-generation-agent.json
│   └── pr-creator-agent.json
├── settings/                  # Configuration files
│   ├── mcp.json              # MCP server configs
│   ├── pr-config.json        # PR default settings
│   └── orchestration-config.json
├── steering/                  # Agent behavior rules
│   ├── progress-code-analysis.md
│   ├── design-doc-rules.md
│   ├── task_list_rules.md
│   ├── jira-ticket-standards.md
│   ├── p4gl-to-ts-rules.md
│   ├── test-generation-rules.md
│   ├── pr-standards.md
│   └── orchestration-rules.md
└── orchestration/             # Pipeline run artifacts
    └── {Run_ID}/
        ├── manifest.json
        ├── 01-progress-analysis.md
        ├── 02-design-document.md
        ├── 03-task-list.md
        ├── 04-jira-tickets.md
        ├── 05-transformed-code/
        ├── 06-test-files/
        ├── 07-pull-request.md
        └── pipeline-summary.md
```

## Context Files

Domain-specific context is available in `source-progress/context/`:

| File | Purpose |
|------|---------|
| `jira_template.md` | QAD Jira ticket template (DOM-524 format) |
| `progress4gl_syntax.md` | P4GL syntax reference |
| `business_entities.md` | Business entity definitions |
| `data_objects.md` | Data object specifications |
| `error_codes.md` | Error code reference |
| `project_structure.md` | Project organization |
| `qad_conventions.md` | QAD coding conventions |

## Troubleshooting

### MCP Connection Issues

```bash
# Verify MCP servers in Kiro
Command Palette → "Kiro: Reconnect MCP Servers"
```

### Agent Not Responding

1. Check agent JSON syntax in `.kiro/agents/`
2. Verify steering files exist in `.kiro/steering/`
3. Restart Kiro

### GitHub Token Issues

1. Verify token in `.kiro/settings/mcp.json`
2. Ensure token has `repo` scope
3. Check token expiration

### Jira Connection Issues

1. Verify credentials in `.kiro/settings/mcp.json`
2. Check site name is correct
3. Verify API token is valid

## Pipeline Execution Flow

1. **Initialize**: Create Run_ID and directory structure
2. **Analyze**: Parse P4GL code for architecture and dependencies
3. **Design**: Generate technical design document with diagrams
4. **Plan**: Create phased migration task list
5. **Track**: Create Jira ticket with QAD template
6. **Transform**: Convert P4GL to TypeScript
7. **Test**: Generate Jest test cases
8. **Deploy**: Create GitHub pull request

Each stage validates output before proceeding. Failed stages can be retried without restarting the entire pipeline.

## Support

- Check this README for quick reference
- Review steering files in `.kiro/steering/` for detailed rules
- Check orchestration logs in `.kiro/orchestration/{Run_ID}/`
