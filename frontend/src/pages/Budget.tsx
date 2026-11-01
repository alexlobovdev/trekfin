import { useState } from "react";
import { CalendarDays, Repeat2 } from "lucide-react";
import { api, money, monthLabel } from "../api";
import type { Bootstrap, Entry, Month } from "../types";
import { Empty, EntryRow, LimitBar } from "../components/ui";
import Recurring from "./Recurring";
const ruCount = (n: number, one: string, few: string, many: string) => {
  const n10 = n % 10,
    n100 = n % 100;
  const word =
    n10 === 1 && n100 !== 11
      ? one
      : n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)
        ? few
        : many;
  return `${n} ${word}`;
};
export default function Budget({
  month,
  data,
  onEdit,
  onPay,
  onRefresh,
  onMonth,
}: {
  month: Month;
  data: Bootstrap;
  onEdit: (e: Entry) => void;
  onPay: (e: Entry) => void;
  onRefresh: () => void;
  onMonth: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const t = month.totals,
    opening = month.plan?.opening_cents || 0,
    plans = month.entries.filter((e) => e.state === "planned"),
    limits = (month.categories || []).filter((c) => c.mode === "limit"),
    limitIds = new Set(limits.map((c) => c.id)),
    payments = plans.filter((e) => !limitIds.has(e.category_id)),
    incomes = payments.filter((e) => e.kind === "income"),
    expenses = payments.filter((e) => e.kind === "expense");
  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      await api("month", "POST", { month: month.month, generate: true });
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="month-strip">
        {data.months.map((p) => (
          <button
            key={p.month}
            onClick={() => onMonth(p.month)}
            className={p.month === month.month ? "selected" : ""}
          >
            <CalendarDays size={16} />
            {monthLabel(p.month)}
          </button>
        ))}
      </div>
      <div className="budget-stats">
        <div>
          <span>Свободно</span>
          <strong>{money(t.balance)}</strong>
          <small>Уже прошло</small>
        </div>
        <div className="pink-stat">
          <span>К концу месяца</span>
          <strong>{money(t.forecast)}</strong>
          <small>
            {!plans.length
              ? "Добавьте план, чтобы увидеть конец месяца"
              : t.remaining_income === 0 && t.remaining_expense === 0
                ? "Платежи закрыты, лимиты израсходованы"
                : `Ещё ожидается ${money(t.remaining_income)}, на расходы ${money(t.remaining_expense)}`}
          </small>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <section className="panel">
        <div className="panel-title budget-title">
          <div>
            <h2>План</h2>
            <p>
              {limits.length
                ? ruCount(limits.length, "лимит", "лимита", "лимитов")
                : "Лимитов пока нет"}
              {" · "}
              {ruCount(expenses.length, "платёж", "платежа", "платежей")}
            </p>
          </div>
        </div>
        {plans.length ? (
          <>
            {incomes.length > 0 && (
              <>
                <div className="list-section-label">
                  ДОХОДЫ{" "}
                  <span>
                    {money(incomes.reduce((s, e) => s + e.amount_cents, 0))}
                  </span>
                </div>
                {incomes.map((e) => (
                  <EntryRow key={e.id} entry={e} onEdit={onEdit} onPay={onPay} />
                ))}
              </>
            )}
            {expenses.length > 0 && (
              <>
                <div className="list-section-label">
                  ПЛАТЕЖИ{" "}
                  <span>
                    {money(expenses.reduce((s, e) => s + e.amount_cents, 0))}
                  </span>
                </div>
                {expenses.map((e) => (
                  <EntryRow key={e.id} entry={e} onEdit={onEdit} onPay={onPay} />
                ))}
              </>
            )}
            {limits.length > 0 && (
              <>
                <div className="list-section-label">ЛИМИТЫ</div>
                <p className="section-hint">
                  Лимит уменьшают покупки. Платёж отмечают галочкой.
                </p>
                {limits.map((c) => (
                  <div key={c.id} className="limit-block">
                    <LimitBar
                      name={c.name}
                      planned={c.planned_cents}
                      actual={c.actual_cents}
                      color={c.color}
                    />
                    {plans
                      .filter((e) => e.category_id === c.id)
                      .map((e) => (
                        <EntryRow key={e.id} entry={e} onEdit={onEdit} />
                      ))}
                  </div>
                ))}
              </>
            )}
          </>
        ) : (
          <Empty
            title="В этом месяце пока пусто"
            body="Подставьте платежи каждого месяца или запишите доход и платёж."
            action={
              <button
                className="button primary"
                disabled={busy}
                onClick={generate}
              >
                <Repeat2 size={16} />
                {busy ? "Подставляем…" : "Подставить платежи каждого месяца"}
              </button>
            }
          />
        )}
      </section>
      {month.plan?.note && <p className="source-note">{month.plan.note}</p>}
      <Recurring
        data={data}
        onRefresh={onRefresh}
        onGenerate={generate}
        busy={busy}
      />
      <details className="panel budget-explanation">
        <summary>Как посчитано</summary>
        <p>
          Свободно: получено {money(t.income)}, потрачено {money(t.expense)},
          остаток прошлых месяцев {money(t.actual_opening)}.
        </p>
        <p>
          В плане: доходы {money(t.planned_income)}, расходы{" "}
          {money(t.planned_expense)}, начальный остаток {money(opening)}. К
          концу плана {money(t.planned_balance)}.
        </p>
        <p>
          К концу месяца учитывает то, что уже прошло, и ещё не оплаченные
          платежи с остатками лимитов.
        </p>
        <div className="opening-panel">
          <div>
            <h3>Начальный остаток в плане</h3>
            <p>Нужен для суммы «к концу плана».</p>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await api("month", "POST", {
                  month: month.month,
                  opening: f.get("opening"),
                });
                onRefresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              key={month.month + opening}
              name="opening"
              aria-label="Начальный остаток"
              type="number"
              step="0.01"
              min="0"
              max="1000000000"
              defaultValue={opening / 100}
            />
            <button className="button secondary" disabled={busy}>
              Сохранить
            </button>
          </form>
        </div>
      </details>
    </>
  );
}
