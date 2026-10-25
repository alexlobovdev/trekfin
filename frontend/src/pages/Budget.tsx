import { useState } from "react";
import {
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
          <span>Осталось сейчас</span>
          <strong>{money(t.balance)}</strong>
          <small>Полученные деньги минус оплаченные расходы</small>
        </div>
        <div className="pink-stat">
          <span>Останется к концу месяца</span>
          <strong>{money(t.forecast)}</strong>
          <small>
            {!plans.length ? "Добавьте план, чтобы учесть будущие расходы" : t.remaining_income === 0 && t.remaining_expense === 0
              ? "Все платежи оплачены, лимиты израсходованы"
              : `Ещё ожидается ${money(t.remaining_income)}, зарезервировано на расходы ${money(t.remaining_expense)}`}
          </small>
        </div>
        <div>
          <span>План на конец месяца</span>
          <strong>{money(t.planned_balance)}</strong>
          <small>Первоначальный ориентир. Реальные суммы могут отличаться.</small>
        </div>
      </div>
      <div className="info-banner">
        <CalendarDays size={20} />
        <p>
          Оплатили платёж из списка — нажмите ✓. Он сам появится в операциях.
          Сумму и дату оплаты можно поправить повторным нажатием на ✓.
          Обычные покупки просто добавляйте в операции — остаток лимита уменьшится сам.
        </p>
      </div>
      {error && <p className="error">{error}</p>}
      <section className="panel">
        <div className="panel-title budget-title">
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
          <div className="budget-actions">
            <button className="button secondary" disabled={busy} onClick={generate}>
              <Repeat2 size={16} />
              {busy ? "Добавляем…" : "Регулярные платежи"}
            </button>
            <button className="button secondary" onClick={onAdd}>
              <Plus size={16} />В план
            </button>
          </div>
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
      <details className="panel budget-explanation">
        <summary>Как посчитаны остатки</summary>
        <p>Получено за месяц: {money(t.income)}. Потрачено: {money(t.expense)}. Остаток прошлых месяцев: {money(t.actual_opening)}.</p>
        <p>В плане: доходы {money(t.planned_income)}, расходы {money(t.planned_expense)}, начальный остаток {money(opening)}.</p>
        <p>Прогноз учитывает записанные операции и ещё не оплаченные платежи с остатками лимитов. Поэтому при выполненном плане он совпадает с текущим остатком.</p>
        <div className="opening-panel">
        <div>
          <h3>Начальный остаток в плане</h3>
          <p>
            Используется для плана на конец месяца. Факт и прогноз учитывают
            остаток предыдущих фактических операций.
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
        </div>
      </details>
    </>
  );
}
