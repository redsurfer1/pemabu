"use client";

import { useState } from "react";
import type { ComputedHolding, SleevePurpose } from "@/types/allocation";
import { SleeveCard } from "./SleeveCard";
import { AddSleeveModal } from "./AddSleeveModal";

export interface SleeveDisplayData {
  id: string;
  name: string;
  purpose: SleevePurpose;
  budgetPct: number;
  sortOrder: number;
  holdings: ComputedHolding[];
  subtotalValue: number;
  subtotalTargetPct: number;
  signalSummary: { entry: number; hold: number; exit: number };
}

interface SleeveManagerProps {
  sleeves: SleeveDisplayData[];
  totalPortfolioNAV: number;
  onAddSleeve: (data: { name: string; purpose: SleevePurpose; budgetPct: number; description: string }) => void;
  onRemoveSleeve: (sleeveId: string) => void;
  onReorder?: (orderedIds: string[]) => void;
}

export function SleeveManager({
  sleeves,
  totalPortfolioNAV,
  onAddSleeve,
  onRemoveSleeve,
}: SleeveManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  const sortedSleeves = [...sleeves].sort((a, b) => a.sortOrder - b.sortOrder);
  const totalBudget = sleeves.reduce((s, sl) => s + sl.budgetPct, 0);
  const remainingBudget = Math.max(0, 1 - totalBudget);
  const budgetWarning = Math.abs(totalBudget - 1) > 0.001;

  return (
    <div className="space-y-4">
      {budgetWarning && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-400">
          Sleeve budgets sum to {(totalBudget * 100).toFixed(0)}% — expected 100%.
          {totalBudget > 1 && " Over-allocated."}
          {totalBudget < 1 && " Under-allocated."}
        </div>
      )}

      {sortedSleeves.map((sleeve) => (
        <SleeveCard
          key={sleeve.id}
          sleeve={sleeve}
          totalPortfolioNAV={totalPortfolioNAV}
          onRemove={() => onRemoveSleeve(sleeve.id)}
        />
      ))}

      <button
        type="button"
        onClick={() => setShowAddModal(true)}
        className="w-full rounded-lg border border-dashed border-white/20 px-4 py-3 text-xs text-gray-400 transition-colors hover:border-[#C9A84C]/50 hover:text-[#C9A84C]"
      >
        + Add Sleeve
      </button>

      <AddSleeveModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={onAddSleeve}
        remainingBudget={remainingBudget}
      />
    </div>
  );
}
