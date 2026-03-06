import DepartmentDetailPanel from "@/components/usage/DepartmentDetailPanel";

export const metadata = {
  title: "Department Usage — Copilot Dashboard",
};

export const dynamic = "force-dynamic";

interface DepartmentDetailPageProps {
  params: Promise<{ departmentId: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function DepartmentDetailPage({
  params,
  searchParams,
}: DepartmentDetailPageProps) {
  const { departmentId: departmentIdStr } = await params;
  const { month: monthStr, year: yearStr } = await searchParams;

  const departmentId = parseInt(departmentIdStr, 10);
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
        <DepartmentDetailPanel
          departmentId={departmentId}
          initialMonth={month}
          initialYear={year}
        />
      </div>
    </main>
  );
}
