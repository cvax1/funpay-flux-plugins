// Одобрить текущую версию плагина: записывает её отпечаток в reviewed.json.
// Запуск: GitHub → Actions → «Одобрить плагин» (или локально: node scripts/approve.mjs my-plugin).
import fs from "node:fs";
import path from "node:path";
import { checkPlugin } from "./lib.mjs";

const id = String(process.argv[2] || process.env.PLUGIN_ID || "").trim();
if (!id) {
  console.error("Укажи id плагина");
  process.exit(1);
}
const dir = path.join("plugins", id);
if (!fs.existsSync(dir)) {
  console.error(`Нет папки ${dir}`);
  process.exit(1);
}
const r = checkPlugin(dir);
if (r.errors.length) {
  console.error(`У плагина ошибки:\n• ${r.errors.join("\n• ")}`);
  process.exit(1);
}
const reviewed = JSON.parse(fs.readFileSync("reviewed.json", "utf8"));
reviewed[`${id}@${r.manifest.version}`] = r.hash;
fs.writeFileSync("reviewed.json", JSON.stringify(Object.fromEntries(Object.entries(reviewed).sort()), null, 2) + "\n");
console.log(`✅ ${r.manifest.name} v${r.manifest.version} одобрен (${r.hash.slice(0, 12)}…)`);
