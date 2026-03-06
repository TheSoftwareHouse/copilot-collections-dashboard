import { getUsageColour } from "@/lib/usage-helpers";

interface UsageProgressBarProps {
  percent: number;
}

export function UsageProgressBar({ percent }: UsageProgressBarProps) {
  const { bgClass, label } = getUsageColour(percent);
  const fillWidth = Math.min(percent, 100);
  const displayPercent = `${Math.round(percent)}%`;

  return (
    <div className="flex items-center gap-3">
      <div
        className="h-4 w-full rounded-full bg-gray-200"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} — ${displayPercent}`}
      >
        <div
          className={`h-full rounded-full transition-all ${bgClass}`}
          style={{ width: `${fillWidth}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
        {displayPercent}
      </span>
    </div>
  );
}
