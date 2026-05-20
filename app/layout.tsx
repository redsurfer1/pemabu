// Validate all environment variables at startup
// This import has side effects — it throws if any
// required env var is missing or malformed
import "@/lib/env";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Pemabu — Allocation Intelligence for Modern Investors",
    template: "%s — Pemabu",
  },
  description:
    "Real-time portfolio monitoring, allocation drift detection, and scenario analysis. Pemabu helps investors track holdings, identify drift, and make informed decisions.",
  icons: {
    icon: { url: "/favicon.svg", type: "image/svg+xml" },
  },
  alternates: {
    canonical: "https://pemabu.com",
  },
  openGraph: {
    title: "Pemabu — Allocation Intelligence for Modern Investors",
    description:
      "Real-time portfolio monitoring, allocation drift detection, and scenario analysis. Pemabu helps investors track holdings, identify drift, and make informed decisions.",
    url: "https://pemabu.com",
    siteName: "Pemabu",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pemabu — Allocation Intelligence for Modern Investors",
    description:
      "Real-time portfolio monitoring, allocation drift detection, and scenario analysis.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Pemabu",
              url: "https://pemabu.com",
              description:
                "Real-time portfolio monitoring, allocation drift detection, and scenario analysis.",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://pemabu.com/search?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
