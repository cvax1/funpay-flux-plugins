// Подсказки для VS Code: положи рядом с main.js и добавь в начало файла
//   /** @param {import("./flux").Flux} flux */
export interface ChatMessage { chatId: string; text: string; buyerName: string | null; authorId: string; blacklisted: boolean }
export interface Order { orderId: string; chatId: string; buyerName: string | null; buyerId: string | null; amount: number | null; title: string; quantity: number; lotId: string | null }
export interface Review { orderId: string; rating: number | null; chatId: string; buyerName: string | null; changed: boolean }
export interface Log { (text: unknown): void; info(text: unknown): void; ok(text: unknown): void; warn(text: unknown): void; error(text: unknown): void }
export interface Flux {
  readonly plugin: { id: string; name: string; version: string };
  readonly settings: Record<string, any>;
  on(event: "message", fn: (msg: ChatMessage) => unknown): void;
  on(event: "order", fn: (order: Order) => unknown): void;
  on(event: "confirmed", fn: (e: { orderId: string; chatId: string }) => unknown): void;
  on(event: "review", fn: (r: Review) => unknown): void;
  on(event: "settings", fn: (s: Record<string, any>) => unknown): void;
  on(event: "start" | "stop", fn: () => unknown): void;
  command(trigger: string, fn: (msg: ChatMessage, args: string) => unknown): void;
  say(chatId: string, text: string): Promise<boolean>;
  reply(msg: { chatId: string }, text: string): Promise<boolean>;
  notify(title: string, text?: string): Promise<boolean>;
  log: Log;
  storage: { get<T = any>(key: string, def?: T): T; set(key: string, value: unknown): Promise<boolean>; delete(key: string): Promise<boolean>; all(): Record<string, any> };
}