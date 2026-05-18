import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { LegalSection } from "@/components/legal/LegalSection";
import { LEGAL_CONTACT_EMAIL, LEGAL_ROUTES } from "@/lib/constants/compliance";

export const metadata: Metadata = {
  title: "Terms of Service | Pemabu",
  description: "Terms governing use of the Pemabu portfolio intelligence platform.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPageShell eyebrow="Legal" title="Terms of Service" prominentNonAdvisory>
      <LegalSection title="1. Agreement">
        <p>
          These Terms of Service (“Terms”) govern your access to and use of the Pemabu website, applications, APIs, and
          related services (collectively, the “Service”) operated by Pemabu (“we,” “us,” or “our”). By creating an
          account, requesting access, or using the Service, you agree to these Terms and our{" "}
          <Link href={LEGAL_ROUTES.privacy} className="text-emerald-400 hover:text-emerald-300">
            Privacy Policy
          </Link>
          . If you do not agree, do not use the Service.
        </p>
        <p>
          You must be at least 18 years old and able to form a binding contract. The Service is offered from the United
          States unless we state otherwise.
        </p>
      </LegalSection>

      <LegalSection title="2. Not investment advice">
        <p>
          <strong className="text-white">Pemabu does not offer investment advice.</strong> The Service provides
          software tools, data visualizations, quantitative metrics, and AI-generated text for informational purposes
          only. See our{" "}
          <Link href={LEGAL_ROUTES.disclaimer} className="text-emerald-400 hover:text-emerald-300">
            Investment Disclaimer
          </Link>{" "}
          for full details. You are solely responsible for investment and trading decisions.
        </p>
      </LegalSection>

      <LegalSection title="3. Beta and access">
        <p>
          The Service may be labeled private beta or invitation-only. We may modify, suspend, or discontinue features at
          any time without liability. We may deny or revoke access at our discretion, including for violation of these
          Terms.
        </p>
      </LegalSection>

      <LegalSection title="4. Accounts and security">
        <p>
          You are responsible for maintaining the confidentiality of your credentials and for all activity under your
          account. Notify us promptly at{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-emerald-400 hover:text-emerald-300">
            {LEGAL_CONTACT_EMAIL}
          </a>{" "}
          if you suspect unauthorized access.
        </p>
        <p>
          Optional features may allow you to store exchange API credentials or run execution workflows in a
          self-hosted “vault” deployment. You are responsible for securing that environment and any keys you provide.
        </p>
      </LegalSection>

      <LegalSection title="5. Subscriptions and payments">
        <p>
          Paid tiers, marketplace unlocks, and import tokens may be processed through Stripe or other payment processors.
          Prices and features are described on our pricing page and may change with notice where required. Except as
          stated in a separate written agreement or required by law, fees are non-refundable.
        </p>
        <p>
          Entitlements (e.g., Intelligence, Autonomous) are enforced in software. Failure of a webhook or technical error
          does not entitle you to access paid features without payment; contact us to resolve billing issues.
        </p>
      </LegalSection>

      <LegalSection title="6. Marketplace">
        <p>
          Users may publish or import portfolio strategies subject to tier requirements. Publishers represent that they
          have the right to share submitted content. Pemabu does not endorse marketplace listings. Importing a strategy
          does not constitute a recommendation to invest.
        </p>
      </LegalSection>

      <LegalSection title="7. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Use the Service for unlawful purposes or to violate others’ rights;</li>
          <li>Probe, scrape, or overload the Service without written permission;</li>
          <li>Reverse engineer the Service except where permitted by law;</li>
          <li>Upload malware or attempt to access other users’ data;</li>
          <li>Present Pemabu outputs as personalized investment advice to third parties; or</li>
          <li>Misrepresent your affiliation with Pemabu.</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Intellectual property">
        <p>
          We own the Service, branding, and underlying software. You retain ownership of portfolio data you submit. You
          grant us a license to host, process, and display your data as needed to operate the Service, including
          generating aggregates and AI summaries.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimers">
        <p>
          THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
          INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT
          UNINTERRUPTED, ERROR-FREE, OR ACCURATE OPERATION, INCLUDING MARKET DATA OR AI OUTPUTS.
        </p>
      </LegalSection>

      <LegalSection title="10. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, PEMABU AND ITS SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING
          FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THESE TERMS OR THE SERVICE IS
          LIMITED TO THE GREATER OF (A) AMOUNTS YOU PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM OR (B) ONE HUNDRED
          U.S. DOLLARS ($100).
        </p>
        <p>Some jurisdictions do not allow certain limitations; in those cases, our liability is limited to the fullest extent permitted by law.</p>
      </LegalSection>

      <LegalSection title="11. Indemnification">
        <p>
          You will defend and indemnify Pemabu against claims arising from your use of the Service, your portfolio data,
          your marketplace publications, or your violation of these Terms or applicable law.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes">
        <p>
          We may update these Terms by posting a revised version and updating the “Last updated” date. Material changes
          may be communicated via email or in-product notice where practicable. Continued use after changes constitutes
          acceptance.
        </p>
      </LegalSection>

      <LegalSection title="13. Governing law">
        <p>
          These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-law rules,
          except where mandatory consumer protection laws apply in your jurisdiction. Disputes will be resolved in the
          state or federal courts located in Delaware, unless otherwise required by law.
        </p>
      </LegalSection>

      <LegalSection title="14. Contact">
        <p>
          Legal and Terms inquiries:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-emerald-400 hover:text-emerald-300">
            {LEGAL_CONTACT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
