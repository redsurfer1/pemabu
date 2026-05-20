"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useOnboarding } from "@/hooks/useOnboarding";

// ── Types ─────────────────────────────────────────────────────────────────────

type AssetClass =
  | "equity"
  | "fixed_income"
  | "alternatives"
  | "cash"
  | "other"
  | "crypto";

interface PortfolioForm {
  name: string;
  description: string;
  currency: string;
}

interface HoldingForm {
  ticker: string;
  asset_class: AssetClass;
  quantity: string;
  cost_basis: string;
}

interface OnboardingWizardProps {
  onComplete: () => void;
  initialStep?: number;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function createPortfolio(form: PortfolioForm): Promise<{ id: string }> {
  const res = await fetch("/api/workbook/portfolios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      name: form.name,
      description: form.description || undefined,
      currency: form.currency,
    }),
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(typeof data.error === "string" ? data.error : "Failed to create portfolio");
  }
  const data = (await res.json()) as { portfolio: { id: string } };
  return data.portfolio;
}

async function addHolding(portfolioId: string, form: HoldingForm): Promise<void> {
  const isCash = form.asset_class === "cash";
  const res = await fetch("/api/workbook/holdings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      portfolio_id: portfolioId,
      ticker: isCash ? "CASH" : form.ticker.toUpperCase(),
      asset_class: form.asset_class,
      quantity: parseFloat(form.quantity),
      cost_basis: isCash ? 1.0 : parseFloat(form.cost_basis),
      source: "manual",
      currency: "USD",
    }),
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(typeof data.error === "string" ? data.error : "Failed to add holding");
  }
}

async function runEngineRefresh(portfolioId: string): Promise<void> {
  await fetch(`/api/portfolio/${portfolioId}/refresh`, {
    method: "POST",
    credentials: "same-origin",
  });
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
              i + 1 < current
                ? "bg-emerald-500 text-white"
                : i + 1 === current
                  ? "border-2 border-emerald-400 bg-emerald-400/10 text-emerald-400"
                  : "border border-white/10 text-gray-600"
            }`}
          >
            {i + 1 < current ? "✓" : i + 1}
          </div>
          {i < total - 1 && (
            <div
              className={`h-px w-8 transition-colors ${i + 1 < current ? "bg-emerald-500" : "bg-white/10"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── STEP 1 — Create Portfolio ─────────────────────────────────────────────────

function StepCreatePortfolio({ onNext }: { onNext: (portfolioId: string) => void }) {
  const [form, setForm] = useState<PortfolioForm>({
    name: "",
    description: "",
    currency: "USD",
  });
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: createPortfolio,
    onSuccess: (data) => onNext(data.id),
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to create portfolio"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-medium text-white">Create your first portfolio</h2>
        <p className="mt-1 text-sm text-gray-400">
          Give your portfolio a name. You can create additional portfolios after setup.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">
            Portfolio name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Core Portfolio, Retirement, Growth"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">
            Description <span className="text-gray-600">(optional)</span>
          </label>
          <textarea
            placeholder="Investment thesis, goals, or notes..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">
            Base currency
          </label>
          <select
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-[#0A1628] px-4 py-2.5 text-sm text-white outline-none"
          >
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="CAD">CAD — Canadian Dollar</option>
            <option value="AUD">AUD — Australian Dollar</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          if (!form.name.trim()) {
            setError("Portfolio name is required.");
            return;
          }
          setError(null);
          mutate(form);
        }}
        disabled={isPending || !form.name.trim()}
        className="w-full rounded-lg bg-emerald-500 py-3 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
      >
        {isPending ? "Creating portfolio..." : "Create Portfolio →"}
      </button>
    </div>
  );
}

// ── STEP 2 — Add First Holding ────────────────────────────────────────────────

const ASSET_CLASS_OPTIONS: { value: AssetClass; label: string }[] = [
  { value: "equity", label: "Equity (Stocks, ETFs)" },
  { value: "fixed_income", label: "Fixed Income (Bonds)" },
  { value: "crypto", label: "Cryptocurrency" },
  { value: "alternatives", label: "Alternatives (REITs, Commodities)" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

function StepAddHolding({
  portfolioId,
  onNext,
  onSkip,
}: {
  portfolioId: string;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [form, setForm] = useState<HoldingForm>({
    ticker: "",
    asset_class: "equity",
    quantity: "",
    cost_basis: "",
  });
  const [error, setError] = useState<string | null>(null);

  const isCash = form.asset_class === "cash";

  const { mutate, isPending } = useMutation({
    mutationFn: () => addHolding(portfolioId, form),
    onSuccess: onNext,
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to add holding"),
  });

  function handleSubmit() {
    if (!isCash && !form.ticker.trim()) {
      setError("Ticker is required.");
      return;
    }
    if (!form.quantity || parseFloat(form.quantity) <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }
    if (!isCash && (!form.cost_basis || parseFloat(form.cost_basis) < 0)) {
      setError("Cost basis is required.");
      return;
    }
    setError(null);
    mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-medium text-white">Add your first holding</h2>
        <p className="mt-1 text-sm text-gray-400">
          Add one position to get started. You can add more from your portfolio dashboard.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">
            Asset class <span className="text-red-400">*</span>
          </label>
          <select
            value={form.asset_class}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                asset_class: e.target.value as AssetClass,
                ticker: e.target.value === "cash" ? "CASH" : f.ticker,
              }))
            }
            className="w-full rounded-lg border border-white/10 bg-[#0A1628] px-4 py-2.5 text-sm text-white outline-none"
          >
            {ASSET_CLASS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">
            {isCash ? "Symbol" : "Ticker symbol"}{" "}
            {!isCash && <span className="text-red-400">*</span>}
          </label>
          <input
            type="text"
            placeholder={isCash ? "CASH (auto-set)" : "e.g. AAPL, BTC, SPY"}
            value={isCash ? "CASH" : form.ticker}
            disabled={isCash}
            onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-white placeholder-gray-600 outline-none focus:border-emerald-400/40 disabled:opacity-50"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              {isCash ? "Amount ($)" : "Shares / Units"}{" "}
              <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder={isCash ? "10000" : "e.g. 100"}
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-emerald-400/40"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-400">
              {isCash ? "Price per unit ($)" : "Cost basis per share ($)"}{" "}
              {!isCash && <span className="text-red-400">*</span>}
            </label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder={isCash ? "1.00" : "e.g. 150.00"}
              value={isCash ? "1.00" : form.cost_basis}
              disabled={isCash}
              onChange={(e) => setForm((f) => ({ ...f, cost_basis: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-emerald-400/40 disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="flex-1 rounded-lg bg-emerald-500 py-3 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
        >
          {isPending ? "Adding holding..." : "Add Holding →"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-lg border border-white/10 px-5 py-3 text-sm text-gray-400 hover:border-white/20 hover:text-white"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

// ── STEP 3 — Run Engine ───────────────────────────────────────────────────────

function StepRunEngine({
  portfolioId,
  onFinish,
}: {
  portfolioId: string;
  onFinish: () => void;
}) {
  const [ran, setRan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { completeWizard } = useOnboarding();

  const { mutate: runEng, isPending } = useMutation({
    mutationFn: () => runEngineRefresh(portfolioId),
    onSuccess: () => setRan(true),
    onError: (e) => setError(e instanceof Error ? e.message : "Engine run failed"),
  });

  function handleFinish() {
    completeWizard(3);
    onFinish();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-medium text-white">Run your first engine pass</h2>
        <p className="mt-1 text-sm text-gray-400">
          The allocation engine scores your holdings, detects drift, and generates signals.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10">
            <span className="text-lg">⚡</span>
          </div>
          <div>
            <p className="text-sm font-medium text-white">Pemabu Allocation Engine</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              Scores each holding across formula columns including expense ratio, dividend yield,
              RSI, volatility, and momentum. Generates ranked allocation weights and detects drift
              from your target allocation.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Formula columns", value: "46" },
            { label: "Signal types", value: "RSI, Drift, Momentum" },
            { label: "Output", value: "Ranked weights" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
              <p className="text-[10px] text-gray-500">{item.label}</p>
              <p className="mt-0.5 text-xs font-medium text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {ran ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5">
            <p className="text-sm font-medium text-emerald-400">✓ Engine run complete</p>
            <p className="mt-1 text-xs text-gray-400">
              Your portfolio has been scored and signals have been generated. View the full engine
              output and allocation weights from the Engine tab in the navigation.
            </p>
          </div>
          <button
            type="button"
            onClick={handleFinish}
            className="w-full rounded-lg bg-emerald-500 py-3 text-sm font-medium text-white hover:bg-emerald-400"
          >
            Go to Dashboard →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {error && (
            <p className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-400">
              {error} — you can run the engine manually from the portfolio page.
            </p>
          )}
          <button
            type="button"
            onClick={() => runEng()}
            disabled={isPending}
            className="w-full rounded-lg bg-emerald-500 py-3 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                Running engine...
              </span>
            ) : (
              "Run Allocation Engine →"
            )}
          </button>
          <button
            type="button"
            onClick={handleFinish}
            className="w-full rounded-lg border border-white/10 py-3 text-sm text-gray-400 hover:border-white/20 hover:text-white"
          >
            Skip — go to dashboard
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function OnboardingWizard({ onComplete, initialStep }: OnboardingWizardProps) {
  const [step, setStep] = useState(() => Math.max(initialStep ?? 1, 1));
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const { markStep, dismissWizard } = useOnboarding();

  const STEP_LABELS = ["Create Portfolio", "Add Holding", "Run Engine"];

  function handleDismiss() {
    dismissWizard();
    onComplete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1628]/95 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500">Getting started</p>
            <p className="mt-0.5 text-lg font-medium text-white">{STEP_LABELS[step - 1]}</p>
          </div>
          <div className="flex items-center gap-4">
            <StepIndicator current={step} total={3} />
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs text-gray-600 hover:text-gray-400"
              title="Skip setup"
            >
              Skip setup
            </button>
          </div>
        </div>

        {/* Step content */}
        <div className="rounded-2xl border border-white/10 bg-[#0B1C36] p-8">
          {step === 1 && (
            <StepCreatePortfolio
              onNext={(id) => {
                setPortfolioId(id);
                markStep(1);
                setStep(2);
              }}
            />
          )}

          {step === 2 && portfolioId && (
            <StepAddHolding
              portfolioId={portfolioId}
              onNext={() => {
                markStep(2);
                setStep(3);
              }}
              onSkip={() => {
                markStep(2);
                setStep(3);
              }}
            />
          )}

          {step === 3 && portfolioId && (
            <StepRunEngine portfolioId={portfolioId} onFinish={onComplete} />
          )}
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-[11px] text-gray-600">
          Not a registered investment advisor. For informational purposes only.
        </p>
      </div>
    </div>
  );
}
