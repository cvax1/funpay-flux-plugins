// Считает выручку за сегодня. Данные хранятся в flux.storage — переживают перезапуск бота.
const today = () => new Date().toISOString().slice(0, 10);

module.exports = (flux) => {
  flux.on("order", async (order) => {
    let day = flux.storage.get("day", { date: today(), sum: 0, count: 0, done: false });
    if (day.date !== today()) day = { date: today(), sum: 0, count: 0, done: false }; // новый день — счёт заново

    day.sum += Number(order.amount) || 0;
    day.count += 1;
    flux.log(`Заказ #${order.orderId} на ${order.amount ?? "?"} ₽ — за сегодня ${day.sum} ₽ (${day.count} шт.)`);

    if (flux.settings.notifyEach) await flux.notify(`Заказ #${order.orderId}`, `${order.title} — ${order.amount ?? "?"} ₽`);
    if (!day.done && day.sum >= flux.settings.goal) {
      day.done = true;
      await flux.notify("🎯 Цель на день выполнена!", `Выручка ${day.sum} ₽ из ${flux.settings.goal} ₽, заказов: ${day.count}`);
    }
    await flux.storage.set("day", day);
  });
};