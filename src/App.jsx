import { useEffect, useCallback } from "react";
import { AppProvider, useAppStore } from "./store/useAppStore";
import SetupWizard from "./components/SetupWizard";
import Dashboard from "./components/Dashboard";
import "./App.css";

// ─── Hash routing helpers ─────────────────────────────────────────────────────
function getHashForView(view, agentId) {
  if (view === "setup") return "#/setup";
  if (view === "agent_detail" && agentId) return `#/agent/${agentId}`;
  return "#/dashboard";
}

function getViewFromHash(hash) {
  if (!hash || hash === "#" || hash === "#/") return null;
  if (hash.startsWith("#/agent/")) {
    const agentId = hash.slice("#/agent/".length);
    return { view: "agent_detail", agentId: agentId || null };
  }
  if (hash === "#/setup") return { view: "setup", agentId: null };
  if (hash.startsWith("#/dashboard")) return { view: "dashboard", agentId: null };
  return null;
}

function AppContent() {
  const { state, actions } = useAppStore();
  const { view, workflow } = state;
  const selectedAgentId = state.selectedAgentId;

  // ── Sync state.view → URL hash ─────────────────────────────────────────────
  useEffect(() => {
    const targetHash = getHashForView(view, selectedAgentId);
    if (globalThis.location.hash !== targetHash) {
      globalThis.history.pushState({ view, agentId: selectedAgentId }, "", targetHash);
    }
  }, [view, selectedAgentId]);

  // ── Sync URL hash → state.view (browser back / forward) ───────────────────
  const handlePopState = useCallback(() => {
    const parsed = getViewFromHash(globalThis.location.hash);
    if (!parsed) return;
    if (parsed.view === "setup") {
      actions.backToSetup();
    } else if (parsed.view === "agent_detail" && parsed.agentId) {
      actions.setView("agent_detail", parsed.agentId);
    } else {
      actions.setView("dashboard", null);
    }
  }, [actions]);

  useEffect(() => {
    globalThis.addEventListener("popstate", handlePopState);
    return () => globalThis.removeEventListener("popstate", handlePopState);
  }, [handlePopState]);

  // ── On first load, honour hash if present ─────────────────────────────────
  useEffect(() => {
    const parsed = getViewFromHash(globalThis.location.hash);
    if (parsed && parsed.view !== view) {
      if (parsed.view === "setup") actions.backToSetup();
      else if (parsed.view === "agent_detail" && parsed.agentId)
        actions.setView("agent_detail", parsed.agentId);
      else if (parsed.view === "dashboard") actions.setView("dashboard", null);
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simulation logic removed — agent status is managed by useAgentExecution
  // based on real API responses only.

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
