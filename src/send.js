import fs from "node:fs/promises";

const config = JSON.parse(await fs.readFile(new URL("../config.json", import.meta.url), "utf8"));
const topic = process.env.NTFY_TOPIC?.trim();
if (!topic) throw new Error("Добавьте секрет NTFY_TOPIC в настройках репозитория");
const message = await fs.readFile("notification.txt", "utf8");
await fs.writeFile("ntfy-payload.json", JSON.stringify({
  topic,
  title: `Свет — группа ${config.group}`,
  message,
  priority: 4,
  tags: ["warning", "electric_plug"],
  click: config.siteUrl
}));
console.log("Сообщение подготовлено к отправке.");
