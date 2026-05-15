import "dotenv/config";
import cron from "node-cron";
import { supabaseAdmin } from "../../lib/supabase/admin";
import { runDriftDetectorCycle } from "./drift-detector";
import { runWeeklyMacroClassification } from "./macro-classifier";
import { runDailyGovernanceFetch } from "./governance-fetcher";
import { runDailyDeFiNativeBalanceSync } from "./defi-native-balances";

void runDriftDetectorCycle().catch((e) => console.error("[watcher] initial run failed", e));

cron.schedule("0 * * * *", () => {
  void runDriftDetectorCycle().catch((e) => console.error("[watcher] scheduled run failed", e));
});

cron.schedule("0 8 * * 1", () => {
  void runWeeklyMacroClassification().catch((e) => console.error("[watcher] macro weekly failed", e));
});

cron.schedule("0 6 * * *", () => {
  void runDailyGovernanceFetch().catch((e) => console.error("[watcher] governance daily failed", e));
});

cron.schedule("1 0 * * *", () => {
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
  void runDailyDeFiNativeBalanceSync().catch((e) =>
    console.error("[watcher] defi native daily failed", e),
  );
});

console.log(
  "[watcher] drift hourly · macro Mon 08:00 UTC · governance daily 06:00 UTC · trial expiry 00:01 UTC · defi native 04:00 UTC",
);
