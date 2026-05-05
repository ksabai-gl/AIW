import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
} from "react";
import { WORKFLOW_TEMPLATES, KICKOFF_SOURCE_CONFIG, ALL_AGENTS, PROJECT_FLOW_OPTIONS } from "../data/options";
import lightTheme from "../colors";
import darkTheme from "../colorDark";

// ─── Constants ────────────────────────────────────────────────────────────────
export const FLOW_TYPE = {
  WITH_MIGRATION: "with_migration",
  WITHOUT_MIGRATION: "without_migration",
};

export const PROJECT_FLOW = {
  JIRA_SPEC: "jira_spec",
  DESIGN_SPEC: "design_spec",
  CODE_WITH_MIGRATION: "code_with_migration",
  CODE_WITHOUT_MIGRATION: "code_without_migration",
  CUSTOM: "custom",
};

export const SETUP_STEPS = {
  FLOW_SELECTION: "flow_selection",
  AGENT_SELECTION: "agent_selection",
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

/** Derive sidebar / Run All state from agent rows (stored workflowStatus otherwise goes stale after COMPLETE). */
export function deriveWorkflowStatus(agents) {
  if (!agents?.length) return "not_started";
  if (agents.some((a) => a.status === AGENT_STATUS.RUNNING)) return "running";
  if (agents.every((a) => a.status === AGENT_STATUS.COMPLETED)) return "completed";
  if (agents.some((a) => a.status === AGENT_STATUS.COMPLETED || a.status === AGENT_STATUS.FAILED)) return "paused";
  return "not_started";
}

/** Same sequencing rules as dashboard agent cards / bridge API START_AGENT reducer. */
function prevAgentMeetsPipelineGate(prev) {
  if (!prev) return false;
  if (prev.status !== AGENT_STATUS.COMPLETED) return false;
  if (prev.shortName === "Jira Spec Creator") {
    return prev.jiraSpecPublishDone === true;
  }
  return true;
}

export function canStartSequentialAgent(workflowAgents, idx) {
  const agent = workflowAgents[idx];
  if (!agent) return false;
  if (agent.status === AGENT_STATUS.RUNNING) return false;
  if (idx === 0) return true;
  if (
    agent.status === AGENT_STATUS.COMPLETED ||
    agent.status === AGENT_STATUS.FAILED
  )
    return true;
  const prev = workflowAgents[idx - 1];
  return prevAgentMeetsPipelineGate(prev);
}

// ─── Initial State ─────────────────────────────────────────────────────────────
const initialSetupState = {
  currentStep: SETUP_STEPS.FLOW_SELECTION,
  completedSteps: [],
  projectName: "",
  /** Folder passed to `agent --workspace` / Kiro cwd (cursor-agent-bridge). */
  targetWorkspace: "",
  /** Base URL for bridge API, e.g. `http://127.0.0.1:3847`. Empty = same origin (use Vite `/api` proxy). */
  agentBridgeBaseUrl: "",
  projectFlow: null,
  flowType: null,
  sourceLanguage: null,
  targetLanguage: null,
  selectedTemplateId: null,
  kickoffSource: "custom_flow",
  sourceFile: null,
  selectedAgentIds: [], // For custom flow
  ideConfig: {
    platform: null,
    llm: null,
    cloudDeployment: null,
    mcpServers: [],
    /** Optional full path to `agent` / `cursor-agent.cmd` or `kiro` when using CLI platforms. */
    cliExecutablePath: "",
    /** Kiro: full tools (MCP). Cursor: bridge ignores this and uses default agent mode. */
    executionMode: "autopilot",
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

const applyKickoffSourceToPipeline = (pipeline, kickoffSource) => {
  const kickoffConfig = KICKOFF_SOURCE_CONFIG[kickoffSource];
  const configuredStart = kickoffConfig?.startFrom;

  if (!configuredStart) return pipeline;

  let startIndex = pipeline.findIndex(
    (agent) => agent.shortName === configuredStart,
  );
  if (startIndex < 0 && kickoffSource === "modernization") {
    startIndex = pipeline.findIndex((agent) => agent.shortName === "Code Gen");
  }
  if (startIndex < 0) return pipeline;

  const trimmedPipeline = pipeline.slice(startIndex);
  if (!trimmedPipeline.length) return pipeline;

  if (
    kickoffSource === "spec_file" &&
    trimmedPipeline[0].shortName === "Design Spec"
  ) {
    return [
      {
        ...trimmedPipeline[0],
        name: "Specification Agent",
        shortName: "Spec Agent",
        description:
          "Parses the provided specification document and generates implementation-ready specs.",
      },
      ...trimmedPipeline.slice(1),
    ];
  }

  return trimmedPipeline;
};

// Maps each project flow to the exact template + kickoff combo that generates its pipeline
const PROJECT_FLOW_PIPELINE_MAP = {
  jira_spec:             { templateId: "modernization_pipeline", kickoffSource: "jira_document" },
  design_spec:           { templateId: "modernization_pipeline", kickoffSource: "design_file" },
  code_with_migration:   { templateId: "migration_pipeline",     kickoffSource: "modernization" },
  code_without_migration:{ templateId: "modernization_pipeline", kickoffSource: "modernization" },
};

const buildAgents = (setupState) => {
  const { selectedTemplateId, flowType: fallbackFlowType, kickoffSource, projectFlow, selectedAgentIds } = setupState;
  
  // Handle custom flow with manually selected agents
  if (projectFlow === PROJECT_FLOW.CUSTOM && selectedAgentIds?.length > 0) {
    const customPipeline = selectedAgentIds.map(agentKey => {
      const agentBase = ALL_AGENTS.find(a => a.id === agentKey);
      if (!agentBase) return null;
      const { id: _key, ...rest } = agentBase;
      return rest;
    }).filter(Boolean);
    return customPipeline.map((agent, idx) =>
      createAgent(idx + 1, {
        ...agent,
        htlpStatus: agent.htlpRequired ? "pending" : undefined,
      })
    );
  }


  const selectedTemplate = WORKFLOW_TEMPLATES.find(
    (template) => template.id === selectedTemplateId,
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
          "Analyzes source code and generates detailed analysis report.",
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
          "Migrates code to target technology (e.g., Java) and prepares migrated artifacts.",
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
        name: "Jira Spec Creator Agent",
        shortName: "Jira Spec Creator",
        description:
          "Drafts the QAD Jira spec to the workspace, then review and create one issue via MCP (same card).",
        icon: "ticket",
        color: "#22C55E",
        pipelinePauseAfter: true,
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
        name: "Jira Spec Creator Agent",
        shortName: "Jira Spec Creator",
        description:
          "Drafts the spec locally, then review and create one Jira issue via MCP on the same card.",
        icon: "ticket",
        color: "#22C55E",
        pipelinePauseAfter: true,
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
        name: "Jira Spec Creator Agent",
        shortName: "Jira Spec Creator",
        description:
          "Drafts backlog/spec to the workspace, then review and publish one Jira issue (same card).",
        icon: "ticket",
        color: "#22C55E",
        pipelinePauseAfter: true,
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
        name: "Jira Spec Creator Agent",
        shortName: "Jira Spec Creator",
        description:
          "Drafts traceable Jira content locally, then review and create the issue on the same card.",
        icon: "ticket",
        color: "#22C55E",
        pipelinePauseAfter: true,
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
        name: "Jira Spec Creator Agent",
        shortName: "Jira Spec Creator",
        description:
          "Drafts findings into a spec file, then review and create one Jira issue (same card).",
        icon: "ticket",
        color: "#22C55E",
        pipelinePauseAfter: true,
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

  // Use per-projectFlow mapping as the authoritative source (keeps setup preview + dashboard in sync)
  const flowPipelineKey = PROJECT_FLOW_PIPELINE_MAP[projectFlow];
  if (flowPipelineKey) {
    const basePipeline = pipelineByTemplate[flowPipelineKey.templateId];
    if (basePipeline) {
      const adjusted = applyKickoffSourceToPipeline(basePipeline, flowPipelineKey.kickoffSource);
      return adjusted.map((agent, idx) => createAgent(idx + 1, agent));
    }
  }

  const fallbackPipeline = hasMigration
    ? pipelineByTemplate.migration_pipeline
    : pipelineByTemplate.modernization_pipeline;

  const selectedPipeline = resolvedTemplate
    ? pipelineByTemplate[resolvedTemplate.id]
    : fallbackPipeline;

  const kickoffPipelineOverride =
    KICKOFF_SOURCE_CONFIG[kickoffSource]?.pipelineTemplateOverride;
  const basePipeline = kickoffPipelineOverride
    ? pipelineByTemplate[kickoffPipelineOverride] || selectedPipeline
    : selectedPipeline;

  const kickoffAdjustedPipeline = applyKickoffSourceToPipeline(
    basePipeline,
    kickoffSource,
  );
  return kickoffAdjustedPipeline.map((agent, idx) =>
    createAgent(idx + 1, agent),
  );
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
  projects: [], // saved project snapshots
  activeProjectId: null,
  view: "dashboard", // setup | dashboard | agent_detail
  dashboardPanel: "workflow", // workflow | config | settings
  dashboardConfigFocus: null, // platform | llm | mcp | null
  selectedAgentId: null,
  theme: "dark",
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
        return {
          ...initialState,
          ...parsed,
          setup: {
            ...initialSetupState,
            ...parsed.setup,
            ideConfig: {
              ...initialSetupState.ideConfig,
              ...(parsed.setup?.ideConfig && typeof parsed.setup.ideConfig === "object"
                ? parsed.setup.ideConfig
                : {}),
            },
          },
          workflow: { ...initialWorkflowState, ...parsed.workflow },
          projects: Array.isArray(parsed.projects) ? parsed.projects : [],
          activeProjectId: parsed.activeProjectId || null,
        };
      }
    }
  } catch (error) {
    console.warn("Failed to load state from localStorage:", error);
  }
  return initialState;
};

const saveStateToStorage = (state) => {
  try {
    // Strip sourceFile.content before persisting — file content is transient (in-memory only)
    // and can cause localStorage quota errors for large files.
    const stateToSave = {
      ...state,
      setup: {
        ...state.setup,
        sourceFile: state.setup.sourceFile
          ? { ...state.setup.sourceFile, content: null }
          : null,
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
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
    case "SET_PROJECT_NAME":
      return {
        ...state,
        setup: { ...state.setup, projectName: action.payload },
      };

    case "SET_AGENT_BRIDGE_CONTEXT": {
      const p = action.payload || {};
      const patch = {};
      if (
        Object.prototype.hasOwnProperty.call(p, "targetWorkspace") &&
        typeof p.targetWorkspace === "string"
      ) {
        patch.targetWorkspace = p.targetWorkspace;
      }
      if (
        Object.prototype.hasOwnProperty.call(p, "agentBridgeBaseUrl") &&
        typeof p.agentBridgeBaseUrl === "string"
      ) {
        patch.agentBridgeBaseUrl = p.agentBridgeBaseUrl;
      }
      return {
        ...state,
        setup: {
          ...state.setup,
          ...patch,
        },
      };
    }

    case "SET_FLOW_TYPE": {
      const flowOption = PROJECT_FLOW_OPTIONS.find(o => o.id === action.payload);
      const isCustom = action.payload === PROJECT_FLOW.CUSTOM;
      
      return {
        ...state,
        setup: {
          ...state.setup,
          projectFlow: action.payload,
          flowType: flowOption?.flowType || FLOW_TYPE.WITHOUT_MIGRATION,
          kickoffSource: flowOption?.kickoffSource || "custom_flow",
          completedSteps: [SETUP_STEPS.FLOW_SELECTION],
          currentStep: isCustom ? SETUP_STEPS.AGENT_SELECTION : SETUP_STEPS.LANGUAGE_CONFIG,
          selectedAgentIds: isCustom ? state.setup.selectedAgentIds : [],
        },
      };
    }

    case "SET_CUSTOM_AGENTS": {
      return {
        ...state,
        setup: {
          ...state.setup,
          selectedAgentIds: action.payload,
          completedSteps: [...new Set([...state.setup.completedSteps, SETUP_STEPS.AGENT_SELECTION])],
          currentStep: SETUP_STEPS.LANGUAGE_CONFIG,
        },
      };
    }

    case "RESET_SETUP_FROM_STEP": {
      const stepOrder = [
        SETUP_STEPS.FLOW_SELECTION,
        SETUP_STEPS.AGENT_SELECTION,
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
          ...(fromIdx <= 0
            ? {
                projectFlow: null,
                flowType: null,
                kickoffSource: "custom_flow",
                projectName: "",
                targetWorkspace: "",
                agentBridgeBaseUrl: "",
              }
            : {}),
          ...(fromIdx <= 1 ? { selectedAgentIds: [] } : {}),
          ...(fromIdx <= 2
            ? { sourceLanguage: null, targetLanguage: null, sourceFile: null }
            : {}),
          ...(fromIdx <= 3
            ? {
                ideConfig: {
                  platform: null,
                  llm: null,
                  cloudDeployment: null,
                  mcpServers: [],
                  cliExecutablePath: "",
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

    case "SET_KICKOFF_SOURCE": {
      const nextSetup = {
        ...state.setup,
        kickoffSource: action.payload,
        sourceFile: null,
      };

      if (!state.setup.setupComplete) {
        return { ...state, setup: nextSetup };
      }

      return {
        ...state,
        setup: nextSetup,
        workflow: {
          ...initialWorkflowState,
          agents: buildAgents(state.setup),
        },
        dashboardPanel: "workflow",
        dashboardConfigFocus: null,
        selectedAgentId: null,
      };
    }

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

    case "COMPLETE_SETUP": {
      const projectId = state.activeProjectId || `proj_${Date.now()}`;
      const projectSnapshot = {
        id: projectId,
        name: state.setup.projectName || "Untitled Project",
        projectFlow: state.setup.projectFlow,
        flowType: state.setup.flowType,
        kickoffSource: state.setup.kickoffSource,
        sourceLanguage: state.setup.sourceLanguage,
        targetLanguage: state.setup.targetLanguage,
        selectedAgentIds: state.setup.selectedAgentIds,
        targetWorkspace: state.setup.targetWorkspace,
        agentBridgeBaseUrl: state.setup.agentBridgeBaseUrl,
        ideConfig: state.setup.ideConfig,
        selectedTemplateId: state.setup.selectedTemplateId,
        createdAt: new Date().toISOString(),
      };
      const existingIdx = state.projects.findIndex((p) => p.id === projectId);
      const updatedProjects =
        existingIdx >= 0
          ? state.projects.map((p) => (p.id === projectId ? projectSnapshot : p))
          : [...state.projects, projectSnapshot];
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
          agents: buildAgents(state.setup),
        },
        projects: updatedProjects,
        activeProjectId: projectId,
        view: "dashboard",
        dashboardPanel: "workflow",
        dashboardConfigFocus: null,
      };
    }

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
          agents: buildAgents({ ...state.setup, selectedTemplateId: action.payload, flowType: nextFlowType }),
        },
        view: "dashboard",
        dashboardPanel: "workflow",
        dashboardConfigFocus: null,
        selectedAgentId: null,
      };
    }

    case "SWITCH_PROJECT": {
      const proj = state.projects.find((p) => p.id === action.payload);
      if (!proj) return state;
      const restoredSetup = {
        ...initialSetupState,
        projectName: proj.name,
        projectFlow: proj.projectFlow,
        flowType: proj.flowType,
        kickoffSource: proj.kickoffSource,
        sourceLanguage: proj.sourceLanguage,
        targetLanguage: proj.targetLanguage,
        selectedAgentIds: proj.selectedAgentIds || [],
        targetWorkspace: proj.targetWorkspace ?? "",
        agentBridgeBaseUrl: proj.agentBridgeBaseUrl ?? "",
        ideConfig: {
          ...initialSetupState.ideConfig,
          ...(proj.ideConfig && typeof proj.ideConfig === "object" ? proj.ideConfig : {}),
        },
        selectedTemplateId: proj.selectedTemplateId,
        setupComplete: true,
        completedSteps: [
          SETUP_STEPS.FLOW_SELECTION,
          SETUP_STEPS.LANGUAGE_CONFIG,
          SETUP_STEPS.IDE_CONFIG,
          SETUP_STEPS.REVIEW,
        ],
      };
      return {
        ...state,
        setup: restoredSetup,
        workflow: {
          ...initialWorkflowState,
          agents: buildAgents(restoredSetup),
        },
        activeProjectId: proj.id,
        view: "dashboard",
        dashboardPanel: "workflow",
        dashboardConfigFocus: null,
        selectedAgentId: null,
      };
    }

    case "NEW_PROJECT":
      return {
        ...state,
        setup: initialSetupState,
        workflow: initialWorkflowState,
        activeProjectId: null,
        view: "setup",
        dashboardPanel: "workflow",
        dashboardConfigFocus: null,
        selectedAgentId: null,
      };

    // Workflow actions
    case "START_AGENT": {
      const agentId = action.payload;
      const agentIndex = state.workflow.agents.findIndex(
        (a) => a.id === agentId,
      );
      if (agentIndex === -1) return state;
      const agent = state.workflow.agents[agentIndex];
      if (agent.status === AGENT_STATUS.RUNNING) return state;
      if (
        agentIndex > 0 &&
        agent.status !== AGENT_STATUS.COMPLETED &&
        agent.status !== AGENT_STATUS.FAILED &&
        state.workflow.agents[agentIndex - 1].status !== AGENT_STATUS.COMPLETED
      ) {
        return state;
      }

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
          workflowStatus: deriveWorkflowStatus(newAgents),
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
          workflowStatus: deriveWorkflowStatus(newAgents),
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
      const payload =
        typeof action.payload === "object" && action.payload !== null
          ? action.payload
          : { id: action.payload, output: null };
      const {
        id: agentId,
        output,
        jiraSpecCreatorStep,
      } = payload;
      const jiraPatch =
        jiraSpecCreatorStep === "draft"
          ? { jiraSpecAwaitingPublish: true, jiraSpecPublishDone: false }
          : jiraSpecCreatorStep === "publish"
            ? { jiraSpecAwaitingPublish: false, jiraSpecPublishDone: true }
            : {};
      const newAgents = state.workflow.agents.map((a) =>
        a.id === agentId
          ? {
              ...a,
              status: AGENT_STATUS.COMPLETED,
              progress: 100,
              output: output ?? a.output,
              ...jiraPatch,
            }
          : a,
      );
      return {
        ...state,
        workflow: {
          ...state.workflow,
          agents: newAgents,
          activeAgentId: null,
          workflowStatus: deriveWorkflowStatus(newAgents),
        },
      };
    }

    case "FAIL_AGENT": {
      const { id: agentId, output } = typeof action.payload === "object"
        ? action.payload
        : { id: action.payload, output: null };
      const newAgents = state.workflow.agents.map((a) =>
        a.id === agentId
          ? { ...a, status: AGENT_STATUS.FAILED, progress: 0, output: output ?? a.output }
          : a,
      );
      return {
        ...state,
        workflow: {
          ...state.workflow,
          agents: newAgents,
          activeAgentId: null,
          workflowStatus: deriveWorkflowStatus(newAgents),
        },
      };
    }

    case "DISMISS_AGENT_WAITING": {
      const agentId = action.payload;
      const newAgents = state.workflow.agents.map((a) =>
        a.id === agentId ? { ...a, dismissedWaiting: true } : a,
      );
      return {
        ...state,
        workflow: { ...state.workflow, agents: newAgents },
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
      return {
        ...state,
        workflow: {
          ...state.workflow,
          agents: newAgents,
          workflowStatus: deriveWorkflowStatus(newAgents),
        },
      };
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
              output: undefined,
              dismissedWaiting: false,
              htlpStatus: a.htlpRequired ? "pending" : undefined,
              logs: [],
              jiraSpecAwaitingPublish: false,
              jiraSpecPublishDone: false,
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
          workflowStatus: deriveWorkflowStatus(newAgents),
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

    case "OPEN_DASHBOARD_SETTINGS":
      return {
        ...state,
        view: "dashboard",
        dashboardPanel: "settings",
        dashboardConfigFocus: null,
        selectedAgentId: null,
      };

    case "SET_THEME": {
      return {
        ...state,
        theme: action.payload,
      };
    }
    case "TOGGLE_THEME": {
      return {
        ...state,
        theme: state.theme === "dark" ? "light" : "dark",
      };
    }
    default:
      return state;
  }
}

// ─── Theme Helpers ─────────────────────────────────────────────────────────────
const themeMap = {
  dark: darkTheme,
  light: lightTheme,
};

const applyTheme = (theme) => {
  if (typeof document === "undefined") return;
  const themeVariables = themeMap[theme] || darkTheme;
  const root = document.documentElement;
  Object.entries(themeVariables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
};

// ─── Context ───────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, loadStateFromStorage());

  // Apply theme and save state to localStorage whenever it changes
  useEffect(() => {
    applyTheme(state.theme);
    saveStateToStorage(state);
  }, [state]);

  const actions = {
    setProjectName: useCallback(
      (name) => dispatch({ type: "SET_PROJECT_NAME", payload: name }),
      [],
    ),
    setAgentBridgeContext: useCallback(
      (payload) => dispatch({ type: "SET_AGENT_BRIDGE_CONTEXT", payload }),
      [],
    ),
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
    setKickoffSource: useCallback(
      (source) => dispatch({ type: "SET_KICKOFF_SOURCE", payload: source }),
      [],
    ),
    setCustomAgents: useCallback(
      (agentIds) => dispatch({ type: "SET_CUSTOM_AGENTS", payload: agentIds }),
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
      (id, output = null, extra = {}) =>
        dispatch({ type: "COMPLETE_AGENT", payload: { id, output, ...extra } }),
      [],
    ),
    failAgent: useCallback(
      (id, output = null) => dispatch({ type: "FAIL_AGENT", payload: { id, output } }),
      [],
    ),
    dismissAgentWaiting: useCallback(
      (id) => dispatch({ type: "DISMISS_AGENT_WAITING", payload: id }),
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
    switchProject: useCallback(
      (projectId) => dispatch({ type: "SWITCH_PROJECT", payload: projectId }),
      [],
    ),
    newProject: useCallback(() => dispatch({ type: "NEW_PROJECT" }), []),
    openDashboardConfig: useCallback(
      (step, focus) =>
        dispatch({ type: "OPEN_DASHBOARD_CONFIG", payload: { step, focus } }),
      [],
    ),
    closeDashboardConfig: useCallback(
      () => dispatch({ type: "CLOSE_DASHBOARD_CONFIG" }),
      [],
    ),
    openDashboardSettings: useCallback(
      () => dispatch({ type: "OPEN_DASHBOARD_SETTINGS" }),
      [],
    ),
    clearStoredState: useCallback(() => {
      clearStoredState();
      window.location.reload(); // Force a reload to reset to initial state
    }, []),
    toggleTheme: useCallback(() => dispatch({ type: "TOGGLE_THEME" }), []),
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
