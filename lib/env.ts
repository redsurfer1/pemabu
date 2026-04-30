import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(32),
  PEMABU_CRON_SECRET: z.string().min(16),
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-"),
  MARKET_DATA_PROVIDER: z.enum(["google-finance"]),
  RESEND_API_KEY: z.string().startsWith("re_"),
  RESEND_FROM_EMAIL: z.string().email(),
  OPERATOR_ALERT_EMAIL: z.string().email(),
  TIINGO_API_KEY: z.string().min(1),
});

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

type ServerEnv = z.infer<typeof serverSchema>;

let _env: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (!_env) {
    _env = serverSchema.parse(process.env);
  }
  return _env;
}

export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_, prop: string) {
    return getEnv()[prop as keyof ServerEnv];
  },
});

export const publicEnv = publicSchema.parse(process.env);
