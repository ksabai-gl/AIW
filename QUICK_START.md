# Quick Start Guide: Agent Execution

## 🚀 Getting Started

The agent execution system is now fully integrated and ready to use!

## Prerequisites

1. ✅ Cursor Agent or Kiro CLI installed
2. ✅ Agent configurations in `.kiro/agents/` folder
3. ✅ cursor-agent-bridge server running (port 3847)

## Setup Steps

### Step 1: Start the Backend
```bash
npm run dev:bridge
# or
npm run dev:all  # Runs both bridge and UI
```

### Step 2: Start the UI
```bash
npm run dev
```

### Step 3: Configure in Setup Wizard

1. Select your project flow (JIRA Spec, Design Spec, etc.)
2. Choose platform: **Cursor CLI** or **Kiro CLI**
3. Select your LLM model
4. (Optional) Set target workspace path
5. Click "Complete Setup"

## Using the Dashboard

### Execute a Single Agent

1. **View the workflow** - You'll see agents in sequence
2. **Click "Start Agent"** on the first available agent
3. **Watch the Execution Log** - See real-time output
4. When complete, the next agent becomes available
5. **Click "Run All Agents"** to run the entire workflow

### Monitor Execution

- **Green checkmark (✓)** - Agent completed successfully
- **Spinner animation** - Agent is running
- **Orange pending dot** - Waiting to run
- **Execution Log** at the bottom shows all output

### Handle Errors

- ❌ Red error messages in Execution Log
- Workflow stops on error (you can reset and retry)
- Check browser console for technical details

## Example Workflow

1. **Code Analysis Agent**
   - Input: Your source code
   - Output: Analysis results
   
2. **Design Spec Agent**
   - Input: Analysis results
   - Output: Design specification

3. **Code Generation Agent**
   - Input: Design specification
   - Output: Generated code

4. **Test Generation Agent**
   - Input: Generated code
   - Output: Test suite

5. **PR Creation Agent**
   - Input: Code + tests
   - Output: Pull request

## 🔍 Troubleshooting

### "Agent not found" error
- Make sure `.kiro/agents/{agent-name}.json` exists
- Agent name must match exactly

### No logs appearing
- Check if backend is running: `curl http://localhost:3847/api/ping`
- Turn on "Auto Refresh" toggle in Execution Log
- Check browser console for errors

### Execution times out
- Very large codebases may take > 5 minutes
- Increase timeout in `src/hooks/useAgentExecution.js` line 59
- Change `timeoutMs: 300000` to larger value

### Platform not working
- Verify agent/kiro is installed: `which agent` or `which kiro`
- Try providing full path in IDE Config
- Check server logs for subprocess errors

## 📊 Available Agents

Automatically discovered from `.kiro/agents/`:

```
✓ Code Analyser Agent
✓ Design Spec Agent
✓ Code Generation Agent
✓ Test Generation Agent
✓ PR Creation Agent
✓ Task List Agent
✓ Jira Spec Agent
```

Use `GET /api/agents` to see all available agents.

## 📝 Log Types

| Icon | Type | Meaning |
|------|------|---------|
| ℹ️ | info | Informational message |
| ✅ | success | Operation completed |
| ❌ | error | Error occurred |
| 📤 | output | Agent output |
| ⚠️ | warning | Warning message |

## 🎮 Keyboard Shortcuts

- **Enter** on agent = Start execution
- **Space** on agent = Start execution
- Click agent card = View agent details

## 💾 Auto-Save Features

- Setup configuration auto-saves
- Execution logs kept in memory (last 100)
- Project snapshots saved automatically

## 📱 UI Elements

### Workflow Canvas
- Shows 4 agents per row
- Auto-wraps for 5+ agents
- Interactive agent cards
- Sequential flow indicators

### Execution Log
- Real-time output
- Colored by message type
- Auto-scrolls to latest
- Toggleable auto-refresh
- Legend for reference

### Agent Card
- Color-coded by agent type
- Progress bar during execution
- Status indicator
- Action buttons

## 🔗 API Reference

### Execute Agent
```bash
POST /api/run
Content-Type: application/json

{
  "agentName": "Code Gen",
  "userMessage": "Generate login page",
  "workspaceRoot": "/path/to/workspace",
  "model": "claude-3-sonnet",
  "outputFormat": "json"
}
```

### List Agents
```bash
GET /api/agents
```

### Health Check
```bash
GET /api/ping
```

## 🚦 Execution States

```
IDLE (gray) ─→ RUNNING (blue) ─→ COMPLETED (green)
                    ↓
               ERROR (red) → Manual Reset
```

## 📈 Performance Tips

1. **Keep workspace clean** - Removes unnecessary files
2. **Use specific LLM models** - Better for faster execution
3. **Set context workspace** - Limits scope for analysis
4. **Check agent timeout** - May need increase for large projects

## 🐛 Debug Mode

Check execution details:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for agent execution logs
4. Check Network tab for API calls
5. See response payloads from backend

## ✨ Next Steps

1. **Run your first agent** - Try Code Analysis
2. **Review the output** - Check Execution Log
3. **Run full workflow** - Click "Run All Agents"
4. **Customize settings** - Adjust for your project
5. **Review generated artifacts** - Check workspace

## 📚 More Information

- See `AGENT_EXECUTION_GUIDE.md` for architecture details
- See `INTEGRATION_SUMMARY.md` for technical summary
- Check `cursor-agent-bridge/` for backend details

---

**Ready to go!** 🎉

Start by clicking the setup wizard or "Run All Agents" on the dashboard.

Need help? Check the Execution Log output for detailed error messages.
