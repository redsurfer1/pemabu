/**
 * Server-side demo mode guard.
 * If the request URL or a cookie indicates demo mode,
 * skip the service-access redirect and pass demo=true.
 */
export function isDemoRequest(searchParams: Record<string, string | undefined>): boolean {
  return searchParams.demo === "1";
}
