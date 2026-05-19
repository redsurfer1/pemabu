interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-red-400/20 bg-red-400/5 py-12 text-center">
      <p className="text-2xl">⚠️</p>
      <p className="mt-3 text-sm text-red-400">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-red-400/30 px-4 py-2 text-sm text-red-300 hover:border-red-400/50"
        >
          Retry
        </button>
      )}
    </div>
  );
}
