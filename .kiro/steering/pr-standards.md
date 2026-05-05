---
inclusion: auto
---

# Pull Request Standards - Automated PR Creation

> **🛑 MANDATORY: Read this file completely before creating any pull request.**
>
> **Agent**: You are the PR Agent (Step 6). Read `.kiro/steering/pr-standards.md` fully.
>
> **OUTPUT FILE**: Write PR documentation to `.kiro/orchestration/<run-id>/07-pull-request.md`

---

## PR Creation Workflow

When creating pull requests automatically, follow this structured workflow:

### Phase 1: Code Generation & Validation

1. **Generate/Modify Code**
   - Follow project coding standards
   - Add proper documentation and comments
   - Ensure code is production-ready
   - Include error handling

2. **Validate Changes**
   - Run linters if available
   - Execute tests if applicable
   - Check for syntax errors
   - Verify imports and dependencies

### Phase 2: Branch Management

1. **Branch Naming Convention**
   ```
   feature/<short-description>  - New features
   fix/<bug-description>        - Bug fixes
   refactor/<component-name>    - Code refactoring
   docs/<doc-type>              - Documentation updates
   test/<test-scope>            - Test additions
   chore/<task-description>     - Maintenance tasks
   ```

   **Examples:**
   - `feature/user-authentication`
   - `fix/login-validation-error`
   - `refactor/database-connection`
   - `docs/api-endpoints`

2. **Branch Creation**
   - Always create from the latest base branch (usually `main` or `develop`)
   - Use descriptive, kebab-case names
   - Keep branch names concise but meaningful

### Phase 3: Commit Strategy

1. **Conventional Commits Format**
   ```
   <type>(<scope>): <description>

   [optional body]

   [optional footer]
   ```

2. **Commit Types**
   - `feat`: New feature
   - `fix`: Bug fix
   - `refactor`: Code refactoring
   - `docs`: Documentation changes
   - `test`: Adding or updating tests
   - `chore`: Maintenance tasks
   - `style`: Code style changes (formatting)
   - `perf`: Performance improvements

3. **Commit Examples**
   ```
   feat(auth): add JWT token validation
   fix(api): resolve null pointer in user endpoint
   refactor(database): optimize query performance
   docs(readme): update installation instructions
   test(auth): add unit tests for login flow
   ```

4. **Commit Best Practices**
   - Make atomic commits (one logical change per commit)
   - Write clear, descriptive messages
   - Use present tense ("add feature" not "added feature")
   - Keep subject line under 72 characters
   - Add body for complex changes

### Phase 4: PR Description Template

Use this template for all PR descriptions:

```markdown
## Summary
[Brief description of what this PR does]

## Type of Change
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (code improvement without changing functionality)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Test addition/update

## Motivation and Context
[Why is this change required? What problem does it solve?]

## Changes Made
- [List key changes]
- [Be specific about what was added/modified/removed]
- [Include file paths if relevant]

## Related Issues
- Closes #[issue number]
- Related to #[issue number]
- Jira: [TICKET-ID]

## Testing Performed
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] All existing tests pass

**Test Details:**
[Describe what testing was done]

## Screenshots (if applicable)
[Add screenshots for UI changes]

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated and passing
- [ ] Dependent changes merged

## Additional Notes
[Any additional information reviewers should know]

## Reviewer Notes
[Specific areas to focus on during review]
```

### Phase 5: PR Metadata

1. **Labels** (add appropriate labels):
   - `feature` - New functionality
   - `bugfix` - Bug fixes
   - `enhancement` - Improvements
   - `documentation` - Docs changes
   - `refactor` - Code refactoring
   - `breaking-change` - Breaking changes
   - `needs-review` - Ready for review
   - `work-in-progress` - Still in progress

2. **Reviewers**
   - Assign relevant team members
   - Tag subject matter experts
   - Include code owners

3. **Assignees**
   - Assign PR creator
   - Assign responsible developer

4. **Milestone**
   - Link to relevant milestone/sprint

### Phase 6: Pre-PR Checklist

Before creating the PR, verify:

- [ ] All code changes are committed
- [ ] Branch is up to date with base branch
- [ ] No merge conflicts exist
- [ ] Code compiles/runs without errors
- [ ] Tests pass (if applicable)
- [ ] Documentation is updated
- [ ] Commit messages follow conventions
- [ ] PR description is complete
- [ ] Related issues are linked

### Phase 7: Post-PR Actions

After PR creation:

1. **Notify Stakeholders**
   - Comment on related Jira tickets
   - Notify team in communication channels
   - Tag relevant reviewers

2. **Monitor PR**
   - Respond to review comments
   - Address requested changes
   - Keep PR updated with base branch

3. **Merge Strategy**
   - Use squash merge for feature branches
   - Use merge commit for release branches
   - Delete branch after merge

---

## GitHub MCP Tools Usage

### Creating a Branch
```javascript
mcp_github_create_branch({
  owner: "organization-name",
  repo: "repository-name",
  branch: "feature/new-feature-name",
  from_branch: "main"  // optional, defaults to repo default
})
```

### Pushing Files
```javascript
mcp_github_push_files({
  owner: "organization-name",
  repo: "repository-name",
  branch: "feature/new-feature-name",
  files: [
    {
      path: "src/components/NewComponent.tsx",
      content: "// file content here"
    },
    {
      path: "src/utils/helper.ts",
      content: "// file content here"
    }
  ],
  message: "feat(components): add new component with helper utilities"
})
```

### Creating a Pull Request
```javascript
mcp_github_create_pull_request({
  owner: "organization-name",
  repo: "repository-name",
  title: "feat: Add user authentication system",
  body: "## Summary\n\nImplements JWT-based authentication...",
  head: "feature/user-authentication",
  base: "main",
  draft: false,
  maintainer_can_modify: true
})
```

---

## Automated PR Workflow Example

### User Request:
"Create a new API endpoint for user profile management"

### Agent Workflow:

1. **Generate Code**
   - Create controller file
   - Create service file
   - Create model/interface
   - Add tests
   - Update documentation

2. **Create Branch**
   ```
   Branch: feature/user-profile-api
   From: main
   ```

3. **Commit Changes**
   ```
   feat(api): add user profile management endpoint
   
   - Add ProfileController with CRUD operations
   - Implement ProfileService with business logic
   - Add UserProfile model and validation
   - Include unit tests for all operations
   - Update API documentation
   ```

4. **Create PR**
   ```
   Title: feat: Add user profile management API endpoint
   
   Description: [Full template filled out]
   
   Labels: feature, api, needs-review
   ```

5. **Confirm with User**
   ```
   PR created successfully!
   URL: https://github.com/org/repo/pull/123
   
   Summary:
   - Created feature/user-profile-api branch
   - Added 5 files (controller, service, model, tests, docs)
   - 1 commit with conventional format
   - PR ready for review
   ```

---

## Error Handling

### Common Issues and Solutions:

1. **Branch Already Exists**
   - Check if branch exists first
   - Use unique branch names with timestamps if needed
   - Offer to use existing branch or create new one

2. **Merge Conflicts**
   - Update branch with latest base
   - Resolve conflicts before PR creation
   - Notify user of conflicts

3. **Authentication Errors**
   - Verify GitHub token is valid
   - Check token has required permissions
   - Provide clear error message to user

4. **File Too Large**
   - Split into multiple commits
   - Use Git LFS for large files
   - Warn user about file size limits

---

## Best Practices

### DO:
- ✅ Create descriptive branch names
- ✅ Write clear commit messages
- ✅ Fill out complete PR descriptions
- ✅ Link related issues/tickets
- ✅ Add appropriate labels
- ✅ Request relevant reviewers
- ✅ Keep PRs focused and atomic
- ✅ Update documentation
- ✅ Add tests for new features

### DON'T:
- ❌ Create PRs with vague descriptions
- ❌ Mix unrelated changes in one PR
- ❌ Skip testing
- ❌ Ignore coding standards
- ❌ Leave TODO comments without issues
- ❌ Create massive PRs (>500 lines)
- ❌ Force push to PR branches
- ❌ Merge without review

---

## Integration with Jira

When creating PRs related to Jira tickets:

1. **Include Jira Ticket in Branch Name**
   ```
   feature/DOM-524-network-code-api
   ```

2. **Reference Jira in Commit**
   ```
   feat(api): implement network code validation [DOM-524]
   ```

3. **Link Jira in PR Description**
   ```markdown
   ## Related Issues
   - Jira: [DOM-524](https://jira-url/browse/DOM-524)
   ```

4. **Update Jira After PR Creation**
   - Add PR link to Jira ticket
   - Update ticket status to "In Review"
   - Add comment with PR details

---

## Configuration Requirements

### GitHub Token Permissions

Your GitHub Personal Access Token must have:
- `repo` - Full control of private repositories
- `workflow` - Update GitHub Action workflows (if applicable)
- `write:packages` - Upload packages (if applicable)

### Repository Settings

Ensure repository has:
- Branch protection rules configured
- Required reviewers set up
- Status checks enabled
- Auto-merge settings (optional)

---

## Validation Rules

Before creating any PR, validate:

1. **Code Quality**
   - No syntax errors
   - Follows project conventions
   - Proper error handling
   - Adequate documentation

2. **Git Hygiene**
   - Clean commit history
   - Descriptive commit messages
   - No merge commits in feature branch
   - Branch up to date with base

3. **PR Content**
   - Complete description
   - All checklist items addressed
   - Related issues linked
   - Appropriate labels added

4. **Testing**
   - Tests added for new features
   - All tests passing
   - Manual testing completed
   - No regressions introduced

---

## Quick Reference

### Branch Naming
```
feature/<description>
fix/<description>
refactor/<description>
docs/<description>
test/<description>
chore/<description>
```

### Commit Format
```
<type>(<scope>): <description>
```

### PR Title Format
```
<type>: <Brief description>
```

### Common Labels
- feature, bugfix, enhancement
- documentation, refactor
- breaking-change, needs-review
- work-in-progress

---

This steering file ensures all automated PRs follow consistent, professional standards that align with modern development practices.
