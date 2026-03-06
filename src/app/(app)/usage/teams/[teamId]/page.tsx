import TeamDetailPanel from "@/components/usage/TeamDetailPanel";

export const metadata = {
  title: "Team Usage — Copilot Dashboard",
};

export const dynamic = "force-dynamic";

interface TeamDetailPageProps {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function TeamDetailPage({
  params,
  searchParams,
}: TeamDetailPageProps) {
  const { teamId: teamIdStr } = await params;
  const { month: monthStr, year: yearStr } = await searchParams;

  const teamId = parseInt(teamIdStr, 10);
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
        <TeamDetailPanel
          teamId={teamId}
          initialMonth={month}
          initialYear={year}
        />
      </div>
    </main>
  );
}
