import { publicEnv } from "@/lib/env";

export function getBaseUrl(): string {
  return publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}
