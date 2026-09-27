// Сборка каталога: проверяет все плагины, пакует zip, пишет dist/catalog.json и сообщает в Discord о новых непроверенных версиях.
// Цена, автор, категория, «скрыт» и т. п. задаются в админ-панели → catalog/listing.json (перекрывают plugin.json).
import fs from "node:fs";
import path from "node:path";
import { checkPlugin, zip, discord, PERM_TEXT } from "./lib.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([a-z]:)/i, "$1")), "..");
const PAGES_URL = (process.env.PAGES_URL || "").replace(/\/+$/, ""); // https://имя.github.io/funpay-flux-plugins
const REPO_URL = process.env.REPO_URL || ""; // https://github.com/имя/funpay-flux-plugins
const dist = path.join(ROOT, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "zips"), { recursive: true });

const readJson = (f, def) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
  } catch {
    return def;
  }
};
const reviewed = readJson("reviewed.json", {});
const listing = readJson("catalog/listing.json", {});
const settings = readJson("catalog/settings.json", {});
const plugins = [];
const problems = [];

for (const id of fs.readdirSync(path.join(ROOT, "plugins")).sort()) {
  const dir = path.join(ROOT, "plugins", id);
  if (!fs.statSync(dir).isDirectory()) continue;
  const r = checkPlugin(dir);
  if (r.errors.length) {
    problems.push(`plugins/${id}:\n  • ${r.errors.join("\n  • ")}`);
    continue;
  }
  const m = r.manifest;
  const l = listing[m.id] || {};
  if (l.hidden) continue; // скрыт в админ-панели
  const file = `${m.id}-${m.version}.zip`;
  fs.writeFileSync(path.join(dist, "zips", file), zip(r.files));
  const price = Math.max(0, Number(l.price) || 0);
  plugins.push({
    id: m.id,
    name: l.name || m.name,
    version: m.version,
    author: l.author || m.author,
    description: l.description || m.description,
    icon: l.icon || m.icon || "🧩",
    category: l.category || "",
    featured: !!l.featured,
    price,
    currency: settings.currency || "₽",
    buyUrl: price ? l.buyUrl || "" : "",
    permissions: m.permissions || [],
    status: reviewed[`${m.id}@${m.version}`] === r.hash ? "approved" : "review",
    hash: r.hash,
    download: `${PAGES_URL}/zips/${file}`,
    homepage: REPO_URL ? `${REPO_URL}/tree/main/plugins/${m.id}` : "",
  });
}

if (problems.length) {
  console.error("Плагины с ошибками (в каталог не попали):\n" + problems.join("\n"));
  if (process.env.STRICT === "1") process.exit(1);
}

plugins.sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name, "ru"));
const catalog = {
  updatedAt: new Date().toISOString(),
  storeName: settings.storeName || "Каталог плагинов FunPay Flux",
  devUrl: REPO_URL ? `${REPO_URL}#readme` : "",
  licensePublicKey: settings.licensePublicKey || "",
  revoked: settings.revoked || [],
  plugins,
};
fs.writeFileSync(path.join(dist, "catalog.json"), JSON.stringify(catalog, null, 2));

// админ-панель публикуется рядом с каталогом: https://имя.github.io/funpay-flux-plugins/admin/
fs.cpSync(path.join(ROOT, "admin"), path.join(dist, "admin"), { recursive: true });

const priceText = (p) => (p.price ? `${p.price} ${p.currency}` : "бесплатно");
fs.writeFileSync(
  path.join(dist, "index.html"),
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${catalog.storeName}</title><style>body{font:15px system-ui;max-width:760px;margin:40px auto;padding:0 16px;background:#0d0e12;color:#e7e9ee}a{color:#22d3ee}.p{border:1px solid #262a35;border-radius:12px;padding:12px 16px;margin:10px 0}</style>
<h1>🧩 ${catalog.storeName}</h1><p>Устанавливаются в приложении FunPay Flux: «Плагины» → «Сторонние плагины» → «Каталог». <a href="${REPO_URL}">Как написать свой</a></p>
${plugins.map((p) => `<div class="p"><b>${p.icon} ${p.name}</b> v${p.version} · ${p.author} · ${priceText(p)} · ${p.status === "approved" ? "✅ проверено" : "🟡 не проверено"}<br>${p.description}</div>`).join("")}`
);
console.log(`Каталог: ${plugins.length} плагинов (${plugins.filter((p) => p.status === "approved").length} проверено, платных ${plugins.filter((p) => p.price).length})`);

// ---------- Discord: что нового ждёт проверки ----------
let previous = { plugins: [] };
if (PAGES_URL) {
  try {
    const res = await fetch(`${PAGES_URL}/catalog.json`, { headers: { "Cache-Control": "no-cache" } });
    if (res.ok) previous = await res.json();
  } catch {}
}
const before = new Map(previous.plugins.map((p) => [p.id, p]));
for (const p of plugins) {
  const old = before.get(p.id);
  if (p.status === "review" && (!old || old.hash !== p.hash)) {
    await discord({
      embeds: [
        {
          title: `🟡 ${old ? "Новая версия" : "Новый плагин"} ждёт проверки: ${p.icon} ${p.name} v${p.version}`,
          url: p.homepage || undefined,
          color: 0xfbbf24,
          description: `${p.description}\n\nУже виден в каталоге со значком «Не проверено». Протестируй и одобри в админ-панели${PAGES_URL ? `: ${PAGES_URL}/admin/` : ""}.`,
          fields: [
            { name: "Автор", value: p.author, inline: true },
            { name: "Цена", value: priceText(p), inline: true },
            { name: "id", value: p.id, inline: true },
            { name: "Разрешения", value: p.permissions.map((x) => PERM_TEXT[x] || x).join("\n") || "нет" },
            { name: "Скачать для теста", value: p.download || "—" },
          ],
        },
      ],
    });
  } else if (p.status === "approved" && old && old.status !== "approved") {
    await discord({ embeds: [{ title: `✅ Одобрен: ${p.icon} ${p.name} v${p.version}`, color: 0x34d399, url: p.homepage || undefined }] });
  }
}
