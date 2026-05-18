"use client";

import { useEffect, useState } from "react";

type Slots = { total: number; remaining: number; isFull: boolean };

export function FoundingPublisherSlotCounter() {
  const [slots, setSlots] = useState<Slots | null>(null);

  useEffect(() => {
    fetch("/api/public/founding-publisher-slots")
      .then((r) => r.json())
      .then((d: Slots) => setSlots(d))
      .catch(() => {});
  }, []);

  if (!slots) {
    return <div className="mx-auto h-8 w-32 animate-pulse rounded bg-white/10" />;
  }

  return (
    <div className="text-center">
      <div className="text-3xl font-bold tabular-nums text-white">
        {slots.total}
        <span className="text-gray-500 font-normal text-xl"> / 50</span>
      </div>
      <p className="text-sm text-gray-400 mt-1">
        {slots.isFull
          ? "Program is full — join the waitlist"
          : `${slots.remaining} slot${slots.remaining === 1 ? "" : "s"} remaining`}
      </p>
    </div>
  );
}
