import { useState } from "react";
import { Download, Plus, Search, SlidersHorizontal } from "lucide-react";
import type { Bootstrap, Entry, Month } from "../types";
import { money } from "../api";
import { Empty, EntryRow } from "../components/ui";
export default function Transactions({
  month,
  data,
  onEdit,
  onAdd,
}: {
  month: Month;
  data: Bootstrap;
  onEdit: (e: Entry) => void;
  onAdd: () => void;
}) {
  const [search, setSearch] = useState(""),
    [author, setAuthor] = useState(""),
    [kind, setKind] = useState(""),
    [category, setCategory] = useState("");
  const entries = month.entries.filter(
    (e) =>
      e.state === "actual" &&
      (!author || String(e.author_id) === author) &&
      (!kind || e.kind === kind) &&
      (!category || String(e.category_id) === category) &&
      (!search ||
        (e.title + " " + e.category.name + " " + e.note)
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  return (
    <>
      <div className="filter-bar">
        <label className="search-field">
          <Search size={18} />
          <input
            placeholder="Найти операцию…"
            aria-label="Поиск операций"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="filter-select">
          <SlidersHorizontal size={16} />
          <select
            aria-label="Автор"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          >
            <option value="">Оба автора</option>
            {data.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <select
          aria-label="Тип операции"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">Доходы и расходы</option>
          <option value="expense">Расходы</option>
          <option value="income">Доходы</option>
        </select>
        <select
          aria-label="Категория"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Все категории</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <a
          className="icon-button export-button"
          href="/api/export"
          aria-label="Скачать все операции CSV"
          title="Скачать все операции CSV"
        >
          <Download size={19} />
        </a>
      </div>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>История операций</h2>
            <p>{entries.length} записей · только фактические операции</p>
          </div>
          <button className="button secondary" onClick={onAdd}>
            <Plus size={16} />
            Добавить
          </button>
        </div>
        {entries.length ? (
          entries.map((e) => <EntryRow key={e.id} entry={e} onEdit={onEdit} />)
        ) : (
          <Empty
            title={
              search || author || kind || category
                ? "Ничего не нашлось"
                : "Здесь будет ваша история"
            }
            body={
              search || author || kind || category
                ? "Попробуйте изменить фильтры."
                : "Добавьте первый расход или доход. Не забудьте указать автора."
            }
            action={
              !search && !author && !kind && !category ? (
                <button className="button primary" onClick={onAdd}>
                  <Plus size={16} />
                  Первая операция
                </button>
              ) : undefined
            }
          />
        )}
        <div className="table-footer">
          <span>По выбранным фильтрам</span>
          <strong className="positive">
            +
            {money(
              entries
                .filter((e) => e.kind === "income")
                .reduce((s, e) => s + e.amount_cents, 0),
            )}
          </strong>
          <strong>
            −
            {money(
              entries
                .filter((e) => e.kind === "expense")
                .reduce((s, e) => s + e.amount_cents, 0),
            )}
          </strong>
        </div>
      </section>
    </>
  );
}
