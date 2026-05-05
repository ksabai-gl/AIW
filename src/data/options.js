// Platform Options
export const IDE_PLATFORMS = [
  { id: "cursor_cli", label: "Cursor (Agent CLI)", color: "#6366F1", icon: "⬡" },
  { id: "kiro_cli", label: "Kiro CLI", color: "#F59E0B", icon: "🟡" },
  { id: "amazon_kiro", label: "Amazon KIRO AI", color: "#F59E0B", icon: "🟡" },
  { id: "microsoft_autogen", label: "Microsoft Autogen", icon: "🔵" },
  { id: "crew_ai", label: "Crew AI", icon: "🟢" },
  { id: "n8n", label: "n8n", icon: "🔴" },
];

/** Platforms that load LLMs from cursor-agent-bridge (`/api/models` or `/api/kiro/models`). */
export const BRIDGE_CLI_PLATFORMS = ["cursor_cli", "kiro_cli"];

export function isBridgeCliPlatform(platformId) {
  return BRIDGE_CLI_PLATFORMS.includes(platformId);
}

// LLM Options (visible after platform selected)
export const LLM_OPTIONS = [
  { id: "llm1", label: "Claude Sonnet 4.5", provider: "Anthropic" },
  { id: "llm2", label: "GPT-4o", provider: "OpenAI" },
  { id: "llm3", label: "Gemini 2.0", provider: "Google" },
  { id: "llm4", label: "LLaMA 3.3", provider: "Meta" },
];

// Cloud Deployment Options
export const CLOUD_OPTIONS = [
  { id: "on_premises", label: "On Premises", icon: "🏢" },
  { id: "aws", label: "AWS", icon: "☁️", color: "#F59E0B" },
  { id: "azure", label: "Azure GCP", icon: "🔵" },
  { id: "gcp", label: "GCP", icon: "🌐" },
];

// MCP Server Options
export const MCP_OPTIONS = [
  { id: "jira", label: "JIRA", icon: "📋" },
  { id: "github", label: "Github", icon: "🐙", color: "#06B6D4" },
  { id: "confluence", label: "Confluence", icon: "📄" },
  { id: "slack", label: "Slack", icon: "💬" },
];

// Language Options
export const LANGUAGES = [
  { id: "reactjs", label: "ReactJS", icon: "⚛️" },
  { id: "progress4gl", label: "Progress4GL", icon: "📦", color: "#3B82F6" },
  { id: "java", label: "Java", icon: "☕" },
  { id: "dotnet", label: ".NET", icon: "🔷" },
  { id: "nodejs", label: "Node.js", icon: "🟩" },
  { id: "python", label: "Python", icon: "🐍" },
  { id: "angular", label: "Angular", icon: "🔴" },
  { id: "vue", label: "Vue.js", icon: "💚" },
];

// Accepted source file extensions by selected source language/framework
export const SOURCE_FILE_ACCEPT = {
  progress4gl: ".p,.w,.i,.cls,.p4gl,.r",
  java: ".java,.gradle,.xml,.properties,.yml,.yaml",
  dotnet: ".cs,.vb,.fs,.csproj,.sln,.config,.json",
  nodejs: ".js,.mjs,.cjs,.ts,.tsx,.json",
  reactjs: ".jsx,.tsx,.js,.ts,.css,.scss",
  python: ".py,.pyw,.toml,.txt",
  angular: ".ts,.html,.scss,.css,.json",
  vue: ".vue,.js,.ts,.json,.css,.scss",
};

export const KICKOFF_SOURCES = [
  { id: "spec_file", label: "Spec File" },
  { id: "jira_document", label: "Jira Document" },
  { id: "design_file", label: "Design File" },
  { id: "modernization", label: "Modernization" },
  { id: "custom_flow", label: "Custom Flow" },
];

export const PROJECT_FLOW_OPTIONS = [
  {
    id: "jira_spec",
    title: "JIRA Spec",
    subtitle: "Input as JIRA Spec",
    icon: "📋",
    description: "Start from a JIRA specification document to generate implementation tasks and code.",
    flowType: "without_migration",
    kickoffSource: "jira_document",
    badge: "Agile Ready",
    badgeColor: "#3B82F6",
    // modernization_pipeline trimmed from Jira onward
    agents: ["jira_spec_creator", "code_gen", "test_gen", "pr_agent"],
    nextStepLabel: "Select Target Language",
    nextStepDesc: "Choose the language for code generation output.",
  },
  {
    id: "design_spec",
    title: "Design Spec",
    subtitle: "Input as Design Spec",
    icon: "🎨",
    description: "Start from a design specification file to generate high-level and detailed designs.",
    flowType: "without_migration",
    kickoffSource: "design_file",
    badge: "Design First",
    badgeColor: "#06B6D4",
    // modernization_pipeline trimmed from Design Spec onward
    agents: ["design_spec", "task_list", "jira_spec_creator", "code_gen", "test_gen", "pr_agent"],
    nextStepLabel: "Select Target Language",
    nextStepDesc: "Choose the language for code generation output.",
  },
  {
    id: "code_with_migration",
    title: "Code (With Migration)",
    subtitle: "Input as Code",
    icon: "🔄",
    description: "Legacy modernization with a dedicated Code Migration Agent.",
    flowType: "with_migration",
    kickoffSource: "modernization",
    badge: "Legacy",
    badgeColor: "#8B5CF6",
    // full migration_pipeline
    agents: [
      "code_analyser",
      "code_migration",
      "design_spec",
      "task_list",
      "jira_spec_creator",
      "code_gen",
      "test_gen",
      "pr_agent",
    ],
    nextStepLabel: "Select Source & Target Language",
    nextStepDesc: "Choose the legacy source language and the modern target language.",
  },
  {
    id: "code_without_migration",
    title: "Code (Without Migration)",
    subtitle: "Input as Code",
    icon: "⚡",
    description: "Direct analysis and generation for modern stacks or same-tech modernization.",
    flowType: "without_migration",
    kickoffSource: "modernization",
    badge: "Greenfield",
    badgeColor: "#22C55E",
    // full modernization_pipeline (no migration agent)
    agents: [
      "code_analyser",
      "design_spec",
      "task_list",
      "jira_spec_creator",
      "code_gen",
      "test_gen",
      "pr_agent",
    ],
    nextStepLabel: "Select Source Language",
    nextStepDesc: "Choose the primary language for analysis and code generation.",
  },
  {
    id: "custom",
    title: "Custom Flow",
    subtitle: "Select Input & Agents",
    icon: "🛠️",
    description: "Full control over input source and specific agents needed for your pipeline.",
    flowType: "without_migration",
    kickoffSource: "custom_flow",
    badge: "Tailored",
    badgeColor: "#F59E0B",
    agents: [],
    nextStepLabel: "Configure Agents",
    nextStepDesc: "Select your input source and choose the agents for your custom pipeline.",
  },
];

export const ALL_AGENTS = [
  {
    id: "code_analyser",
    name: "Code Analyser Agent",
    shortName: "Code Analyser",
    description: "Analyzes source code and generates detailed analysis report.",
    icon: "search",
    color: "#3B82F6",
    htlpRequired: true,
    htlpLabel: "HITLP (Context Setting for Code Analysis)",
  },
  {
    id: "code_migration",
    name: "Code Migration Agent",
    shortName: "Migration",
    description: "Migrates code to target technology and prepares migrated artifacts.",
    icon: "git-merge",
    color: "#8B5CF6",
    htlpRequired: true,
    htlpLabel: "HITLP (Manual Migration Review)",
  },
  {
    id: "design_spec",
    name: "Design Spec Agent",
    shortName: "Design Spec",
    description: "Generates high level and detailed design specification.",
    icon: "layout",
    color: "#06B6D4",
    htlpRequired: true,
    htlpLabel: "HITLP (Manual Review Design Spec)",
  },
  {
    id: "task_list",
    name: "Task List Spec Agent",
    shortName: "Task List",
    description: "Creates estimated task list, timelines and dependencies.",
    icon: "list-checks",
    color: "#F59E0B",
  },
  {
    id: "jira_spec_creator",
    name: "Jira Spec Creator Agent",
    shortName: "Jira Spec Creator",
    description:
      "Drafts the Jira spec in your workspace, then review and create one issue via MCP on this card.",
    icon: "ticket",
    color: "#22C55E",
  },
  {
    id: "code_gen",
    name: "Code Generation Agent",
    shortName: "Code Gen",
    description: "Generates clean, modular and production ready code.",
    icon: "code",
    color: "#3B82F6",
    htlpRequired: true,
    htlpLabel: "HITLP (Manual Code Review)",
  },
  {
    id: "test_gen",
    name: "Test Generation Agent",
    shortName: "Test Gen",
    description: "Generates unit, integration and regression tests.",
    icon: "flask-conical",
    color: "#8B5CF6",
    htlpRequired: true,
    htlpLabel: "HITLP (Manual Test Review)",
  },
  {
    id: "pr_agent",
    name: "PR Creation Agent",
    shortName: "PR Agent",
    description: "Creates Pull Request in Git repository with code and tests.",
    icon: "git-pull-request",
    color: "#EC4899",
    htlpRequired: true,
    htlpLabel: "HITLP (PR Review)",
  },
];

export const KICKOFF_SOURCE_CONFIG = {
  spec_file: {
    inputLabel: "Spec Document",
    accept: ".pdf,.doc,.docx,.md,.txt,.yaml,.yml,.json",
    startFrom: "Design Spec",
  },
  jira_document: {
    inputLabel: "Jira Document",
    accept: ".json,.csv,.xlsx,.txt,.md",
    startFrom: "Jira Spec Creator",
  },
  design_file: {
    inputLabel: "Design File",
    accept: ".pdf,.doc,.docx,.ppt,.pptx,.md,.txt",
    startFrom: "Design Spec",
  },
  modernization: {
    inputLabel: "Source Code File",
    accept: null,
    startFrom: null,
    pipelineTemplateOverride: "migration_pipeline",
  },
  custom_flow: {
    inputLabel: "Input File",
    accept: null,
    startFrom: null,
  },
};

// Sidebar workflow templates mapped to pipeline variants
export const WORKFLOW_TEMPLATES = [
  {
    id: "migration_pipeline",
    label: "Migration Pipeline",
    icon: "🔄",
    flowType: "with_migration",
    estimatedTime: "~60-90 mins",
    agentCount: 9,
  },
  {
    id: "modernization_pipeline",
    label: "Modernization Pipeline",
    icon: "☕",
    flowType: "without_migration",
    estimatedTime: "~45-60 mins",
    agentCount: 8,
  },
  {
    id: "cloud_ready_pipeline",
    label: "Cloud Ready Pipeline",
    icon: "☁️",
    flowType: "without_migration",
    estimatedTime: "~50-70 mins",
    agentCount: 8,
  },
  {
    id: "reengineering_pipeline",
    label: "Re-engineering Pipeline",
    icon: "🏗️",
    flowType: "with_migration",
    estimatedTime: "~60-85 mins",
    agentCount: 9,
  },
  {
    id: "analysis_pipeline",
    label: "Code Analysis Pipeline",
    icon: "🔍",
    flowType: "without_migration",
    estimatedTime: "~30-40 mins",
    agentCount: 4,
  },
];
