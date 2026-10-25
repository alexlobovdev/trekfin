import { useState, type FormEvent } from "react";
import { api, amountInput } from "../api";
import type { SavingsGoal } from "../types";
import { goalIcons } from "./SavingsProgress";
import { Modal } from "./ui";
export default function SavingsForm({
  goal,
  onClose,
  onSaved,
}: {
  goal?: SavingsGoal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [color, setColor] = useState(goal?.color || "#d3437b"),
    [icon, setIcon] = useState(goal?.icon || "sparkles"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api(
        "savings" + (goal ? "/" + goal.id : ""),
        goal ? "PUT" : "POST",
        { ...Object.fromEntries(f), color, icon, archived: f.has("archived") },
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={goal ? "Настроить цель" : "Новая цель накоплений"}
      onClose={onClose}
    >
      <form className="form" onSubmit={submit}>
        <label>
          На что копим
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={goal?.title}
            placeholder="Например, отпуск вдвоём"
          />
        </label>
        <div className="goal-customize">
          <div className="icon-options" role="group" aria-label="Значок цели">
            {Object.entries(goalIcons).map(([key, Icon]) => (
              <button
                type="button"
                aria-label={
                  {
                    shield: "Резерв",
                    plane: "Путешествие",
                    home: "Дом",
                    gift: "Подарок",
                    sparkles: "Мечта",
                  }[key]
                }
                aria-pressed={icon === key}
                className={icon === key ? "selected" : ""}
                key={key}
                onClick={() => setIcon(key)}
              >
                <Icon size={20} />
              </button>
            ))}
          </div>
          <label className="color-control">
            Цвет
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Сумма цели, ₽
            <input
              name="target"
              required
              inputMode="decimal"
              pattern="[0-9]+([.,][0-9]{1,2})?"
              defaultValue={goal ? amountInput(goal.target_cents) : ""}
            />
          </label>
          <label>
            Уже отложено до учёта, ₽
            <input
              name="opening"
              required
              inputMode="decimal"
              pattern="[0-9]+([.,][0-9]{1,2})?"
              defaultValue={amountInput(goal?.opening_cents || 0)}
            />
          </label>
        </div>
        <p className="form-hint">
          Начальная сумма — ваши прежние накопления. Для новых пополнений
          используйте кнопку «Пополнить», чтобы записать расход «Отложенное» в
          бюджете.
        </p>
        <label>
          К какой дате
          <input
            name="due_date"
            type="date"
            defaultValue={goal?.due_date?.slice(0, 10) || ""}
          />
        </label>
        <label>
          Зачем нам эта цель
          <textarea
            name="note"
            rows={2}
            maxLength={2000}
            defaultValue={goal?.note || ""}
            placeholder="Что изменится, когда мечта сбудется?"
          />
        </label>
        {goal && (
          <label className="check-label">
            <input
              type="checkbox"
              name="archived"
              defaultChecked={goal.archived}
            />
            Убрать цель в архив, сохранив накопления и историю
          </label>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? "Сохраняем…" : "Сохранить цель"}
        </button>
      </form>
    </Modal>
  );
}
