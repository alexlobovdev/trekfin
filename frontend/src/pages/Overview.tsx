import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Heart,
  Lightbulb,
  Plus,
  Sparkles,
} from "lucide-react";
import { money } from "../api";
import type { Bootstrap, Entry, Insight, Month } from "../types";
import { Avatar, CategoryIcon, Empty, EntryRow, Stat } from "../components/ui";
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
  const t = month.totals,
    forecast =
      (month.plan?.opening_cents || 0) + t.planned_income - t.planned_expense;
  const plans = month.entries.filter(
      (e) => e.state === "planned" && e.kind === "expense",
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
  const ratio = t.planned_expense
    ? Math.round((t.expense / t.planned_expense) * 100)
    : 0;
  return (
    <>
      <div className="summary-grid">
        <section className="balance-card">
          <div className="balance-copy">
            <span className="balance-label">
              Свободно по плану <span className="tiny-pill">Общий бюджет</span>
            </span>
            <strong>{money(forecast)}</strong>
            <p>После всех запланированных расходов</p>
            <button
              onClick={() => onNavigate("budget")}
              className="balance-link"
            >
              Посмотреть бюджет <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="balance-art" aria-hidden="true">
            <div className="orbit o1" />
            <div className="orbit o2" />
            <div className="little-card">
              <span>trekfin.</span>
              <Heart size={18} />
              <div className="card-chip" />
              <b>•••• 002</b>
            </div>
            <div className="coin">₽</div>
            <div className="spark">✳</div>
          </div>
        </section>
        <Stat
          label="Доходы за месяц"
          value={t.income}
          detail={"В плане " + money(t.planned_income)}
          income
        />
        <Stat
          label="Расходы за месяц"
          value={t.expense}
          detail={"В плане " + money(t.planned_expense)}
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel spending-panel">
          <div className="panel-title">
            <div>
              <h2>{t.expense ? "Куда уходят деньги" : "План расходов"}</h2>
              <p>
                {t.expense
                  ? "Фактические расходы по категориям"
                  : "Бюджет из вашей таблицы"}
              </p>
            </div>
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
              title="Начнём с плана?"
              body="Добавьте регулярные платежи или запишите первую операцию."
            />
          )}
          <div className="plan-progress">
            <div>
              <span>Потрачено от плана</span>
              <strong>{ratio}%</strong>
            </div>
            <div className="progress-track">
              <i
                style={{
                  width: Math.min(ratio, 100) + "%",
                  background: ratio > 100 ? "#c74f52" : undefined,
                }}
              />
            </div>
            <small>
              {t.expense > t.planned_expense
                ? "Выше плана на " + money(t.expense - t.planned_expense)
                : "В бюджете ещё " + money(t.planned_expense - t.expense)}
            </small>
          </div>
        </section>
        <section className="panel upcoming-panel">
          <div className="panel-title">
            <div>
              <h2>Платежи по плану</h2>
              <p>Чтобы ничего не упустить</p>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("budget")}
            >
              Все <ArrowRight size={15} />
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
                      {e.source_key?.startsWith("import:")
                        ? "В этом месяце"
                        : e.date.slice(8, 10) + " числа"}
                    </span>
                  </div>
                  <strong>{money(e.amount_cents - e.paid_cents)}</strong>
                  <button
                    className="pay-button"
                    onClick={() => onPay(e)}
                    aria-label={"Подтвердить " + e.title}
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
                    ? "Все запланированные платежи подтверждены."
                    : "На этот месяц ещё нет запланированных платежей."
                }
              />
            )}
          </div>
          <button
            className="subtle-button full"
            onClick={() => onNavigate("budget")}
          >
            Открыть план месяца <ArrowRight size={15} />
          </button>
        </section>
        <section className="panel recent-panel">
          <div className="panel-title">
            <div>
              <h2>Последние операции</h2>
              <p>Каждая мелочь на своём месте</p>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("transactions")}
            >
              Все операции <ArrowRight size={15} />
            </button>
          </div>
          {actual.length ? (
            actual
              .slice(0, 4)
              .map((e) => <EntryRow key={e.id} entry={e} onEdit={onEdit} />)
          ) : (
            <Empty
              title="Пока без записей"
              body="Планы уже на месте. Добавьте первый реальный расход или доход."
              action={
                <button className="button secondary" onClick={onAdd}>
                  <Plus size={16} />
                  Добавить операцию
                </button>
              }
            />
          )}
        </section>
        <div className="dashboard-side">
          <section className="tip-card">
            <div className="tip-top">
              <span>
                <Lightbulb size={17} />
                СОВЕТ ДНЯ
              </span>
              <Sparkles size={20} strokeWidth={1.3} />
            </div>
            <h3>{insight?.title || "Маленькие шаги — общие планы"}</h3>
            <p>
              {insight?.body ||
                "Записывайте расходы вместе, чтобы видеть полную картину вашего бюджета."}
            </p>
            <a
              href={insight?.link || "https://fincult.info/"}
              target="_blank"
              rel="noreferrer"
            >
              {insight?.source || "Совет Trekfin"} <ArrowUpRight size={13} />
            </a>
          </section>
          <section className="panel couple-card">
            <div className="panel-title">
              <h2>Мы в этом вместе</h2>
              <Heart size={17} />
            </div>
            {month.by_author.map((p) => (
              <div className="person-summary" key={p.id}>
                <Avatar name={p.name} />
                <div>
                  <strong>{p.name}</strong>
                  <span>Расходы за месяц</span>
                </div>
                <strong>{money(p.expense)}</strong>
              </div>
            ))}
          </section>
        </div>
      </div>
      <div className="page-foot">
        <span>
          <span className="status-dot" />
          Ваши финансы видны только вам двоим
        </span>
        <span>Маленькие шаги. Общие планы.</span>
      </div>
    </>
  );
}
