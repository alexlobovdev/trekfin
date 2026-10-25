import { useState, type FormEvent, type ReactNode } from "react";
import { api, amountInput, today } from "../api";
import type { Entry, MoneyRecord, Person } from "../types";
import { Modal } from "./ui";

export default function MoneyRecordForm({
  title,
  endpoint,
  record,
  users,
  userId,
  onSaved,
  onClose,
  children,
  withdrawal = false,
  defaultWithdrawal = false,
  plans = [],
}: {
  title: string;
  endpoint: string;
  record?: MoneyRecord;
  users: Person[];
  userId: number;
  onSaved: () => void;
  onClose: () => void;
  children?: ReactNode;
  withdrawal?: boolean;
  defaultWithdrawal?: boolean;
  plans?: Entry[];
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const [kind, setKind] = useState(
    record?.kind === "income" || defaultWithdrawal ? "withdraw" : "deposit",
  );
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        endpoint,
        record ? "PUT" : "POST",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setBusy(true);
    try {
      await api(endpoint, "DELETE");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {children}
        {withdrawal && (
          <label>
            Операция
            <select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="deposit">Пополнить накопления</option>
              <option value="withdraw">Вернуть деньги из накоплений</option>
            </select>
          </label>
        )}
        {withdrawal && kind === "deposit" && plans.length > 0 && (
          <label>
            Связать с расходом в плане
            <select name="plan_id" defaultValue={record?.plan_id || ""}>
              <option value="">Вне плана</option>
              {plans
                .filter(
                  (p) =>
                    p.paid_cents < p.amount_cents || p.id === record?.plan_id,
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </select>
            <span className="form-hint">
              Плановое пополнение не уменьшит остаток повторно.
            </span>
          </label>
        )}
        <label className="amount-field">
          Сумма, ₽
          <input
            name="amount"
            required
            autoFocus
            inputMode="decimal"
            pattern="[0-9]+([.,][0-9]{1,2})?"
            placeholder="0"
            defaultValue={
              record ? amountInput(Math.abs(record.amount_cents)) : ""
            }
          />
        </label>
        <div className="form-grid">
          <label>
            Дата
            <input
              name="date"
              type="date"
              required
              max={withdrawal ? today() : undefined}
              defaultValue={record?.date?.slice(0, 10) || today()}
            />
          </label>
          <label>
            Кто вносит
            <select
              name="author_id"
              defaultValue={record?.author_id || record?.created_by || userId}
            >
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
            maxLength={1000}
            rows={2}
            defaultValue={record?.note || ""}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          {record && (
            <button
              type="button"
              className="danger-link"
              disabled={busy}
              onClick={remove}
            >
              {confirm ? "Подтвердить отмену" : "Отменить запись"}
            </button>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
