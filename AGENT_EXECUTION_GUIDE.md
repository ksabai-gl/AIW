# Agent Execution Integration Guide

## Overview

This document describes how the UI agents are connected to the Kiro agents from the `.kiro/agents` folder and how they execute through the cursor-agent-bridge API to display results in the execution log.

## Architecture

### Components Involved

1. **UI Layer (React Components)**
   - `AgentNode.jsx` - Displays individual agents and triggers execution
   - `ExecutionLog.jsx` - Shows real-time execution logs and results
   - `Dashboard.jsx` - Manages the workflow orchestration

2. **State Management (Zustand Store)**
   - `useAppStore.jsx` - Manages application state, agent status, and execution logs
   - Reducer handles: `START_AGENT`, `COMPLETE_AGENT`, `ADD_LOG`, etc.

3. **API Layer**
   - `agentBridgeApi.js` - Simple wrapper functions using `agentBridgeFetchJson`
   - Uses cursor-agent-bridge HTTP endpoints

4. **Execution Hook**
   - `useAgentExecution.js` - Orchestrates agent execution with logging

5. **Backend Server**
   - `cursor-agent-bridge/server/index.mjs` - Express server with:
     - `GET /api/agents` - Lists available agents from `.kiro/agents`
     - `POST /api/run` - Executes Cursor Agent CLI
     - `POST /api/kiro/run` - Executes Kiro CLI
     - All agent payload building and execution logic

## Data Flow

### Agent Execution Flow

```
User Clicks "Start Agent" on AgentNode
    ↓
AgentNode.handleStart() 
    ↓
useAgentExecution.executeAgent()
    ↓
agentBridgeFetchJson() → POST /api/run or /api/kiro/run
    ↓
cursor-agent-bridge server
    ├─ Reads agent config from .kiro/agents/{agentName}.json
    ├─ Builds system prompt from agent catalog
    ├─ Spawns subprocess (cursor agent or kiro)
    └─ Streams stdout back to response
    ↓
Response received with agent output
    ↓
useAgentExecution.executeAgent() processes output
    ├─ Parses JSON if applicable
    └─ Dispatches ADD_LOG actions for each line
    ↓
useAppStore reducer updates executionLogs
    ↓
ExecutionLog component re-renders with new logs
```

## Key Files Modified/Created

### 1. **src/hooks/useAgentExecution.js** (NEW)

Core hook for executing agents:

```javascript
// Main function to execute a single agent
const executeAgent = async (agentId, userMessage = "") => {
  // 1. Get agent from state
  // 2. Determine platform (Cursor vs Kiro)
  // 3. Build payload with agent config
  // 4. Call backend API
  // 5. Process response and add logs
  // 6. Return result
}

// Execute workflow sequentially
const executeWorkflow = async (startAgentId) => {
  // Execute agents one by one from starting agent
}
```

**Features:**
- Handles both Cursor Agent CLI and Kiro CLI
- Parses JSON output automatically
- Logs each line of agent output
- Graceful error handling
- Sequential workflow execution

### 2. **src/lib/agentBridgeApi.js** (SIMPLIFIED)

Now contains only essential API wrapper functions:
- `agentBridgeApiUrl()` - Build URLs
- `agentBridgeFetchJson()` - Core fetch with timeout handling
- `fetchCursorModels()` - Get available Cursor models
- `fetchKiroModels()` - Get available Kiro models
- `fetchBridgePing()` - Health check

All agent execution logic is now in `useAgentExecution.js` which directly calls `agentBridgeFetchJson`.

### 3. **src/components/dashboard/AgentNode.jsx** (UPDATED)

Changes:
- Imported `useAgentExecution` hook
- Updated `handleStart()` to:
  1. Mark agent as RUNNING
  2. Call `executeAgent()` async
  3. Mark agent as COMPLETED after execution

```javascript
const handleStart = async (e) => {
  e.stopPropagation();
  actions.startAgent(agent.id);
  await executeAgent(agent.id);  // Executes agent and logs results
  actions.completeAgent(agent.id);
};
```

### 4. **src/components/dashboard/ExecutionLog.jsx** (ENHANCED)

Improvements:
- Added log type icons (ℹ️, ✅, ❌, 📤, ⚠️)
- Better visual distinction between log types
- Added log count display
- Improved styling and layout
- Unique log keys to prevent React warnings

### 5. **src/components/dashboard/ExecutionLog.css** (ENHANCED)

Styling updates:
- Log type icon styling
- Better color coding for different message types:
  - `info` - Blue (ℹ️)
  - `success` - Green (✅)
  - `error` - Red (❌)
  - `output` - Gray (📤)
  - `warning` - Yellow (⚠️)
- Improved legend with proper dot indicators

## Agent Configuration

### Available Agents in `.kiro/agents/`

The system auto-discovers agents from `.kiro/agents/*.json`:

```json
{
  "name": "Code Generation Agent",
  "shortName": "Code Gen",
  "description": "Generates modular and production-ready code...",
  "systemPrompt": "You are a code generation expert...",
  "icon": "code",
  "color": "#3B82F6"
}
```

The backend's `GET /api/agents` endpoint lists all discovered agents.

## API Request/Response Format

### POST /api/run or /api/kiro/run

**Request:**
```json
{
  "agentName": "Code Gen",
  "userMessage": "Generate login component",
  "workspaceRoot": "/path/to/workspace",
  "model": "claude-3-sonnet",
  "outputFormat": "json",
  "executionMode": "default",
  "agentBin": "/path/to/agent"  // optional
}
```

**Response:**
```json
{
  "agentName": "Code Gen",
  "stdout": "Generated code output...",
  "stderr": "",
  "exitCode": 0,
  "parsedJson": { "code": "...", "description": "..." },
  "executionTime": 2500,
  "userPromptOnly": false,
  "workspaceRoot": "/path/to/workspace",
  "agentCatalogRoot": "/path/to/.kiro/agents"
}
```

## State Management

### Workflow State Structure

```javascript
workflow: {
  agents: [
    {
      id: 1,
      name: "Code Analyser Agent",
      shortName: "Code Analyser",
      status: "idle" | "running" | "completed" | "failed",
      progress: 0-100,
      logs: [],
      ...
    },
    ...
  ],
  activeAgentId: 1,
  workflowStatus: "not_started" | "running" | "paused" | "completed",
  executionLogs: [
    {
      timestamp: "14:30:45",
      agent: "Code Gen",
      message: "Starting execution...",
      type: "info" | "success" | "error" | "output" | "warning"
    },
    ...
  ],
  autoRefresh: true
}
```

### Reducer Actions

- `START_AGENT` - Mark agent as running
- `COMPLETE_AGENT` - Mark agent as completed with 100% progress
- `STOP_AGENT` - Stop running agent
- `ADD_LOG` - Add line to execution log (keeps last 100 logs)
- `UPDATE_AGENT_PROGRESS` - Update progress percentage

## Execution Flow Example

1. **User clicks "Start Agent" button on Code Gen agent**
   - AgentNode triggers `handleStart()`
   - `actions.startAgent(2)` → sets status to RUNNING

2. **executeAgent() is called**
   - Reads agent config: `{ shortName: "Code Gen", ... }`
   - Determines API endpoint based on `ideConfig.platform`
   - Builds payload with agent name and workspace root
   - Makes POST request to backend

3. **Backend processes request**
   - Reads `.kiro/agents/code-gen-agent.json`
   - Extracts system prompt
   - Spawns subprocess with agent CLI
   - Returns stdout when complete

4. **Hook processes response**
   - Parses JSON output if applicable
   - For each output line, calls `actions.addLog()`
   - Logs are prepended to `executionLogs` array

5. **ExecutionLog component re-renders**
   - Displays all logs with timestamps and colors
   - Most recent logs appear at top

6. **Agent marked as complete**
   - `actions.completeAgent(2)` sets status to COMPLETED
   - Progress shows 100%

## Configuration

### Setup Requirements

In the Dashboard setup wizard:

1. **Agent Bridge Base URL** (optional)
   - Default: Empty (uses Vite proxy to localhost:3847)
   - Can set to: `http://127.0.0.1:3847`

2. **Target Workspace**
   - Where agents run their operations
   - Default: Repository root

3. **Platform Selection**
   - `cursor_cli` - Uses POST /api/run
   - `kiro_cli` - Uses POST /api/kiro/run

4. **CLI Executable Path** (optional)
   - Full path to agent or kiro binary
   - Auto-detected from PATH if not provided

## Error Handling

The system handles errors at multiple levels:

1. **Agent Execution Errors**
   - Logged to execution log with type: "error"
   - Workflow stops on error

2. **Network Errors**
   - Timeout after 5 minutes (300 seconds)
   - Displays error message in execution log

3. **JSON Parse Errors**
   - Falls back to raw string output
   - Doesn't break the display

4. **Missing Agents**
   - 404 error from backend
   - Error logged and displayed to user

## Performance Considerations

- **Log Limit**: Last 100 logs kept in memory
- **Timeout**: 5 minute timeout per agent execution
- **Sequential Execution**: Agents run one at a time
- **Auto-refresh**: Can be toggled for faster responsiveness

## Future Enhancements

1. **Parallel Execution** - Run independent agents in parallel
2. **Agent Grouping** - Group related agents for multi-stage workflows
3. **Output Download** - Save execution logs to file
4. **Agent Retry Logic** - Automatic retry on specific failures
5. **Performance Metrics** - Show execution time per agent
6. **Conditional Execution** - Skip agents based on previous results
7. **Progress Streaming** - Real-time progress updates during execution

## Troubleshooting

### Logs not appearing
- Check `autoRefresh` toggle is ON
- Verify backend is running on port 3847
- Check browser console for errors

### Agent execution times out
- Increase timeout in `useAgentExecution.js` (currently 300s)
- Check if backend is responsive: `curl http://127.0.0.1:3847/api/ping`

### Agent not found error
- Verify `.kiro/agents/{agent-name}.json` exists
- Agent name must match exactly (case-sensitive)
- Check backend logs for agent discovery issues

### Platform not executing correctly
- Verify correct platform selected (Cursor vs Kiro)
- Check CLI is installed and on PATH
- Try providing explicit executable path in IDE Config

---

**Last Updated:** May 4, 2026
**Version:** 1.0.0
