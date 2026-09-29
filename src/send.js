import fs from "node:fs/promises";

const topic = process.env.NTFY_TOPIC?.trim();
if (!topic) throw new Error("Добавьте секрет NTFY_TOPIC в настройках репозитория");
const message = await fs.readFile("notification.txt", "utf8");
await fs.writeFile("ntfy-payload.json", JSON.stringify({
  topic,
  title: "Свет — группа 3.1",
  message,
  priority: 4,
  tags: ["warning", "electric_plug"],
  click: "https://off.energy.mk.ua/"
}));
console.log("Сообщение подготовлено к отправке.");
