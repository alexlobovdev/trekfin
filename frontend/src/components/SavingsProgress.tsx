import {
  Award,
  Gift,
  House,
  Plane,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { money } from "../api";
import type { SavingsGoal } from "../types";
export const goalIcons = {
  shield: ShieldCheck,
  plane: Plane,
  home: House,
  gift: Gift,
  sparkles: Sparkles,
};
export const goalPercent = (g: SavingsGoal) =>
  Math.min(100, Math.floor((g.saved_cents / g.target_cents) * 100));
export function GoalIcon({
  goal,
}: {
  goal: Pick<SavingsGoal, "icon" | "color">;
}) {
  const Icon = goalIcons[goal.icon as keyof typeof goalIcons] || Sparkles;
  return (
    <span
      className="resource-symbol"
      style={{ color: goal.color, background: goal.color + "14" }}
    >
      <Icon size={22} />
    </span>
  );
}
export default function SavingsProgress({
  goal,
  compact = false,
}: {
  goal: SavingsGoal;
  compact?: boolean;
}) {
  const percent = goalPercent(goal);
  return (
    <div
      className={"goal-progress " + (compact ? "compact" : "")}
      style={{ "--goal-color": goal.color } as React.CSSProperties}
    >
      <div className="goal-amount">
        <strong>{money(goal.saved_cents)}</strong>
        <span>из {money(goal.target_cents)}</span>
        <b>{percent >= 100 ? <Trophy size={20} /> : percent + "%"}</b>
      </div>
      <div className="progress-track">
        <i style={{ width: percent + "%", background: goal.color }} />
      </div>
      {!compact && (
        <div className="goal-milestones">
          {[25, 50, 75, 100].map((p) => (
            <span key={p} className={percent >= p ? "earned" : ""}>
              <Award size={16} />
              {p === 100 ? "Цель!" : p + "%"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
