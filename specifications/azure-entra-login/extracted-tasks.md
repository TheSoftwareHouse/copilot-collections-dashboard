# Azure Entra ID Login - Extracted Tasks

## Workshop Summary

| Field | Value |
|---|---|
| Workshop Date | N/A — direct requirements |
| Participants | N/A |
| Source Materials | User requirements (2026-03-02), codebase analysis |
| Total Epics | 1 |
| Total Stories | 5 |

## Epics Overview

| # | Epic Title | Stories Count | Priority |
|---|-----------|---------------|----------|
| 1 | Azure Entra ID Authentication | 5 | High |

## Epic 1: Azure Entra ID Authentication

**Business Description**: Enable users to log in using Azure Entra ID (Azure AD) as an alternative to the existing username/password authentication. When Azure login is active, user management is fully delegated to Azure — local user creation and removal are disabled. The authentication method is controlled via environment variables, allowing operators to choose between credentials-based and Azure-based login at deployment time.

**Success Criteria**:
- Users can log in via Azure AD using the PKCE authorization code flow when Azure authentication is configured
- The login page automatically adapts to show the correct login method based on configuration
- Local user management is disabled when Azure authentication is active, with all access managed through Azure AD

### Story 1.1: System reads authentication method from environment variables

**User Story**: As a system operator, I want to configure the authentication method via environment variables so that I can switch between credentials-based and Azure AD login at deployment time without changing the application code or database.

**Acceptance Criteria**:
- [ ] An explicit `AUTH_METHOD` environment variable determines the active authentication method (`credentials` or `azure`)
- [ ] When `AUTH_METHOD` is not set, the system defaults to `credentials` (current behaviour preserved)
- [ ] When `AUTH_METHOD=azure`, the system requires `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_REDIRECT_URI` environment variables
- [ ] The system fails to start with a clear error message if `AUTH_METHOD=azure` but any required Azure variable is missing
- [ ] When `AUTH_METHOD=credentials`, the system behaves exactly as it does today (no changes to existing flow)
- [ ] If `AUTH_METHOD` is set to an unrecognized value, the system fails to start with a clear error listing the supported values (`credentials`, `azure`)

**High-Level Technical Notes**: Configuration is environment-variable-only — no UI settings page for Azure. This keeps Azure configuration as a deployment concern managed by operators.

**Priority**: Critical

### Story 1.2: Login page adapts to the configured authentication method

**User Story**: As a user, I want to see the appropriate login interface based on how the system is configured so that I know how to authenticate.

**Acceptance Criteria**:
- [ ] When `AUTH_METHOD=azure`, the login page displays a "Login with Azure AD" button instead of the username/password form
- [ ] When `AUTH_METHOD=credentials` (default), the login page displays the current username/password form unchanged
- [ ] The "Login with Azure AD" button is clearly labelled and visually prominent
- [ ] No username/password fields are shown when Azure authentication is active

**High-Level Technical Notes**: None

**Priority**: High

### Story 1.3: User can authenticate via Azure AD PKCE flow

**User Story**: As a user, I want to log in by clicking the "Login with Azure AD" button and authenticating with my Azure credentials so that I can access the dashboard without needing a separate local account.

**Acceptance Criteria**:
- [ ] Clicking the "Login with Azure AD" button redirects the user to the Azure authorization endpoint
- [ ] The authorization request uses the PKCE (Proof Key for Code Exchange) flow with a code verifier and code challenge
- [ ] After authenticating with Azure, the user is redirected back to the application with an authorization code
- [ ] The system exchanges the authorization code for tokens using the code verifier
- [ ] A local session is created for the authenticated user, granting access to the dashboard
- [ ] The user is redirected to the dashboard after successful authentication
- [ ] If authentication fails or the user cancels at Azure, an appropriate error message is shown on the login page
- [ ] If Azure AD is unreachable or times out, the user sees an error message indicating the identity provider is unavailable
- [ ] If the token exchange fails (invalid code, expired code), the user sees an error and can retry
- [ ] The authorization request includes a state parameter to protect against CSRF attacks

**High-Level Technical Notes**: PKCE flow was explicitly requested — no client secret is used. The redirect URI must match the value configured in both the Azure app registration and the environment variable.

**Priority**: Critical

### Story 1.4: User management is disabled when Azure login is configured

**User Story**: As a system operator, I want local user management to be unavailable when Azure authentication is active so that all access control is managed centrally through Azure AD.

**Acceptance Criteria**:
- [ ] When `AUTH_METHOD=azure`, the user management panel is not accessible in the UI
- [ ] When `AUTH_METHOD=azure`, API endpoints for creating, editing, and deleting users return an appropriate error indicating that user management is handled by Azure AD
- [ ] The UI clearly communicates that access management is handled through Azure AD (e.g., an informational message where the user management panel would normally appear)
- [ ] When `AUTH_METHOD=credentials`, user management works exactly as it does today (no changes)

**High-Level Technical Notes**: None

**Priority**: High

### Story 1.5: User can log out when authenticated via Azure AD

**User Story**: As a user authenticated via Azure AD, I want to log out of the application so that my session is ended and access is revoked.

**Acceptance Criteria**:
- [ ] When the user clicks logout, the local session is destroyed (same as current logout behaviour)
- [ ] The user is redirected to the login page after logout
- [ ] Optionally, the user can be redirected to Azure AD's logout endpoint to end the Azure session as well
- [ ] The logout flow works consistently regardless of authentication method (credentials or Azure)

**High-Level Technical Notes**: None

**Priority**: High

## Dependencies

| Task | Depends On | Type | Notes |
|------|-----------|------|-------|
| Story 1.2 | Story 1.1 | Blocked by | Login page needs to read the auth method to decide which UI to show |
| Story 1.3 | Story 1.1 | Blocked by | PKCE flow needs Azure configuration values from environment variables |
| Story 1.3 | Story 1.2 | Related to | The Azure login button (Story 1.2) triggers the PKCE flow (Story 1.3) |
| Story 1.4 | Story 1.1 | Blocked by | Disabling user management depends on knowing the active auth method |
| Story 1.5 | Story 1.3 | Blocked by | Logout flow depends on Azure session being established first |

## Assumptions

| # | Assumption | Confidence | Impact if Wrong |
|---|-----------|------------|-----------------|
| 1 | Single Azure tenant is supported (one set of Azure env vars) | High | Would need to support multiple tenant configurations |
| 2 | When switching from Azure back to credentials, the previously seeded default admin credentials remain valid | Medium | May need a migration path or re-seeding logic |
| 3 | The system does not need to store or display Azure user profile details (name, email) beyond what is needed for the session | Medium | Would need additional user profile storage and display logic |
| 4 | Azure app registration and redirect URI setup in the Azure portal is handled by the operator outside of this system | High | Would need to automate Azure app registration |

## Out of Scope

Items explicitly excluded from this task breakdown:
- Azure AD group or role mapping to local permissions (no role-based access exists in the current system)
- Automatic provisioning or syncing of Azure users into a local user table
- Multi-tenant Azure support
- Token refresh/renewal specifics (technical implementation concern)
- Changes to the first-run setup wizard (Azure config is env-var-only)
- Migration tooling for transitioning existing credential users to Azure

## Open Questions for Stakeholders

| # | Question | Context | Impact |
|---|----------|---------|--------|
| 1 | Should the system display Azure user information (display name, email) anywhere in the UI after login? | Currently the app shows the username in the session. With Azure login, the identity source changes. | Affects whether Azure user profile data needs to be extracted from tokens and displayed |
| 2 | Should the system support switching from Azure back to credentials mode, and if so, what happens to the default admin seed? | The default admin is seeded from env vars when no users exist. If Azure was used first, there may be no local users. | Affects whether the admin seeding logic needs to be revisited |
