import { useState } from "react";
import type { Bootstrap, Debt, Entry, Month } from "../types";
import Debts from "./Debts";
import Savings from "./Savings";
export default function Goals({
  data,
  month,
  userId,
  section,
  onSection,
  onRefresh,
  onEdit,
  onPay,
}: {
  data: Bootstrap;
  month: Month;
  userId: number;
  section: "savings" | "debts";
  onSection: (section: "savings" | "debts") => void;
  onRefresh: () => void;
  onEdit: (e: Entry) => void;
  onPay: (d: Debt) => void;
}) {
  const [archive, setArchive] = useState(false);
  return (
    <>
      <div className="resource-toolbar">
        <div className="resource-tabs">
          <button
            className={section === "savings" ? "selected" : ""}
            onClick={() => onSection("savings")}
          >
            Накопления
          </button>
          <button
            className={section === "debts" ? "selected" : ""}
            onClick={() => onSection("debts")}
          >
            Долги
          </button>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={archive}
            onChange={(e) => setArchive(e.target.checked)}
          />
          Архив
        </label>
      </div>
      {section === "savings" ? (
        <Savings
          data={data}
          month={month}
          userId={userId}
          showArchive={archive}
          onRefresh={onRefresh}
        />
      ) : (
        <Debts
          data={data}
          userId={userId}
          showArchive={archive}
          onRefresh={onRefresh}
          onEdit={onEdit}
          onPay={onPay}
        />
      )}
    </>
  );
}
