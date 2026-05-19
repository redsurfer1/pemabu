"use client";

import { useState } from "react";

export function ComplianceExportButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/export", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers
        .get("Content-Disposition")
        ?.match(/filename="(.+)"/)?.[1]
        ?? "compliance-evidence.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="rounded border border-white/10 px-3 py-1 text-xs text-gray-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-400 disabled:opacity-50"
      title="Download compliance evidence package (audit logs, AI interactions, disclaimers)"
    >
      {loading ? "Exporting…" : "Export evidence"}
    </button>
  );
}
