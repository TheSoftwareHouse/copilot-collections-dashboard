export default function AzureLoginButton() {
  return (
    <a
      href="/api/auth/azure"
      className="flex w-full items-center justify-center rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
    >
      Login with Azure AD
    </a>
  );
}
