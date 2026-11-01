import { useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Trash2 } from "lucide-react";
import { api, amountInput, money, today } from "../api";
import type { Bootstrap, CategoryProgress, Entry, Kind } from "../types";
import { Modal } from "./ui";
export type EntryDraft = Partial<Entry> & { paying?: boolean };
export default function EntryForm({
  draft,
  data,
  userId,
  month,
  plans,
  progress,
  onClose,
  onSaved,
}: {
  draft: EntryDraft;
  data: Bootstrap;
  userId: number;
  month: string;
  plans: Entry[];
  progress: CategoryProgress[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const paying = !!draft.paying,
    editing = !!draft.id && !paying;
  const [kind, setKind] = useState<Kind>(draft.kind || "expense");
  const [state, setState] = useState<"actual" | "planned">(
    !paying && draft.state === "planned" ? "planned" : "actual",
  );
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
  const [debt, setDebt] = useState(String(draft.debt_id || ""));
  const [savings, setSavings] = useState(String(draft.savings_goal_id || ""));
  const linkedSaving =
    !!draft.savings_goal_id && (draft.state === "actual" || paying);
  const [linkedPlan, setLinkedPlan] = useState(String(draft.plan_id || ""));
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
    [confirmDelete, setConfirmDelete] = useState(false),
    [extraOpen, setExtraOpen] = useState(
      !!(
        draft.debt_id ||
        draft.savings_goal_id ||
        draft.note ||
        draft.plan_id ||
        (draft.state === "planned" && draft.date_confirmed === false) ||
        ["Отложенное", "Возврат из накоплений"].includes(
          data.categories.find((c) => c.id === draft.category_id)?.name || "",
        )
      ),
    );
  const selectedCategory = data.categories.find(
      (c) => c.id === Number(category),
    ),
    limitCategory = selectedCategory?.mode === "limit",
    limitRow = progress.find((c) => c.id === Number(category));
  const typedCents = (() => {
      const n = Number(amount.replace(",", "."));
      return Number.isFinite(n) ? Math.round(n * 100) : 0;
    })(),
    ownCents =
      editing &&
      draft.state === "actual" &&
      draft.category_id === Number(category)
        ? draft.amount_cents || 0
        : 0,
    nextActual =
      (limitRow?.actual_cents || 0) -
      ownCents +
      ((state === "actual" || paying) && amount.trim() ? typedCents : 0),
    limitPlanned = limitRow?.planned_cents || 0;
  const changeKind = (k: Kind) => {
    setKind(k);
    setDebt("");
    setSavings("");
    setLinkedPlan("");
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
          plan_id: paying ? draft.id : linkedPlan ? Number(linkedPlan) : null,
          debt_id: kind === "expense" && debt ? Number(debt) : null,
          savings_goal_id: savings ? Number(savings) : null,
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
  const savingsCategory = ["Отложенное", "Возврат из накоплений"].includes(
      selectedCategory?.name || "",
    ),
    planChoices = plans.filter(
      (p) =>
        p.category?.mode !== "limit" &&
        p.kind === kind &&
        (!p.debt_id || String(p.debt_id) === debt) &&
        (!p.savings_goal_id || String(p.savings_goal_id) === savings) &&
        p.paid_cents < p.amount_cents,
    );
  const pickPlan = (id: string) => {
    setLinkedPlan(id);
    const p = plans.find((item) => String(item.id) === id);
    if (!p) return;
    setCategory(String(p.category_id));
    setTitle(p.title);
    setAmount(amountInput(Math.max(0, p.amount_cents - p.paid_cents)));
    setAuthor(String(p.author_id || userId));
    setDebt(String(p.debt_id || ""));
    setSavings(String(p.savings_goal_id || ""));
    if (
      ["Отложенное", "Возврат из накоплений"].includes(p.category?.name || "")
    )
      setExtraOpen(true);
  };
  return (
    <Modal
      title={
        paying ? "Подтвердить платёж" : editing ? "Изменить запись" : "Записать"
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="form">
        <div className="segmented">
          <button
            type="button"
            className={state === "actual" ? "selected" : ""}
            disabled={paying || editing || linkedSaving}
            onClick={() => {
              setState("actual");
              if (!author) setAuthor(String(userId));
            }}
          >
            Уже произошло
          </button>
          <button
            type="button"
            className={state === "planned" ? "selected" : ""}
            disabled={paying || editing || linkedSaving}
            onClick={() => setState("planned")}
          >
            В плане
          </button>
        </div>
        <div className="segmented">
          <button
            type="button"
            className={kind === "expense" ? "selected" : ""}
            disabled={paying || linkedSaving}
            onClick={() => changeKind("expense")}
          >
            <ArrowUpRight size={16} />
            Расход
          </button>
          <button
            type="button"
            className={kind === "income" ? "selected" : ""}
            disabled={paying || linkedSaving}
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
          Категория
          <select
            required
            disabled={paying || linkedSaving}
            value={category}
            onChange={(e) => {
              const next = e.target.value;
              setCategory(next);
              if (!linkedSaving) setSavings("");
              setLinkedPlan("");
              const name = data.categories.find((c) => c.id === Number(next))?.name;
              if (["Отложенное", "Возврат из накоплений"].includes(name || ""))
                setExtraOpen(true);
            }}
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
        {limitCategory && (state === "actual" || paying) && (
          <p className="form-hint">
            {limitPlanned
              ? `В «${selectedCategory?.name}» будет ${money(nextActual)} из ${money(limitPlanned)}. ` +
                (nextActual > limitPlanned
                  ? `Выше лимита на ${money(nextActual - limitPlanned)}.`
                  : `Останется ${money(limitPlanned - nextActual)}.`)
              : `У «${selectedCategory?.name}» в этом месяце нет лимита. Добавьте сумму в план.`}
          </p>
        )}
        {limitCategory && state === "planned" && !paying && (
          <p className="form-hint">
            Эта сумма задаёт лимит категории, а не отдельный платёж.
          </p>
        )}
        <label>
          Название
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
        {!(state === "planned" && limitCategory) && (
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
        )}
        {draft.recurring_id && state === "planned" && !paying && (
          <p className="form-hint">
            Изменение даты перенесёт только этот платёж. День для остальных
            месяцев задаётся в «Каждый месяц».
          </p>
        )}
        <fieldset className="person-fieldset">
          <legend>Кто</legend>
          <div className="person-options">
            {state === "planned" && !paying && (
              <button
                type="button"
                className={!author ? "selected" : ""}
                onClick={() => setAuthor("")}
              >
                Общее
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
        <details
          className="form-extra"
          open={extraOpen}
          onToggle={(e) => setExtraOpen(e.currentTarget.open)}
        >
          <summary>Ещё</summary>
          <label>
            Комментарий <span className="muted">· необязательно</span>
            <textarea
              rows={2}
              maxLength={2000}
              placeholder="Что стоит запомнить"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {state === "actual" && !paying && !editing && planChoices.length > 0 && (
            <label>
              Платёж из плана
              <select
                value={linkedPlan}
                onChange={(e) => pickPlan(e.target.value)}
              >
                <option value="">Не связывать</option>
                {planChoices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · остаток {(p.amount_cents - p.paid_cents) / 100} ₽
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === "expense" &&
            !savings &&
            data.debts.some((d) => d.type !== "internal") && (
              <label>
                Долг
                <select
                  value={debt}
                  disabled={paying && !!draft.debt_id}
                  onChange={(e) => {
                    setDebt(e.target.value);
                    setLinkedPlan("");
                  }}
                >
                  <option value="">Не связано с долгом</option>
                  {data.debts
                    .filter(
                      (d) =>
                        d.type !== "internal" &&
                        (!d.archived || String(d.id) === debt),
                    )
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} · осталось{" "}
                        {(d.amount_cents - d.paid_cents) / 100} ₽
                      </option>
                    ))}
                </select>
              </label>
            )}
          {savingsCategory && data.savings.length > 0 && (
            <label>
              Цель
              <select
                value={savings}
                disabled={linkedSaving}
                onChange={(e) => {
                  setSavings(e.target.value);
                  if (e.target.value) setDebt("");
                  setLinkedPlan("");
                }}
              >
                <option value="">Без привязки к цели</option>
                {data.savings
                  .filter((g) => !g.archived || String(g.id) === savings)
                  .map((g) => (
                    <option value={g.id} key={g.id}>
                      {g.title}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {linkedSaving && (
            <p className="form-hint">
              Запись связана с целью. Изменение суммы обновит её прогресс.
            </p>
          )}
          {state === "planned" && !paying && !limitCategory && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={!dateConfirmed}
                onChange={(e) => setDateConfirmed(!e.target.checked)}
              />
              Точная дата неизвестна
            </label>
          )}
          {state === "planned" && !paying && !dateConfirmed && (
            <p className="form-hint">
              Платёж останется в плане месяца без привязки к конкретному дню.
            </p>
          )}
        </details>
        {paying && (
          <p className="form-hint">
            План сохранится. Появится запись, что это уже прошло.
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
