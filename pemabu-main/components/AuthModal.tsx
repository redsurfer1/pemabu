"use client";

import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { PemabuLogoCompact } from "@/components/brand/PemabuLogo";

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();

    if (mode === "signin") {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (err) {
        setError(err.message);
      } else if (data.session) {
        onClose();
        // Full navigation so cookie-backed session is visible to middleware,
        // RSC, and /api/workbook/* (SSR client reads cookies).
        window.location.assign("/dashboard");
        return;
      }
    } else {
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      if (err) {
        setError(err.message);
      } else if (data.session) {
        onClose();
        window.location.assign("/dashboard");
        return;
      } else {
        setError("Check your email to confirm your account before signing in.");
      }
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(10,22,40,0.88)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="presentation"
    >
      <div
        style={{
          width: 400,
          backgroundColor: "#0d1e36",
          border: "1px solid #1a2f4e",
          borderRadius: 12,
          padding: 40,
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 32,
          }}
        >
          <PemabuLogoCompact size={28} />
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: "#f1f5f9",
            }}
          >
            PEMABU
          </span>
        </div>

        <div style={{ marginBottom: 28 }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 500,
              color: "#f1f5f9",
              margin: 0,
              marginBottom: 6,
            }}
          >
            {mode === "signin" ? "Sign in" : "Create account"}
          </h2>
          <p style={{ fontSize: 13, color: "#4a607a", margin: 0 }}>
            {mode === "signin"
              ? "Access your Pemabu workspace."
              : "Private beta — invitation required."}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#4a607a",
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 13,
                backgroundColor: "#0a1628",
                border: "1px solid #1a2f4e",
                borderRadius: 6,
                color: "#f1f5f9",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#4a607a",
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 13,
                backgroundColor: "#0a1628",
                border: "1px solid #1a2f4e",
                borderRadius: 6,
                color: "#f1f5f9",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              padding: "11px 0",
              fontSize: 13,
              fontWeight: 500,
              color: "#0A1628",
              backgroundColor: loading ? "#0d9669" : "#10b981",
              border: "none",
              borderRadius: 6,
              cursor: loading ? "default" : "pointer",
              letterSpacing: "0.02em",
              transition: "background-color 0.15s",
            }}
          >
            {loading
              ? "Please wait…"
              : mode === "signin"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <span
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            style={{
              fontSize: 12,
              color: "#4a607a",
              cursor: "pointer",
              letterSpacing: "0.01em",
            }}
          >
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <span style={{ color: "#10b981" }}>
              {mode === "signin" ? "Sign up" : "Sign in"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
