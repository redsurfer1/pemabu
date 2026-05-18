"use client";

import { useEffect, useState } from "react";

export function ReferralCodeDisplay() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/marketplace/my-referral-code", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { code?: string }) => setCode(d.code ?? null))
      .catch(() => {});
  }, []);

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!code) return <div className="h-9 w-40 animate-pulse rounded bg-white/10" />;

  return (
    <div className="flex items-center gap-2">
      <code className="rounded bg-black/40 px-3 py-1.5 text-sm font-mono font-medium text-gray-200">{code}</code>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}
