import UsagePageLayout from "@/components/usage/UsagePageLayout";

export const metadata = {
  title: "Usage Analytics — Copilot Dashboard",
};

export const dynamic = "force-dynamic";

const VALID_TABS = ["seat", "team", "department"] as const;
type TabId = (typeof VALID_TABS)[number];

function isValidTab(value: unknown): value is TabId {
  return typeof value === "string" && VALID_TABS.includes(value as TabId);
}

interface UsagePageProps {
  searchParams: Promise<{ tab?: string; month?: string; year?: string }>;
}

export default async function UsagePage({ searchParams }: UsagePageProps) {
  const params = await searchParams;

  const now = new Date();
  const month =
    params.month && !isNaN(parseInt(params.month, 10))
      ? parseInt(params.month, 10)
      : now.getUTCMonth() + 1;
  const year =
    params.year && !isNaN(parseInt(params.year, 10))
      ? parseInt(params.year, 10)
      : now.getUTCFullYear();
  const tab: TabId = isValidTab(params.tab) ? params.tab : "seat";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900">Usage Analytics</h1>
        <p className="mt-2 text-sm text-gray-600">
          Detailed usage breakdown by seat, team, and department for a selected
          month.
        </p>

        <div className="mt-8">
          <UsagePageLayout
            initialMonth={month}
            initialYear={year}
            initialTab={tab}
          />
        </div>
      </div>
    </main>
  );
}
