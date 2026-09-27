// Самый простой плагин: покупатель пишет команду — бот отвечает.
module.exports = (flux) => {
  flux.on("message", async (msg) => {
    if (msg.text.trim().toLowerCase() !== String(flux.settings.command).trim().toLowerCase()) return;
    const text = String(flux.settings.answer).replace(/\{buyer\}/g, msg.buyerName || "");
    await flux.reply(msg, text);
    flux.log(`Ответил ${msg.buyerName || "покупателю"} на ${flux.settings.command}`);
  });
};