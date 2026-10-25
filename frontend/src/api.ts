let token = "";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function csrf() {
  const r = await fetch("/api/csrf", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  token = (await r.json()).token;
}
export async function api<T = unknown>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  if (method !== "GET" && !token) await csrf();
  const run = () =>
    fetch("/api/" + path, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(method !== "GET" ? { "X-CSRF-TOKEN": token } : {}),
      },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
  let r = await run();
  if (r.status === 419) {
    await csrf();
    r = await run();
  }
  if (r.status === 204) return undefined as T;
  const body = await r.json();
  if (!r.ok) {
    const validation = body.errors
      ? Object.values(body.errors).flat().join(" ")
      : null;
    throw new ApiError(
      validation || body.message || "Не удалось выполнить действие.",
      r.status,
    );
  }
  return body;
}
export function invalidateCsrf() {
  token = "";
}
export const money = (cents: number, precise = false) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: precise || cents % 100 !== 0 ? 2 : 0,
  }).format(cents / 100);
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Yekaterinburg" }).format(
    new Date(),
  );
export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" })
    .format(new Date(month + "-15T12:00:00"))
    .replace(" г.", "");
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(
    new Date(date.slice(0, 10) + "T12:00:00"),
  );
export const amountInput = (cents: number) => String(cents / 100);
