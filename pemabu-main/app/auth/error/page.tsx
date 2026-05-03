import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A1628",
        color: "#f1f5f9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div>
        <p style={{ marginBottom: 16 }}>Something went wrong during sign-in.</p>
        <Link href="/" style={{ color: "#10b981" }}>
          Return home
        </Link>
      </div>
    </div>
  );
}
