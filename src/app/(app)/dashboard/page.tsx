import DashboardWithFilter from "@/components/dashboard/DashboardWithFilter";

export const metadata = {
  title: "Dashboard — Copilot Dashboard",
};

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900">
          Monthly Usage Overview
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Key Copilot usage metrics for the current month including seat counts,
          per-model usage, and spending.
        </p>

        <div className="mt-8">
          <DashboardWithFilter initialMonth={month} initialYear={year} />
        </div>
      </div>
    </main>
  );
}
