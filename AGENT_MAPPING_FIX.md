# Agent Name Mapping - Fix for Unknown Agent Error

## Problem Fixed
The UI was sending agent short names (e.g., "Jira Spec") directly to the backend API, but the backend expects the actual agent file names from `.kiro/agents/` (e.g., "jira-ticket-creator-agent"). This caused the error: `{"error":"Unknown agent: Jira Spec"}`.

## Solution Implemented

### 1. Created `src/data/agentMapping.js`
This file contains:
- **AGENT_NAME_MAPPING** - Maps UI display names to actual agent names
- **getActualAgentName()** - Function to convert UI names to actual names
- **AVAILABLE_AGENTS** - Complete list of all available agents with both names

### 2. Updated `src/hooks/useAgentExecution.js`
Changed the agent name handling:
```javascript
// BEFORE (Wrong)
const payload = {
  agentName: agent.shortName || agent.name,  // ❌ Sends "Jira Spec"
  ...
};

// AFTER (Correct)
const actualAgentName = getActualAgentName(agent.shortName || agent.name);
const payload = {
  agentName: actualAgentName,  // ✅ Sends "jira-ticket-creator-agent"
  ...
};
```

## Agent Name Mappings

| UI Display Name | Actual Agent Name | Agent File |
|-----------------|-------------------|-----------|
| Jira Spec | jira-ticket-creator-agent | jira-ticket-creator-agent.json |
| Design Spec | design-doc-agent | design-doc-agent.json |
| Code Gen | p4gl-to-ts-transform-agent | p4gl-to-ts-transform-agent.json |
| Test Gen | test-generation-agent | test-generation-agent.json |
| PR Agent | pr-creator-agent | pr-creator-agent.json |
| Code Analyser | progress-code-analyser-agent | progress-code-analyser-agent.json |
| Task List | task-list-agent | task-list-agent.json |
| Migration | orchestrator-agent | orchestrator-agent.json |
| Login Page | login-page-agent | login-page-agent.json |

## How It Works

1. **User clicks agent** in the dashboard
2. **AgentNode.jsx** calls `executeAgent()` with the agent object
3. **useAgentExecution.js** receives the agent with `shortName` property (e.g., "Jira Spec")
4. **getActualAgentName()** converts it to actual name (e.g., "jira-ticket-creator-agent")
5. **ExecutionLog** displays the mapping for transparency (e.g., "Mapped: 'Jira Spec' → 'jira-ticket-creator-agent'")
6. **API payload** sends the correct agent name to backend

## Verification Steps

### To verify the fix is working:

1. Open the Dashboard
2. Select an agent and click execute
3. In the Execution Log, look for a message like:
   ```
   Starting agent execution... (Mapped: "Jira Spec" → "jira-ticket-creator-agent")
   ```
4. If you see the mapping in the log, the fix is working correctly

### If you get an "Unknown agent" error:

1. Check if the agent's `shortName` is spelled correctly in `useAppStore.jsx`
2. Check if there's a mapping for it in `agentMapping.js`
3. Verify the `.kiro/agents/` folder has the corresponding agent file
4. Check the browser console for warnings about unmapped agents

## Debugging

The `getActualAgentName()` function includes debugging:
```javascript
if (!actualName) {
  console.warn(`No mapping found for agent: ${uiName}. Available agents:`, Object.keys(AGENT_NAME_MAPPING));
  return uiName; // Fallback to original name
}
```

If a mapping is missing, you'll see a warning in the browser console showing available agents.

## Files Modified

1. **Created**: `src/data/agentMapping.js` - Agent name mapping utilities
2. **Modified**: `src/hooks/useAgentExecution.js` - Updated to use actual agent names

## Testing Checklist

- [ ] Select "Jira Spec" agent and execute
- [ ] Check Execution Log shows mapping message
- [ ] Verify API request sent correct agent name
- [ ] Check no "Unknown agent" errors appear
- [ ] Repeat for other agents (Design Spec, Test Gen, etc.)
