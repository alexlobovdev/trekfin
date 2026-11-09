import { useState } from "react";
import { ChevronRight, ReceiptText, ScanLine, Search } from "lucide-react";
import type { Entry, Month } from "../types";
import { dateLabel, money } from "../api";
import { Empty } from "../components/ui";

export default function Purchases({
  month,
  onEdit,
  onScan,
}: {
  month: Month;
  onEdit: (entry: Entry) => void;
  onScan: () => void;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"receipts" | "items">("receipts");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const receipts = month.entries.filter((e) => e.receipt);
  const needsAttention = receipts.filter(
    (e) => !e.category_id || e.receipt?.status === "pending",
  );
  const query = search.trim().toLowerCase();
  const visible = receipts.filter(
    (e) =>
      (!attentionOnly || !e.category_id || e.receipt?.status === "pending") &&
      (!query ||
        [
          e.title,
          e.receipt?.seller,
          e.category.name,
          ...e.receipt!.purchases.map((p) => p.name),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)),
  );
  const purchases = visible
    .flatMap((entry) =>
      entry.receipt!.purchases.map((item) => ({ item, entry })),
    )
    .filter(
      ({ item, entry }) =>
        !query ||
        [item.name, entry.title, entry.receipt?.seller, entry.category.name]
          .join(" ")
          .toLowerCase()
          .includes(query),
    );
  return (
    <>
      <div className="purchases-heading">
        <p>Чеки и всё, что вы купили за месяц</p>
        <button className="button primary" onClick={onScan}>
          <ScanLine size={18} />
          Сканировать чек
        </button>
      </div>
      {needsAttention.length > 0 && (
        <button
          className={
            "receipt-attention-banner" + (attentionOnly ? " selected" : "")
          }
          onClick={() => setAttentionOnly(!attentionOnly)}
          aria-pressed={attentionOnly}
        >
          <ReceiptText size={21} />
          <span>
            <strong>Требуют внимания · {needsAttention.length}</strong>
            <small>Выберите категорию или загрузите покупки</small>
          </span>
          <span>{attentionOnly ? "Показать все" : "Разобрать"}</span>
          <ChevronRight size={17} />
        </button>
      )}
      <section className="panel purchases-panel">
        <div className="purchases-toolbar">
          <div className="segmented" aria-label="Вид покупок">
            <button
              className={view === "receipts" ? "selected" : ""}
              aria-pressed={view === "receipts"}
              onClick={() => setView("receipts")}
            >
              Чеки · {visible.length}
            </button>
            <button
              className={view === "items" ? "selected" : ""}
              aria-pressed={view === "items"}
              onClick={() => setView("items")}
            >
              Товары · {purchases.length}
            </button>
          </div>
          <label className="search-field">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Магазин или покупка"
              aria-label="Поиск покупок"
            />
          </label>
        </div>
        {view === "receipts" ? (
          visible.length ? (
            <div className="receipt-card-list">
              {[...visible]
                .sort(
                  (a, b) =>
                    Number(!b.category_id || b.receipt?.status === "pending") -
                    Number(!a.category_id || a.receipt?.status === "pending"),
                )
                .map((entry) => (
                  <button
                    className={
                      "receipt-card" +
                      (!entry.category_id ? " needs-category" : "")
                    }
                    key={entry.id}
                    onClick={() => onEdit(entry)}
                  >
                    <span className="receipt-card-icon">
                      <ReceiptText size={21} />
                    </span>
                    <span className="receipt-card-copy">
                      <strong>{entry.receipt?.seller || entry.title}</strong>
                      <small>
                        {dateLabel(entry.date)} · {entry.author?.name}
                      </small>
                      <span className="receipt-card-status">
                        {!entry.category_id ? (
                          <span className="receipt-status-badge">
                            Без категории
                          </span>
                        ) : (
                          <span>{entry.category.name}</span>
                        )}
                        {entry.receipt?.status === "pending" ? (
                          <span className="receipt-status-pending">
                            Товары не загружены
                          </span>
                        ) : (
                          <span>{entry.receipt?.purchases.length} позиций</span>
                        )}
                      </span>
                    </span>
                    <span className="receipt-card-tail">
                      <strong>{money(entry.amount_cents, true)}</strong>
                      <ChevronRight size={17} />
                    </span>
                  </button>
                ))}
            </div>
          ) : (
            <Empty
              title={
                search
                  ? "Чеков не нашлось"
                  : attentionOnly
                    ? "Все чеки разобраны"
                    : "Первый чек — и покупки здесь"
              }
              body={
                search
                  ? "Попробуйте другое название."
                  : attentionOnly
                    ? "Категории выбраны, товары загружены."
                    : "Сканируйте QR-код. Сумму, дату и список товаров заполним за вас."
              }
              action={
                !search && !attentionOnly ? (
                  <button className="button primary" onClick={onScan}>
                    <ScanLine size={17} />
                    Сканировать чек
                  </button>
                ) : undefined
              }
            />
          )
        ) : purchases.length ? (
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
                  {entry.receipt?.seller || entry.title} ·{" "}
                  {dateLabel(entry.date)}
                </small>
                <small>
                  {item.quantity} × {money(item.price_cents, true)}
                </small>
              </span>
              <strong>{money(item.amount_cents, true)}</strong>
            </button>
          ))
        ) : (
          <Empty
            title={
              search ? "Товаров не нашлось" : "Здесь будут товары из чеков"
            }
            body={
              search
                ? "Попробуйте другой запрос."
                : "Если чек уже добавлен, откройте его и нажмите «Повторить загрузку»."
            }
          />
        )}
        {visible.length > 0 && (
          <div className="table-footer">
            <span>
              {attentionOnly ? "Требуют внимания" : "По выбранным чекам"}
            </span>
            <strong>
              {money(
                visible.reduce((sum, e) => sum + e.amount_cents, 0),
                true,
              )}
            </strong>
          </div>
        )}
      </section>
    </>
  );
}
