"use client";

export type BundleSize = "single" | "five_pack" | "twelve_pack";

const BUNDLES: Array<{
  id: BundleSize;
  tokens: number;
  price: string;
  pricePerToken: string;
  badge?: string;
}> = [
  { id: "single", tokens: 1, price: "$4.99", pricePerToken: "$4.99 each" },
  {
    id: "five_pack",
    tokens: 5,
    price: "$19.99",
    pricePerToken: "$3.99 each",
    badge: "Save 20%",
  },
  {
    id: "twelve_pack",
    tokens: 12,
    price: "$44.99",
    pricePerToken: "$3.74 each",
    badge: "Best value",
  },
];

export function TokenBundleSelector({
  onSelect,
  selectedBundle,
}: {
  onSelect: (bundle: BundleSize) => void;
  selectedBundle: BundleSize;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-300">Choose a token pack</p>
      <div className="grid gap-2">
        {BUNDLES.map((bundle) => (
          <button
            key={bundle.id}
            type="button"
            onClick={() => onSelect(bundle.id)}
            className={`flex items-center justify-between rounded-md border px-3 py-2.5 text-left transition-colors ${
              selectedBundle === bundle.id
                ? "border-emerald-500/60 bg-emerald-950/20 ring-1 ring-emerald-500/40"
                : "border-white/10 hover:border-emerald-500/30"
            }`}
          >
            <div>
              <span className="text-sm font-medium text-white">
                {bundle.tokens} import token{bundle.tokens > 1 ? "s" : ""}
              </span>
              <span className="ml-2 text-xs text-gray-500">{bundle.pricePerToken}</span>
            </div>
            <div className="flex items-center gap-2">
              {bundle.badge ? (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  {bundle.badge}
                </span>
              ) : null}
              <span className="text-sm font-semibold text-white">{bundle.price}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
