import ModelUsageDetail from "@/components/dashboard/ModelUsageDetail";

export const metadata = {
  title: "Model Usage — Copilot Dashboard",
};

export const dynamic = "force-dynamic";

interface ModelUsagePageProps {
  params: Promise<{ modelName: string }>;
  searchParams: Promise<{ month?: string; year?: string; day?: string }>;
}

export default async function ModelUsagePage({
  params,
  searchParams,
}: ModelUsagePageProps) {
  const { modelName: rawModelName } = await params;
  const { month: monthStr, year: yearStr, day: dayStr } = await searchParams;

  const modelName = decodeURIComponent(rawModelName);

  const now = new Date();
  const month =
    monthStr && !isNaN(parseInt(monthStr, 10))
      ? parseInt(monthStr, 10)
      : now.getUTCMonth() + 1;
  const year =
    yearStr && !isNaN(parseInt(yearStr, 10))
      ? parseInt(yearStr, 10)
      : now.getUTCFullYear();
  const day =
    dayStr && !isNaN(parseInt(dayStr, 10))
      ? parseInt(dayStr, 10)
      : undefined;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <ModelUsageDetail modelName={modelName} month={month} year={year} day={day} />
      </div>
    </main>
  );
}
