# JIRA TICKET: Login Page (React.js)

## Summary
Build a responsive login form with email/password validation, JWT storage, and redirect on success.

## User Story
As a user, I want a login page, so that I can authenticate and access protected areas.

## Acceptance Criteria
- [ ] Email + Password fields with client-side validation (empty check, email format)
- [ ] Login button disabled when fields are empty; shows spinner during API call
- [ ] POST /auth/login via axios; store JWT in localStorage on 200 OK
- [ ] Show "Invalid email or password" on 401; show generic error on 5xx
- [ ] Redirect to /dashboard on success using useNavigate
- [ ] Mobile-responsive layout; accessible labels and keyboard navigation

## Technical Notes
- Stack: React 18, TypeScript, Tailwind CSS
- Libraries: axios, react-router-dom
- API: POST ${REACT_APP_API_BASE_URL}/auth/login → { token } on 200, { message } on 401
- State: email, password, isLoading, error via useState

## Labels
authentication, crud, validation
