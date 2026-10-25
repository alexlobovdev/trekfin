import { useState, useRef, type KeyboardEvent } from "react";
import { ArrowRight, CalendarDays, ChevronDown, Plus } from "lucide-react";
import { dateLabel, money, monthLabel, today } from "../api";
import type { Bootstrap, Entry, Month } from "../types";
import { Empty, EntryRow } from "../components/ui";

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const dayKey = (value: unknown) =>
  typeof value === "string" ? value.slice(0, 10) : "";
const compact = (cents: number) => {
  const rub = cents / 100,
    divisor = rub >= 1000000 ? 1000000 : rub >= 1000 ? 1000 : 1;
  return (
    new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: divisor === 1 ? 2 : 1,
    }).format(rub / divisor) +
    (divisor === 1000000 ? "м" : divisor === 1000 ? "к" : "")
  );
};
export default function Calendar({
  month,
  data,
  selected,
  onSelect,
  onMonth,
  onEdit,
  onPay,
  onAdd,
}: {
  month: Month;
  data: Bootstrap;
  selected: string;
  onSelect: (date: string) => void;
  onMonth: (month: string) => void;
  onEdit: (e: Entry) => void;
  onPay: (e: Entry) => void;
  onAdd: (date: string, author?: number) => void;
}) {
  const [author, setAuthor] = useState(""),
    [includePlans, setIncludePlans] = useState(true),
    [expanded, setExpanded] = useState(false);
  const gridRef = useRef<HTMLElement>(null),
    detailsRef = useRef<HTMLElement>(null);
  const [year, number] = month.month.split("-").map(Number),
    first = new Date(year, number - 1, 1, 12),
    offset = (first.getDay() + 6) % 7,
    daysInMonth = new Date(year, number, 0, 12).getDate(),
    cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
  const expenses = month.entries.filter(
    (e) =>
      e.kind === "expense" &&
      (!author ||
        String(e.author_id) === author ||
        (e.state === "planned" && !e.author_id)),
  );
  const payment = (e: Entry) => e.category?.mode !== "limit";
  const actual = expenses.filter((e) => e.state === "actual"),
    plans = expenses.filter((e) => e.state === "planned" && payment(e)),
    undated = plans.filter((e) => !e.date_confirmed),
    dated = plans.filter((e) => e.date_confirmed && !!dayKey(e.date));
  const sums = new Map<
    string,
    { actual: number; planned: number; authors: Set<number> }
  >();
  for (const e of [...actual, ...(includePlans ? dated : [])]) {
    const key = dayKey(e.date);
    if (!key) continue;
    const day = sums.get(key) || {
      actual: 0,
      planned: 0,
      authors: new Set<number>(),
    };
    if (e.state === "actual") {
      day.actual += e.amount_cents;
      if (e.author_id) day.authors.add(e.author_id);
    } else day.planned += Math.max(0, e.amount_cents - e.paid_cents);
    sums.set(key, day);
  }
  const dayEntries = expenses
    .filter(
      (e) =>
        dayKey(e.date) === selected &&
        (e.state === "actual" ||
          (includePlans && e.date_confirmed && payment(e))),
    )
    .sort((a, b) => a.state.localeCompare(b.state) || b.id - a.id);
  const daySums = sums.get(selected),
    max = Math.max(0, ...Array.from(sums.values(), (d) => d.actual)),
    spentDays = Array.from(sums.values()).filter((d) => d.actual > 0).length,
    total = actual.reduce((s, e) => s + e.amount_cents, 0),
    remaining = dated.reduce(
      (s, e) => s + Math.max(0, e.amount_cents - e.paid_cents),
      0,
    );
  const selectedLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(new Date(selected + "T12:00:00"));
  const keyDay = (e: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const shifts: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (!(e.key in shifts)) return;
    e.preventDefault();
    const day = Number(date.slice(8)) + shifts[e.key];
    if (day < 1 || day > daysInMonth) return;
    const next = month.month + "-" + String(day).padStart(2, "0");
    onSelect(next);
    e.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)
      ?.focus();
  };
  return (
    <>
      <div className="calendar-controls">
        <div className="calendar-people">
          <button
            className={!author ? "selected" : ""}
            aria-pressed={!author}
            onClick={() => setAuthor("")}
          >
            Вместе
          </button>
          {data.users.map((u) => (
            <button
              key={u.id}
              className={author === String(u.id) ? "selected" : ""}
              aria-pressed={author === String(u.id)}
              onClick={() => setAuthor(String(u.id))}
            >
              <span
                className={
                  "author-dot " + (u.name.startsWith("В") ? "violet" : "rose")
                }
              />
              {u.name}
            </button>
          ))}
        </div>
        <label className="calendar-toggle">
          <input
            type="checkbox"
            checked={includePlans}
            onChange={(e) => setIncludePlans(e.target.checked)}
          />
          Показывать план
        </label>
        <button
          className="button secondary calendar-today"
          onClick={() => {
            const date = today();
            onSelect(date);
            onMonth(date.slice(0, 7));
          }}
        >
          Сегодня
        </button>
      </div>
      <div className="calendar-summary">
        <div>
          <span>Потрачено за месяц</span>
          <strong>{money(total)}</strong>
        </div>
        <div>
          <span>Запланировано с датой</span>
          <strong>{money(remaining)}</strong>
        </div>
        <div>
          <span>Дней с расходами</span>
          <strong>
            {spentDays}
            <small> из {daysInMonth}</small>
          </strong>
        </div>
      </div>
      <div className="calendar-layout">
        <section className="panel calendar-panel" ref={gridRef}>
          <div className="panel-title">
            <h2>{monthLabel(month.month)}</h2>
            <span className="calendar-legend">
              <i />
              Факт <i className="planned-dot" />
              План <span>· ₽</span>
            </span>
          </div>
          <div className="calendar-weekdays">
            {weekdays.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div
            className="calendar-grid"
            aria-label={"Расходы за " + monthLabel(month.month)}
          >
            {Array.from({ length: cellCount }, (_, index) => {
              const number = index - offset + 1;
              if (number < 1 || number > daysInMonth)
                return (
                  <div
                    key={index}
                    className="calendar-padding"
                    aria-hidden="true"
                  />
                );
              const date = month.month + "-" + String(number).padStart(2, "0"),
                s = sums.get(date),
                isToday = date === today();
              return (
                <button
                  type="button"
                  key={date}
                  data-date={date}
                  tabIndex={date === selected ? 0 : -1}
                  className={
                    "calendar-day " +
                    (date === selected ? "selected " : "") +
                    (isToday ? "is-today " : "") +
                    (index % 7 >= 5 ? "weekend" : "")
                  }
                  style={
                    s?.actual
                      ? {
                          backgroundColor: `rgba(211,67,123,${0.025 + (s.actual / (max || 1)) * 0.12})`,
                        }
                      : undefined
                  }
                  onClick={() => {
                    onSelect(date);
                    if (window.matchMedia("(max-width:760px)").matches)
                      detailsRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                  }}
                  onKeyDown={(e) => keyDay(e, date)}
                  aria-pressed={date === selected}
                  aria-label={`${dateLabel(date)}${isToday ? ", сегодня" : ""}; расходы ${money(s?.actual || 0)}${includePlans ? ", запланировано " + money(s?.planned || 0) : ""}`}
                >
                  <span className="calendar-day-number">{number}</span>
                  {s?.actual ? (
                    <strong className="calendar-actual" title={money(s.actual)}>
                      {compact(s.actual)}
                    </strong>
                  ) : null}
                  {includePlans && !!s?.planned && (
                    <span
                      className="calendar-planned"
                      title={"План " + money(s.planned)}
                    >
                      {compact(s.planned)}
                    </span>
                  )}
                  {!!s?.authors.size && (
                    <span className="calendar-author-dots">
                      {Array.from(s.authors).map((id) => (
                        <i
                          key={id}
                          className={
                            data.users
                              .find((u) => u.id === id)
                              ?.name.startsWith("В")
                              ? "violet"
                              : "rose"
                          }
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="calendar-caption">
            Нажмите на день, чтобы посмотреть траты или добавить запись.
          </div>
        </section>
        <section className="panel calendar-detail" ref={detailsRef}>
          <button
            className="text-button back-to-calendar"
            onClick={() =>
              gridRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
          >
            ↑ К календарю
          </button>
          <div className="panel-title">
            <div>
              <span className="eyebrow">ВЫБРАННЫЙ ДЕНЬ</span>
              <h2>{selectedLabel[0].toUpperCase() + selectedLabel.slice(1)}</h2>
            </div>
            <button
              className="icon-button"
              onClick={() =>
                onAdd(selected, author ? Number(author) : undefined)
              }
              aria-label="Добавить расход на выбранный день"
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="calendar-day-total">
            <span>Фактические расходы</span>
            <strong>{money(daySums?.actual || 0)}</strong>
            {includePlans && !!daySums?.planned && (
              <small>Ещё по плану: {money(daySums.planned)}</small>
            )}
          </div>
          {dayEntries.length ? (
            <div className="calendar-entry-list">
              {dayEntries.map((e) => (
                <div key={e.id}>
                  {e.state === "planned" && (
                    <span className="calendar-entry-label">Запланировано</span>
                  )}
                  <EntryRow
                    entry={e}
                    onEdit={onEdit}
                    onPay={e.state === "planned" ? onPay : undefined}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="На этот день пока нет трат"
              body="Добавьте расход или запланируйте платёж на выбранную дату."
            />
          )}
          <button
            className="button primary full"
            onClick={() => onAdd(selected, author ? Number(author) : undefined)}
          >
            <Plus size={16} />
            {selected > today() ? "Запланировать платёж" : "Добавить расход"}
          </button>
        </section>
      </div>
      {undated.length > 0 && (
        <section className="panel calendar-undated">
          <div className="panel-title">
            <div>
              <h2>
                Планы без точной даты{" "}
                <span className="quiet-pill">{undated.length}</span>
              </h2>
              <p>
                В таблице указан только месяц. Выберите день и назначьте дату
                платежу.
              </p>
            </div>
            <CalendarDays size={21} />
          </div>
          {(expanded ? undated : undated.slice(0, 3)).map((e) => (
            <div className="undated-row" key={e.id}>
              <EntryRow entry={e} onEdit={onEdit} />
              <button
                className="text-button"
                onClick={() =>
                  onEdit({ ...e, date: selected, date_confirmed: true })
                }
              >
                Назначить <ArrowRight size={14} />
              </button>
            </div>
          ))}
          {undated.length > 3 && (
            <button
              className="subtle-button full"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Свернуть" : "Все платежи без даты"}
              <ChevronDown size={15} />
            </button>
          )}
        </section>
      )}
    </>
  );
}
