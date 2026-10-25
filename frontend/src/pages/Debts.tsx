import { useEffect, useState, type FormEvent } from "react";
import { Check, Handshake, Plus } from "lucide-react";
import { api, dateLabel, money, today } from "../api";
import type { Debt } from "../types";
import { Empty, Modal } from "../components/ui";
export default function Debts() {
  const [debts, setDebts] = useState<Debt[]>([]),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Debt | null>(null),
    [busy, setBusy] = useState(false);
  const load = () =>
    api<Debt[]>("debts")
      .then(setDebts)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      await api("debts/" + selected!.id + "/repay", "POST", f);
      setSelected(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {error && <p className="error">{error}</p>}
      {debts.map((d) => (
        <section className="panel debt-panel" key={d.id}>
          <div className="panel-title">
            <div className="debt-heading">
              <span className="category-icon">
                <Handshake size={22} />
              </span>
              <div>
                <h2>{d.title}</h2>
                <p>История из вашей таблицы</p>
              </div>
            </div>
            <button
              className="button secondary"
              disabled={d.paid_cents >= d.amount_cents}
              onClick={() => {
                setError("");
                setSelected(d);
              }}
            >
              <Plus size={16} />
              Возврат
            </button>
          </div>
          <div className="debt-stats">
            <div>
              <span>Осталось вернуть</span>
              <strong>{money(d.amount_cents - d.paid_cents)}</strong>
            </div>
            <div>
              <span>Уже возвращено</span>
              <strong className="positive">{money(d.paid_cents)}</strong>
            </div>
            <div>
              <span>Первоначальная сумма</span>
              <strong>{money(d.amount_cents)}</strong>
            </div>
          </div>
          <div className="progress-track">
            <i
              style={{
                width:
                  Math.min(100, (d.paid_cents / d.amount_cents) * 100) + "%",
              }}
            />
          </div>
          <p className="source-note">{d.note}</p>
          <div className="list-section-label">ИСТОРИЯ ВОЗВРАТОВ</div>
          {d.repayments.map((r) => (
            <div className="repayment-row" key={r.id}>
              <span className="paid-icon">
                <Check size={17} />
              </span>
              <div>
                <strong>
                  {r.date
                    ? dateLabel(r.date) + " " + r.date.slice(0, 4)
                    : "Дата не указана"}
                </strong>
                <p>{r.note}</p>
              </div>
              <strong className="positive">{money(r.amount_cents)}</strong>
            </div>
          ))}
        </section>
      ))}
      {!debts.length && !error && (
        <Empty
          title="Нет долгов"
          body="Здесь появится импортированная история возвратов."
        />
      )}
      {selected && (
        <Modal title="Записать возврат долга" onClose={() => setSelected(null)}>
          <form className="form" onSubmit={submit}>
            <p className="form-hint">
              Осталось {money(selected.amount_cents - selected.paid_cents)}.
              Возврат внутри пары не меняет семейные доходы и расходы.
            </p>
            <label>
              Сумма, ₽
              <input
                autoFocus
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                max={(selected.amount_cents - selected.paid_cents) / 100}
                required
              />
            </label>
            <label>
              Дата
              <input type="date" name="date" required defaultValue={today()} />
            </label>
            <label>
              Комментарий
              <textarea name="note" rows={2} />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="button primary full" disabled={busy}>
              {busy ? "Сохраняем…" : "Записать возврат"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
