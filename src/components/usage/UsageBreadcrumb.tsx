import Link from "next/link";

type UsageSection = "seat" | "team" | "department";

const SECTION_LABELS: Record<UsageSection, string> = {
  seat: "Seats",
  team: "Teams",
  department: "Departments",
};

interface UsageBreadcrumbProps {
  section: UsageSection;
  entityName: string;
  month: number;
  year: number;
}

export default function UsageBreadcrumb({
  section,
  entityName,
  month,
  year,
}: UsageBreadcrumbProps) {
  const usageHref = `/usage?tab=${section}&month=${month}&year=${year}`;
  const sectionLabel = SECTION_LABELS[section];

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-sm">
        <li>
          <Link
            href={usageHref}
            className="text-blue-600 hover:text-blue-800"
          >
            Usage
          </Link>
        </li>
        <li aria-hidden="true" className="text-gray-400">
          /
        </li>
        <li>
          <Link
            href={usageHref}
            className="text-blue-600 hover:text-blue-800"
          >
            {sectionLabel}
          </Link>
        </li>
        <li aria-hidden="true" className="text-gray-400">
          /
        </li>
        <li aria-current="page" className="font-medium text-gray-900">
          {entityName}
        </li>
      </ol>
    </nav>
  );
}
