import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { LegalSection } from "@/components/legal/LegalSection";
import { LEGAL_CONTACT_EMAIL, LEGAL_ROUTES } from "@/lib/constants/compliance";

export const metadata: Metadata = {
  title: "Privacy Policy | Pemabu",
  description: "How Pemabu collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell eyebrow="Legal" title="Privacy Policy" prominentNonAdvisory>
      <LegalSection title="1. Overview">
        <p>
          This Privacy Policy describes how Pemabu (“we,” “us”) collects, uses, and shares information when you use our
          website, applications, and related services (the “Service”). It applies to visitors, beta users, and paying
          subscribers. By using the Service, you agree to this Policy and our{" "}
          <Link href={LEGAL_ROUTES.terms} className="text-emerald-400 hover:text-emerald-300">
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <p>
          <strong className="text-gray-300">Account information:</strong> email address, authentication identifiers, and
          profile settings stored via Supabase Auth.
        </p>
        <p>
          <strong className="text-gray-300">Portfolio data:</strong> holdings, quantities, tickers, assumptions, signals,
          briefs, and related metadata you enter or import.
        </p>
        <p>
          <strong className="text-gray-300">Payment information:</strong> processed by Stripe; we receive subscription
          status, customer IDs, and transaction metadata—not full card numbers.
        </p>
        <p>
          <strong className="text-gray-300">Usage and technical data:</strong> IP address, browser type, device
          information, logs, and cookies or similar technologies needed for sessions and security.
        </p>
        <p>
          <strong className="text-gray-300">Optional execution data:</strong> if you use sovereign/vault features, exchange
          API credentials may be encrypted and stored in your chosen deployment; cloud mode does not require exchange keys
          for core workbook features.
        </p>
        <p>
          <strong className="text-gray-300">AI interactions:</strong> prompts and outputs sent to Anthropic for briefs,
          explanations, and Strategy Council memos may include portfolio context you trigger.
        </p>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <p>We use information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide, maintain, and improve the Service;</li>
          <li>Authenticate users and enforce tier entitlements;</li>
          <li>Calculate allocations, scores, signals, and drift alerts;</li>
          <li>Process payments and marketplace unlocks;</li>
          <li>Send operational emails (e.g., briefs, alerts) when enabled;</li>
          <li>Monitor abuse, fraud, and security incidents; and</li>
          <li>Comply with legal obligations.</li>
        </ul>
        <p className="text-sm text-gray-500">
          Pemabu does not sell your personal information. We do not use portfolio data to provide investment advice.
        </p>
      </LegalSection>

      <LegalSection title="4. Sharing with service providers">
        <p>We share data with processors that help operate the Service, including:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-gray-300">Supabase</strong> — authentication and database hosting;
          </li>
          <li>
            <strong className="text-gray-300">Stripe</strong> — payment processing;
          </li>
          <li>
            <strong className="text-gray-300">Anthropic</strong> — AI-generated summaries when you request them;
          </li>
          <li>
            <strong className="text-gray-300">Resend</strong> (or similar) — transactional email delivery;
          </li>
          <li>
            <strong className="text-gray-300">Market data providers</strong> — ticker symbols you request for quotes; and
          </li>
          <li>
            <strong className="text-gray-300">Hosting providers</strong> — application delivery (e.g., Vercel) and optional
            self-hosted vault infrastructure you control.
          </li>
        </ul>
        <p>These providers process data under their own terms and our instructions where applicable.</p>
      </LegalSection>

      <LegalSection title="5. Marketplace and family sharing">
        <p>
          Published marketplace strategies may display pseudonymous publisher labels and performance metrics derived from
          platform data—not your legal name unless you choose to display it. Family-sharing tokens let you grant
          read-only access to selected portfolio views; you control token creation and revocation.
        </p>
      </LegalSection>

      <LegalSection title="6. Retention">
        <p>
          We retain account and portfolio data while your account is active and for a reasonable period afterward for
          backup, legal, and audit purposes. You may request deletion subject to legal retention requirements and
          technical constraints (e.g., immutable audit logs in sovereign deployments).
        </p>
      </LegalSection>

      <LegalSection title="7. Security">
        <p>
          We use industry-standard measures including encryption in transit, row-level security in our database, and
          restricted access to production systems. No method of transmission or storage is 100% secure; you use the
          Service at your own risk.
        </p>
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p>
          Depending on your location, you may have rights to access, correct, delete, or export personal data, or to
          object to certain processing. Contact{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-emerald-400 hover:text-emerald-300">
            {LEGAL_CONTACT_EMAIL}
          </a>{" "}
          to exercise these rights. California residents may have additional rights under the CCPA/CPRA; we do not sell
          personal information as defined by those laws.
        </p>
      </LegalSection>

      <LegalSection title="9. International users">
        <p>
          If you access the Service from outside the United States, you understand that data may be processed in the U.S.
          and other countries where our providers operate, which may have different data protection laws than your
          jurisdiction.
        </p>
      </LegalSection>

      <LegalSection title="10. Children">
        <p>The Service is not directed to children under 18. We do not knowingly collect data from children.</p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          We may update this Policy by posting a revised version with a new “Last updated” date. Material changes may be
          communicated via email or in-product notice where appropriate.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Privacy inquiries:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-emerald-400 hover:text-emerald-300">
            {LEGAL_CONTACT_EMAIL}
          </a>
          . See also our{" "}
          <Link href={LEGAL_ROUTES.disclaimer} className="text-emerald-400 hover:text-emerald-300">
            Investment Disclaimer
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
