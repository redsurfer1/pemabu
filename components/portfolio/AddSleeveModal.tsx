"use client";

import { useState } from "react";
import type { SleevePurpose } from "@/types/allocation";

interface AddSleeveModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; purpose: SleevePurpose; budgetPct: number; description: string }) => void;
  remainingBudget: number;
}

const PURPOSES: SleevePurpose[] = ["Appreciation", "Income", "Stability", "Growth", "Custom"];

export function AddSleeveModal({ open, onClose, onSubmit, remainingBudget }: AddSleeveModalProps) {
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState<SleevePurpose>("Appreciation");
  const [budgetPct, setBudgetPct] = useState("");
  const [description, setDescription] = useState("");

  if (!open) return null;

  const budgetNum = Number(budgetPct) / 100;
  const isValid = name.trim().length > 0 && budgetNum > 0 && budgetNum <= remainingBudget;

  function handleSubmit() {
    if (!isValid) return;
    onSubmit({ name: name.trim(), purpose, budgetPct: budgetNum, description: description.trim() });
    setName("");
    setPurpose("Appreciation");
    setBudgetPct("");
    setDescription("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#0D1B2A] p-6 shadow-2xl">
        <h2 className="mb-4 font-[Georgia,serif] text-lg text-white">Add Sleeve</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-gray-400">Sleeve Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main ETF"
              className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-[#C9A84C]/50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-400">Purpose *</label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as SleevePurpose)}
              className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#C9A84C]/50"
            >
              {PURPOSES.map((p) => (
                <option key={p} value={p} className="bg-[#0D1B2A]">{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-400">
              Budget % (remaining: {(remainingBudget * 100).toFixed(0)}%)
            </label>
            <input
              type="number"
              value={budgetPct}
              onChange={(e) => setBudgetPct(e.target.value)}
              placeholder="e.g. 88"
              min={0}
              max={remainingBudget * 100}
              className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-[#C9A84C]/50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-400">Description (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-[#C9A84C]/50"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className="rounded bg-[#C9A84C] px-4 py-2 text-xs font-medium text-[#0D1B2A] transition-colors hover:bg-[#C9A84C]/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Sleeve
          </button>
        </div>
      </div>
    </div>
  );
}
