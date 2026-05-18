import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { LegalSection } from "@/components/legal/LegalSection";
import { DisclaimerCallout } from "@/components/legal/DisclaimerCallout";
import { LEGAL_CONTACT_EMAIL, LEGAL_ROUTES, NON_ADVISORY_HEADLINE } from "@/lib/constants/compliance";

export const metadata: Metadata = {
  title: "Investment Disclaimer | Pemabu",
  description:
    "Pemabu does not offer investment advice. Read how signals, scores, AI content, and marketplace strategies are informational only.",
};

export default function InvestmentDisclaimerPage() {
  return (
    <LegalPageShell eyebrow="Legal" title="Investment Disclaimer" prominentNonAdvisory>
      <DisclaimerCallout>
        <p className="text-center text-base font-bold uppercase tracking-wide text-amber-200">
          Pemabu does not offer investment advice
        </p>
        <p className="mt-3 text-center text-sm">
          {NON_ADVISORY_HEADLINE} Nothing in the Pemabu platform—including portfolio scores, rankings, drift alerts,
          signals labeled “Consider Entry” or “Consider Exit,” Strategy Council memos, weekly briefs, marketplace
          strategies, or third-party data overlays—should be treated as a recommendation or solicitation to transact.
        </p>
      </DisclaimerCallout>

      <LegalSection title="1. What Pemabu is">
        <p>
          Pemabu is portfolio monitoring and allocation intelligence software. It helps self-directed investors track
          holdings, compare weights to targets, visualize drift, and review quantitative and AI-generated summaries.
          Pemabu is a technology tool, not a financial institution, fiduciary, or personalized advisory relationship.
        </p>
        <DisclaimerCallout variant="secondary">
          <strong>We do not offer investment advice.</strong> We do not manage assets for you, and we do not owe you a
          fiduciary duty in the manner of a registered investment adviser.
        </DisclaimerCallout>
      </LegalSection>

      <LegalSection title="2. What is not investment advice">
        <p>The following outputs are provided for informational and educational purposes only:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Composite scores, ranks, and factor-weighted comparisons between holdings</li>
          <li>Signals such as “Consider Entry,” “Consider Exit,” or “Hold” derived from rules and formulas</li>
          <li>RSI, return windows, volatility metrics, and other quantitative indicators</li>
          <li>AI-generated weekly briefs, holding explanations, drift narratives, and Strategy Council memos</li>
          <li>13F, governance, political disclosure, macro regime, and token-quality overlays</li>
          <li>Marketplace-published sleeve strategies, grades, and leaderboard rankings</li>
          <li>Scenario simulations and allocation projections</li>
        </ul>
        <DisclaimerCallout variant="secondary">
          <strong>We do not offer investment advice.</strong> Labels that resemble trade ideas are algorithmic
          descriptions of data—not instructions to buy, sell, or hold any security or digital asset.
        </DisclaimerCallout>
      </LegalSection>

      <LegalSection title="3. Your responsibility">
        <p>
          You alone decide whether, when, and how to invest. You are responsible for due diligence, tax treatment, risk
          tolerance, liquidity needs, and compliance with laws applicable to you. Past performance shown in charts or
          backtests does not guarantee future results.
        </p>
        <p>
          If you enable optional execution features (including exchange API keys in a sovereign deployment), you
          authorize trades through your own accounts. Pemabu does not take custody of your funds in standard cloud
          deployments; execution remains your responsibility.
        </p>
      </LegalSection>

      <LegalSection title="4. No professional relationship">
        <p>
          Use of Pemabu does not create an investment adviser–client, broker–customer, or attorney–client relationship.
          Content is general in nature and not tailored to your individual financial situation unless you independently
          apply it. Consult a qualified financial, legal, or tax professional before making investment decisions.
        </p>
      </LegalSection>

      <LegalSection title="5. Third-party and marketplace content">
        <p>
          Marketplace strategies are published by users or third parties. Pemabu does not endorse, verify, or guarantee
          any published strategy. Subscriber counts, grades, and rankings are derived from platform metrics and do not
          constitute performance guarantees.
        </p>
        <DisclaimerCallout variant="secondary">
          <strong>We do not offer investment advice</strong> regarding any marketplace listing. Importing a strategy
          copies configuration data; it is not an endorsement to invest.
        </DisclaimerCallout>
      </LegalSection>

      <LegalSection title="6. Market data and accuracy">
        <p>
          Prices, returns, and reference data may be delayed, incomplete, or incorrect. Pemabu does not warrant the
          accuracy of market data from third-party providers. Do not rely solely on Pemabu for time-sensitive trading
          decisions.
        </p>
      </LegalSection>

      <LegalSection title="7. Crypto and digital assets">
        <p>
          Digital assets are highly volatile and speculative. Regulatory treatment varies by jurisdiction. Pemabu’s
          crypto-related features are informational tools only and do not constitute advice on whether to hold crypto
          or any particular token.
        </p>
      </LegalSection>

      <LegalSection title="8. Acknowledgment">
        <DisclaimerCallout>
          <p className="font-semibold">By using Pemabu, you acknowledge that:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Pemabu does not offer investment advice;</li>
            <li>All platform outputs are informational and may be wrong or incomplete;</li>
            <li>You will not rely on Pemabu as your sole basis for investment decisions; and</li>
            <li>You accept full responsibility for your portfolio and any trades you execute.</li>
          </ul>
        </DisclaimerCallout>
      </LegalSection>

      <LegalSection title="9. Contact">
        <p>
          Questions about this disclaimer:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-emerald-400 hover:text-emerald-300">
            {LEGAL_CONTACT_EMAIL}
          </a>
          . See also our{" "}
          <Link href={LEGAL_ROUTES.terms} className="text-emerald-400 hover:text-emerald-300">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href={LEGAL_ROUTES.privacy} className="text-emerald-400 hover:text-emerald-300">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
