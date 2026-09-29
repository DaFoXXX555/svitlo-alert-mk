import { chromium } from "playwright";
import fs from "node:fs/promises";

const config = JSON.parse(await fs.readFile(new URL("../config.json", import.meta.url), "utf8"));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ locale: "uk-UA", timezoneId: config.timezone });
try {
  await page.goto(config.siteUrl, { waitUntil: "networkidle", timeout: 90000 });
  const data = await page.evaluate(async () => {
    const text = await (await fetch("/js/app.js")).text();
    const needles = ["schedule/active", "time-series", "outage_queue", "queue_id", "status_id", "schedule_id"];
    return needles.map((needle) => {
      const i = text.indexOf(needle);
      return { needle, snippet: i < 0 ? "NOT_FOUND" : text.slice(Math.max(0, i - 1200), i + 2500) };
    });
  });
  console.log(JSON.stringify(data, null, 2));
} finally {
  await browser.close();
}
