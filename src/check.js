const base = "https://off.energy.mk.ua";
const headers = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
  "accept": "application/json, text/plain, */*",
  "referer": base + "/"
};
const home = await fetch(base + "/", { headers });
console.log("HOME", home.status);
const cookies = home.headers.getSetCookie?.().map(x => x.split(";")[0]).join("; ") || "";
for (const path of ["/api/outage-queue/by-type/3", "/api/schedule/time-series", "/api/v2/schedule/active"]) {
  const response = await fetch(base + path, { headers: { ...headers, cookie: cookies } });
  const text = await response.text();
  console.log(path, response.status, text.slice(0, 2000));
  if (!response.ok) process.exitCode = 1;
}
