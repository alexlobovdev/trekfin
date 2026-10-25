import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CreditCard,
  Handshake,
  Plus,
  Settings2,
} from "lucide-react";
import { dateLabel, money } from "../api";
import type { Bootstrap, Debt, Entry, MoneyRecord } from "../types";
import { Avatar, Empty, EntryRow } from "../components/ui";
import DebtForm from "../components/DebtForm";
import MoneyRecordForm from "../components/MoneyRecordForm";
export const debtTypes = {
  loan: "Кредит / рассрочка",
  debt: "Внешний долг",
  internal: "Внутри пары",
};
export default function Debts({
  data,
  userId,
  onRefresh,
  onEdit,
  onPay,
}: {
  data: Bootstrap;
  userId: number;
  onRefresh: () => void;
  onEdit: (e: Entry) => void;
  onPay: (d: Debt) => void;
}) {
  const [editing, setEditing] = useState<Debt | "new" | null>(null),
    [payment, setPayment] = useState<{
      debt: Debt;
      record?: MoneyRecord;
    } | null>(null),
    [showArchive, setShowArchive] = useState(false),
    [filter, setFilter] = useState("all");
  const active = data.debts.filter((d) => !d.archived),
    debts = data.debts.filter(
      (d) =>
        (showArchive || !d.archived) &&
        (filter === "all" ||
          (filter === "closed"
            ? d.paid_cents >= d.amount_cents
            : d.type === filter)),
    );
  const total = active.reduce((s, d) => s + d.amount_cents, 0),
    paid = active.reduce((s, d) => s + d.paid_cents, 0),
    monthly = active
      .filter((d) => d.paid_cents < d.amount_cents)
      .reduce((s, d) => s + d.monthly_payment_cents, 0);
  const saved = () => {
    setEditing(null);
    setPayment(null);
    onRefresh();
  };
  return (
    <>
      <div className="resource-toolbar">
        <div className="resource-tabs">
          {[
            ["all", "Все"],
            ["loan", "Кредиты"],
            ["debt", "Долги"],
            ["internal", "Внутри пары"],
            ["closed", "Закрытые"],
          ].map(([v, l]) => (
            <button
              key={v}
              className={filter === v ? "selected" : ""}
              onClick={() => setFilter(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <button className="button primary" onClick={() => setEditing("new")}>
          <Plus size={17} />
          Добавить долг
        </button>
      </div>
      <div className="resource-stats">
        <div>
          <span>Осталось погасить</span>
          <strong>{money(total - paid)}</strong>
        </div>
        <div>
          <span>Уже погашено</span>
          <strong className="positive">{money(paid)}</strong>
        </div>
        <div>
          <span>Ориентир в месяц</span>
          <strong>{money(monthly)}</strong>
        </div>
      </div>
      <label className="check-label resource-archive">
        <input
          type="checkbox"
          checked={showArchive}
          onChange={(e) => setShowArchive(e.target.checked)}
        />
        Показывать архив
      </label>
      <div className="resource-grid">
        {debts.map((d) => {
          const remaining = Math.max(0, d.amount_cents - d.paid_cents),
            percent = Math.min(
              100,
              Math.round((d.paid_cents / d.amount_cents) * 100),
            );
          return (
            <section
              className={
                "panel debt-card " +
                (!remaining ? "completed " : "") +
                (d.archived ? "archived" : "")
              }
              key={d.id}
            >
              <div className="panel-title">
                <div className="resource-card-title">
                  <span className="resource-symbol">
                    {d.type === "loan" ? (
                      <CreditCard size={22} />
                    ) : (
                      <Handshake size={22} />
                    )}
                  </span>
                  <div>
                    <span className="eyebrow">
                      {d.archived ? "В АРХИВЕ" : debtTypes[d.type]}
                    </span>
                    <h2>{d.title}</h2>
                    <p>
                      {d.creditor ||
                        data.users.find((u) => u.id === d.author_id)?.name}
                    </p>
                  </div>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setEditing(d)}
                  aria-label={"Настроить " + d.title}
                >
                  <Settings2 size={19} />
                </button>
              </div>
              <div className="debt-remaining">
                <span>{remaining ? "Осталось вернуть" : "Долг закрыт"}</span>
                <strong>
                  {remaining ? (
                    money(remaining)
                  ) : (
                    <>
                      <Check size={25} />
                      Готово!
                    </>
                  )}
                </strong>
                <small>из {money(d.amount_cents)}</small>
              </div>
              <div className="resource-progress-label">
                <span>Погашено {money(d.paid_cents)}</span>
                <strong>{percent}%</strong>
              </div>
              <div className="progress-track">
                <i style={{ width: percent + "%" }} />
              </div>
              <div className="debt-terms">
                {!!d.monthly_payment_cents && (
                  <span>
                    {money(d.monthly_payment_cents)} / мес.
                    {d.payment_day ? ` · ${d.payment_day} числа` : ""}
                  </span>
                )}
                {d.due_date && (
                  <span>
                    До {dateLabel(d.due_date)} {d.due_date.slice(0, 4)}
                  </span>
                )}
              </div>
              <button
                className="button primary full"
                disabled={!remaining || d.archived}
                onClick={() =>
                  d.type === "internal" ? setPayment({ debt: d }) : onPay(d)
                }
              >
                <Plus size={17} />
                {d.type === "internal" ? "Записать возврат" : "Внести платёж"}
              </button>
              <details className="resource-history">
                <summary>
                  История · {d.entries.length + d.repayments.length}{" "}
                  <ChevronDown size={15} />
                </summary>
                {d.initial_paid_cents > 0 && (
                  <p className="form-hint">
                    До начала учёта погашено {money(d.initial_paid_cents)}
                  </p>
                )}
                {d.entries.map((e) => (
                  <EntryRow key={"e" + e.id} entry={e} onEdit={onEdit} />
                ))}
                {d.repayments.map((r) => (
                  <button
                    className="ledger-row"
                    key={"r" + r.id}
                    onClick={() => setPayment({ debt: d, record: r })}
                  >
                    <Avatar
                      name={
                        data.users.find(
                          (u) => u.id === (r.author_id || r.created_by),
                        )?.name || "?"
                      }
                      small
                    />
                    <span>
                      <strong>
                        {r.date
                          ? dateLabel(r.date) + " " + r.date.slice(0, 4)
                          : "Дата не указана"}
                      </strong>
                      <small>{r.note || "Возврат внутри пары"}</small>
                    </span>
                    <b>{money(r.amount_cents)}</b>
                  </button>
                ))}
                {!d.entries.length && !d.repayments.length && (
                  <p className="form-hint">
                    Запишите первый платёж — здесь появится история.
                  </p>
                )}
              </details>
              {d.note && <p className="resource-note">{d.note}</p>}
            </section>
          );
        })}
      </div>
      {!debts.length && (
        <Empty
          title="Здесь пока спокойно"
          body="Добавьте кредит, внешний долг или расчёты между вами. Суммы и начальный прогресс можно настроить."
          action={
            <button
              className="button secondary"
              onClick={() => setEditing("new")}
            >
              <Plus size={16} />
              Добавить долг
            </button>
          }
        />
      )}
      <p className="source-note">
        <ArrowUpRight size={13} />
        Внешние платежи — расходы семьи. Возвраты внутри пары учитываются
        отдельно. Месячный платёж — ориентир; операции в бюджете появляются
        после добавления.
      </p>
      {editing && (
        <DebtForm
          debt={editing === "new" ? undefined : editing}
          users={data.users}
          userId={userId}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
      {payment && (
        <MoneyRecordForm
          title={payment.record ? "Изменить возврат" : "Записать возврат"}
          endpoint={`debts/${payment.debt.id}/repay${payment.record ? "/" + payment.record.id : ""}`}
          record={payment.record}
          users={data.users}
          userId={userId}
          onSaved={saved}
          onClose={() => setPayment(null)}
        >
          <p className="form-hint">
            {payment.debt.title}. Возврат внутри пары не меняет расходы семьи.
          </p>
        </MoneyRecordForm>
      )}
    </>
  );
}
