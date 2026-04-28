// Platform Options
export const IDE_PLATFORMS = [
  { id: "amazon_kiro", label: "Amazon KIRO AI", color: "#F59E0B", icon: "🟡" },
  { id: "microsoft_autogen", label: "Microsoft Autogen", icon: "🔵" },
  { id: "crew_ai", label: "Crew AI", icon: "🟢" },
  { id: "n8n", label: "n8n", icon: "🔴" },
];

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
    agentCount: 5,
  },
];
