/**
 * Agent name mapping from UI display names to actual .kiro/agents file names
 * Maps UI shortNames to the actual agent config file names
 */

export const AGENT_NAME_MAPPING = {
  // UI shortName → actual agent name in .kiro/agents/
  "Jira Spec Creator": "jira-spec-drafter-agent",
  /** @deprecated merged into Jira Spec Creator; still map for older projects */
  "Jira Spec Draft": "jira-spec-drafter-agent",
  "Jira Publish": "jira-ticket-publisher-agent",
  /** @deprecated single-step; prefer Draft + Publish */
  "Jira Spec": "jira-spec-drafter-agent",
  "Design Spec": "design-doc-agent",
  "Code Gen": "p4gl-to-ts-transform-agent",
  "Test Gen": "test-generation-agent",
  "PR Agent": "pr-creator-agent",
  "Code Analyser": "progress-code-analyser-agent",
  "Task List": "task-list-agent",
  "Spec Agent": "jira-spec-drafter-agent",
  "Migration": "orchestrator-agent",
  "Login Page": "login-page-agent",
};

/**
 * Get the actual agent name from UI display name
 * @param {string} uiName - The shortName from UI (e.g., "Jira Spec")
 * @returns {string} - The actual agent name for .kiro/agents/ (e.g., "jira-ticket-creator-agent")
 */
export function getActualAgentName(uiName) {
  const actualName = AGENT_NAME_MAPPING[uiName];
  if (!actualName) {
    console.warn(`No mapping found for agent: ${uiName}. Available agents:`, Object.keys(AGENT_NAME_MAPPING));
    return uiName; // Fallback to original name
  }
  return actualName;
}

/**
 * Available agents in .kiro/agents/
 * This is auto-populated from the backend's agent discovery
 */
export const AVAILABLE_AGENTS = [
  {
    displayName: "Jira Spec Creator",
    actualName: "jira-spec-drafter-agent",
    description: "Drafts workspace spec, then publish step uses publisher agent when you confirm",
    file: "jira-spec-drafter-agent.json",
  },
  {
    displayName: "Jira Spec Draft",
    actualName: "jira-spec-drafter-agent",
    description: "Legacy: drafts only",
    file: "jira-spec-drafter-agent.json",
  },
  {
    displayName: "Jira Publish",
    actualName: "jira-ticket-publisher-agent",
    description: "Legacy: publish only",
    file: "jira-ticket-publisher-agent.json",
  },
  {
    displayName: "Design Spec",
    actualName: "design-doc-agent",
    description: "Generates comprehensive design documents",
    file: "design-doc-agent.json",
  },
  {
    displayName: "Code Gen",
    actualName: "p4gl-to-ts-transform-agent",
    description: "Generates code transformations",
    file: "p4gl-to-ts-transform-agent.json",
  },
  {
    displayName: "Test Gen",
    actualName: "test-generation-agent",
    description: "Generates tests with Jest configuration",
    file: "test-generation-agent.json",
  },
  {
    displayName: "PR Agent",
    actualName: "pr-creator-agent",
    description: "Creates pull requests with code and tests",
    file: "pr-creator-agent.json",
  },
  {
    displayName: "Code Analyser",
    actualName: "progress-code-analyser-agent",
    description: "Analyzes Progress code",
    file: "progress-code-analyser-agent.json",
  },
  {
    displayName: "Task List",
    actualName: "task-list-agent",
    description: "Creates task lists and timelines",
    file: "task-list-agent.json",
  },
  {
    displayName: "Migration",
    actualName: "orchestrator-agent",
    description: "Orchestrates migration workflows",
    file: "orchestrator-agent.json",
  },
  {
    displayName: "Login Page",
    actualName: "login-page-agent",
    description: "Generates login page components",
    file: "login-page-agent.json",
  },
];
