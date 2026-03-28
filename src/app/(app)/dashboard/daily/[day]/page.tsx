import DailyUsageDetail from "@/components/dashboard/DailyUsageDetail";

export const metadata = {
  title: "Daily Usage — Copilot Dashboard",
};

export const dynamic = "force-dynamic";

interface DailyUsagePageProps {
  params: Promise<{ day: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function DailyUsagePage({
  params,
  searchParams,
}: DailyUsagePageProps) {
  const { day: dayStr } = await params;
  const { month: monthStr, year: yearStr } = await searchParams;

  const day = parseInt(dayStr, 10);
  const now = new Date();
  const month =
    monthStr && !isNaN(parseInt(monthStr, 10))
      ? parseInt(monthStr, 10)
      : now.getUTCMonth() + 1;
  const year =
    yearStr && !isNaN(parseInt(yearStr, 10))
      ? parseInt(yearStr, 10)
      : now.getUTCFullYear();

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <DailyUsageDetail day={day} month={month} year={year} />
      </div>
    </main>
  );
}
