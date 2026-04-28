import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
} from "react";
import { WORKFLOW_TEMPLATES } from "../data/options";

// ─── Constants ────────────────────────────────────────────────────────────────
export const FLOW_TYPE = {
  WITH_MIGRATION: "with_migration",
  WITHOUT_MIGRATION: "without_migration",
};

export const SETUP_STEPS = {
  FLOW_SELECTION: "flow_selection",
  LANGUAGE_CONFIG: "language_config",
  IDE_CONFIG: "ide_config",
  REVIEW: "review",
};

export const AGENT_STATUS = {
  IDLE: "idle",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  PENDING: "pending",
};

// ─── Initial State ─────────────────────────────────────────────────────────────
const initialSetupState = {
  currentStep: SETUP_STEPS.FLOW_SELECTION,
  completedSteps: [],
  flowType: null,
  sourceLanguage: null,
  targetLanguage: null,
  selectedTemplateId: null,
  sourceFile: null,
  ideConfig: {
    platform: null,
    llm: null,
    cloudDeployment: null,
    mcpServers: [], // Changed from mcpServer to mcpServers
  },
  setupComplete: false,
};

const createAgent = (id, config) => ({
  id,
  status: AGENT_STATUS.IDLE,
  progress: 0,
  htlpRequired: false,
  logs: [],
  ...config,
});

const buildAgents = (templateId, fallbackFlowType) => {
  const selectedTemplate = WORKFLOW_TEMPLATES.find(
    (template) => template.id === templateId,
  );
  const requestedFlowType = fallbackFlowType || selectedTemplate?.flowType;
  const resolvedTemplate =
    selectedTemplate?.flowType === requestedFlowType ? selectedTemplate : null;
  const flowType =
    requestedFlowType || selectedTemplate?.flowType || FLOW_TYPE.WITH_MIGRATION;
  const hasMigration = flowType === FLOW_TYPE.WITH_MIGRATION;

  const pipelineByTemplate = {
    migration_pipeline: [
      {
        name: "Code Analyser Agent",
        shortName: "Code Analyser",
        description:
          "Analyzes Progress4GL source code and generates detailed analysis report.",
        icon: "search",
        color: "#3B82F6",
        htlpRequired: true,
        htlpLabel: "HITLP (Context Setting for Code Analysis)",
        htlpStatus: "pending",
      },
      {
        name: "Code Migration Agent",
        shortName: "Migration",
        description:
          "Migrates Progress4GL code to target technology (e.g., Java) and prepares migrated artifacts.",
        icon: "git-merge",
        color: "#8B5CF6",
        htlpRequired: true,
        htlpLabel: "HITLP (Manual Migration Review)",
        htlpStatus: "pending",
      },
      {
        name: "Design Spec Agent",
        shortName: "Design Spec",
        description:
          "Generates high level and detailed design specification for the migrated application.",
        icon: "layout",
        color: "#06B6D4",
        htlpRequired: true,
        htlpLabel: "HITLP (Manual Review Design Spec)",
        htlpStatus: "pending",
      },
      {
        name: "Task List Spec Agent",
        shortName: "Task List",
        description:
          "Creates estimated task list, timelines and dependencies for implementation.",
        icon: "list-checks",
        color: "#F59E0B",
      },
      {
        name: "Jira Spec Agent",
        shortName: "Jira Spec",
        description:
          "Creates/updates Jira items with epics, stories, tasks and links to generated specs.",
        icon: "ticket",
        color: "#22C55E",
        htlpRequired: true,
        htlpLabel: "HITLP (Manual Review JIRA Spec)",
        htlpStatus: "pending",
      },
      {
        name: "Code Generation Agent",
        shortName: "Code Gen",
        description:
          "Generates clean, modular and production ready code based on design specs and tasks.",
        icon: "code",
        color: "#3B82F6",
        htlpRequired: true,
        htlpLabel: "HITLP (Manual Code Review)",
        htlpStatus: "pending",
      },
      {
        name: "Test Generation Agent",
        shortName: "Test Gen",
        description:
          "Generates unit, integration and regression tests for the generated code.",
        icon: "flask-conical",
        color: "#8B5CF6",
        htlpRequired: true,
        htlpLabel: "HITLP (Manual Test Review)",
        htlpStatus: "pending",
      },
      {
        name: "PR Creation Agent",
        shortName: "PR Agent",
        description:
          "Creates Pull Request in Git repository with code, tests and documentation.",
        icon: "git-pull-request",
        color: "#EC4899",
        htlpRequired: true,
        htlpLabel: "HITLP (PR Review)",
        htlpStatus: "pending",
      },
      // { name: 'Deployment Agent', shortName: 'Deploy', description: 'Deploys application to configured runtime target.', icon: 'rocket', color: '#F59E0B' },
    ],
    modernization_pipeline: [
      {
        name: "Code Analyser Agent",
        shortName: "Code Analyser",
        description:
          "Analyzes existing services, module boundaries and identifies modernization candidates.",
        icon: "search",
        color: "#3B82F6",
        htlpRequired: true,
        htlpLabel: "HITLP (Context Setting for Code Analysis)",
        htlpStatus: "pending",
      },
      {
        name: "Design Spec Agent",
        shortName: "Design Spec",
        description:
          "Creates modernization design with target architecture and migration strategy.",
        icon: "layout",
        color: "#06B6D4",
        htlpRequired: true,
        htlpLabel: "HITLP (Manual Review Design Spec)",
        htlpStatus: "pending",
      },
      {
        name: "Task List Spec Agent",
        shortName: "Task List",
        description:
          "Creates sprint-ready task breakdown with priorities and timelines for modernization.",
        icon: "list-checks",
        color: "#F59E0B",
      },
      {
        name: "Jira Spec Agent",
        shortName: "Jira Spec",
        description:
          "Publishes modernization scope, milestones and work items to Jira.",
        icon: "ticket",
        color: "#22C55E",
        htlpRequired: true,
        htlpLabel: "HITLP (Manual Review JIRA Spec)",
        htlpStatus: "pending",
      },
      {
        name: "Code Generation Agent",
        shortName: "Code Gen",
        description:
          "Generates modular and production-ready code for the target modernized stack.",
        icon: "code",
        color: "#3B82F6",
        htlpRequired: true,
        htlpLabel: "HITLP (Manual Code Review)",
        htlpStatus: "pending",
      },
      {
        name: "Test Generation Agent",
        shortName: "Test Gen",
        description:
          "Generates comprehensive unit, integration and regression tests for modernized code.",
        icon: "flask-conical",
        color: "#8B5CF6",
        htlpRequired: true,
        htlpLabel: "HITLP (Manual Test Review)",
        htlpStatus: "pending",
      },
      {
        name: "PR Creation Agent",
        shortName: "PR Agent",
        description:
          "Creates pull request with modernized code, tests, and implementation evidence.",
        icon: "git-pull-request",
        color: "#EC4899",
        htlpRequired: true,
        htlpLabel: "HITLP (PR Review)",
        htlpStatus: "pending",
      },
      // { name: 'Deployment Agent', shortName: 'Deploy', description: 'Deploys modernized application to specified runtime environment.', icon: 'rocket', color: '#F59E0B' },
    ],
    cloud_ready_pipeline: [
      {
        name: "Code Analyser Agent",
        shortName: "Code Analyser",
        description:
          "Assesses cloud readiness across source modules and identifies cloud-native opportunities.",
        icon: "search",
        color: "#3B82F6",
        htlpRequired: true,
        htlpLabel: "HITLP (Cloud Readiness Context)",
        htlpStatus: "pending",
      },
      {
        name: "Design Spec Agent",
        shortName: "Design Spec",
        description:
          "Designs cloud-native architecture, services, boundaries and deployment strategy.",
        icon: "layout",
        color: "#06B6D4",
        htlpRequired: true,
        htlpLabel: "HITLP (Architecture Review)",
        htlpStatus: "pending",
      },
      {
        name: "Task List Spec Agent",
        shortName: "Task List",
        description:
          "Builds cloud migration work plan with release waves and deployment phases.",
        icon: "list-checks",
        color: "#F59E0B",
      },
      {
        name: "Jira Spec Agent",
        shortName: "Jira Spec",
        description:
          "Creates delivery backlog, rollout checklist and release readiness items in Jira.",
        icon: "ticket",
        color: "#22C55E",
        htlpRequired: true,
        htlpLabel: "HITLP (Backlog Review)",
        htlpStatus: "pending",
      },
      {
        name: "Code Generation Agent",
        shortName: "Code Gen",
        description:
          "Generates cloud-ready implementation artifacts and infrastructure-as-code.",
        icon: "code",
        color: "#3B82F6",
        htlpRequired: true,
        htlpLabel: "HITLP (Code Review)",
        htlpStatus: "pending",
      },
      {
        name: "Test Generation Agent",
        shortName: "Test Gen",
        description:
          "Generates resiliency, performance and regression tests for cloud environment.",
        icon: "flask-conical",
        color: "#8B5CF6",
        htlpRequired: true,
        htlpLabel: "HITLP (Test Review)",
        htlpStatus: "pending",
      },
      // { name: 'Deployment Agent', shortName: 'Deploy', description: 'Prepares deployment, cloud environment and release configuration for production.', icon: 'rocket', color: '#F59E0B' },
      {
        name: "PR Creation Agent",
        shortName: "PR Agent",
        description:
          "Creates PR with cloud-ready code, infrastructure and deployment deliverables.",
        icon: "git-pull-request",
        color: "#EC4899",
        htlpRequired: true,
        htlpLabel: "HITLP (PR Review)",
        htlpStatus: "pending",
      },
    ],
    reengineering_pipeline: [
      {
        name: "Code Analyser Agent",
        shortName: "Code Analyser",
        description:
          "Performs deep static analysis, dependency tracing and architecture assessment.",
        icon: "search",
        color: "#3B82F6",
        htlpRequired: true,
        htlpLabel: "HITLP (Analysis Scope Review)",
        htlpStatus: "pending",
      },
      {
        name: "Code Migration Agent",
        shortName: "Migration",
        description:
          "Transforms legacy code structure into modernized intermediate representations.",
        icon: "git-merge",
        color: "#8B5CF6",
        htlpRequired: true,
        htlpLabel: "HITLP (Transformation Review)",
        htlpStatus: "pending",
      },
      {
        name: "Design Spec Agent",
        shortName: "Design Spec",
        description:
          "Defines re-engineered target domain model, architecture and refactoring strategy.",
        icon: "layout",
        color: "#06B6D4",
        htlpRequired: true,
        htlpLabel: "HITLP (Design Review)",
        htlpStatus: "pending",
      },
      {
        name: "Task List Spec Agent",
        shortName: "Task List",
        description:
          "Creates phased re-engineering execution plan with dependencies and timelines.",
        icon: "list-checks",
        color: "#F59E0B",
      },
      {
        name: "Jira Spec Agent",
        shortName: "Jira Spec",
        description:
          "Creates traceable Jira epics, stories and tasks for re-engineering work.",
        icon: "ticket",
        color: "#22C55E",
        htlpRequired: true,
        htlpLabel: "HITLP (Jira Review)",
        htlpStatus: "pending",
      },
      {
        name: "Code Generation Agent",
        shortName: "Code Gen",
        description:
          "Generates redesigned modules, interfaces and production-ready implementation code.",
        icon: "code",
        color: "#3B82F6",
        htlpRequired: true,
        htlpLabel: "HITLP (Code Review)",
        htlpStatus: "pending",
      },
      {
        name: "Test Generation Agent",
        shortName: "Test Gen",
        description:
          "Generates comprehensive regression tests and quality assurance test suites.",
        icon: "flask-conical",
        color: "#8B5CF6",
        htlpRequired: true,
        htlpLabel: "HITLP (Quality Review)",
        htlpStatus: "pending",
      },
      {
        name: "PR Creation Agent",
        shortName: "PR Agent",
        description:
          "Prepares PR with re-engineered code, tests and architectural transformation artifacts.",
        icon: "git-pull-request",
        color: "#EC4899",
        htlpRequired: true,
        htlpLabel: "HITLP (PR Review)",
        htlpStatus: "pending",
      },
      // { name: 'Deployment Agent', shortName: 'Deploy', description: 'Deploys re-engineered application components to target environment.', icon: 'rocket', color: '#F59E0B' },
    ],
    analysis_pipeline: [
      {
        name: "Code Analyser Agent",
        shortName: "Code Analyser",
        description:
          "Produces comprehensive static analysis and risk assessment report.",
        icon: "search",
        color: "#3B82F6",
        htlpRequired: true,
        htlpLabel: "HITLP (Analysis Scope Review)",
        htlpStatus: "pending",
      },
      {
        name: "Design Spec Agent",
        shortName: "Design Spec",
        description:
          "Generates architecture assessment and remediation recommendations for improvement.",
        icon: "layout",
        color: "#06B6D4",
        htlpRequired: true,
        htlpLabel: "HITLP (Architecture Review)",
        htlpStatus: "pending",
      },
      {
        name: "Task List Spec Agent",
        shortName: "Task List",
        description:
          "Creates prioritized task list, timelines and effort estimates for resolution.",
        icon: "list-checks",
        color: "#F59E0B",
      },
      {
        name: "Jira Spec Agent",
        shortName: "Jira Spec",
        description:
          "Publishes findings, recommendations and action items to Jira backlog.",
        icon: "ticket",
        color: "#22C55E",
        htlpRequired: true,
        htlpLabel: "HITLP (Backlog Review)",
        htlpStatus: "pending",
      },
      {
        name: "PR Creation Agent",
        shortName: "PR Agent",
        description:
          "Creates PR with analysis reports, documentation and findings summary.",
        icon: "git-pull-request",
        color: "#EC4899",
        htlpRequired: true,
        htlpLabel: "HITLP (PR Review)",
        htlpStatus: "pending",
      },
    ],
  };

  const fallbackPipeline = hasMigration
    ? pipelineByTemplate.migration_pipeline
    : pipelineByTemplate.modernization_pipeline;

  const selectedPipeline = resolvedTemplate
    ? pipelineByTemplate[resolvedTemplate.id]
    : fallbackPipeline;

  return selectedPipeline.map((agent, idx) => createAgent(idx + 1, agent));
};

const initialWorkflowState = {
  agents: [],
  activeAgentId: null,
  workflowStatus: "not_started", // not_started | running | paused | completed
  executionLogs: [],
  autoRefresh: true,
};

const initialState = {
  setup: initialSetupState,
  workflow: initialWorkflowState,
  view: "setup", // setup | dashboard | agent_detail
  dashboardPanel: "workflow", // workflow | config
  dashboardConfigFocus: null, // platform | llm | mcp | null
  selectedAgentId: null,
};

// ─── Persistence Helpers ──────────────────────────────────────────────────────
const STORAGE_KEY = "multi-agent-web-ui-state";

const loadStateFromStorage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate that the saved state has the expected structure
      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.setup &&
        parsed.workflow
      ) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn("Failed to load state from localStorage:", error);
  }
  return initialState;
};

const saveStateToStorage = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Failed to save state to localStorage:", error);
  }
};

const clearStoredState = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear state from localStorage:", error);
  }
};

// ─── Reducer ───────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    // Setup actions
    case "SET_FLOW_TYPE": {
      const defaultTemplate =
        WORKFLOW_TEMPLATES.find(
          (template) => template.flowType === action.payload,
        )?.id || null;
      return {
        ...state,
        setup: {
          ...state.setup,
          flowType: action.payload,
          selectedTemplateId: defaultTemplate,
          completedSteps: [SETUP_STEPS.FLOW_SELECTION],
          currentStep: SETUP_STEPS.LANGUAGE_CONFIG,
        },
      };
    }

    case "RESET_SETUP_FROM_STEP": {
      const stepOrder = [
        SETUP_STEPS.FLOW_SELECTION,
        SETUP_STEPS.LANGUAGE_CONFIG,
        SETUP_STEPS.IDE_CONFIG,
        SETUP_STEPS.REVIEW,
      ];
      const fromIdx = stepOrder.indexOf(action.payload);
      const newCompleted = state.setup.completedSteps.filter(
        (s) => stepOrder.indexOf(s) < fromIdx,
      );
      return {
        ...state,
        setup: {
          ...state.setup,
          currentStep: action.payload,
          completedSteps: newCompleted,
          ...(fromIdx <= 0 ? { flowType: null } : {}),
          ...(fromIdx <= 0 ? { selectedTemplateId: null } : {}),
          ...(fromIdx <= 1
            ? { sourceLanguage: null, targetLanguage: null, sourceFile: null }
            : {}),
          ...(fromIdx <= 2
            ? {
                ideConfig: {
                  platform: null,
                  llm: null,
                  cloudDeployment: null,
                  mcpServers: [],
                },
              }
            : {}),
          setupComplete: false,
        },
      };
    }

    case "SET_LANGUAGE_CONFIG":
      return {
        ...state,
        setup: {
          ...state.setup,
          sourceLanguage: action.payload.sourceLanguage,
          targetLanguage: action.payload.targetLanguage,
          sourceFile:
            state.setup.sourceLanguage === action.payload.sourceLanguage
              ? state.setup.sourceFile
              : null,
          completedSteps: [
            ...new Set([
              ...state.setup.completedSteps,
              SETUP_STEPS.LANGUAGE_CONFIG,
            ]),
          ],
          currentStep: SETUP_STEPS.IDE_CONFIG,
        },
      };

    case "SET_SOURCE_FILE":
      return {
        ...state,
        setup: {
          ...state.setup,
          sourceFile: action.payload,
        },
      };

    case "SET_IDE_CONFIG":
      return {
        ...state,
        setup: {
          ...state.setup,
          ideConfig: action.payload,
          completedSteps: [
            ...new Set([...state.setup.completedSteps, SETUP_STEPS.IDE_CONFIG]),
          ],
          currentStep: SETUP_STEPS.REVIEW,
        },
      };

    case "COMPLETE_SETUP":
      return {
        ...state,
        setup: {
          ...state.setup,
          setupComplete: true,
          completedSteps: [
            ...new Set([...state.setup.completedSteps, SETUP_STEPS.REVIEW]),
          ],
        },
        workflow: {
          ...initialWorkflowState,
          agents: buildAgents(
            state.setup.selectedTemplateId,
            state.setup.flowType,
          ),
        },
        view: "dashboard",
        dashboardPanel: "workflow",
        dashboardConfigFocus: null,
      };

    case "SET_WORKFLOW_TEMPLATE": {
      const selectedTemplate = WORKFLOW_TEMPLATES.find(
        (template) => template.id === action.payload,
      );
      const nextFlowType = selectedTemplate?.flowType || state.setup.flowType;
      const nextSetup = {
        ...state.setup,
        selectedTemplateId: action.payload,
        flowType: nextFlowType,
      };

      if (!state.setup.setupComplete) {
        return {
          ...state,
          setup: nextSetup,
        };
      }

      return {
        ...state,
        setup: nextSetup,
        workflow: {
          ...initialWorkflowState,
          agents: buildAgents(action.payload, nextFlowType),
        },
        view: "dashboard",
        dashboardPanel: "workflow",
        dashboardConfigFocus: null,
        selectedAgentId: null,
      };
    }

    // Workflow actions
    case "START_AGENT": {
      const agentId = action.payload;
      const newAgents = state.workflow.agents.map((a) =>
        a.id === agentId
          ? {
              ...a,
              status: AGENT_STATUS.RUNNING,
              progress: a.progress === 100 ? 0 : a.progress,
            }
          : a,
      );
      return {
        ...state,
        workflow: {
          ...state.workflow,
          agents: newAgents,
          activeAgentId: agentId,
          workflowStatus: "running",
        },
      };
    }

    case "STOP_AGENT": {
      const agentId = action.payload;
      const newAgents = state.workflow.agents.map((a) =>
        a.id === agentId ? { ...a, status: AGENT_STATUS.IDLE } : a,
      );
      return {
        ...state,
        workflow: {
          ...state.workflow,
          agents: newAgents,
          activeAgentId:
            state.workflow.activeAgentId === agentId
              ? null
              : state.workflow.activeAgentId,
        },
      };
    }

    case "UPDATE_AGENT_PROGRESS": {
      const { agentId, progress } = action.payload;
      const newAgents = state.workflow.agents.map((a) =>
        a.id === agentId ? { ...a, progress } : a,
      );
      return { ...state, workflow: { ...state.workflow, agents: newAgents } };
    }

    case "COMPLETE_AGENT": {
      const agentId = action.payload;
      const newAgents = state.workflow.agents.map((a) =>
        a.id === agentId
          ? { ...a, status: AGENT_STATUS.COMPLETED, progress: 100 }
          : a,
      );
      return {
        ...state,
        workflow: { ...state.workflow, agents: newAgents, activeAgentId: null },
      };
    }

    case "SET_HTLP_STATUS": {
      const { agentId, htlpStatus } = action.payload;
      const newAgents = state.workflow.agents.map((a) =>
        a.id === agentId
          ? {
              ...a,
              htlpStatus,
              status:
                htlpStatus === "approved" ? AGENT_STATUS.COMPLETED : a.status,
            }
          : a,
      );
      return { ...state, workflow: { ...state.workflow, agents: newAgents } };
    }

    case "RESET_AGENT": {
      const agentId = action.payload;
      const agentIdx = state.workflow.agents.findIndex((a) => a.id === agentId);
      // When resetting an agent, reset all following agents too
      const newAgents = state.workflow.agents.map((a, idx) =>
        idx >= agentIdx
          ? {
              ...a,
              status: AGENT_STATUS.IDLE,
              progress: 0,
              htlpStatus: a.htlpRequired ? "pending" : undefined,
              logs: [],
            }
          : a,
      );
      return {
        ...state,
        workflow: {
          ...state.workflow,
          agents: newAgents,
          activeAgentId:
            state.workflow.activeAgentId === agentId
              ? null
              : state.workflow.activeAgentId,
        },
      };
    }

    case "ADD_LOG": {
      return {
        ...state,
        workflow: {
          ...state.workflow,
          executionLogs: [
            action.payload,
            ...state.workflow.executionLogs,
          ].slice(0, 100),
        },
      };
    }

    case "TOGGLE_AUTO_REFRESH":
      return {
        ...state,
        workflow: {
          ...state.workflow,
          autoRefresh: !state.workflow.autoRefresh,
        },
      };

    case "SET_VIEW":
      return {
        ...state,
        view: action.payload.view,
        dashboardPanel:
          action.payload.view === "dashboard"
            ? "workflow"
            : state.dashboardPanel,
        dashboardConfigFocus:
          action.payload.view === "dashboard"
            ? null
            : state.dashboardConfigFocus,
        selectedAgentId: action.payload.agentId ?? null,
      };

    case "BACK_TO_SETUP":
      return {
        ...state,
        view: "setup",
        dashboardPanel: "workflow",
        dashboardConfigFocus: null,
        setup: { ...state.setup, setupComplete: false },
      };

    case "OPEN_DASHBOARD_CONFIG":
      return {
        ...state,
        view: "dashboard",
        dashboardPanel: "config",
        dashboardConfigFocus: action.payload.focus || null,
        setup: {
          ...state.setup,
          currentStep: action.payload.step,
        },
        selectedAgentId: null,
      };

    case "CLOSE_DASHBOARD_CONFIG":
      return {
        ...state,
        dashboardPanel: "workflow",
        dashboardConfigFocus: null,
      };

    default:
      return state;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, loadStateFromStorage());

  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveStateToStorage(state);
  }, [state]);

  const actions = {
    setFlowType: useCallback(
      (type) => dispatch({ type: "SET_FLOW_TYPE", payload: type }),
      [],
    ),
    setWorkflowTemplate: useCallback(
      (templateId) =>
        dispatch({ type: "SET_WORKFLOW_TEMPLATE", payload: templateId }),
      [],
    ),
    resetSetupFromStep: useCallback(
      (step) => dispatch({ type: "RESET_SETUP_FROM_STEP", payload: step }),
      [],
    ),
    setLanguageConfig: useCallback(
      (cfg) => dispatch({ type: "SET_LANGUAGE_CONFIG", payload: cfg }),
      [],
    ),
    setSourceFile: useCallback(
      (fileMeta) => dispatch({ type: "SET_SOURCE_FILE", payload: fileMeta }),
      [],
    ),
    setIdeConfig: useCallback(
      (cfg) => dispatch({ type: "SET_IDE_CONFIG", payload: cfg }),
      [],
    ),
    completeSetup: useCallback(() => dispatch({ type: "COMPLETE_SETUP" }), []),
    startAgent: useCallback(
      (id) => dispatch({ type: "START_AGENT", payload: id }),
      [],
    ),
    stopAgent: useCallback(
      (id) => dispatch({ type: "STOP_AGENT", payload: id }),
      [],
    ),
    updateAgentProgress: useCallback(
      (agentId, progress) =>
        dispatch({
          type: "UPDATE_AGENT_PROGRESS",
          payload: { agentId, progress },
        }),
      [],
    ),
    completeAgent: useCallback(
      (id) => dispatch({ type: "COMPLETE_AGENT", payload: id }),
      [],
    ),
    setHtlpStatus: useCallback(
      (agentId, htlpStatus) =>
        dispatch({ type: "SET_HTLP_STATUS", payload: { agentId, htlpStatus } }),
      [],
    ),
    resetAgent: useCallback(
      (id) => dispatch({ type: "RESET_AGENT", payload: id }),
      [],
    ),
    addLog: useCallback(
      (log) => dispatch({ type: "ADD_LOG", payload: log }),
      [],
    ),
    toggleAutoRefresh: useCallback(
      () => dispatch({ type: "TOGGLE_AUTO_REFRESH" }),
      [],
    ),
    setView: useCallback(
      (view, agentId) =>
        dispatch({ type: "SET_VIEW", payload: { view, agentId } }),
      [],
    ),
    backToSetup: useCallback(() => dispatch({ type: "BACK_TO_SETUP" }), []),
    openDashboardConfig: useCallback(
      (step, focus) =>
        dispatch({ type: "OPEN_DASHBOARD_CONFIG", payload: { step, focus } }),
      [],
    ),
    closeDashboardConfig: useCallback(
      () => dispatch({ type: "CLOSE_DASHBOARD_CONFIG" }),
      [],
    ),
    clearStoredState: useCallback(() => {
      clearStoredState();
      window.location.reload(); // Force a reload to reset to initial state
    }, []),
  };

  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppStore must be used within AppProvider");
  return ctx;
}
