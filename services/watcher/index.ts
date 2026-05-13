import "dotenv/config";
import cron from "node-cron";
import { runDriftDetectorCycle } from "./drift-detector";

void runDriftDetectorCycle().catch((e) => console.error("[watcher] initial run failed", e));

cron.schedule("0 * * * *", () => {
  void runDriftDetectorCycle().catch((e) => console.error("[watcher] scheduled run failed", e));
});

console.log("[watcher] drift detector scheduled (hourly, node-cron 0 * * * *)");
