"use client";

import { useState } from "react";
import { publicCreatorId } from "@/lib/marketplace/public-creator-id";

export function ShareCreatorProfileButton({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/creator/${publicCreatorId(userId)}`
      : `/creator/${publicCreatorId(userId)}`;

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(shareUrl).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="text-xs text-emerald-400 hover:underline"
    >
      {copied ? "Profile link copied" : "Share your creator profile"}
    </button>
  );
}
