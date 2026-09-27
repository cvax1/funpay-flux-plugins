// Шаблон плагина FunPay Flux. Документация — README.md в корне репозитория.
module.exports = (flux) => {
  // команда покупателя в чате
  flux.command("!привет", async (msg) => {
    await flux.reply(msg, flux.settings.answer);
  });

  // все события, которые можно слушать (нужны разрешения из plugin.json):
  // flux.on("message",   (msg)   => {}); // chat:    { chatId, text, buyerName, authorId, blacklisted }
  // flux.on("order",     (order) => {}); // orders:  { orderId, chatId, buyerName, buyerId, amount, title, quantity, lotId }
  // flux.on("confirmed", (e)     => {}); // orders:  { orderId, chatId }
  // flux.on("review",    (r)     => {}); // reviews: { orderId, rating, chatId, buyerName, changed }
  // flux.on("settings",  (s)     => {}); // пользователь сохранил настройки
  // flux.on("start",     ()      => {}); // плагин запущен
  // flux.on("stop",      ()      => {}); // плагин выключают — успей сохранить данные
};