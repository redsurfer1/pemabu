"use client";

import { useAdminPortfolios } from "@/hooks/useAdmin";

export function AdminPortfoliosClient() {
  const { data: portfolios = [], isPending, error } = useAdminPortfolios();

  if (isPending) {
    return <div className="text-sm text-gray-400">Loading portfolios...</div>;
  }

  if (error) {
    return (
      <div className="text-sm text-red-400">
        {error instanceof Error ? error.message : "Failed to load portfolios"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-white">Portfolios</h1>
        <p className="mt-1 text-xs text-gray-500">
          {portfolios.length} portfolio{portfolios.length !== 1 ? "s" : ""} across all users
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10">
            <tr className="text-xs text-gray-500">
              <th className="px-4 py-3 text-left">Portfolio</th>
              <th className="px-4 py-3 text-left">Currency</th>
              <th className="px-4 py-3 text-right">Holdings</th>
              <th className="px-4 py-3 text-right">Open signals</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {portfolios.map((p, i) => (
              <tr
                key={p.id}
                className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.03]" : ""}`}
              >
                <td className="px-4 py-3 text-sm text-white">{p.name}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{p.currency}</td>
                <td className="px-4 py-3 text-right text-xs text-gray-300">{p.holdings_count}</td>
                <td className="px-4 py-3 text-right text-xs">
                  {p.open_signals > 0 ? (
                    <span className="text-amber-400">{p.open_signals}</span>
                  ) : (
                    <span className="text-gray-600">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
