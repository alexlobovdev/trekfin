import { useEffect, useRef, type ReactNode } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingBasket,
  BriefcaseBusiness,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  CreditCard,
  Handshake,
  House,
  ReceiptText,
  Utensils,
  Wallet,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import type { Category, Entry } from "../types";
import { dateLabel, money, monthLabel } from "../api";
export function CategoryIcon({
  category,
}: {
  category?: Pick<Category, "color" | "icon">;
}) {
  const icons: Record<string, typeof Wallet> = {
    home: House,
    zap: Zap,
    wifi: Wifi,
    car: Car,
    basket: ShoppingBasket,
    utensils: Utensils,
    coffee: Coffee,
    activity: Activity,
    "credit-card": CreditCard,
    handshake: Handshake,
    receipt: ReceiptText,
    briefcase: BriefcaseBusiness,
    wallet: Wallet,
  };
  const Icon = icons[category?.icon || "wallet"] || Wallet;
  return (
    <span
      className="category-icon"
      style={{
        color: category?.color || "#d3437b",
        background: (category?.color || "#d3437b") + "14",
      }}
    >
      <Icon size={19} strokeWidth={1.7} />
    </span>
  );
}
export function Avatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  return (
    <span
      className={
        "avatar " +
        (name.startsWith("В") ? "violet" : "rose") +
        (small ? " small" : "")
      }
    >
      {name.slice(0, 1)}
    </span>
  );
}
export function MonthPicker({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  const shift = (n: number) => {
    const d = new Date(month + "-15T12:00:00");
    d.setMonth(d.getMonth() + n);
    onChange(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
  };
  return (
    <div className="month-picker">
      <button
        className="icon-button"
        onClick={() => shift(-1)}
        aria-label="Предыдущий месяц"
      >
        <ChevronLeft size={17} />
      </button>
      <label>
        <span>{monthLabel(month)}</span>
        <input
          type="month"
          aria-label="Выбрать месяц"
          value={month}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
      </label>
      <button
        className="icon-button"
        onClick={() => shift(1)}
        aria-label="Следующий месяц"
      >
        <ChevronRight size={17} />
      </button>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    ref.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="icon-button"
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Wallet size={25} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
export function EntryRow({
  entry,
  onEdit,
  onPay,
}: {
  entry: Entry;
  onEdit: (e: Entry) => void;
  onPay?: (e: Entry) => void;
}) {
  const planned = entry.state === "planned",
    paid = planned && entry.paid_cents >= entry.amount_cents;
  return (
    <div className="entry-row">
      <button className="entry-main" onClick={() => onEdit(entry)}>
        <CategoryIcon category={entry.category} />
        <span className="entry-copy">
          <strong>{entry.title}</strong>
          <span>
            {entry.category.name}
            <i />{" "}
            {planned && entry.source_key?.startsWith("import:")
              ? "Этот месяц"
              : dateLabel(entry.date)}
          </span>
        </span>
      </button>
      <div className="entry-tail">
        <strong className={entry.kind === "income" ? "positive" : ""}>
          {entry.kind === "income" ? "+" : planned ? "" : "−"}
          {money(entry.amount_cents)}
        </strong>
        <span>
          {entry.author ? (
            <>
              <span
                className={
                  "author-dot " +
                  (entry.author.name.startsWith("В") ? "violet" : "rose")
                }
              />
              {entry.author.name}
            </>
          ) : (
            "Общие"
          )}
        </span>
      </div>
      {planned && onPay && (
        <button
          className={"pay-button " + (paid ? "paid" : "")}
          disabled={paid}
          onClick={() => onPay(entry)}
          aria-label={paid ? "Оплачено" : "Подтвердить " + entry.title}
        >
          {paid ? <Check size={17} /> : <ArrowUpRight size={17} />}
        </button>
      )}
    </div>
  );
}
export function Stat({
  label,
  value,
  detail,
  income = false,
}: {
  label: string;
  value: number;
  detail: string;
  income?: boolean;
}) {
  const Icon = income ? ArrowDownLeft : ArrowUpRight;
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={"stat-icon " + (income ? "green" : "")}>
          <Icon size={18} />
        </span>
      </div>
      <strong>{money(value)}</strong>
      <small>{detail}</small>
    </div>
  );
}
