interface EntityLoadingStateProps {
  label: string;
}

export default function EntityLoadingState({ label }: EntityLoadingStateProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-500">Loading {label}…</p>
    </div>
  );
}
