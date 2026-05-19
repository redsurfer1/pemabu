"use client";

interface PortfolioTypeCardProps {
  type: "growth" | "balanced" | "income";
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  riskLabel: string;
}

export function PortfolioTypeCard({ type, selected, onSelect, title, description, riskLabel }: PortfolioTypeCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition ${
        selected
          ? "border-blue-500 bg-blue-500/10"
          : "border-white/10 bg-white/5 hover:border-white/20"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-white">{title}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${
          type === "growth" ? "bg-green-500/20 text-green-400" :
          type === "balanced" ? "bg-blue-500/20 text-blue-400" :
          "bg-amber-500/20 text-amber-400"
        }`}>{riskLabel}</span>
      </div>
      <p className="text-sm text-gray-400 mt-1">{description}</p>
    </button>
  );
}
