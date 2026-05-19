import "dotenv/config";
import cron from "node-cron";
import { supabaseAdmin } from "../../lib/supabase/admin";
import { runVaultBackup } from "../../lib/backup/vault-backup";
import { runDriftDetectorCycle } from "./drift-detector";
import { runWeeklyMacroClassification } from "./macro-classifier";
import { runDailyGovernanceFetch } from "./governance-fetcher";
import { runDailyDeFiNativeBalanceSync } from "./defi-native-balances";
import { runDailyPoliticalTrackerFetch } from "./political-tracker-fetcher";
import { runWeeklyVaultExport } from "./vault-exporter";

let shuttingDown = false;

process.on("SIGTERM", () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("[watcher] SIGTERM received — draining in-flight tasks...");
  setTimeout(() => {
    console.log("[watcher] drain timeout reached, exiting.");
    process.exit(0);
  }, 30_000).unref();
});

process.on("SIGINT", () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("[watcher] SIGINT received — draining in-flight tasks...");
  setTimeout(() => {
    console.log("[watcher] drain timeout reached, exiting.");
    process.exit(0);
  }, 30_000).unref();
});

void runVaultBackup().catch((e) => console.error("[watcher] initial backup failed", e));
void runDriftDetectorCycle().catch((e) => console.error("[watcher] initial run failed", e));

if (!shuttingDown) {
  cron.schedule("0 2 * * *", () => {
    if (shuttingDown) return;
    void runVaultBackup().catch((e) => console.error("[watcher] daily backup failed", e));
  });

  cron.schedule("0 * * * *", () => {
    if (shuttingDown) return;
    void runDriftDetectorCycle().catch((e) => console.error("[watcher] scheduled run failed", e));
  });

  cron.schedule("0 8 * * 1", () => {
    if (shuttingDown) return;
    void runWeeklyMacroClassification().catch((e) => console.error("[watcher] macro weekly failed", e));
  });

  cron.schedule("0 6 * * *", () => {
    if (shuttingDown) return;
    void runDailyGovernanceFetch().catch((e) => console.error("[watcher] governance daily failed", e));
  });

  cron.schedule("1 0 * * *", () => {
    if (shuttingDown) return;
    void (async () => {
      try {
        const { data, error } = await supabaseAdmin.rpc("expire_elapsed_trials");
        if (error) console.error("[watcher] expire_elapsed_trials:", error.message);
        else console.log(`[watcher] expired ${String(data ?? 0)} trial(s)`);
      } catch (e) {
        console.error("[watcher] expire_elapsed_trials", e);
      }
    })();
  });

  cron.schedule("0 4 * * *", () => {
    if (shuttingDown) return;
    void runDailyDeFiNativeBalanceSync().catch((e) =>
      console.error("[watcher] defi native daily failed", e),
    );
  });

  cron.schedule("30 5 * * *", () => {
    if (shuttingDown) return;
    void runDailyPoliticalTrackerFetch().catch((e) =>
      console.error("[watcher] political tracker daily failed", e),
    );
  });

  cron.schedule("0 3 * * 0", () => {
    if (shuttingDown) return;
    void runWeeklyVaultExport().catch((e) =>
      console.error("[watcher] vault export weekly failed", e),
    );
  });
}

console.log(
  "[watcher] backup daily 02:00 UTC · drift hourly · macro Mon 08:00 UTC · governance daily 06:00 UTC · trial expiry 00:01 UTC · defi native 04:00 UTC · political tracker 05:30 UTC · vault export Sun 03:00 UTC",
);
