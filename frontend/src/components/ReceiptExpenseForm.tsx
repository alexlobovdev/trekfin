import { useState, type FormEvent } from "react";
import { Check, ChevronDown, RefreshCw, ScanLine, Trash2 } from "lucide-react";
import { api, amountInput, dateLabel, money } from "../api";
import type { Bootstrap, Entry, Receipt, ReceiptPreview } from "../types";
import { CategoryIcon, Modal } from "./ui";
import ReceiptDetails from "./ReceiptDetails";
import ReceiptScanner from "./ReceiptScanner";

export default function ReceiptExpenseForm({
  receipt: initialReceipt,
  preview,
  draft,
  data,
  userId,
  onClose,
  onSaved,
}: {
  receipt: Receipt;
  preview: ReceiptPreview | null;
  draft: Partial<Entry>;
  data: Bootstrap;
  userId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!draft.id;
  const [scanning, setScanning] = useState(false);
  const [receipt, setReceipt] = useState(initialReceipt);
  const [category, setCategory] = useState(String(draft.category_id || ""));
  const [author, setAuthor] = useState(String(draft.author_id || userId));
  const [title, setTitle] = useState(
    (draft.title || receipt.seller || "Покупка по чеку").slice(0, 120),
  );
  const [date, setDate] = useState(draft.date?.slice(0, 10) || receipt.date);
  const [note, setNote] = useState(draft.note || "");
  const [saving, setSaving] = useState(false),
    [loading, setLoading] = useState(false);
  const [error, setError] = useState(""),
    [loadError, setLoadError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const categories = data.categories.filter(
    (c) => c.kind === "expense" && (c.active || c.id === draft.category_id),
  );
  const [renewedPreview, setRenewedPreview] = useState<ReceiptPreview | null>(
    null,
  );
  const suggested = (renewedPreview || preview)?.suggested_category;
  const quickCategories = [...categories]
    .sort(
      (a, b) =>
        Number(b.id === suggested?.id) - Number(a.id === suggested?.id) ||
        Number(b.mode === "limit") - Number(a.mode === "limit"),
    )
    .slice(0, 6);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api(
        "entries" + (editing ? `/${draft.id}` : ""),
        editing ? "PUT" : "POST",
        {
          title: title.trim(),
          kind: "expense",
          state: "actual",
          category_id: category ? Number(category) : null,
          author_id: Number(author),
          amount: amountInput(receipt.total_cents),
          date,
          date_confirmed: true,
          note,
          receipt_token: (renewedPreview || preview)?.token,
          plan_id: draft.plan_id || null,
          debt_id: draft.debt_id || null,
          savings_goal_id: draft.savings_goal_id || null,
        },
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const refresh = async () => {
    setLoading(true);
    setLoadError("");
    try {
      if (editing)
        setReceipt(
          await api<Receipt>(`entries/${draft.id}/receipt/refresh`, "POST"),
        );
      else {
        const next = await api<ReceiptPreview>("receipts/preview", "POST", {
          qr: receipt.qr,
        });
        // A new preview also renews the signed data used when saving.
        setRenewedPreview(next);
        setReceipt(next);
        if (next.status === "pending")
          setLoadError(
            next.message || "Товары пока недоступны. Попробуйте позже.",
          );
      }
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const remove = async () => {
    setSaving(true);
    setError("");
    try {
      await api(`entries/${draft.id}`, "DELETE");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };
  if (scanning)
    return (
      <ReceiptScanner
        onClose={() => setScanning(false)}
        onScanned={(next) => {
          setReceipt(next);
          setRenewedPreview(next);
          setCategory("");
          setTitle((next.seller || "Покупка по чеку").slice(0, 120));
          setDate(next.date);
          setLoadError("");
          setError("");
          setScanning(false);
        }}
      />
    );
  return (
    <Modal
      title={editing ? "Расход по чеку" : "Сохранить чек"}
      onClose={onClose}
    >
      <form className="form receipt-expense-form" onSubmit={submit}>
        <div className="receipt-summary">
          <span className="receipt-success">
            <Check size={15} />
            {editing ? "Расход записан" : "Чек распознан"}
          </span>
          <strong className="receipt-amount">
            {money(receipt.total_cents, true)}
          </strong>
          <span className="receipt-merchant">{receipt.seller || title}</span>
          <small>
            {dateLabel(date)} {date.slice(0, 4)} ·{" "}
            {receipt.status === "loaded"
              ? `${receipt.purchases.length} позиций`
              : "Покупки ещё не загружены"}
          </small>
          {!editing && (
            <button
              type="button"
              className="text-button"
              disabled={saving || loading}
              onClick={() => setScanning(true)}
            >
              <ScanLine size={14} />
              Другой чек
            </button>
          )}
        </div>
        <div className="receipt-category-picker">
          <div className="receipt-field-heading">
            <strong>На что потратили?</strong>
            <span>Можно выбрать позже</span>
          </div>
          <div className="receipt-category-grid">
            {quickCategories.map((c) => (
              <button
                type="button"
                key={c.id}
                aria-pressed={category === String(c.id)}
                className={
                  "receipt-category-choice" +
                  (category === String(c.id) ? " selected" : "")
                }
                onClick={() => {
                  setCategory(category === String(c.id) ? "" : String(c.id));
                  setConfirmDelete(false);
                }}
              >
                <CategoryIcon category={c} />
                <span>{c.name}</span>
                {c.id === suggested?.id && <small>Предлагаем</small>}
              </button>
            ))}
          </div>
          <label className="receipt-category-select">
            <span className="sr-only">Категория расхода</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Выбрать из всех категорий</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {suggested && (
            <small className="receipt-help">
              Предлагаем «{suggested.name}» по вашим прошлым чекам этого
              магазина.
            </small>
          )}
          {editing && !category && (
            <span className="receipt-status-badge">
              Нужно выбрать категорию
            </span>
          )}
        </div>
        <fieldset className="person-fieldset">
          <legend>Кто оплатил</legend>
          <div className="person-options">
            {data.users.map((u) => (
              <button
                type="button"
                key={u.id}
                className={author === String(u.id) ? "selected" : ""}
                aria-pressed={author === String(u.id)}
                onClick={() => setAuthor(String(u.id))}
              >
                {u.name}
              </button>
            ))}
          </div>
        </fieldset>
        {receipt.status === "loaded" ? (
          <ReceiptDetails receipt={receipt} />
        ) : (
          <div className="receipt-pending" aria-live="polite">
            <div>
              <strong>
                {loading ? "Ищем покупки…" : "Товары можно загрузить позже"}
              </strong>
              <p>
                {loading
                  ? "Это может занять до 25 секунд. Сумма чека уже сохранена в форме."
                  : "Расход сохранится с полной суммой. Список покупок можно добавить в любой момент."}
              </p>
            </div>
            <button
              type="button"
              className="button"
              disabled={loading || saving}
              onClick={refresh}
            >
              <RefreshCw size={16} className={loading ? "spinning" : ""} />
              {loading ? "Загрузка…" : "Повторить загрузку"}
            </button>
            {loadError && (
              <p className="error" role="alert">
                {loadError}
              </p>
            )}
          </div>
        )}
        <details className="form-extra receipt-edit-details">
          <summary>
            Название, дата и комментарий
            <ChevronDown size={16} />
          </summary>
          <label>
            Название
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Дата
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Комментарий
            <textarea
              maxLength={2000}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Необязательно"
            />
          </label>
        </details>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {confirmDelete && (
          <div className="receipt-delete-confirm" role="alert">
            <strong>Удалить расход и все покупки?</strong>
            <p>Чек и его позиции будут удалены вместе с операцией.</p>
            <div>
              <button
                type="button"
                className="button"
                disabled={saving}
                onClick={() => setConfirmDelete(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="button danger"
                disabled={saving}
                onClick={remove}
              >
                Удалить всё
              </button>
            </div>
          </div>
        )}
        <div className="receipt-save-bar">
          {!confirmDelete && (
            <>
              <button
                type="submit"
                className="button primary"
                disabled={saving || loading}
              >
                {saving
                  ? "Сохраняем…"
                  : category
                    ? editing
                      ? "Сохранить изменения"
                      : "Сохранить расход"
                    : "Сохранить без категории"}
              </button>
              {!category && <small>Чек будет отмечен для разбора</small>}
            </>
          )}
          {editing && !confirmDelete && (
            <button
              type="button"
              className="danger-link"
              disabled={saving || loading}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={15} />
              Удалить расход
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
