import { getUsageColour } from "@/lib/usage-helpers";

interface UsageStatusIndicatorProps {
  percent: number;
}

export function UsageStatusIndicator({ percent }: UsageStatusIndicatorProps) {
  const { bgClass, label } = getUsageColour(percent);

  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-sm ${bgClass}`}
      role="img"
      aria-label={label}
    />
  );
}
