"use client";

import { ErrorBoundaryClient } from "@/components/shared/ErrorBoundaryClient";

/** Error boundary for client components that fetch remote data. */
export function DataFetchBoundary({
  children,
  title = "This section could not be loaded",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return <ErrorBoundaryClient title={title}>{children}</ErrorBoundaryClient>;
}
