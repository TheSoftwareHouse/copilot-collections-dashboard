export default function AzureUserManagementNotice() {
  return (
    <div
      role="status"
      className="rounded-lg border border-blue-200 bg-blue-50 p-6 text-sm text-blue-700"
    >
      User management is not available when Azure AD authentication is active.
      All access control is managed centrally through Azure AD.
    </div>
  );
}
