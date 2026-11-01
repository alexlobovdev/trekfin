import { ArrowRight, Check, Plus } from "lucide-react";
import { money } from "../api";
import type { Bootstrap, Entry, Insight, Month } from "../types";
import {
  Avatar,
  CategoryIcon,
  Empty,
  EntryRow,
  LimitBar,
  Stat,
} from "../components/ui";
import TipCard from "../components/TipCard";
import GoalsDashboard from "../components/GoalsDashboard";
export default function Overview({
  month,
  data,
  insight,
  onEdit,
  onPay,
  onAdd,
  onNavigate,
}: {
  month: Month;
  data: Bootstrap;
  insight: Insight | null;
  onEdit: (e: Entry) => void;
  onPay: (e: Entry) => void;
  onAdd: () => void;
  onNavigate: (s: string) => void;
}) {
  const t = month.totals;
  const plans = month.entries.filter(
      (e) =>
        e.state === "planned" &&
        e.kind === "expense" &&
        e.category?.mode !== "limit",
    ),
    actual = month.entries.filter((e) => e.state === "actual");
  const expenses = month.entries.filter(
    (e) =>
      e.kind === "expense" && e.state === (t.expense ? "actual" : "planned"),
  );
  const categories = data.categories
    .map((c) => ({
      ...c,
      total: expenses
        .filter((e) => e.category_id === c.id)
        .reduce((s, e) => s + e.amount_cents, 0),
    }))
    .filter((c) => c.total)
    .sort((a, b) => b.total - a.total);
  const total = categories.reduce((s, c) => s + c.total, 0);
  let cursor = 0;
  const gradient = categories
    .map((c) => {
      const start = cursor;
      cursor += (c.total / (total || 1)) * 100;
      return `${c.color} ${start}% ${cursor}%`;
    })
    .join(",");
  const upcoming = plans
    .filter((e) => e.paid_cents < e.amount_cents)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const limitRows = (month.categories || []).filter(
    (c) => c.mode === "limit" && (c.planned_cents || c.actual_cents),
  );
  return (
    <>
      <div className="summary-grid">
        <section className="balance-card">
          <div className="balance-copy">
            <span className="balance-label">Свободно</span>
            <strong>{money(t.balance)}</strong>
            <p>К концу месяца {money(t.forecast)}</p>
          </div>
        </section>
        <Stat
          label="Доходы за месяц"
          value={t.income}
          detail={"в плане " + money(t.planned_income)}
          income
        />
        <Stat
          label="Расходы за месяц"
          value={t.expense}
          detail={"в плане " + money(t.planned_expense)}
        />
      </div>
      <GoalsDashboard data={data} month={month} onNavigate={onNavigate} />
      <div className="dashboard-grid">
        <section className="panel spending-panel">
          <div className="panel-title">
            <h2>{t.expense ? "Куда уходят деньги" : "План расходов"}</h2>
            <span className="quiet-pill">{categories.length} категорий</span>
          </div>
          {total ? (
            <div className="distribution">
              <div
                className="donut"
                style={{ background: `conic-gradient(${gradient})` }}
              >
                <div>
                  <span>{t.expense ? "Потрачено" : "Всего в плане"}</span>
                  <strong>{money(total)}</strong>
                  <small>за этот месяц</small>
                </div>
              </div>
              <div className="category-legend">
                {categories.slice(0, 5).map((c) => (
                  <div key={c.id}>
                    <span
                      className="legend-dot"
                      style={{ background: c.color }}
                    />
                    <span>{c.name}</span>
                    <strong>{money(c.total)}</strong>
                  </div>
                ))}
                {categories.length > 5 && (
                  <div className="legend-other">
                    <span className="legend-dot" />
                    <span>Остальные категории</span>
                    <strong>
                      {money(
                        categories.slice(5).reduce((s, c) => s + c.total, 0),
                      )}
                    </strong>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Empty
              title="Пока пусто"
              body="Запишите расход или соберите план месяца."
            />
          )}
          {limitRows.length > 0 && (
            <div className="limit-list">
              {limitRows.map((c) => (
                <LimitBar
                  key={c.id}
                  name={c.name}
                  planned={c.planned_cents}
                  actual={c.actual_cents}
                  color={c.color}
                />
              ))}
            </div>
          )}
        </section>
        <section className="panel upcoming-panel">
          <div className="panel-title">
            <h2>Нужно оплатить</h2>
            <button className="text-button" onClick={() => onNavigate("budget")}>
              Весь план <ArrowRight size={15} />
            </button>
          </div>
          <div className="upcoming-list">
            {upcoming.length ? (
              upcoming.map((e) => (
                <div className="upcoming-item" key={e.id}>
                  <CategoryIcon category={e.category} />
                  <div>
                    <strong>{e.title}</strong>
                    <span>
                      {!e.date_confirmed
                        ? "В этом месяце"
                        : e.date.slice(8, 10) + " числа"}
                    </span>
                  </div>
                  <strong>{money(e.amount_cents - e.paid_cents)}</strong>
                  <button
                    className="pay-button"
                    onClick={() => onPay(e)}
                    title="Записать оплату на сегодня"
                    aria-label={"Отметить оплаченным: " + e.title}
                  >
                    <Check size={16} />
                  </button>
                </div>
              ))
            ) : (
              <Empty
                title="Всё спокойно"
                body={
                  plans.length
                    ? "Платежи этого месяца закрыты."
                    : "В этом месяце нет платежей."
                }
              />
            )}
          </div>
        </section>
        <section className="panel recent-panel">
          <div className="panel-title">
            <h2>Последние</h2>
            <button
              className="text-button"
              onClick={() => onNavigate("transactions")}
            >
              Вся история <ArrowRight size={15} />
            </button>
          </div>
          {actual.length ? (
            actual
              .slice(0, 4)
              .map((e) => <EntryRow key={e.id} entry={e} onEdit={onEdit} />)
          ) : (
            <Empty
              title="Пока пусто"
              body="Запишите расход или доход."
              action={
                <button className="button secondary" onClick={onAdd}>
                  <Plus size={16} />
                  Записать
                </button>
              }
            />
          )}
        </section>
        <div className="dashboard-side">
          <TipCard initial={insight} />
          <section className="panel couple-card">
            <div className="panel-title">
              <h2>Кто сколько потратил</h2>
            </div>
            {month.by_author.map((p) => (
              <div className="person-summary" key={p.id}>
                <Avatar name={p.name} />
                <div>
                  <strong>{p.name}</strong>
                </div>
                <strong>{money(p.expense)}</strong>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
