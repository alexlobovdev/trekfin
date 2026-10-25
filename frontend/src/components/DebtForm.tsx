import { useState, type FormEvent } from "react";
import { api, amountInput } from "../api";
import type { Debt, Person } from "../types";
import { Modal } from "./ui";
export default function DebtForm({
  debt,
  users,
  userId,
  onClose,
  onSaved,
}: {
  debt?: Debt;
  users: Person[];
  userId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState(debt?.type || "loan"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget),
      v = Object.fromEntries(f);
    try {
      await api("debts" + (debt ? "/" + debt.id : ""), debt ? "PUT" : "POST", {
        ...v,
        type,
        archived: f.has("archived"),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={debt ? "Настроить долг или кредит" : "Новый долг или кредит"}
      onClose={onClose}
    >
      <form className="form" onSubmit={submit}>
        <label>
          Название
          <input
            name="title"
            required
            maxLength={120}
            placeholder="Например, кредит на машину"
            defaultValue={debt?.title}
          />
        </label>
        <label>
          Тип
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Debt["type"])}
          >
            <option value="loan">Кредит / рассрочка</option>
            <option value="debt">Внешний долг</option>
            <option value="internal">Расчёты внутри пары</option>
          </select>
        </label>
        <label>
          {type === "internal" ? "Кому возвращаем" : "Банк или кредитор"}
          <input
            name="creditor"
            maxLength={120}
            defaultValue={debt?.creditor || ""}
            placeholder="Имя или название"
          />
        </label>
        <div className="form-grid">
          <label>
            Всего к погашению, ₽
            <input
              name="amount"
              required
              inputMode="decimal"
              pattern="[0-9]+([.,][0-9]{1,2})?"
              defaultValue={debt ? amountInput(debt.amount_cents) : ""}
            />
          </label>
          <label>
            Погашено до учёта, ₽
            <input
              name="initial_paid"
              required
              inputMode="decimal"
              pattern="[0-9]+([.,][0-9]{1,2})?"
              defaultValue={amountInput(debt?.initial_paid_cents || 0)}
            />
          </label>
        </div>
        <p className="form-hint">
          В начальный прогресс внесите только то, чего ещё нет в истории
          операций. Для кредита укажите общую сумму, которую планируете вернуть,
          включая известную переплату.
        </p>
        <div className="form-grid">
          <label>
            Платёж в месяц, ₽
            <input
              name="monthly_payment"
              required
              inputMode="decimal"
              pattern="[0-9]+([.,][0-9]{1,2})?"
              defaultValue={amountInput(debt?.monthly_payment_cents || 0)}
            />
          </label>
          <label>
            День платежа
            <input
              name="payment_day"
              type="number"
              min={1}
              max={31}
              placeholder="Не задан"
              defaultValue={debt?.payment_day || ""}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Плановая дата закрытия
            <input
              type="date"
              name="due_date"
              defaultValue={debt?.due_date?.slice(0, 10) || ""}
            />
          </label>
          <label>
            Кто погашает
            <select name="author_id" defaultValue={debt?.author_id || userId}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Комментарий
          <textarea
            name="note"
            rows={2}
            maxLength={2000}
            defaultValue={debt?.note || ""}
          />
        </label>
        {debt && (
          <label className="check-label">
            <input
              type="checkbox"
              name="archived"
              defaultChecked={debt.archived}
            />
            Убрать в архив, сохранив историю
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? "Сохраняем…" : "Сохранить"}
        </button>
      </form>
    </Modal>
  );
}
