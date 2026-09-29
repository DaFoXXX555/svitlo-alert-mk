import { chromium } from "playwright";
import fs from "node:fs/promises";

const config = JSON.parse(await fs.readFile(new URL("../config.json", import.meta.url), "utf8"));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  locale: "uk-UA",
  timezoneId: config.timezone,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
});
const jsonResponses = [];
page.on("response", async (response) => {
  try {
    const type = response.headers()["content-type"] || "";
    if (type.includes("json")) {
      const data = await response.json();
      jsonResponses.push({ url: response.url(), data });
      console.log("JSON", response.status(), response.url());
    }
  } catch {}
});
try {
  const response = await page.goto(config.siteUrl, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(5000);
  console.log("PAGE_STATUS", response?.status());
  console.log("PAGE_URL", page.url());
  console.log("PAGE_TITLE", await page.title());
  const text = await page.locator("body").innerText().catch(() => "");
  console.log("BODY_START\n" + text.slice(0, 15000) + "\nBODY_END");
  console.log("JSON_DATA_START\n" + JSON.stringify(jsonResponses).slice(0, 50000) + "\nJSON_DATA_END");
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((x) => x.name));
  console.log("RESOURCES_START\n" + resources.join("\n") + "\nRESOURCES_END");
} finally {
  await browser.close();
}
