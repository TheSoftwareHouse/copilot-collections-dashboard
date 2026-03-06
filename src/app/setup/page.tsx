import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { ConfigurationEntity } from "@/entities/configuration.entity";
import ConfigurationForm from "@/components/setup/ConfigurationForm";

export const metadata = {
  title: "First-Run Setup — Copilot Dashboard",
};

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const dataSource = await getDb();
  const repository = dataSource.getRepository(ConfigurationEntity);
  const existing = await repository.findOne({ where: {} });

  if (existing) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome — First-Run Setup
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Configure how the application connects to GitHub. Choose whether to
            use organisation-level or enterprise-level API endpoints and provide
            the name of your GitHub organisation or enterprise.
          </p>
        </div>
        <ConfigurationForm />
      </div>
    </main>
  );
}
