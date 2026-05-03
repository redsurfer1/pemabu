"use client";

import { useAdminUsers } from "@/hooks/useAdmin";

export function UsersClient() {
  const { data: users = [], isPending, error } = useAdminUsers();

  if (isPending) {
    return <div className="text-sm text-gray-400">Loading users...</div>;
  }

  if (error) {
    return (
      <div className="text-sm text-red-400">
        {error instanceof Error ? error.message : "Failed to load users"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-white">Users</h1>
          <p className="mt-1 text-xs text-gray-500">
            {users.length} user{users.length !== 1 ? "s" : ""} · Beta capacity: 5
          </p>
        </div>
        <InviteInstructions />
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10">
            <tr className="text-xs text-gray-500">
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3 text-left">Last sign in</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => (
              <tr
                key={user.id}
                className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.03]" : ""}`}
              >
                <td className="px-4 py-3 font-mono text-xs text-white">{user.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      user.profile?.role === "admin"
                        ? "bg-amber-400/10 text-amber-400"
                        : "bg-emerald-400/10 text-emerald-400"
                    }`}
                  >
                    {user.profile?.role ?? "owner"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {user.last_sign_in ? new Date(user.last_sign_in).toLocaleDateString() : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InviteInstructions() {
  return (
    <div className="text-right">
      <p className="mb-1 text-xs text-gray-500">To invite a user:</p>
      <p className="font-mono text-xs text-gray-600">Supabase → Auth → Users → Invite</p>
    </div>
  );
}
