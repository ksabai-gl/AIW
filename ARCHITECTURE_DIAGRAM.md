# Implementation Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      MULTI-AGENT WEB UI                         │
└─────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                    React Components Layer                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐      ┌──────────────────┐               │
│  │   Dashboard      │      │   AgentNode      │               │
│  │                  │──────│                  │               │
│  │ - Coordinates    │      │ - Start/Stop btn │               │
│  │ - Shows layout   │      │ - Progress bar   │               │
│  └────────┬─────────┘      └────────┬─────────┘               │
│           │                         │                          │
│           └──────────────┬──────────┘                          │
│                          │                                     │
│                   ┌──────▼──────┐                              │
│                   │ExecutionLog  │                             │
│                   │              │                             │
│                   │- Real-time   │                             │
│                   │  output      │                             │
│                   │- Color-coded │                             │
│                   │- Log legend  │                             │
│                   └──────▲──────┘                              │
│                          │                                     │
└──────────────────────────┼─────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Store     │
                    │ useAppStore │
                    │             │
                    │ Manages:    │
                    │ - State     │
                    │ - Actions   │
                    │ - Dispatch  │
                    │   events    │
                    └──────▲──────┘
                           │
                           │
┌──────────────────────────┼─────────────────────────────────────┐
│              Hooks & API Layer                                  │
├──────────────────────────┼─────────────────────────────────────┤
│                          │                                      │
│         ┌────────────────▼────────────────┐                    │
│         │ useAgentExecution Hook          │                    │
│         │                                 │                    │
│         │ - executeAgent()                │                    │
│         │   ├─ Get agent config           │                    │
│         │   ├─ Build payload              │                    │
│         │   ├─ Call API                   │                    │
│         │   ├─ Parse response             │                    │
│         │   └─ Dispatch logs              │                    │
│         │                                 │                    │
│         │ - executeWorkflow()             │                    │
│         │   └─ Sequential execution       │                    │
│         └────────────────┬────────────────┘                    │
│                          │                                     │
│         ┌────────────────▼────────────────┐                   │
│         │ agentBridgeApi                  │                   │
│         │                                 │                   │
│         │ - agentBridgeFetchJson()        │                   │
│         │ - fetchCursorModels()           │                   │
│         │ - fetchKiroModels()             │                   │
│         │ - fetchBridgePing()             │                   │
│         └────────────────┬────────────────┘                   │
│                          │                                     │
└──────────────────────────┼─────────────────────────────────────┘
                           │
          ┌────────────────▼────────────────┐
          │     HTTP Fetch                  │
          │ (with timeout & error handling) │
          └────────────────┬────────────────┘
                           │
          ┌────────────────▼────────────────┐
          │ Backend API Server              │
          │ (cursor-agent-bridge)           │
          │                                 │
          │ Port: 3847                      │
          │ Endpoints:                      │
          │ - POST /api/run                 │
          │ - POST /api/kiro/run            │
          │ - GET /api/agents               │
          │ - GET /api/ping                 │
          └────────────────┬────────────────┘
                           │
          ┌────────────────▼──────────┐
          │ Agent Execution Layer      │
          │                            │
          │ ┌──────────────────────┐  │
          │ │ Read .kiro/agents/   │  │
          │ │ {agent}.json config  │  │
          │ └──────────────────────┘  │
          │            │              │
          │ ┌──────────▼──────────┐  │
          │ │ Build system prompt │  │
          │ │ + user message      │  │
          │ └──────────────────────┘  │
          │            │              │
          │ ┌──────────▼──────────┐  │
          │ │ Spawn subprocess:   │  │
          │ │ - agent (Cursor)    │  │
          │ │ - kiro (Kiro)       │  │
          │ └──────────────────────┘  │
          │            │              │
          │ ┌──────────▼──────────┐  │
          │ │ Capture stdout/     │  │
          │ │ stderr              │  │
          │ └──────────────────────┘  │
          │            │              │
          │ ┌──────────▼──────────┐  │
          │ │ Return response     │  │
          │ │ with output         │  │
          │ └──────────────────────┘  │
          │                            │
          └────────────────────────────┘
                           │
                           │
          ┌────────────────▼──────────┐
          │ File System / LLM API      │
          │                            │
          │ ├─ .kiro/agents/ (configs)│
          │ ├─ workspace (execution)  │
          │ └─ Claude/GPT/etc (LLM)   │
          │                            │
          └────────────────────────────┘
```

## Data Flow: Agent Execution

```
┌─────────────────┐
│  User clicks    │
│ "Start Agent"   │
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│ AgentNode.handleStart()  │
│ - stopPropagation()      │
│ - startAgent(agentId)    │
└────────┬─────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ actions.startAgent(id)         │
│ [Store: set status = RUNNING]  │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ executeAgent(agentId)          │
│ (async hook function)          │
└────────┬───────────────────────┘
         │
         ├─ Get agent from state
         │
         ├─ Determine platform
         │  (cursor_cli vs kiro_cli)
         │
         ├─ Build payload:
         │  ├─ agentName
         │  ├─ userMessage
         │  ├─ workspaceRoot
         │  ├─ model
         │  └─ outputFormat
         │
         ▼
┌────────────────────────────────┐
│ Add initial log:               │
│ "Starting agent execution..."  │
│ [type: "info"]                 │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ agentBridgeFetchJson()         │
│ POST /api/run or /api/kiro/run │
│ (with 5min timeout)            │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Backend Response Received      │
│ {                              │
│   stdout: "..output..",        │
│   stderr: "",                  │
│   exitCode: 0,                 │
│   parsedJson: {...}            │
│ }                              │
└────────┬───────────────────────┘
         │
         ├─ Check for errors
         │
         ├─ Parse output
         │  └─ Try JSON.parse()
         │
         ├─ Split by newlines
         │
         ▼
┌────────────────────────────────┐
│ For each output line:          │
│ - Add log entry                │
│ - Set type: "output"           │
│ - Include timestamp            │
│ - Include agent name           │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ actions.addLog(logEntry)       │
│ [Store: prepend to logs array] │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ ExecutionLog component         │
│ sees state change and          │
│ re-renders with new logs       │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Add final log:                 │
│ "Execution completed..."       │
│ [type: "success"]              │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Return result to caller        │
│ (AgentNode.handleStart())      │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ actions.completeAgent(id)      │
│ [Store: set status =           │
│  COMPLETED, progress = 100]    │
└────────────────────────────────┘
         │
         ▼
    ✅ DONE
```

## File Structure After Changes

```
src/
├── hooks/
│   └── useAgentExecution.js          [NEW - Agent execution hook]
│
├── lib/
│   └── agentBridgeApi.js             [UPDATED - Simplified API layer]
│
├── components/
│   └── dashboard/
│       ├── AgentNode.jsx             [UPDATED - Added execution]
│       ├── ExecutionLog.jsx          [UPDATED - Enhanced logging]
│       └── ExecutionLog.css          [UPDATED - Better styling]
│
└── store/
    └── useAppStore.jsx               [EXISTING - Already had ADD_LOG]

cursor-agent-bridge/
└── server/
    └── index.mjs                     [EXISTING - Already had API]

Root/
├── AGENT_EXECUTION_GUIDE.md          [NEW - Full documentation]
├── INTEGRATION_SUMMARY.md            [NEW - Summary of changes]
└── QUICK_START.md                    [NEW - Quick reference]
```

## State Flow

```
Initial State:
{
  workflow: {
    agents: [{id: 1, status: "idle", progress: 0}, ...],
    executionLogs: [],
    activeAgentId: null
  }
}

User starts agent:
  │
  ├─ Dispatch: START_AGENT
  │   └─ agents[0].status = "running"
  │
  ├─ Execute agent (API call)
  │
  ├─ Dispatch: ADD_LOG (info)
  │   └─ executionLogs = [{...log1}, ...logs]
  │
  ├─ Dispatch: ADD_LOG (output) × N
  │   └─ executionLogs = [{...logN}, ..., {log1}, ...]
  │
  ├─ Dispatch: ADD_LOG (success)
  │   └─ executionLogs = [{...success_log}, ...]
  │
  └─ Dispatch: COMPLETE_AGENT
      └─ agents[0].status = "completed", progress = 100

Final State:
{
  workflow: {
    agents: [{id: 1, status: "completed", progress: 100}, ...],
    executionLogs: [{...success}, {...output}, ..., {...info}],
    activeAgentId: null
  }
}
```

## Error Handling Flow

```
ExecutionAgent()
    │
    ├─ TRY
    │   ├─ Validate agent exists
    │   ├─ Validate setup config
    │   ├─ Build payload
    │   ├─ Call API (with timeout)
    │   ├─ Parse response
    │   └─ Process output
    │
    └─ CATCH (error)
        │
        ├─ If network error
        │   └─ Dispatch error log
        │
        ├─ If JSON parse error
        │   └─ Use raw output
        │
        ├─ If timeout
        │   └─ Show timeout message
        │
        └─ Return null
            (Caller marks agent as failed)
```

## Component Hierarchy

```
App
 └─ Dashboard
     ├─ Sidebar
     │   └─ Project selector
     │
     ├─ Top Bar
     │   ├─ Title
     │   └─ Action buttons
     │
     ├─ Workflow Canvas (main)
     │   ├─ Row 1 (Agents 1-4)
     │   │   ├─ AgentNode
     │   │   │   ├─ Header
     │   │   │   ├─ Body
     │   │   │   ├─ Footer (with action button)
     │   │   │   └─ Progress bar
     │   │   ├─ Connector arrow
     │   │   └─ ...
     │   │
     │   └─ Row N (Agents N+)
     │       └─ Similar structure
     │
     └─ ExecutionLog (bottom panel)
         ├─ Header (with auto-refresh)
         ├─ Log content
         │   └─ Log lines (colored by type)
         │
         └─ Legend
             ├─ Info
             ├─ Success
             ├─ Error
             └─ Output
```

---

**Legend:**
- ✅ = Complete/Success
- ⏳ = In Progress
- ❌ = Error/Failed
- 📝 = Pending/Idle
- 🔄 = Running
