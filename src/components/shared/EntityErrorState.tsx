interface EntityErrorStateProps {
  message: string;
  onRetry: () => void;
}

export default function EntityErrorState({
  message,
  onRetry,
}: EntityErrorStateProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div
        role="alert"
        className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
      >
        {message}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Retry
      </button>
    </div>
  );
}
