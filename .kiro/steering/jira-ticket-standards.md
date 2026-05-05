---
inclusion: auto
---

# Jira Ticket Standards - Mandatory Template Enforcement

## CRITICAL RULE: CREATE ONLY ONE STORY TICKET

**You MUST create exactly ONE Jira Story ticket per request.**

- **NEVER create epics**
- **NEVER create multiple tickets**
- **NEVER suggest breaking work into sub-tasks or child tickets**
- **Issue Type is ALWAYS `Story`**

All content goes into a single, comprehensive Story ticket following the QAD standard template.

---

## CRITICAL RULE: All Jira tickets MUST follow the QAD standard template

When creating, updating, or analyzing Jira tickets, you MUST strictly adhere to the template defined in the loaded steering rules (this file).

---

## Ticket Metadata Header

Every AI-created or AI-updated Jira ticket MUST include ticket metadata at the top of the description before the mandatory sections.

Recommended metadata fields:

| Field | Required | Notes |
|-------|----------|-------|
| Project | Yes | Jira project key or project name |
| Issue Type | Yes | **ALWAYS `Story`** - never Epic or other types |
| Priority | Yes | Default: `6 - Undefined`, unless specified otherwise |
| Module | Yes | Functional or technical module name |
| Entity | Yes | Main target entity, table, or business object |
| Feature Type | Yes | Example: `crud`, `validation`, `migration`, `integration` |
| Source References | As needed | Requirement docs, PDFs, tickets, screenshots, code files, or analysis notes |

---

## Mandatory Sections (8 Total)

Every ticket description MUST contain these sections in this exact order:

| # | Section | Purpose | Required |
|---|---------|---------|----------|
| 1 | **User Story** | Who, What, Why | Yes |
| 2 | **Background** | Context with table references | Yes |
| 3 | **Scope** | In/Out boundaries and module splits | Yes |
| 4 | **Acceptance Criteria** | Organized by sections A, B, C, and D+ when needed | Yes |
| 5 | **Technical Notes** | Tables, fields, errors, logic | Yes |
| 6 | **Dependencies** | Module dependencies table | Yes |
| 7 | **Attachments** | Design document and task list references | Yes |
| 8 | **Clarifications** | Post-creation explanations and source-document findings | As needed |

---

## Section 1: User Story Format

```text
As a [specific role/persona],
I want to [action/capability],
So that [business value/outcome].
```

### Validation Rules

- Role must be specific, not just `user`.
- Action must be concrete and measurable.
- Business value must clearly explain why the work is needed.

---

## Section 2: Background Requirements

The Background section MUST include:

- Primary field, feature, entity, or business-process description.
- Table references, for example: `pt_mstr.pt_network`.
- List of contexts where the feature appears.
- Pre-defaulting behavior, if applicable.
- Related modules and their responsibilities.
- Relevant business rules or existing behavior that affects the ticket.
- Any source-document or requirement context that explains why the change is needed.

---

## Section 3: Scope Format

```markdown
**In Scope:**
• [Feature 1] (for example, core base entity logic)
• [Feature 2]
• [Validation rules]
• [CRUD or integration behavior]
• [Module-specific responsibility]

**Out of Scope:** (if applicable)
• [Excluded feature]
• [Reason]
```

### Scope Guidance

Use the Scope section to clearly separate what this ticket owns from what other modules, apps, services, or integrations own.

Examples:

- **Application Module Splits:** Country-specific extension fields may be handled by a different app or module.
- **API-Populated Fields:** Fields such as `RateTypeCode` may be populated by external integrations and may not require manual BE validation.
- **Shared/Base Logic:** Core base entity behavior should be separated from app-specific extensions.

---

## Section 4: Acceptance Criteria Structure

### Section Organization

| Section | Purpose | AC Range |
|---------|---------|----------|
| **Section A** | Primary Entity CRUD | AC-A01 to AC-A06 |
| **Section B** | Related Entity CRUD | AC-B01 to AC-B06 |
| **Section C** | Integration / Validation / Defaults | AC-C01 to AC-C10 |
| **Section D+** | Additional Features | AC-D01+ |

### AC Format (Given / When / Then)

```text
AC-[Section][Number] — [Descriptive Title]
• Given [precondition/context]
• When [action/trigger]
• Then [expected outcome]
• And [additional validation] (optional)
```

### `.cls` Code Mapping Rules for Generating ACs

When reading Business Entity (BE) and Business Service (BS) `.cls` files, map the code logic to acceptance criteria as follows.

#### Pre-Defaulting and Initialization — Map to Section C

- **Hard-coded defaults:** Extract from the BE `Initialize` method.
  - Example: `DomainCode` is set from the session domain.
- **Admin-configured defaults:** Document the use of the QRA Framework `EntityFieldDefaultValueService`.
  - These defaults are applied after hard-coded defaults to supplement or override them.
- **Conditional defaults:** Extract logic from the BE `AssignDefaults` method.
  - Example: if field X is present, then field Y is derived or defaulted.

#### Validation Rules — Map to Sections A, B, and C

Extract every conditional check and error throw from the BE `IsValid` method, including:

- **Create-only checks:** Record must not already exist, usually based on the primary key.
- **Active-state checks:** Domain, country, site, address, or related entity must be active.
- **Entity constraints:** Specific business rules such as country, region, or module eligibility.
- **Foreign keys:** Related entities must exist, for example Address, Currency, Agent, Site, Customer, or Supplier.
- **Business-rule errors:** Capture the exact error code, error number, field, and message.

#### CRUD Operations — Map to Section A

Extract transactional logic from BS methods such as `Create`, `Fetch`, `Update`, and `Delete`, including:

- Transaction start, commit, and rollback behavior.
- `Create` defaulting and validation sequence.
- `Fetch` key lookup and display-description population.
- `Update` concurrency-hash verification.
- Replacement of unknown values using `LeaveAsUnknownList`.
- Respecting `ReadOnlyFields` during update.
- `Delete` existence check and `IsValidForDelete` behavior.

---

### Section A — Primary Entity (CRUD)

Use Section A for the main entity or business object owned by the ticket.

| AC | Standard Title | Required Coverage |
|----|----------------|-------------------|
| **AC-A01** | Create Record | Copy defaults, validate through `IsValid`, and commit within a transaction block |
| **AC-A02** | Mandatory Fields | Required fields are enforced with correct messages |
| **AC-A03** | Update Record | Verify concurrency hash, replace unknowns, validate, and commit |
| **AC-A04** | Delete (Success) | Verify existence and execute `IsValidForDelete` successfully |
| **AC-A05** | Delete (Blocked) | Prevent delete when business rules or dependencies block deletion |
| **AC-A06** | Fetch / Read | Retrieve by keys and populate display descriptions |

---

### Section B — Related Entity

Use Section B for child, related, dependent, or supporting entities.

| AC | Standard Title | Required Coverage |
|----|----------------|-------------------|
| **AC-B01** | Create Related | Related entity can be created when valid |
| **AC-B02** | Mandatory Fields | Required related-entity fields are enforced |
| **AC-B03** | Foreign Key Validation | Related references must exist, for example `AgentCode` |
| **AC-B04** | Business Rule Validation | Related business rules are enforced, for example site/country mismatch |
| **AC-B05** | Date / Range Validation | Date, range, and effective-period rules are enforced |
| **AC-B06** | Optional Field Validation | Optional fields are accepted, defaulted, or validated correctly |

---

### Section C — Integration

Use Section C for cross-module behavior, integration rules, defaults, and validation consistency.

| AC | Standard Title | Required Coverage |
|----|----------------|-------------------|
| **AC-C01** | Field Optional | Optional field behavior is documented |
| **AC-C02** | Valid Value Accepted | Valid values are accepted and persisted |
| **AC-C03** | Invalid Value Rejected | Invalid values are rejected with exact error details |
| **AC-C04** | Validation Consistency | Validation behavior is consistent across create and update |
| **AC-C05** | Domain Scoping | Domain, tenant, company, or site scoping is enforced |
| **AC-C06** | Pre-Defaulting | System hard-coded defaults and admin-configured defaults are documented |
| **AC-C07** | Side Effects | Any generated, copied, or updated side effects are documented |
| **AC-C08** | Cascading Triggers | Cascading updates, recalculations, or dependent actions are documented |
| **AC-C09** | Validation Order | Validation order is documented when order affects behavior or error messages |
| **AC-C10** | Module Dependencies | Dependent modules and services are validated and documented |

---

### Section D+ — Additional Features

Use Section D and beyond only when the ticket contains additional behavior that does not fit cleanly into Sections A, B, or C.

Examples:

- Migration behavior.
- Reporting behavior.
- UI-specific behavior.
- Batch job or scheduler behavior.
- External integration callbacks.
- Security, permission, or audit behavior.

Format:

```text
AC-D01 — [Descriptive Title]
• Given [precondition/context]
• When [action/trigger]
• Then [expected outcome]
• And [additional validation] (optional)
```

---

## Section 5: Technical Notes Requirements

The Technical Notes section MUST include all relevant technical implementation details.

### Database Tables

```text
• [Entity] table: [table_name] (key: [field1] + [field2])
```

### Field Specifications

```text
• [Field] on [entity]: [table.column] (format: [type], max: [length], label: [message-key])
```

### Error Codes

```text
• [Condition]: [ERROR_CODE] ([error-number]: "[Message]") on the [FieldName] field
```

### Business Logic

```text
• Observer: [Observer]:[Method]() → [Interface]:[Method]() → [Implementation].cls
• ReadOnly/Unknowns: Note `ReadOnlyFields` and `LeaveAsUnknownList` properties tracked in BS.
• Pre-defaulting: [Entity]BE copies [Field] from [source] on [trigger].
• Validation: [Entity]BE:IsValid() checks [condition] and throws [ERROR_CODE].
• Delete validation: [Entity]BE:IsValidForDelete() blocks delete when [condition].
• Transaction flow: [Service]BS:[Method]() starts transaction → validates → commits or rolls back.
```

### Required Technical Details Checklist

- Database table names and key fields.
- Field names, table columns, formats, max lengths, and labels.
- Mandatory field rules.
- Foreign-key checks.
- Error codes, error numbers, messages, and target fields.
- BE and BS methods involved.
- Observer, interface, and implementation mapping.
- Pre-defaulting and admin-configured default behavior.
- Read-only field handling.
- Unknown-value replacement behavior.
- Domain, company, site, country, or tenant scoping.
- Delete-blocking dependencies.

---

## Section 6: Dependencies Table

Use this table to document all module, package, service, table, and integration dependencies.

| Dependency | Module / Package | Type | Notes |
|------------|------------------|------|-------|
| [Name] | [module] | Required / Optional / Conditional | [Why needed, for example shared APIs, app splits, validation dependency] |

### Dependency Type Guidance

- **Required:** Ticket cannot work without this dependency.
- **Optional:** Dependency enriches behavior but does not block core functionality.
- **Conditional:** Dependency is required only for a specific module, country, app split, or business flow.

---

## Section 7: Attachments (MANDATORY for AI-Created)

### Required Attachments

| Attachment | Format | Naming Convention | Required |
|------------|--------|-------------------|----------|
| Design Document | PNG | `[TICKET-ID]_design_document.png` | Yes |
| Task List | PNG | `[TICKET-ID]_task_list.png` | Yes |
| Code Analysis | PDF / MD | `[TICKET-ID]_code_analysis.pdf` or `[TICKET-ID]_code_analysis.md` | Optional |

### Attachment Process

1. Generate the design document as a Mermaid diagram.
2. Convert the design document to PNG.
3. Generate the task-list visualization.
4. Convert the task list to PNG.
5. Upload attachments after ticket creation.
6. Reference uploaded attachments in the ticket description.

### Reference in Description

```markdown
## Attachments

| Document | File |
|----------|------|
| Design Document | [TICKET-ID]_design_document.png |
| Task List | [TICKET-ID]_task_list.png |
| Code Analysis | [TICKET-ID]_code_analysis.pdf |
```

---

## Section 8: Clarifications Format

Clarifications MUST be added as sections in the ticket description body, NOT as Jira comments.

Use this section for:

- Post-creation explanations.
- Findings from attached requirement documents.
- Findings from PDFs, screenshots, or design notes.
- Mapping notes from code analysis.
- Clarifications for any AC that may otherwise be misunderstood.

```markdown
## Clarifications

### [AC-XX] — [Topic Title]
[Detailed explanation extracted from source documents, code analysis, or requirement notes.]

**Key Points:**
• [Point 1]
• [Point 2]
```

---

## Mandatory Labels

All AI-created tickets MUST include these labels:

| Label | Purpose | Example |
|-------|---------|---------|
| `ai-created` | Identifies AI-generated ticket | Required |
| `[module]` | Module name | `logistics`, `distribution` |
| `[feature-type]` | Feature type | `validation`, `crud`, `migration`, `integration` |
| `[entity]` | Target entity | `declarant`, `customer`, `address`, `currency` |

### Label Rules

- Use lowercase labels unless the project already follows a different convention.
- Use hyphenated labels for multi-word values.
- Do not omit the entity label for entity-specific tickets.
- Keep labels meaningful and searchable.

---

## Error Message Format

Use this exact structure when documenting validation failures:

```text
reject with [ERROR_CODE] ([error-number]: "Message") on the [FieldName] field
```

### Common Error Patterns

| Pattern | Format |
|---------|--------|
| Duplicate | `RECORD_ALREADY_EXIST on the [Field] field` |
| Not Found | `RECORD_DOES_NOT_EXIST` |
| Invalid Reference | `INVALID_[FIELD] ([error-number]) on the [Field] field` |
| Business Rule | `[module]-[number] ("[Message]") on the [Field] field` |

### Error Documentation Rules

- Always capture the exact error code.
- Capture the error number when available.
- Capture the message exactly as defined in the code or source document.
- Capture the target field name.
- Mention whether the error applies to create, update, delete, or all flows.

---

## Validation Workflow

### Before Creating or Updating a Ticket

#### 1. Gather Information

- [ ] Ticket metadata is available.
- [ ] All 8 mandatory sections are complete, except Clarifications when not needed.
- [ ] All ACs use Given / When / Then format.
- [ ] ACs accurately map logic from `.cls` files where code analysis is involved.
- [ ] All technical details are documented.
- [ ] Source documents, PDFs, screenshots, or existing Jira tickets have been reviewed when provided.

#### 2. Validate Structure

- [ ] Metadata is included at the top.
- [ ] User Story format is correct.
- [ ] Background has table references.
- [ ] Scope has In Scope and Out of Scope boundaries.
- [ ] Module splits are documented where relevant.
- [ ] ACs are organized by sections A, B, C, and D+ when needed.
- [ ] Technical Notes are complete.
- [ ] Dependencies are documented.
- [ ] Attachments are referenced.
- [ ] Clarifications are in the description body, not comments.

#### 3. Prepare Attachments

- [ ] Design document PNG is ready.
- [ ] Task list PNG is ready.
- [ ] Code analysis file is ready when applicable.

#### 4. Validate Labels

- [ ] `ai-created` label is included.
- [ ] Module label is included.
- [ ] Feature-type label is included.
- [ ] Entity label is included.

### If Validation Fails

1. DO NOT create or update the ticket.
2. Report the missing sections or missing details to the user.
3. Provide specific guidance on what must be added.
4. Reference the template in the loaded steering rules.

---

## Jira MCP Workflow

**REMINDER: Create exactly ONE Story ticket. Never create epics or multiple tickets.**

### Step 1: Create ONE Story Ticket

```javascript
mcp_jira_jira_post({
  path: "/rest/api/3/issue",
  body: {
    fields: {
      project: { key: "PROJECT_KEY" },
      summary: "[Entity Name] Maintenance - Validation, Pre-Defaulting & CRUD for [Module] [Entity Name] Records",
      issuetype: { name: "Story" },  // ALWAYS Story - NEVER Epic
      priority: { name: "6 - Undefined" },
      labels: ["ai-created", "module-name", "feature-type", "entity-name"],
      description: {
        /* ADF format - mapping directly to metadata and Sections 1-8 */
      }
    }
  }
})
```

### Step 2: Upload Attachments

After ticket creation, upload attachments.

```javascript
// Upload design document
mcp_jira_jira_post({
  path: "/rest/api/3/issue/{issueKey}/attachments",
  headers: { "X-Atlassian-Token": "no-check" },
  body: /* multipart form with PNG file */
})

// Upload task list
mcp_jira_jira_post({
  path: "/rest/api/3/issue/{issueKey}/attachments",
  headers: { "X-Atlassian-Token": "no-check" },
  body: /* multipart form with PNG file */
})
```

### Step 3: Confirm Creation

Return the following to the user:

- Ticket key, for example `DOM-524`.
- Ticket URL.
- List of attachments uploaded.
- Summary of what was created.
- Any assumptions or missing details that were handled during creation.

---

## Quick Reference

### ONE Ticket Rule

```text
Create exactly ONE Story ticket per request. NEVER create epics or multiple tickets.
```

### Section Order

```text
Metadata → 1. User Story → 2. Background → 3. Scope → 4. Acceptance Criteria → 5. Technical Notes → 6. Dependencies → 7. Attachments → 8. Clarifications
```

### Mandatory Labels

```text
ai-created + [module] + [feature-type] + [entity]
```

### Attachment Naming

```text
[TICKET-ID]_design_document.png
[TICKET-ID]_task_list.png
[TICKET-ID]_code_analysis.pdf
```

### AC Numbering

```text
A01-A06 (Primary Entity CRUD) → B01-B06 (Related Entity CRUD) → C01-C10 (Integration / Validation / Defaults) → D01+ (Additional Features)
```

### Minimum Ticket Quality Bar

A ticket is ready only when:

- **Issue type is Story** (NEVER Epic or other types).
- **Only ONE ticket is created** (NEVER multiple tickets).
- The user story is specific and business-value driven.
- Background includes table and module context.
- Scope clearly separates in-scope and out-of-scope behavior.
- ACs map directly to code, requirements, or documented business rules.
- Technical notes contain table, field, error, and method-level details.
- Dependencies are explicit.
- Attachments are named and referenced correctly.
- Required labels are present.

---

## Reference

Full template is defined in `.kiro/steering/jira-ticket-standards.md` (this file).

Based on DOM-524 and LOG-1771 formats | Template Version 2.0