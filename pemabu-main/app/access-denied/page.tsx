import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A1628] px-6 text-center">
      <h1 className="text-lg font-medium text-white">Access denied</h1>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        You do not have permission to view this area. Admin access requires{" "}
        <code className="text-gray-400">user_profiles.role = &apos;admin&apos;</code>.
      </p>
      <Link href="/dashboard" className="mt-6 text-sm text-emerald-400 hover:text-emerald-300">
        ← Back to dashboard
      </Link>
    </div>
  );
}
