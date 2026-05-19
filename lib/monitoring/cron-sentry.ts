import * as Sentry from "@sentry/nextjs";

type CronHandler = (req: Request) => Promise<Response>;

export function withCronSentry(cronName: string, handler: CronHandler): CronHandler {
  return async (req: Request) => {
    return Sentry.startSpan(
      {
        op: "cron",
        name: cronName,
        attributes: {
          "cron.name": cronName,
          "cron.source": req.headers.get("x-vercel-cron-source") ?? "manual",
        },
      },
      async () => {
        try {
          const res = await handler(req);
          Sentry.setTag("cron.status", res.status);
          return res;
        } catch (err) {
          Sentry.setTag("cron.status", "error");
          Sentry.captureException(err, { tags: { cron: cronName } });
          throw err;
        }
      },
    );
  };
}
