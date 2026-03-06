# Azure Entra ID Login — Jira Tasks

---

## Epic: Azure Entra ID Authentication: Secure Login via Azure AD

**Jira Key**: —
**Status**: —
**Priority**: High

**Description**:
```
h2. Overview

Enable users to log in using Azure Entra ID (Azure AD) as an alternative to the existing username/password authentication. When Azure login is active, user management is fully delegated to Azure — local user creation and removal are disabled. The authentication method is controlled via environment variables, allowing operators to choose between credentials-based and Azure-based login at deployment time.

h2. Business Value

Organisations using Azure AD can centralise access management, reducing administrative overhead and improving security. Users authenticate with their existing corporate credentials instead of managing separate passwords. This aligns the application with enterprise identity standards.

h2. Success Metrics

* Users can log in via Azure AD using the PKCE authorization code flow when Azure authentication is configured
* The login page automatically adapts to show the correct login method based on configuration
* Local user management is disabled when Azure authentication is active, with all access managed through Azure AD
```

**Acceptance Criteria**:
```
(/) Users can authenticate via Azure AD PKCE flow when AUTH_METHOD=azure is configured
(/) Login page displays "Login with Azure AD" button when Azure auth is active
(/) Login page displays username/password form when credentials auth is active (default)
(/) User management is not accessible when Azure login is configured
(/) Logout works consistently for both authentication methods
```

**Labels**: `auth`, `azure-ad`, `integration`

---

### Story 1.1: System operator can configure authentication method via environment variables

**Parent**: Azure Entra ID Authentication: Secure Login via Azure AD
**Jira Key**: —
**Status**: —
**Priority**: Highest
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Azure Entra ID Authentication: Secure Login via Azure AD] epic. It establishes the configuration foundation that all other stories depend on.

h2. User Story

As a system operator, I want to configure the authentication method via environment variables so that I can switch between credentials-based and Azure AD login at deployment time without changing the application code or database.

h2. Requirements

# An explicit AUTH_METHOD environment variable determines the active authentication method (credentials or azure)
# When AUTH_METHOD is not set, the system defaults to credentials (current behaviour preserved)
# When AUTH_METHOD=azure, the system requires AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_REDIRECT_URI environment variables
# The system fails to start with a clear error message if AUTH_METHOD=azure but any required Azure variable is missing
# When AUTH_METHOD=credentials, the system behaves exactly as it does today (no changes to existing flow)
# If AUTH_METHOD is set to an unrecognized value, the system fails to start with a clear error listing the supported values (credentials, azure)

h2. Technical Notes

Configuration is environment-variable-only — no UI settings page for Azure. This keeps Azure configuration as a deployment concern managed by operators.
```

**Acceptance Criteria**:
```
(/) AUTH_METHOD env var accepts values "credentials" and "azure"
(/) System defaults to credentials when AUTH_METHOD is not set
(/) System requires AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_REDIRECT_URI when AUTH_METHOD=azure
(/) System fails to start with clear error when AUTH_METHOD=azure but required Azure vars are missing
(/) System behaves unchanged when AUTH_METHOD=credentials
(/) System fails to start with clear error when AUTH_METHOD is set to an unrecognized value
```

**Labels**: `auth`, `azure-ad`, `configuration`

---

### Story 1.2: User sees appropriate login interface based on configuration

**Parent**: Azure Entra ID Authentication: Secure Login via Azure AD
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Azure Entra ID Authentication: Secure Login via Azure AD] epic. It adapts the login UI to show the correct authentication method based on the operator's configuration.

h2. User Story

As a user, I want to see the appropriate login interface based on how the system is configured so that I know how to authenticate.

h2. Requirements

# When AUTH_METHOD=azure, the login page displays a "Login with Azure AD" button instead of the username/password form
# When AUTH_METHOD=credentials (default), the login page displays the current username/password form unchanged
# The "Login with Azure AD" button is clearly labelled and visually prominent
# No username/password fields are shown when Azure authentication is active

h2. Technical Notes

No specific technical considerations discussed.
```

**Acceptance Criteria**:
```
(/) Login page shows "Login with Azure AD" button when AUTH_METHOD=azure
(/) Login page shows username/password form when AUTH_METHOD=credentials
(/) "Login with Azure AD" button is clearly labelled and visually prominent
(/) No username/password fields are visible when Azure auth is active
```

**Labels**: `auth`, `azure-ad`, `ui`

---

### Story 1.3: User can authenticate via Azure AD PKCE flow

**Parent**: Azure Entra ID Authentication: Secure Login via Azure AD
**Jira Key**: —
**Status**: —
**Priority**: Highest
**Sizing Guidance**: Large (13+)

**Description**:
```
h2. Context

This story is part of the [Azure Entra ID Authentication: Secure Login via Azure AD] epic. It implements the core Azure AD authentication flow using the PKCE method.

h2. User Story

As a user, I want to log in by clicking the "Login with Azure AD" button and authenticating with my Azure credentials so that I can access the dashboard without needing a separate local account.

h2. Requirements

# Clicking the "Login with Azure AD" button redirects the user to the Azure authorization endpoint
# The authorization request uses the PKCE (Proof Key for Code Exchange) flow with a code verifier and code challenge
# After authenticating with Azure, the user is redirected back to the application with an authorization code
# The system exchanges the authorization code for tokens using the code verifier
# A local session is created for the authenticated user, granting access to the dashboard
# The user is redirected to the dashboard after successful authentication
# If authentication fails or the user cancels at Azure, an appropriate error message is shown on the login page
# If Azure AD is unreachable or times out, the user sees an error indicating the identity provider is unavailable
# If the token exchange fails (invalid code, expired code), the user sees an error and can retry
# The authorization request includes a state parameter to protect against CSRF attacks

h2. Technical Notes

PKCE flow was explicitly requested — no client secret is used. The redirect URI must match the value configured in both the Azure app registration and the environment variable.
```

**Acceptance Criteria**:
```
(/) Clicking "Login with Azure AD" redirects to Azure authorization endpoint
(/) Authorization request uses PKCE flow with code verifier and code challenge
(/) After Azure authentication, user is redirected back with authorization code
(/) System exchanges authorization code for tokens using code verifier
(/) Local session is created and user is redirected to dashboard
(/) Failed authentication or cancellation shows error on login page
(/) Azure AD unreachable/timeout shows identity provider unavailable message
(/) Token exchange failure shows error with retry option
(/) Authorization request includes state parameter for CSRF protection
```

**Labels**: `auth`, `azure-ad`, `integration`, `security`

---

### Story 1.4: User management is disabled when Azure login is configured

**Parent**: Azure Entra ID Authentication: Secure Login via Azure AD
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Medium (5-8)

**Description**:
```
h2. Context

This story is part of the [Azure Entra ID Authentication: Secure Login via Azure AD] epic. It disables local user management when Azure authentication is active, ensuring all access control is managed centrally through Azure AD.

h2. User Story

As a system operator, I want local user management to be unavailable when Azure authentication is active so that all access control is managed centrally through Azure AD.

h2. Requirements

# When AUTH_METHOD=azure, the user management panel is not accessible in the UI
# When AUTH_METHOD=azure, API endpoints for creating, editing, and deleting users return an appropriate error indicating that user management is handled by Azure AD
# The UI clearly communicates that access management is handled through Azure AD (e.g., an informational message where the user management panel would normally appear)
# When AUTH_METHOD=credentials, user management works exactly as it does today (no changes)

h2. Technical Notes

No specific technical considerations discussed.
```

**Acceptance Criteria**:
```
(/) User management panel is not accessible in UI when AUTH_METHOD=azure
(/) User CRUD API endpoints return error indicating Azure AD manages access when AUTH_METHOD=azure
(/) UI shows informational message about Azure AD access management
(/) User management works unchanged when AUTH_METHOD=credentials
```

**Labels**: `auth`, `azure-ad`, `ui`, `backend`

---

### Story 1.5: User can log out when authenticated via Azure AD

**Parent**: Azure Entra ID Authentication: Secure Login via Azure AD
**Jira Key**: —
**Status**: —
**Priority**: High
**Sizing Guidance**: Small (1-3)

**Description**:
```
h2. Context

This story is part of the [Azure Entra ID Authentication: Secure Login via Azure AD] epic. It ensures users authenticated via Azure AD can properly end their session.

h2. User Story

As a user authenticated via Azure AD, I want to log out of the application so that my session is ended and access is revoked.

h2. Requirements

# When the user clicks logout, the local session is destroyed (same as current logout behaviour)
# The user is redirected to the login page after logout
# Optionally, the user can be redirected to Azure AD's logout endpoint to end the Azure session as well
# The logout flow works consistently regardless of authentication method (credentials or Azure)

h2. Technical Notes

No specific technical considerations discussed.
```

**Acceptance Criteria**:
```
(/) Local session is destroyed when user clicks logout
(/) User is redirected to login page after logout
(/) Optional redirect to Azure AD logout endpoint to end Azure session
(/) Logout works consistently for both credentials and Azure authentication
```

**Labels**: `auth`, `azure-ad`

---
