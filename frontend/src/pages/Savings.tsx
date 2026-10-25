import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Plus,
  Settings2,
  Sparkles,
  Trophy,
} from "lucide-react";
import { dateLabel, money, today } from "../api";
import type { Bootstrap, MoneyRecord, SavingsGoal, Month } from "../types";
import { Avatar, Empty } from "../components/ui";
import SavingsForm from "../components/SavingsForm";
import MoneyRecordForm from "../components/MoneyRecordForm";
import SavingsProgress, {
  GoalIcon,
  goalPercent,
} from "../components/SavingsProgress";
export default function Savings({
  data,
  userId,
  onRefresh,
  month: selectedMonth,
}: {
  data: Bootstrap;
  userId: number;
  onRefresh: () => void;
  month: Month;
}) {
  const [editing, setEditing] = useState<SavingsGoal | "new" | null>(null),
    [movement, setMovement] = useState<{
      goal: SavingsGoal;
      record?: MoneyRecord;
      withdraw?: boolean;
    } | null>(null),
    [showArchive, setShowArchive] = useState(false);
  const active = data.savings.filter((g) => !g.archived),
    total = active.reduce((s, g) => s + g.saved_cents, 0),
    closed = active.filter((g) => g.saved_cents >= g.target_cents).length,
    month = today().slice(0, 7),
    added = data.savings
      .flatMap((g) => g.movements)
      .filter((m) => m.date?.startsWith(month))
      .reduce(
        (s, m) => s + (m.kind === "income" ? -m.amount_cents : m.amount_cents),
        0,
      );
  const saved = () => {
    setEditing(null);
    setMovement(null);
    onRefresh();
  };
  return (
    <>
      <div className="savings-hero">
        <div>
          <span className="eyebrow">МАЛЕНЬКИЕ ШАГИ К БОЛЬШИМ ПЛАНАМ</span>
          <h2>
            У каждой мечты есть начало<span>.</span>
          </h2>
          <p>
            Копите вместе, отмечайте этапы и наблюдайте, как цель становится
            ближе.
          </p>
        </div>
        <Sparkles size={60} strokeWidth={1} />
      </div>
      <div className="resource-stats">
        <div>
          <span>Накоплено в активных целях</span>
          <strong>{money(total)}</strong>
        </div>
        <div>
          <span>Изменение за этот месяц</span>
          <strong className={added >= 0 ? "positive" : ""}>
            {added > 0 ? "+" : ""}
            {money(added)}
          </strong>
        </div>
        <div>
          <span>Достигнуто целей</span>
          <strong>
            <Trophy size={22} />
            {closed}
            <small>из {active.length}</small>
          </strong>
        </div>
      </div>
      <div className="resource-toolbar">
        <label className="check-label">
          <input
            type="checkbox"
            checked={showArchive}
            onChange={(e) => setShowArchive(e.target.checked)}
          />
          Показывать архив
        </label>
        <button className="button primary" onClick={() => setEditing("new")}>
          <Plus size={17} />
          Новая цель
        </button>
      </div>
      <div className="resource-grid">
        {data.savings
          .filter((g) => showArchive || !g.archived)
          .map((g) => {
            const percent = goalPercent(g),
              remaining = Math.max(0, g.target_cents - g.saved_cents),
              months = g.due_date
                ? Math.max(
                    1,
                    (Number(g.due_date.slice(0, 4)) -
                      Number(month.slice(0, 4))) *
                      12 +
                      Number(g.due_date.slice(5, 7)) -
                      Number(month.slice(5, 7)) +
                      1,
                  )
                : 0;
            return (
              <section
                className={
                  "panel savings-card " +
                  (percent >= 100 ? "completed " : "") +
                  (g.archived ? "archived" : "")
                }
                key={g.id}
              >
                <div className="panel-title">
                  <div className="resource-card-title">
                    <GoalIcon goal={g} />
                    <div>
                      <span className="eyebrow">
                        {g.archived
                          ? "В АРХИВЕ"
                          : percent >= 100
                            ? "МЕЧТА СБЫЛАСЬ"
                            : percent >= 75
                              ? "ФИНИШНАЯ ПРЯМАЯ"
                              : percent >= 50
                                ? "ПОЛОВИНА ПУТИ"
                                : percent >= 25
                                  ? "ОТЛИЧНЫЙ РАЗГОН"
                                  : "НАЧАЛО ИСТОРИИ"}
                      </span>
                      <h2>{g.title}</h2>
                    </div>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={"Настроить цель " + g.title}
                    onClick={() => setEditing(g)}
                  >
                    <Settings2 size={19} />
                  </button>
                </div>
                <SavingsProgress goal={g} />
                <div className="goal-next-step">
                  {remaining ? (
                    <>
                      <span>
                        До цели осталось <strong>{money(remaining)}</strong>
                      </span>
                      {months > 0 && (
                        <small>
                          {g.due_date! < today()
                            ? "Срок цели прошёл — можно выбрать новую дату"
                            : `Ориентир: ${money(Math.ceil(remaining / months))} в месяц · до ${dateLabel(g.due_date!)} ${g.due_date!.slice(0, 4)}`}
                        </small>
                      )}
                    </>
                  ) : (
                    <span className="positive">
                      <Trophy size={16} />
                      Вы сделали это вместе!
                    </span>
                  )}
                </div>
                <div className="goal-actions">
                  <button
                    className="button primary"
                    disabled={g.archived}
                    onClick={() => setMovement({ goal: g })}
                  >
                    <Plus size={16} />
                    Пополнить
                  </button>
                  <button
                    className="button secondary"
                    disabled={g.archived || g.saved_cents <= 0}
                    onClick={() => setMovement({ goal: g, withdraw: true })}
                  >
                    <ArrowUpRight size={16} />
                    Снять
                  </button>
                </div>
                <details className="resource-history">
                  <summary>
                    История · {g.movements.length}
                    <ChevronDown size={15} />
                  </summary>
                  {g.opening_cents > 0 && (
                    <p className="form-hint">
                      До начала учёта накоплено {money(g.opening_cents)}
                    </p>
                  )}
                  {g.movements.map((m) => (
                    <button
                      className="ledger-row"
                      key={m.id}
                      onClick={() => setMovement({ goal: g, record: m })}
                    >
                      <Avatar
                        name={
                          data.users.find((u) => u.id === m.author_id)?.name ||
                          "?"
                        }
                        small
                      />
                      <span>
                        <strong>
                          {m.kind !== "income" ? "Пополнение" : "Снятие"} ·{" "}
                          {m.date ? dateLabel(m.date) : ""}
                        </strong>
                        <small>
                          {m.note ||
                            data.users.find((u) => u.id === m.author_id)?.name}
                        </small>
                      </span>
                      <b className={m.kind !== "income" ? "positive" : ""}>
                        {m.kind !== "income" ? "+" : ""}
                        {money(m.amount_cents)}
                      </b>
                    </button>
                  ))}
                  {!g.movements.length && (
                    <p className="form-hint">
                      Первый взнос откроет историю вашей цели.
                    </p>
                  )}
                </details>
                {g.note && <p className="resource-note">{g.note}</p>}
              </section>
            );
          })}
      </div>
      {!active.length && !showArchive && (
        <Empty
          title="О чём вы мечтаете?"
          body="Отпуск, подушка безопасности, новый дом — создайте первую цель и начните с любой суммы."
          action={
            <button
              className="button secondary"
              onClick={() => setEditing("new")}
            >
              <Plus size={16} />
              Создать цель
            </button>
          }
        />
      )}
      <div className="info-banner">
        <ArrowDownLeft size={20} />
        <p>
          Пополнение записывается расходом «Отложенное», снятие — доходом
          «Возврат из накоплений». Каждая запись меняет бюджет и прогресс цели.
        </p>
      </div>
      {editing && (
        <SavingsForm
          goal={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
      {movement && (
        <MoneyRecordForm
          title={
            movement.record
              ? "Изменить запись"
              : movement.withdraw
                ? "Взять из накоплений"
                : "Ещё ближе к мечте"
          }
          endpoint={`savings/${movement.goal.id}/movements${movement.record ? "/" + movement.record.id : ""}`}
          record={movement.record}
          users={data.users}
          userId={userId}
          onSaved={saved}
          onClose={() => setMovement(null)}
          withdrawal
          plans={selectedMonth.entries.filter(
            (e) =>
              e.state === "planned" &&
              e.kind === "expense" &&
              e.category.name === "Отложенное" &&
              (!e.savings_goal_id || e.savings_goal_id === movement.goal.id),
          )}
          defaultWithdrawal={movement.withdraw}
        >
          <p className="form-hint">
            {movement.goal.title} · накоплено {money(movement.goal.saved_cents)}
          </p>
        </MoneyRecordForm>
      )}
    </>
  );
}
