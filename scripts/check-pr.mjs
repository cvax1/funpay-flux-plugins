// Проверка присланного плагина (Pull Request). Код плагина НЕ запускается — только читаются файлы.
import fs from "node:fs";
import path from "node:path";
import { checkPlugin, discord, PERM_TEXT } from "./lib.mjs";

const BASE = path.resolve(process.env.BASE_DIR || ".");
const PR = path.resolve(process.env.PR_DIR || "pr");
const prUrl = process.env.PR_URL || "";
const who = process.env.PR_AUTHOR || "?";

const list = (root) => (fs.existsSync(path.join(root, "plugins")) ? fs.readdirSync(path.join(root, "plugins")).filter((d) => fs.statSync(path.join(root, "plugins", d)).isDirectory()) : []);
const changed = [];
for (const id of list(PR)) {
  const now = checkPlugin(path.join(PR, "plugins", id));
  const was = fs.existsSync(path.join(BASE, "plugins", id)) ? checkPlugin(path.join(BASE, "plugins", id)) : null;
  if (!was || was.hash !== now.hash) changed.push({ id, isNew: !was, ...now });
}

// правки вне plugins/ из PR принимать нельзя — там скрипты сборки каталога
const outside = (process.env.CHANGED_FILES || "").split("\n").filter((f) => f && !f.startsWith("plugins/"));

let summary = `## Проверка плагина\n\n`;
if (!changed.length) summary += "В PR не изменено ни одного плагина в папке `plugins/`.\n";
for (const c of changed) {
  summary += c.errors.length
    ? `### ❌ plugins/${c.id}\n${c.errors.map((e) => `- ${e}`).join("\n")}\n`
    : `### ✅ ${c.manifest.icon || "🧩"} ${c.manifest.name} v${c.manifest.version}\nРазрешения: ${(c.manifest.permissions || []).map((p) => PERM_TEXT[p] || p).join(", ") || "нет"}\n`;
}
if (outside.length) summary += `\n### ⚠️ Изменены файлы вне plugins/ — такой PR нельзя принимать без ручной проверки:\n${outside.map((f) => `- ${f}`).join("\n")}\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);

if (changed.length) {
  const ok = changed.every((c) => !c.errors.length) && !outside.length;
  await discord({
    embeds: [
      {
        title: `${ok ? "🧩 Прислан плагин — надо посмотреть" : "⚠️ Прислан плагин с ошибками"} (${who})`,
        url: prUrl || undefined,
        color: ok ? 0x8b5cf6 : 0xf87171,
        description: changed
          .map((c) =>
            c.errors.length
              ? `❌ **${c.id}**: ${c.errors.slice(0, 3).join("; ")}`
              : `${c.isNew ? "🆕" : "⬆️"} **${c.manifest.name}** v${c.manifest.version} — ${c.manifest.description}\nРазрешения: ${(c.manifest.permissions || []).map((p) => PERM_TEXT[p] || p).join(", ") || "нет"}`
          )
          .join("\n\n") + (outside.length ? `\n\n⚠️ Изменены файлы вне plugins/: ${outside.slice(0, 5).join(", ")}` : "") + `\n\nПосмотри код в PR и нажми Merge — плагин появится в каталоге со значком «Не проверено».`,
      },
    ],
  });
}
if (changed.some((c) => c.errors.length)) process.exit(1);
