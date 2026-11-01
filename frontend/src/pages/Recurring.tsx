import { useState, type FormEvent } from "react";
import { Plus, Repeat2, Trash2 } from "lucide-react";
import { api, amountInput, money } from "../api";
import type { Bootstrap, Kind, Recurring as Rule } from "../types";
import { CategoryIcon, Modal } from "../components/ui";
export default function Recurring({
  data,
  onRefresh,
  onGenerate,
  busy,
}: {
  data: Bootstrap;
  onRefresh: () => void;
  onGenerate: () => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState<Partial<Rule> | null>(null),
    [error, setError] = useState("");
  const rules = data.recurrings.filter((r) => r.active);
  return (
    <>
      <section className="panel">
        <div className="panel-title budget-title">
          <div>
            <h2>Каждый месяц</h2>
            <p>
              {money(
                rules
                  .filter((r) => r.kind === "expense")
                  .reduce((s, r) => s + r.amount_cents, 0),
              )}{" "}
              расходов
            </p>
          </div>
          <div className="budget-actions">
            <button className="button secondary" disabled={busy} onClick={onGenerate}>
              <Repeat2 size={16} />
              {busy ? "Подставляем…" : "Подставить в этот месяц"}
            </button>
            <button className="button secondary" onClick={() => setEditing({})}>
              <Plus size={16} />
              Новый
            </button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        {rules.length ? (
          <div className="recurring-grid">
            {rules.map((r) => {
              const c = data.categories.find((c) => c.id === r.category_id);
              return (
                <button
                  key={r.id}
                  className="recurring-card panel"
                  onClick={() => setEditing(r)}
                >
                  <div>
                    <CategoryIcon category={c} />
                    <span className="quiet-pill">
                      {data.users.find((u) => u.id === r.author_id)?.name ||
                        "Общее"}
                    </span>
                  </div>
                  <h3>{r.title}</h3>
                  <strong>
                    {money(r.amount_cents)}
                    <small>/ мес.</small>
                  </strong>
                  <p>
                    {c?.name} · {r.day} числа
                  </p>
                  {r.summer_cents !== null && (
                    <span className="season-label">
                      Летом {money(r.summer_cents)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="section-hint">Пока нет шаблонов.</p>
        )}
        <p className="source-note">
          День шаблона не трогает уже оплаченные и вручную перенесённые даты
          этого месяца.
        </p>
      </section>
      {editing && (
        <RuleForm
          rule={editing}
          data={data}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onRefresh();
          }}
          onError={setError}
        />
      )}
    </>
  );
}
function RuleForm({
  rule,
  data,
  onClose,
  onSaved,
  onError,
}: {
  rule: Partial<Rule>;
  data: Bootstrap;
  onClose: () => void;
  onSaved: () => void;
  onError: (s: string) => void;
}) {
  const [kind, setKind] = useState<Kind>(rule.kind || "expense"),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setSaving(true);
    try {
      await api(
        "recurrings" + (rule.id ? "/" + rule.id : ""),
        rule.id ? "PUT" : "POST",
        {
          ...f,
          kind,
          amount: String(f.amount).replace(",", "."),
          summer: f.summer || null,
          author_id: f.author_id ? Number(f.author_id) : null,
          category_id: Number(f.category_id),
          day: Number(f.day),
          active: true,
        },
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };
  return (
    <Modal title={rule.id ? "Каждый месяц" : "Новый"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Название
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={rule.title}
            autoFocus
          />
        </label>
        <div className="form-grid">
          <label>
            Тип
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
            >
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
          </label>
          <label>
            Категория
            <select
              name="category_id"
              key={kind}
              defaultValue={rule.category_id}
            >
              {data.categories
                .filter((c) => c.active && c.kind === kind)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            Сумма, ₽
            <input
              name="amount"
              inputMode="decimal"
              required
              pattern="[0-9]+([.,][0-9]{1,2})?"
              defaultValue={
                rule.amount_cents ? amountInput(rule.amount_cents) : ""
              }
            />
          </label>
          <label>
            День
            <input
              name="day"
              type="number"
              min="1"
              max="31"
              required
              defaultValue={rule.day || 1}
            />
          </label>
        </div>
        <p className="form-hint">
          Если такого дня нет, платёж встанет на последний день. Разовую дату
          меняют в плане, истории или календаре. Новая сумма попадает в месяц
          при следующей подстановке.
        </p>
        <label>
          Кто
          <select name="author_id" defaultValue={rule.author_id || ""}>
            <option value="">Общее</option>
            {data.users.map((u) => (
              <option value={u.id} key={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Летний тариф, ₽{" "}
          <span className="muted">· если отличается, май–сентябрь</span>
          <input
            name="summer"
            type="number"
            min="0"
            step="0.01"
            defaultValue={
              rule.summer_cents !== null && rule.summer_cents !== undefined
                ? amountInput(rule.summer_cents)
                : ""
            }
          />
        </label>
        <label>
          Комментарий
          <textarea name="note" rows={2} defaultValue={rule.note || ""} />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          {rule.id && (
            <button
              type="button"
              className="danger-link"
              disabled={saving}
              onClick={async () => {
                if (!deleting) {
                  setDeleting(true);
                  return;
                }
                setSaving(true);
                try {
                  await api("recurrings/" + rule.id, "DELETE");
                  onSaved();
                } catch (e) {
                  onError((e as Error).message);
                  onClose();
                }
              }}
            >
              <Trash2 size={16} />
              {deleting ? "Убрать платёж?" : "Убрать"}
            </button>
          )}
          <button className="button primary" disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
