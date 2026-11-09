import { useState } from "react";
import { Search } from "lucide-react";
import type { Entry, Month } from "../types";
import { dateLabel, money } from "../api";
import { Empty } from "../components/ui";
export default function Purchases({
  month,
  onEdit,
}: {
  month: Month;
  onEdit: (entry: Entry) => void;
}) {
  const [search, setSearch] = useState("");
  const receipts = month.entries.filter((e) => e.receipt);
  const purchases = receipts
    .flatMap((entry) =>
      entry.receipt!.purchases.map((item) => ({ item, entry })),
    )
    .filter(({ item, entry }) =>
      (item.name + " " + entry.title + " " + entry.receipt?.seller)
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const pending = receipts.filter((e) => e.receipt?.status === "pending");
  return (
    <>
      <label className="search-field">
        <Search size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Найти покупку или магазин…"
          aria-label="Поиск покупок"
        />
      </label>
      <section className="panel purchases-panel">
        <div className="panel-title">
          <div>
            <h2>Покупки за месяц</h2>
            <p>
              {purchases.length} позиций ·{" "}
              {money(
                purchases.reduce((sum, p) => sum + p.item.amount_cents, 0),
                true,
              )}
            </p>
          </div>
        </div>
        {purchases.length ? (
          purchases.map(({ item, entry }, i) => (
            <button
              className={
                "purchase-row" + (!entry.category_id ? " needs-category" : "")
              }
              key={item.id ?? i}
              onClick={() => onEdit(entry)}
            >
              <span>
                <strong>{item.name}</strong>
                <small>
                  {dateLabel(entry.date)} ·{" "}
                  {entry.receipt?.seller || entry.title}
                </small>
                <small>
                  {item.quantity} × {money(item.price_cents, true)} ·{" "}
                  {entry.category.name}
                </small>
              </span>
              <strong>{money(item.amount_cents, true)}</strong>
            </button>
          ))
        ) : (
          <Empty
            title={search ? "Ничего не нашлось" : "Покупок пока нет"}
            body={
              search
                ? "Попробуйте другой запрос."
                : "Добавьте расход через «+ → Сканировать». Здесь появятся товары из чеков."
            }
          />
        )}
        {pending.length > 0 && (
          <div className="pending-receipts">
            <h3>Ожидают загрузки товаров: {pending.length}</h3>
            {pending.map((entry) => (
              <button
                className="text-button"
                key={entry.id}
                onClick={() => onEdit(entry)}
              >
                {entry.title} · {dateLabel(entry.date)} ·{" "}
                {money(entry.amount_cents)}
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
