"use client";

interface SortableTableHeaderProps {
  label: string;
  field: string;
  currentSortBy: string;
  currentSortOrder: "asc" | "desc";
  onSort: (field: string) => void;
  align?: "left" | "right";
}

export default function SortableTableHeader({
  label,
  field,
  currentSortBy,
  currentSortOrder,
  onSort,
  align = "left",
}: SortableTableHeaderProps) {
  const isActive = field === currentSortBy;

  return (
    <th
      scope="col"
      className={`px-6 py-3 font-medium text-gray-500${align === "right" ? " text-right" : ""}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 hover:text-gray-900"
        aria-label={`Sort by ${label}`}
      >
        {label}
        {isActive ? (
          <span aria-hidden="true">
            {currentSortOrder === "asc" ? "▲" : "▼"}
          </span>
        ) : (
          <span aria-hidden="true" className="text-gray-300">
            ⇅
          </span>
        )}
      </button>
    </th>
  );
}
