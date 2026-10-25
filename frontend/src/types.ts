export type Person = { id: number; name: string };
export type User = Person & { email: string; must_change_password: boolean };
export type Kind = "expense" | "income";
export type Category = {
  id: number;
  name: string;
  kind: Kind;
  icon: string;
  color: string;
  active: boolean;
};
export type Entry = {
  id: number;
  title: string;
  category_id: number;
  category: Category;
  author_id: number | null;
  author: Person | null;
  created_by: number;
  kind: Kind;
  state: "actual" | "planned";
  amount_cents: number;
  paid_cents: number;
  date: string;
  note: string | null;
  plan_id: number | null;
  source_key: string | null;
};
export type Recurring = {
  id: number;
  title: string;
  category_id: number;
  author_id: number | null;
  amount_cents: number;
  summer_cents: number | null;
  day: number;
  kind: Kind;
  active: boolean;
  note: string | null;
};
export type MonthPlan = {
  month: string;
  opening_cents: number;
  note: string | null;
};
export type Month = {
  month: string;
  plan: MonthPlan | null;
  entries: Entry[];
  totals: {
    planned_income: number;
    planned_expense: number;
    income: number;
    expense: number;
    balance: number;
  };
  by_author: (Person & { income: number; expense: number })[];
};
export type ImportReport = {
  sheets: string[];
  months: {
    month: string;
    income_cents: number;
    expense_cents: number;
    opening_cents: number;
    remaining_cents: number;
    source_remaining_cents: number;
  }[];
  notes: string[];
};
export type Bootstrap = {
  users: Person[];
  categories: Category[];
  recurrings: Recurring[];
  months: MonthPlan[];
  push_key: string;
  import: ImportReport | null;
};
export type Debt = {
  id: number;
  title: string;
  amount_cents: number;
  paid_cents: number;
  note: string;
  repayments: {
    id: number;
    amount_cents: number;
    date: string | null;
    note: string;
  }[];
};
export type Insight = {
  title: string;
  body: string;
  source: string;
  link: string;
  rates: { date: string; values: Record<string, number> } | null;
};
