// k6 load test: simulate concurrent cron job invocations
// Run: k6 run tests/load/cron-load.js
// Requires BASE_URL env (default http://localhost:3000)

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "1m", target: 20 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<30000"],
    http_req_failed: ["rate<0.1"],
  },
};

const CRON_SECRET = __ENV.CRON_SECRET || "test-cron-secret-needs-32-chars-min!";
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const cronEndpoints = [
  "/api/cron/morning-brief",
  "/api/cron/nightly-refresh",
  "/api/cron/assumption-drift",
  "/api/cron/sleeve-performance-snapshot",
  "/api/cron/weekly-brief",
  "/api/cron/sentry-verify",
  "/api/cron/trial-reminders",
];

export default function () {
  const endpoint = cronEndpoints[Math.floor(Math.random() * cronEndpoints.length)];

  const res = http.post(`${BASE_URL}${endpoint}`, null, {
    headers: {
      "x-cron-secret": CRON_SECRET,
      "Content-Type": "application/json",
    },
    timeout: "60s",
  });

  check(res, {
    "status is 200 or 202": (r) => r.status === 200 || r.status === 202,
    "response time < 30s": (r) => r.timings.duration < 30000,
  });

  sleep(Math.random() * 5 + 1);
}
