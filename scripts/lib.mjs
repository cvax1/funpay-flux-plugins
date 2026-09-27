// Общие функции каталога: проверка plugin.json, отпечаток содержимого, zip, Discord.
// Отпечаток считается ТАК ЖЕ, как в приложении (worker/src/ext/manager.js → contentHash) — не меняй одно без другого.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";

export const PERMISSIONS = ["chat", "orders", "reviews", "notify", "network"];
const FIELD_TYPES = ["text", "textarea", "number", "toggle", "select"];

export function validateManifest(m, folderName) {
  const errors = [];
  if (!m || typeof m !== "object") return ["plugin.json не читается как JSON-объект"];
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(m.id || "")) errors.push("id: латиница в нижнем регистре, цифры и дефис (например my-plugin)");
  if (folderName && m.id !== folderName) errors.push(`id «${m.id}» должен совпадать с именем папки «${folderName}»`);
  if (!m.name || String(m.name).length > 60) errors.push("name: название до 60 символов");
  if (!/^\d+\.\d+\.\d+$/.test(m.version || "")) errors.push("version: в формате 1.0.0");
  if (!m.author) errors.push("author: ник автора");
  if (!m.description) errors.push("description: пара предложений, что делает плагин");
  if (m.main && !/^[\w\-./]+\.(c?js|mjs)$/.test(m.main)) errors.push("main: путь к .js/.mjs файлу");
  for (const p of m.permissions || []) if (!PERMISSIONS.includes(p)) errors.push(`permissions: неизвестное «${p}» (есть: ${PERMISSIONS.join(", ")})`);
  for (const f of m.settings || []) {
    if (!/^\w{1,40}$/.test(f?.key || "")) errors.push(`settings: неверный key «${f?.key}»`);
    if (!FIELD_TYPES.includes(f?.type)) errors.push(`settings.${f?.key}: type — один из ${FIELD_TYPES.join(", ")}`);
  }
  return errors;
}

export function readFiles(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === ".DS_Store") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) readFiles(full, base, out);
    else out.push({ path: path.relative(base, full).split(path.sep).join("/"), data: fs.readFileSync(full) });
  }
  return out;
}

export function contentHash(files) {
  const h = crypto.createHash("sha256");
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    h.update(f.path + "\n" + crypto.createHash("sha256").update(f.data).digest("hex") + "\n");
  }
  return h.digest("hex");
}

/** Проверка папки плагина: { manifest, files, hash, errors } */
export function checkPlugin(dir) {
  const folder = path.basename(dir);
  const errors = [];
  let manifest = null;
  let files = [];
  try {
    files = readFiles(dir);
  } catch (e) {
    return { errors: [`папка не читается: ${e.message}`] };
  }
  const size = files.reduce((n, f) => n + f.data.length, 0);
  if (size > 5 * 1024 * 1024) errors.push("плагин больше 5 МБ — так много не нужно");
  const mf = files.find((f) => f.path === "plugin.json");
  if (!mf) errors.push("нет plugin.json");
  else {
    try {
      manifest = JSON.parse(mf.data.toString("utf8"));
      errors.push(...validateManifest(manifest, folder));
      const main = manifest.main || "main.js";
      if (!files.some((f) => f.path === main)) errors.push(`нет главного файла ${main}`);
    } catch (e) {
      errors.push(`plugin.json — не JSON: ${e.message}`);
    }
  }
  if (files.some((f) => /\.(exe|dll|node|bat|cmd|ps1|sh)$/i.test(f.path))) errors.push("в плагине не должно быть исполняемых файлов (.exe, .dll, .node, скрипты)");
  return { manifest, files, hash: files.length ? contentHash(files) : null, errors };
}

// ---------- zip (deflate) ----------
export function zip(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    const name = Buffer.from(f.path, "utf8");
    const data = zlib.deflateRawSync(f.data, { level: 9 });
    const crc = zlib.crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // имена в UTF-8
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10); // время/дата — нули, чтобы архив был одинаковым при каждой сборке
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(f.data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// ---------- Discord ----------
export async function discord(payload) {
  const url = process.env.DISCORD_WEBHOOK;
  if (!url) {
    console.log("DISCORD_WEBHOOK не задан — уведомление пропущено:", JSON.stringify(payload).slice(0, 300));
    return;
  }
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "FunPay Flux · плагины", ...payload }) });
  if (!res.ok) console.log("Discord ответил", res.status, await res.text());
}

export const PERM_TEXT = {
  chat: "💬 чат: читать и отвечать",
  orders: "💰 заказы",
  reviews: "⭐ отзывы",
  notify: "🔔 уведомления",
  network: "🌐 интернет",
};
