import { ArrowRight, CreditCard, Target, Trophy } from "lucide-react";
import { money } from "../api";
import type { Bootstrap, Month } from "../types";
import SavingsProgress, { GoalIcon } from "./SavingsProgress";
export default function GoalsDashboard({
  data,
  month,
  onNavigate,
}: {
  data: Bootstrap;
  month: Month;
  onNavigate: (page: string) => void;
}) {
  const goals = data.savings.filter((g) => !g.archived),
    total = goals.reduce((s, g) => s + g.saved_cents, 0),
    external = data.debts.filter((d) => !d.archived && d.type !== "internal"),
    owed = external.reduce(
      (s, d) => s + Math.max(0, d.amount_cents - d.paid_cents),
      0,
    );
  return (
    <div className="goals-dashboard">
      <section className="panel goals-dashboard-main">
        <div className="panel-title">
          <div>
            <h2>
              <Target size={18} />
              Накопления
            </h2>
            <p>
              {goals.length
                ? `Накоплено ${money(total)}` +
                  (month.totals.savings
                    ? ` · в этом месяце ${money(month.totals.savings)}`
                    : "")
                : "Пока нет целей"}
            </p>
          </div>
          <button className="text-button" onClick={() => onNavigate("goals")}>
            {goals.length ? "Все цели" : "Создать"} <ArrowRight size={15} />
          </button>
        </div>
        {goals.length ? (
          <div className="mini-goals">
            {goals.slice(0, 2).map((g) => (
              <button
                className="mini-goal"
                key={g.id}
                onClick={() => onNavigate("goals")}
              >
                <div>
                  <GoalIcon goal={g} />
                  <strong>{g.title}</strong>
                  {g.saved_cents >= g.target_cents && <Trophy size={16} />}
                </div>
                <SavingsProgress goal={g} compact />
              </button>
            ))}
          </div>
        ) : null}
      </section>
      <button className="panel debt-dashboard" onClick={() => onNavigate("debts")}>
        <span className="resource-symbol">
          <CreditCard size={21} />
        </span>
        <span>Долги</span>
        <strong>{money(owed)}</strong>
        <small>
          {external.length ? "Осталось вернуть" : "Пока нет долгов"}
        </small>
      </button>
    </div>
  );
}
