"use client";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = "📭", title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-white/10 py-16 text-center">
      <p className="text-2xl">{icon}</p>
      <p className="mt-3 text-sm text-gray-500">{title}</p>
      {description && <p className="mt-1 text-xs text-gray-600">{description}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:border-white/20"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
