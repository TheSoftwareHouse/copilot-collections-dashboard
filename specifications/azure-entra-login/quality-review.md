# Azure Entra ID Login — Quality Review Report

## Review Context

| Field | Value |
|---|---|
| Review Date | 2026-03-02 |
| Source Task List | `extracted-tasks.md` (Gate 1 approved) |
| Additional Sources | Codebase analysis (auth system, user management, configuration) |
| Epics Reviewed | 1 |
| Stories Reviewed | 4 |
| Total Suggestions | 4 |
| Accepted | 4 |
| Rejected | 0 |

---

## Domain Model

### Actors

| Actor | Epics Involved | Key Capabilities |
|---|---|---|
| System Operator | 1 | Configures auth method via environment variables, manages deployment |
| User | 1 | Logs in via Azure AD or credentials, accesses dashboard, logs out |

### Entities

| Entity | Created In | Read In | Updated In | Deactivated/Deleted In |
|---|---|---|---|---|
| Auth Configuration (env vars) | External (deployment) | Story 1.1, 1.2, 1.3, 1.4 | External (deployment) | External (deployment) |
| Azure Session | Story 1.3 | App layout guard | — | Story 1.5 |
| Local User | Existing system | Story 1.4 | Existing system | Story 1.4 (blocked when Azure) |

### Key Relationships

- Azure Session depends on Auth Configuration being set to `azure` — validated in Story 1.1 (startup)
- Local User CRUD depends on Auth Configuration being set to `credentials` — enforced in Story 1.4
- Azure Session lifecycle (create/destroy) mirrors existing DB session — managed in Stories 1.3 and 1.5

---

## Suggestions

### Epic 1: Azure Entra ID Authentication

#### S-01 · High · NEW_STORY

**Target**: Epic 1 (new story)

**Finding** (Pass A: Entity Lifecycle Completeness):
No story covers how users log out when authenticated via Azure AD. The current system has a logout flow that destroys DB sessions, but with Azure there are additional considerations — should the user be signed out of Azure AD as well, or only the local session? This is a clear entity lifecycle gap for the Azure Session entity.

**Proposed Change**:
Add new Story 1.5: User can log out when authenticated via Azure AD
- Local session is destroyed (same as current logout)
- User is redirected to the login page
- Optionally, user can be redirected to Azure AD's logout endpoint
- Logout works consistently regardless of auth method

**Decision**: ✅ Accepted

---

#### S-02 · High · ADD_ACCEPTANCE_CRITERION

**Target**: Story 1.3 — User can authenticate via Azure AD PKCE flow

**Finding** (Pass H: Error State Coverage + Pass F: Third-Party Boundary Clarity):
The acceptance criterion "If authentication fails… error message shown" is too broad for a third-party integration. Different failure modes should be explicitly covered: Azure unreachable, invalid authorization code, token exchange failure, and user cancellation.

**Proposed Change**:
Add to Story 1.3 acceptance criteria:
- [ ] If Azure AD is unreachable or times out, the user sees an error message indicating the identity provider is unavailable
- [ ] If the token exchange fails (invalid code, expired code), the user sees an error and can retry

**Decision**: ✅ Accepted

---

#### S-03 · High · ADD_ACCEPTANCE_CRITERION

**Target**: Story 1.3 — User can authenticate via Azure AD PKCE flow

**Finding** (Pass J: Domain-Specific Research):
OAuth 2.0 best practices require a `state` parameter in the authorization request to prevent CSRF attacks. This is a standard security requirement for any OAuth/OIDC flow and is missing from the current acceptance criteria.

**Proposed Change**:
Add to Story 1.3 acceptance criteria:
- [ ] The authorization request includes a state parameter to protect against CSRF attacks

**Decision**: ✅ Accepted

---

#### S-04 · Medium · ADD_ACCEPTANCE_CRITERION

**Target**: Story 1.1 — System reads authentication method from environment variables

**Finding** (Pass H: Error State & Edge Case Coverage):
Story 1.1 specifies behavior for `credentials` and `azure` values of AUTH_METHOD but doesn't address what happens if the variable is set to an unrecognized value (e.g., "google", "saml").

**Proposed Change**:
Add to Story 1.1 acceptance criteria:
- [ ] If AUTH_METHOD is set to an unrecognized value, the system fails to start with a clear error listing the supported values

**Decision**: ✅ Accepted

---

## Applied Changes Summary

| # | Suggestion | Action | Target |
|---|---|---|---|
| S-01 | Azure AD logout story | NEW_STORY | Story 1.5 (new) |
| S-02 | Detailed error state handling for PKCE flow | ADD_ACCEPTANCE_CRITERION | Story 1.3 |
| S-03 | CSRF state parameter for OAuth flow | ADD_ACCEPTANCE_CRITERION | Story 1.3 |
| S-04 | Unrecognized AUTH_METHOD validation | ADD_ACCEPTANCE_CRITERION | Story 1.1 |

**Updated Totals**: 1 epic (unchanged), 5 stories (+1 new, 2 modified)

## Rejected Suggestions

| # | Suggestion | Confidence | Reason |
|---|---|---|---|
| — | — | — | No suggestions were rejected |
