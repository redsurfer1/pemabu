"use client";

import { useEffect, useMemo, useState } from "react";
import PemabuLogo from "@/components/brand/PemabuLogo";
import type { StrategyCouncilMemoPayload } from "@/lib/services/ai";
import { AI_DISCLAIMER } from "@/lib/constants/ai-models";
import { STRATEGY_COUNCIL_PRINT_STORAGE_KEY } from "@/lib/intelligence/strategy-council-print-key";

/** Pemabu palette — Swiss-bank memo: ivory ground, navy structure, gold accent, emerald seal. */
const brand = {
  navy: "#0A1628",
  navyMuted: "#1a2d4a",
  gold: "#C9A84C",
  goldMuted: "#a88b3d",
  emerald: "#10b981",
  ivory: "#f7f5f0",
  ivoryDeep: "#ebe8e1",
  ink: "#141414",
  inkMuted: "#4a4a4a",
  inkLight: "#6b6b6b",
} as const;

const printCss = `
@media print {
  @page {
    margin: 16mm 18mm;
    size: A4;
  }
  body {
    background: ${brand.ivory} !important;
    color: ${brand.ink} !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .no-print { display: none !important; }
  .memo-sheet { box-shadow: none !important; }
}
`;

function BrandLetterhead({ title, dateLabel }: { title: string; dateLabel: string }) {
  return (
    <header className="border-b pb-8" style={{ borderColor: `${brand.gold}66` }}>
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <div
            className="flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-sm shadow-sm"
            style={{ backgroundColor: brand.navy }}
          >
            <PemabuLogo size={46} animate={false} />
          </div>
          <div>
            <p
              className="text-[13px] font-medium tracking-[0.38em]"
              style={{ color: brand.navy, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
            >
              PEMABU
            </p>
            <p
              className="mt-1 text-[9px] font-medium uppercase tracking-[0.32em]"
              style={{ color: brand.goldMuted }}
            >
              Strategy Council
            </p>
          </div>
        </div>
        <div className="text-right">
          <p
            className="text-[9px] uppercase tracking-[0.22em]"
            style={{ color: brand.inkLight }}
          >
            Confidential — For internal use
          </p>
          <p className="mt-1 font-serif text-sm" style={{ color: brand.inkMuted }}>
            {dateLabel}
          </p>
        </div>
      </div>

      <div className="mt-8 flex items-end gap-3">
        <div className="h-px flex-1" style={{ backgroundColor: brand.gold }} />
        <div
          className="h-1.5 w-1.5 rotate-45"
          style={{ backgroundColor: brand.emerald }}
          aria-hidden
        />
        <div className="h-px w-16" style={{ backgroundColor: brand.gold }} />
      </div>

      <h1
        className="mt-6 font-serif text-[1.75rem] font-normal leading-tight tracking-tight"
        style={{ color: brand.ink }}
      >
        {title}
      </h1>
      <p className="mt-2 font-serif text-sm italic" style={{ color: brand.inkMuted }}>
        Monthly institutional memory — allocation protocol review
      </p>
    </header>
  );
}

function BrandFooter() {
  return (
    <footer
      className="mt-14 border-t pt-6"
      style={{ borderColor: `${brand.gold}44` }}
    >
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ backgroundColor: brand.emerald }} />
        <span
          className="text-[8px] font-medium uppercase tracking-[0.28em]"
          style={{ color: brand.emerald }}
        >
          Pemabu
        </span>
        <div className="h-px flex-1" style={{ backgroundColor: brand.emerald }} />
      </div>
      <p className="mt-4 text-[10px] leading-relaxed" style={{ color: brand.inkLight }}>
        {AI_DISCLAIMER}
      </p>
      <p className="mt-2 text-[10px] leading-relaxed" style={{ color: brand.inkLight }}>
        Pemabu is sovereign software for allocation protocol monitoring. Consult qualified professionals
        where required by law. Pemabu is not a registered investment advisor.
      </p>
      <p
        className="mt-4 text-[8px] uppercase tracking-[0.2em]"
        style={{ color: brand.inkLight }}
      >
        © {new Date().getFullYear()} Pemabu · Strategy Council
      </p>
    </footer>
  );
}

export default function StrategyCouncilPrintPage() {
  const [payload, setPayload] = useState<StrategyCouncilMemoPayload | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STRATEGY_COUNCIL_PRINT_STORAGE_KEY);
      if (raw) setPayload(JSON.parse(raw) as StrategyCouncilMemoPayload);
    } catch {
      setPayload(null);
    }
  }, []);

  const title = useMemo(() => payload?.pdfLayout.documentTitle ?? "Strategy Council Memo", [payload]);
  const dateLabel = useMemo(() => new Date().toISOString().slice(0, 10), []);

  if (!payload) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center"
        style={{ backgroundColor: brand.navy, color: brand.ivory }}
      >
        <div
          className="mb-6 flex h-16 w-16 items-center justify-center rounded-sm"
          style={{ backgroundColor: brand.navyMuted }}
        >
          <PemabuLogo size={52} animate={false} />
        </div>
        <p className="font-serif text-lg" style={{ color: brand.ivory }}>
          No memo payload in session
        </p>
        <p className="mt-2 max-w-sm text-sm" style={{ color: `${brand.ivory}99` }}>
          Generate a memo from the Strategy Council page, then open this print view again.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen print:min-h-0"
      style={{ backgroundColor: brand.ivoryDeep, color: brand.ink }}
    >
      <style dangerouslySetInnerHTML={{ __html: printCss }} />

      <div
        className="pointer-events-none fixed inset-0 z-0 hidden items-center justify-center print:flex"
        aria-hidden
      >
        <span
          className="select-none font-serif text-[4.5rem] font-light leading-none tracking-[0.12em]"
          style={{ color: `${brand.navy}08` }}
        >
          PEMABU
        </span>
      </div>

      <div
        className="no-print border-b px-4 py-3 text-center"
        style={{ backgroundColor: brand.navy, borderColor: `${brand.gold}33` }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <PemabuLogo size={28} animate={false} />
            <span
              className="text-[11px] font-medium tracking-[0.25em]"
              style={{ color: brand.ivory }}
            >
              PEMABU
            </span>
          </div>
          <button
            type="button"
            className="rounded-sm px-4 py-1.5 text-xs font-medium tracking-wide transition-opacity hover:opacity-90"
            style={{
              backgroundColor: brand.gold,
              color: brand.navy,
            }}
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      <article
        className="memo-sheet relative z-10 mx-auto my-8 max-w-[48rem] px-10 py-12 shadow-lg print:my-0 print:max-w-none print:px-0 print:py-0 print:shadow-none"
        style={{ backgroundColor: brand.ivory }}
      >
        <BrandLetterhead title={title} dateLabel={dateLabel} />

        <div className="mt-10 max-w-none">
          {payload.pdfLayout.sections.map((s, i) => (
            <section
              key={s.id}
              className="mb-10 break-inside-avoid pl-5"
              style={{ borderLeft: `2px solid ${i === 0 ? brand.gold : `${brand.gold}88`}` }}
            >
              <h2
                className="mb-3 font-serif text-xl font-medium tracking-tight"
                style={{ color: brand.navy }}
              >
                {s.heading}
              </h2>
              <div
                className="whitespace-pre-wrap font-serif text-[15px] leading-[1.7]"
                style={{ color: brand.inkMuted }}
              >
                {s.bodyMarkdown}
              </div>
            </section>
          ))}
        </div>

        <BrandFooter />
      </article>
    </div>
  );
}
