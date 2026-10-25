import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Plus,
  Repeat2,
} from "lucide-react";
import { api, money, monthLabel } from "../api";
import type { Bootstrap, Entry, Month } from "../types";
import { Empty, EntryRow, LimitBar } from "../components/ui";
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
  onAdd,
  onRefresh,
  onMonth,
}: {
  month: Month;
  data: Bootstrap;
  onEdit: (e: Entry) => void;
  onPay: (e: Entry) => void;
  onAdd: () => void;
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
    payments = plans.filter((e) => !limitIds.has(e.category_id));
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
          <span>Начальный остаток в плане</span>
          <strong>{money(opening)}</strong>
        </div>
        <div>
          <span>
            <ArrowDownLeft size={15} />
            План доходов
          </span>
          <strong className="positive">{money(t.planned_income)}</strong>
        </div>
        <div>
          <span>
            <ArrowUpRight size={15} />
            План расходов
          </span>
          <strong>{money(t.planned_expense)}</strong>
        </div>
        <div>
          <span>План на конец месяца</span>
          <strong>{money(t.planned_balance)}</strong>
        </div>
        <div>
          <span>Факт на сегодня</span>
          <strong>{money(t.balance)}</strong>
        </div>
        <div className="pink-stat">
          <span>Прогноз с учётом лимитов</span>
          <strong>{money(t.forecast)}</strong>
        </div>
      </div>
      <div className="info-banner">
        <CalendarDays size={20} />
        <p>
          Лимит категории уменьшается от фактических трат. Конкретный платёж
          подтверждайте галочкой — тогда он учитывается один раз.
        </p>
      </div>
      {error && <p className="error">{error}</p>}
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Бюджет месяца</h2>
            <p>
              {limits.length
                ? ruCount(limits.length, "лимит", "лимита", "лимитов")
                : "Лимитов пока нет"}
              {" · "}
              {ruCount(payments.length, "платёж", "платежа", "платежей")}
            </p>
          </div>
          <button className="button secondary" onClick={onAdd}>
            <Plus size={16} />В план
          </button>
        </div>
        {plans.length ? (
          <>
            {limits.length > 0 && (
              <>
                <div className="list-section-label">ЛИМИТЫ</div>
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
            {payments.some((e) => e.kind === "expense") && (
              <>
                <div className="list-section-label">
                  ПЛАТЕЖИ{" "}
                  <span>
                    {money(
                      payments
                        .filter((e) => e.kind === "expense")
                        .reduce((s, e) => s + e.amount_cents, 0),
                    )}
                  </span>
                </div>
                {payments
                  .filter((e) => e.kind === "expense")
                  .map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      onEdit={onEdit}
                      onPay={onPay}
                    />
                  ))}
              </>
            )}
            {payments.some((e) => e.kind === "income") && (
              <>
                <div className="list-section-label">
                  ДОХОДЫ{" "}
                  <span>
                    {money(
                      payments
                        .filter((e) => e.kind === "income")
                        .reduce((s, e) => s + e.amount_cents, 0),
                    )}
                  </span>
                </div>
                {payments
                  .filter((e) => e.kind === "income")
                  .map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      onEdit={onEdit}
                      onPay={onPay}
                    />
                  ))}
              </>
            )}
          </>
        ) : (
          <Empty
            title="Новый месяц — новый план"
            body="Перенесите регулярные платежи одним нажатием. Доходы и разовые расходы можно добавить отдельно."
            action={
              <button
                className="button primary"
                disabled={busy}
                onClick={generate}
              >
                <Repeat2 size={16} />
                {busy ? "Создаём план…" : "Добавить регулярные платежи"}
              </button>
            }
          />
        )}
      </section>
      {month.plan?.note && <p className="source-note">{month.plan.note}</p>}
      <section className="panel opening-panel">
        <div>
          <h3>Начальный остаток в плане</h3>
          <p>
            Используется для прогноза месяца. Фактический баланс меняется только
            от реальных операций.
          </p>
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
      </section>
    </>
  );
}
