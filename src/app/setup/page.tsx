import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { ConfigurationEntity } from "@/entities/configuration.entity";
import { GitHubAppEntity } from "@/entities/github-app.entity";
import CreateGitHubApp from "@/components/setup/CreateGitHubApp";
import InstallComplete from "@/components/setup/InstallComplete";

export const metadata = {
  title: "GitHub App Setup — Copilot Dashboard",
};

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const dataSource = await getDb();

  const configRepo = dataSource.getRepository(ConfigurationEntity);
  const existingConfig = await configRepo.findOne({ where: {} });
  if (existingConfig) {
    redirect("/dashboard");
  }

  const appRepo = dataSource.getRepository(GitHubAppEntity);
  const existingApp = await appRepo.findOne({ where: {} });

  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code : undefined;
  const installationId =
    typeof params.installation_id === "string"
      ? params.installation_id
      : undefined;
  const reconnect = params.reconnect === "true";
  const isReconnect = reconnect && !!existingApp && !installationId;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {isReconnect
              ? "Connect a New Organisation"
              : "Welcome — GitHub App Setup"}
          </h1>
          {isReconnect && (
            <p className="mt-2 text-sm text-gray-600">
              Your GitHub App is still active. Install it on a new organisation
              to resume monitoring Copilot usage.
            </p>
          )}
          {!existingApp && !isReconnect && (
            <p className="mt-2 text-sm text-gray-600">
              Create a GitHub App to connect the dashboard to your GitHub
              organisation. Click the button below to start the guided setup on
              GitHub.
            </p>
          )}
        </div>
        {existingApp ? (
          installationId ? (
            <InstallComplete installationId={installationId} />
          ) : (
            <div className="rounded-md bg-green-50 p-6 text-center">
              <h2 className="text-lg font-semibold text-green-800">
                GitHub App created
              </h2>
              <p className="mt-2 text-sm text-green-700">
                App name: <strong>{existingApp.appName}</strong>
              </p>
              <a
                href={existingApp.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-indigo-600 underline hover:text-indigo-800"
              >
                View on GitHub
              </a>
              <a
                href={`https://github.com/apps/${existingApp.appSlug}/installations/new`}
                className="mt-4 block w-full rounded-md bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Install on Organisation
              </a>
            </div>
          )
        ) : (
          <CreateGitHubApp code={code} baseUrl={process.env.APP_BASE_URL} />
        )}
      </div>
    </main>
  );
}
