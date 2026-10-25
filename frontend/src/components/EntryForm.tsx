import { useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Trash2 } from "lucide-react";
import { api, amountInput, today } from "../api";
import type { Bootstrap, Entry, Kind } from "../types";
import { Modal } from "./ui";
export type EntryDraft = Partial<Entry> & { paying?: boolean };
export default function EntryForm({
  draft,
  data,
  userId,
  month,
  onClose,
  onSaved,
}: {
  draft: EntryDraft;
  data: Bootstrap;
  userId: number;
  month: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const paying = !!draft.paying,
    editing = !!draft.id && !paying;
  const [kind, setKind] = useState<Kind>(draft.kind || "expense");
  const [state, setState] = useState(draft.state || "actual");
  const [category, setCategory] = useState(
    String(
      draft.category_id ||
        data.categories.find((c) => c.active && c.kind === kind)?.id ||
        "",
    ),
  );
  const [author, setAuthor] = useState(
    draft.author_id === null && draft.state === "planned" && !paying
      ? ""
      : String(draft.author_id || userId),
  );
  const [amount, setAmount] = useState(
    draft.amount_cents
      ? amountInput(
          paying
            ? Math.max(draft.amount_cents - (draft.paid_cents || 0), 0)
            : draft.amount_cents,
        )
      : "",
  );
  const [title, setTitle] = useState(draft.title || "");
  const [date, setDate] = useState(
    paying
      ? today()
      : draft.date?.slice(0, 10) ||
          (month === today().slice(0, 7) ? today() : month + "-01"),
  );
  const [note, setNote] = useState(paying ? "" : draft.note || "");
  const [dateConfirmed, setDateConfirmed] = useState(
    draft.date_confirmed ?? true,
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  const changeKind = (k: Kind) => {
    setKind(k);
    setCategory(
      String(data.categories.find((c) => c.active && c.kind === k)?.id || ""),
    );
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        "entries" + (editing ? "/" + draft.id : ""),
        editing ? "PUT" : "POST",
        {
          title,
          kind,
          state: paying ? "actual" : state,
          category_id: Number(category),
          author_id: author ? Number(author) : null,
          amount: amount.replace(",", "."),
          date,
          date_confirmed: paying || state === "actual" || dateConfirmed,
          note,
          plan_id: paying ? draft.id : draft.plan_id || null,
        },
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api("entries/" + draft.id, "DELETE");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={
        paying
          ? "Подтвердить платёж"
          : editing
            ? "Изменить запись"
            : state === "planned"
              ? "Добавить в план"
              : "Новая операция"
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="form">
        <div className="segmented">
          <button
            type="button"
            className={kind === "expense" ? "selected" : ""}
            disabled={paying}
            onClick={() => changeKind("expense")}
          >
            <ArrowUpRight size={16} />
            Расход
          </button>
          <button
            type="button"
            className={kind === "income" ? "selected" : ""}
            disabled={paying}
            onClick={() => changeKind("income")}
          >
            <ArrowDownLeft size={16} />
            Доход
          </button>
        </div>
        <label className="amount-field">
          Сумма, ₽
          <input
            autoFocus
            required
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            pattern="[0-9]+([.,][0-9]{1,2})?"
          />
        </label>
        <label>
          Описание
          <input
            required
            maxLength={120}
            placeholder={
              kind === "expense"
                ? "Например, продукты на неделю"
                : "Например, зарплата"
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Категория
            <select
              required
              disabled={paying}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {data.categories
                .filter(
                  (c) =>
                    (c.active || c.id === draft.category_id) && c.kind === kind,
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Дата
            <input
              required
              type="date"
              disabled={state === "planned" && !paying && !dateConfirmed}
              value={
                state === "planned" && !paying && !dateConfirmed ? "" : date
              }
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        {state === "planned" && !paying && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={dateConfirmed}
              onChange={(e) => setDateConfirmed(e.target.checked)}
            />
            Точная дата платежа известна
          </label>
        )}
        {state === "planned" && !paying && !dateConfirmed && (
          <p className="form-hint">
            Платёж останется в бюджете месяца без привязки к конкретному дню.
          </p>
        )}
        <fieldset className="person-fieldset">
          <legend>
            {state === "planned" && !paying
              ? "Для кого"
              : "Кто " + (kind === "expense" ? "потратил" : "получил")}
          </legend>
          <div className="person-options">
            {state === "planned" && !paying && (
              <button
                type="button"
                className={!author ? "selected" : ""}
                onClick={() => setAuthor("")}
              >
                Общие
              </button>
            )}
            {data.users.map((u) => (
              <button
                type="button"
                key={u.id}
                className={author === String(u.id) ? "selected" : ""}
                onClick={() => setAuthor(String(u.id))}
              >
                {u.name}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          Комментарий <span className="muted">· необязательно</span>
          <textarea
            rows={2}
            maxLength={2000}
            placeholder="Что стоит запомнить об этой операции?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {!editing && !paying && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={state === "planned"}
              onChange={(e) =>
                setState(e.target.checked ? "planned" : "actual")
              }
            />
            Это план на месяц
          </label>
        )}
        {paying && (
          <p className="form-hint">
            План сохранится. Создадим связанную фактическую операцию от
            выбранного автора.
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="form-actions">
          {editing && (
            <button
              type="button"
              className="danger-link"
              disabled={busy}
              onClick={() =>
                confirmDelete ? remove() : setConfirmDelete(true)
              }
            >
              <Trash2 size={16} />
              {confirmDelete ? "Подтвердить удаление" : "Удалить"}
            </button>
          )}
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Сохраняем…" : paying ? "Подтвердить" : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
