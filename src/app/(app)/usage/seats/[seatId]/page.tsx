import SeatDetailPanel from "@/components/usage/SeatDetailPanel";

export const metadata = {
  title: "Seat Usage — Copilot Dashboard",
};

export const dynamic = "force-dynamic";

interface SeatDetailPageProps {
  params: Promise<{ seatId: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function SeatDetailPage({
  params,
  searchParams,
}: SeatDetailPageProps) {
  const { seatId: seatIdStr } = await params;
  const { month: monthStr, year: yearStr } = await searchParams;

  const seatId = parseInt(seatIdStr, 10);
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
        <SeatDetailPanel
          seatId={seatId}
          initialMonth={month}
          initialYear={year}
        />
      </div>
    </main>
  );
}
