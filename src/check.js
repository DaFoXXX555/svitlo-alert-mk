import fs from "node:fs/promises";

const config = JSON.parse(await fs.readFile(new URL("../config.json", import.meta.url), "utf8"));
const base = new URL(config.siteUrl).origin;
const headers = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
  "accept": "application/json, text/plain, */*",
  "referer": base + "/"
};

async function loadJson(path, cookies) {
  const response = await fetch(base + path, { headers: { ...headers, cookie: cookies } });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

function zoneParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(x => x.type !== "literal").map(x => [x.type, Number(x.value)]));
}

function zonedEpoch(dateText, timeText, timeZone) {
  const [year, month, day] = dateText.split("-").map(Number);
  const [hour, minute, second = 0] = timeText.split(":").map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = zoneParts(new Date(guess), timeZone);
    const observed = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += wanted - observed;
  }
  return guess;
}

function localDateKey(value, timeZone) {
  const parsed = new Date(String(value).replace(" ", "T"));
  if (!Number.isNaN(parsed.getTime())) {
    const p = zoneParts(parsed, timeZone);
    return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  }
  const match = String(value).match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (!match) throw new Error(`Неизвестная дата расписания: ${value}`);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function format(epoch, timeZone) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
  }).format(new Date(epoch));
}

async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  else console.log(`${name}=${value}`);
}

const home = await fetch(base + "/", { headers });
if (!home.ok) throw new Error(`Главная страница: HTTP ${home.status}`);
const cookies = home.headers.getSetCookie?.().map(x => x.split(";")[0]).join("; ") || "";
const [queues, slots, schedules] = await Promise.all([
  loadJson("/api/outage-queue/by-type/3", cookies),
  loadJson("/api/schedule/time-series", cookies),
  loadJson("/api/v2/schedule/active", cookies)
]);

if (String(process.env.TEST_NOTIFICATION).toLowerCase() === "true") {
  await fs.writeFile("notification.txt", `✅ Проверка работает!\nГруппа: ${config.group}\nПредупреждение: за ${config.notifyBeforeMinutes} минут\nИсточник: ${config.siteUrl}\n`);
  await setOutput("alert_key", `test-${process.env.GITHUB_RUN_ID || Date.now()}`);
  console.log("Подготовлено тестовое уведомление.");
  process.exit(0);
}

const queue = queues.find(x => String(x.name).replace(",", ".") === String(config.group).replace(",", "."));
if (!queue) throw new Error(`Группа ${config.group} не найдена на сайте`);
const slotById = new Map(slots.map(x => [Number(x.id), x]));
const raw = [];
for (const schedule of schedules) {
  const date = localDateKey(schedule.from, config.timezone);
  for (const item of schedule.series || []) {
    if (Number(item.outage_queue_id) !== Number(queue.id) || item.type === "ENABLE") continue;
    const slot = slotById.get(Number(item.time_series_id));
    if (!slot) continue;
    const start = zonedEpoch(date, slot.start, config.timezone);
    let end = zonedEpoch(date, slot.end, config.timezone);
    if (end <= start) end += 86400000;
    raw.push({ start, end, types: new Set([item.type]) });
  }
}
raw.sort((a, b) => a.start - b.start);
const intervals = [];
for (const item of raw) {
  const last = intervals.at(-1);
  if (last && item.start <= last.end) {
    last.end = Math.max(last.end, item.end);
    item.types.forEach(x => last.types.add(x));
  } else intervals.push(item);
}

const now = Date.now();
const minNotice = Math.max(30, Number(config.notifyBeforeMinutes) - 25);
const maxNotice = Number(config.notifyBeforeMinutes) + 10;
const next = intervals.find(x => {
  const minutes = (x.start - now) / 60000;
  return minutes >= minNotice && minutes <= maxNotice;
});
if (!next) {
  await setOutput("alert_key", "");
  console.log(`Группа ${config.group}: уведомлять сейчас не о чем. Активных интервалов: ${intervals.length}.`);
  process.exit(0);
}

const key = `${config.group}-${new Date(next.start).toISOString()}-${new Date(next.end).toISOString()}`.replace(/[^a-zA-Z0-9_.-]/g, "_");
const message = [
  "⚠️ Примерно через час возможно отключение света",
  `Группа: ${config.group}`,
  `Время: ${format(next.start, config.timezone)} — ${format(next.end, config.timezone).split(", ").at(-1)}`,
  `Источник: ${config.siteUrl}`
].join("\n") + "\n";
await fs.writeFile("notification.txt", message);
await setOutput("alert_key", key);
console.log(message);
