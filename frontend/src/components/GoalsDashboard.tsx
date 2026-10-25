import { ArrowRight, CreditCard, Plus, Target, Trophy } from "lucide-react";
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
    ),
    closed = goals.filter((g) => g.saved_cents >= g.target_cents).length;
  return (
    <div className="goals-dashboard">
      <section className="panel goals-dashboard-main">
        <div className="panel-title">
          <div>
            <h2>
              <Target size={18} />
              Наши накопления
            </h2>
            <p>
              {goals.length
                ? `Накоплено ${money(total)} · целей достигнуто: ${closed}`
                : "Мечты, которые мы приближаем вместе"}
            </p>
          </div>
          <button className="text-button" onClick={() => onNavigate("savings")}>
            Все цели <ArrowRight size={15} />
          </button>
        </div>
        {goals.length ? (
          <div className="mini-goals">
            {goals.slice(0, 2).map((g) => (
              <button
                className="mini-goal"
                key={g.id}
                onClick={() => onNavigate("savings")}
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
        ) : (
          <div className="goal-invitation">
            <span>
              <Target size={28} strokeWidth={1.4} />
            </span>
            <div>
              <strong>Пусть мечта станет целью</strong>
              <p>
                Задайте сумму, начните с небольшого взноса и отмечайте каждый
                пройденный этап.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => onNavigate("savings")}
            >
              <Plus size={16} />
              Создать цель
            </button>
          </div>
        )}
        {!!month.totals.savings && (
          <p className="resource-note">
            В {month.month} отложено с учётом возвратов:{" "}
            {money(month.totals.savings)}. Учтено в свободном остатке.
          </p>
        )}
      </section>
      <button
        className="panel debt-dashboard"
        onClick={() => onNavigate("debts")}
      >
        <span className="resource-symbol">
          <CreditCard size={21} />
        </span>
        <span>Долги и кредиты</span>
        <strong>{money(owed)}</strong>
        <small>
          {external.length
            ? "Осталось по внешним обязательствам"
            : "Добавьте кредит и отслеживайте погашение"}
        </small>
        <b>
          Управлять долгами <ArrowRight size={15} />
        </b>
      </button>
    </div>
  );
}
