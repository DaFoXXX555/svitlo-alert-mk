import fs from "node:fs/promises";

const topic = process.env.NTFY_TOPIC?.trim();
if (!topic) throw new Error("Добавьте секрет NTFY_TOPIC в настройках репозитория");
const message = await fs.readFile("notification.txt", "utf8");
const response = await fetch(process.env.NTFY_SERVER || "https://ntfy.sh", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    topic,
    title: "Свет — группа 3.1",
    message,
    priority: 4,
    tags: ["warning", "electric_plug"],
    click: "https://off.energy.mk.ua/"
  })
});
if (!response.ok) throw new Error(`ntfy: HTTP ${response.status}: ${await response.text()}`);
console.log("Push-уведомление отправлено.");
