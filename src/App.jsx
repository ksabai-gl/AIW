import { useEffect } from "react";
import { AppProvider, useAppStore, AGENT_STATUS } from "./store/useAppStore";
import SetupWizard from "./components/SetupWizard";
import Dashboard from "./components/Dashboard";
import "./App.css";

function AppContent() {
  const { state, actions } = useAppStore();
  const { view, workflow } = state;

  // Simulation logic for agents
  useEffect(() => {
    if (workflow.workflowStatus === "running" && workflow.activeAgentId) {
      const activeAgent = workflow.agents.find(
        (a) => a.id === workflow.activeAgentId,
      );

      if (activeAgent && activeAgent.status === AGENT_STATUS.RUNNING) {
        const interval = setInterval(() => {
          const nextProgress =
            activeAgent.progress + Math.floor(Math.random() * 15) + 5;

          if (nextProgress >= 100) {
            clearInterval(interval);
            actions.completeAgent(activeAgent.id);
            actions.addLog({
              timestamp: new Date().toLocaleTimeString(),
              agent: activeAgent.shortName,
              message: `Successfully completed all tasks. Artifacts generated.`,
              type: "success",
            });
            // NO AUTO START OF NEXT AGENT
          } else {
            actions.updateAgentProgress(activeAgent.id, nextProgress);

            // Random logs
            if (Math.random() > 0.8) {
              const messages = [
                "Parsing source files...",
                "Analyzing dependency graph...",
                "Applying transformation rules...",
                "Validating syntax tree...",
              ];
              actions.addLog({
                timestamp: new Date().toLocaleTimeString(),
                agent: activeAgent.shortName,
                message: messages[Math.floor(Math.random() * messages.length)],
                type: "info",
              });
            }
          }
        }, 2000);

        return () => clearInterval(interval);
      }
    }
  }, [
    workflow.workflowStatus,
    workflow.activeAgentId,
    workflow.agents,
    actions,
  ]);

  return (
    <div className="app-shell">
      {view === "setup" ? <SetupWizard /> : <Dashboard />}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
