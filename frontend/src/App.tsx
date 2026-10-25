import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronRight,
  Heart,
  House,
  LayoutGrid,
  LogOut,
  Plus,
  Repeat2,
  Settings as SettingsIcon,
  Wallet,
  Handshake,
  Send,
  PiggyBank,
  Target,
} from "lucide-react";
import { api, ApiError, invalidateCsrf, today } from "./api";
import type { Bootstrap, Debt, Entry, Insight, Month, User } from "./types";
import { Avatar, MonthPicker } from "./components/ui";
import EntryForm, { type EntryDraft } from "./components/EntryForm";
import PushMessage from "./components/PushMessage";
import Calendar from "./pages/Calendar";
import Auth from "./pages/Auth";
import Overview from "./pages/Overview";
import Budget from "./pages/Budget";
import Transactions from "./pages/Transactions";
import Recurring from "./pages/Recurring";
import Debts from "./pages/Debts";
import Savings from "./pages/Savings";
import Settings from "./pages/Settings";
const pages = [
  { id: "overview", label: "Обзор", icon: House },
  { id: "budget", label: "Бюджет", icon: PiggyBank },
  { id: "calendar", label: "Календарь трат", icon: CalendarDays },
  { id: "transactions", label: "Операции", icon: Wallet },
  { id: "recurring", label: "Регулярные платежи", icon: Repeat2 },
  { id: "debts", label: "Долги и кредиты", icon: Handshake },
  { id: "savings", label: "Накопления", icon: Target },
  { id: "settings", label: "Настройки", icon: SettingsIcon },
];
const descriptions: Record<string, string> = {
  overview: "Всё важное о ваших деньгах — в одном месте",
  budget: "Спокойно планируем, осознанно тратим",
  calendar: "Траты по дням, важные платежи и вклад каждого",
  transactions: "Доходы, расходы и вклад каждого",
  recurring: "Один раз настроили — каждый месяц под рукой",
  debts: "Понятные суммы и прозрачная история",
  savings: "Приближаем мечты, отмечаем каждый шаг",
  settings: "Пусть Trekfin будет удобен именно вам",
};
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(true),
    [page, setPage] = useState("overview"),
    [month, setMonth] = useState(today().slice(0, 7)),
    [data, setData] = useState<Bootstrap | null>(null),
    [snapshot, setSnapshot] = useState<Month | null>(null),
    [insight, setInsight] = useState<Insight | null>(null),
    [draft, setDraft] = useState<EntryDraft | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [calendarDay, setCalendarDay] = useState(today()),
    [pushOpen, setPushOpen] = useState(false);
  const calendarDate = calendarDay.startsWith(month)
    ? calendarDay
    : month === today().slice(0, 7)
      ? today()
      : month + "-01";
  const sequence = useRef(0);
  useEffect(() => {
    api<{ user: User }>("me")
      .then((r) => setUser(r.user))
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401))
          setError("Не удалось связаться с сервером. Обновите страницу.");
      })
      .finally(() => setChecking(false));
  }, []);
  const fail = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) {
      setUser(null);
      setData(null);
      setSnapshot(null);
    } else setError((e as Error).message);
  }, []);
  const refresh = useCallback(async () => {
    if (!user || user.must_change_password) return;
    const id = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const [b, m] = await Promise.all([
        api<Bootstrap>("bootstrap"),
        api<Month>("month?month=" + month),
      ]);
      if (id === sequence.current) {
        setData(b);
        setSnapshot(m);
      }
    } catch (e) {
      if (id === sequence.current) fail(e);
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }, [user, month, fail]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (user && !user.must_change_password)
      api<Insight>("insight")
        .then(setInsight)
        .catch(() => {});
  }, [user]);
  useEffect(() => {
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  const navigate = (p: string) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const add = (planned = false) =>
    setDraft({
      state:
        planned || (page === "calendar" && calendarDate > today())
          ? "planned"
          : "actual",
      author_id: planned ? null : user!.id,
      ...(page === "calendar"
        ? { date: calendarDate, date_confirmed: true }
        : {}),
    });
  const pay = (e: Entry) => setDraft({ ...e, paying: true });
  const payDebt = (d: Debt) =>
    setDraft({
      state: "actual",
      kind: "expense",
      debt_id: d.id,
      title: "Платёж: " + d.title,
      author_id: d.author_id,
      date: today(),
      amount_cents: Math.min(
        d.monthly_payment_cents || d.amount_cents - d.paid_cents,
        d.amount_cents - d.paid_cents,
      ),
      category_id: data?.categories.find(
        (c) =>
          c.active &&
          c.kind === "expense" &&
          c.name === (d.type === "loan" ? "Кредиты" : "Долги"),
      )?.id,
    });
  const logout = async () => {
    try {
      await api("logout", "POST");
      invalidateCsrf();
      setUser(null);
      setData(null);
      setSnapshot(null);
    } catch (e) {
      fail(e);
    }
  };
  if (checking)
    return (
      <div className="loading-screen">
        <span className="logo-mark">
          t<span>•</span>
        </span>
        <div className="spinner" />
      </div>
    );
  if (!user || user.must_change_password)
    return <Auth user={user || undefined} onUser={setUser} />;
  const active = pages.find((p) => p.id === page)!;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <span className="logo-mark">
            t<span>•</span>
          </span>
          trekfin<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">
          <span className="workspace-icon">
            <Heart size={17} />
          </span>
          <div>
            <strong>Наши финансы</strong>
            <small>Личное пространство</small>
          </div>
        </div>
        <span className="nav-label">ВАШЕ ПРОСТРАНСТВО</span>
        <nav>
          {pages.map((p) => (
            <button
              key={p.id}
              className={page === p.id ? "active" : ""}
              onClick={() => navigate(p.id)}
            >
              <p.icon size={19} strokeWidth={1.7} />
              {p.label}
              {page === p.id && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-heart">
            <Heart size={20} strokeWidth={1.5} />
          </span>
          <strong>Вместе проще</strong>
          <p>
            Два человека.
            <br />
            Один взгляд на финансы.
          </p>
          <div className="mini-avatars">
            {(data?.users || []).map((u) => (
              <Avatar name={u.name} key={u.id} small />
            ))}
          </div>
        </div>
        <button
          className="sidebar-profile"
          onClick={logout}
          title="Выйти из аккаунта"
        >
          <Avatar name={user.name} />
          <div>
            <strong>{user.name}</strong>
            <span>Выйти из аккаунта</span>
          </div>
          <LogOut size={16} />
        </button>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Наши финансы</span>
            <ChevronRight size={13} />
            <strong>{active.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className="for-two">ДЛЯ ДВОИХ</span>
            <div className="mini-avatars">
              {(data?.users || []).map((u) => (
                <Avatar name={u.name} key={u.id} small />
              ))}
            </div>
            <span className="top-divider" />
            <button
              className="send-push-button"
              aria-label="Отправить пуш"
              title="Отправить пуш второму участнику"
              onClick={() => setPushOpen(true)}
            >
              <Send size={17} />
              <span>Отправить пуш</span>
            </button>
            <button
              className="icon-button notification-button"
              aria-label="Настройки уведомлений"
              onClick={() => navigate("settings")}
            >
              <Bell size={20} />
              <span />
            </button>
            <button
              className="mobile-logout icon-button"
              aria-label="Выйти"
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <div
          className={
            "content " + (page === "calendar" ? "calendar-content" : "")
          }
        >
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "overview"
                  ? "ВАШ ОБЩИЙ БЮДЖЕТ"
                  : "TREKFIN · ДЛЯ ДВОИХ"}
              </div>
              <h1>
                {page === "overview" ? "Финансы без суеты" : active.label}
                <span className="heading-dot">.</span>
              </h1>
              <p>{descriptions[page]}</p>
            </div>
            <div className="heading-actions">
              {["overview", "budget", "transactions", "calendar"].includes(
                page,
              ) && <MonthPicker month={month} onChange={setMonth} />}
              {!["debts", "savings"].includes(page) && (
                <button
                  className="button primary add-main"
                  onClick={() => add(page === "budget")}
                >
                  <Plus size={18} />
                  <span>
                    {page === "budget"
                      ? "Добавить в план"
                      : "Добавить операцию"}
                  </span>
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="error error-banner" role="alert">
              <span>{error}</span>
              <button className="text-button" onClick={refresh}>
                Повторить
              </button>
            </div>
          )}
          {loading && <div className="loading-line" />}
          {data && snapshot ? (
            <div
              className={loading ? "page-content refreshing" : "page-content"}
            >
              {page === "overview" && (
                <Overview
                  month={snapshot}
                  data={data}
                  insight={insight}
                  onEdit={setDraft}
                  onPay={pay}
                  onAdd={() => add()}
                  onNavigate={navigate}
                />
              )}{" "}
              {page === "budget" && (
                <Budget
                  month={snapshot}
                  data={data}
                  onEdit={setDraft}
                  onPay={pay}
                  onAdd={() => add(true)}
                  onRefresh={refresh}
                  onMonth={setMonth}
                />
              )}{" "}
              {page === "transactions" && (
                <Transactions
                  month={snapshot}
                  data={data}
                  onEdit={setDraft}
                  onAdd={() => add()}
                />
              )}{" "}
              {page === "calendar" && (
                <Calendar
                  month={snapshot}
                  data={data}
                  selected={calendarDate}
                  onSelect={setCalendarDay}
                  onMonth={setMonth}
                  onEdit={setDraft}
                  onPay={pay}
                  onAdd={(date, author) =>
                    setDraft({
                      date,
                      date_confirmed: true,
                      state: date > today() ? "planned" : "actual",
                      author_id: author ?? user.id,
                    })
                  }
                />
              )}
              {page === "recurring" && (
                <Recurring data={data} onRefresh={refresh} />
              )}{" "}
              {page === "debts" && (
                <Debts
                  data={data}
                  userId={user.id}
                  onRefresh={refresh}
                  onEdit={setDraft}
                  onPay={payDebt}
                />
              )}{" "}
              {page === "savings" && (
                <Savings
                  data={data}
                  month={snapshot}
                  userId={user.id}
                  onRefresh={refresh}
                />
              )}{" "}
              {page === "settings" && (
                <Settings
                  data={data}
                  user={user}
                  onRefresh={refresh}
                  onNavigate={navigate}
                />
              )}
            </div>
          ) : (
            !error && (
              <div className="page-loading">
                <div className="spinner" />
                <p>Собираем ваш бюджет…</p>
              </div>
            )
          )}
        </div>
      </main>
      <nav className="bottom-nav">
        <button
          className={page === "overview" ? "active" : ""}
          onClick={() => navigate("overview")}
        >
          <LayoutGrid size={21} />
          <span>Обзор</span>
        </button>
        <button
          className={page === "budget" ? "active" : ""}
          onClick={() => navigate("budget")}
        >
          <PiggyBank size={21} />
          <span>Бюджет</span>
        </button>
        <button
          className={page === "calendar" ? "active" : ""}
          onClick={() => navigate("calendar")}
        >
          <CalendarDays size={21} />
          <span>Календарь</span>
        </button>
        <button
          className="mobile-add"
          onClick={() => add(page === "budget")}
          aria-label="Добавить операцию"
        >
          <Plus size={25} />
        </button>
        <button
          className={page === "transactions" ? "active" : ""}
          onClick={() => navigate("transactions")}
        >
          <Wallet size={21} />
          <span>Операции</span>
        </button>
        <button
          className={
            ["settings", "recurring", "debts", "savings"].includes(page)
              ? "active"
              : ""
          }
          onClick={() => navigate("settings")}
        >
          <SettingsIcon size={21} />
          <span>Ещё</span>
        </button>
      </nav>
      {draft && data && (
        <EntryForm
          draft={draft}
          data={data}
          userId={user.id}
          month={month}
          plans={
            snapshot?.entries.filter(
              (e) => e.state === "planned" && e.kind === "expense",
            ) || []
          }
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            void refresh();
          }}
        />
      )}
      {pushOpen && <PushMessage onClose={() => setPushOpen(false)} />}
    </div>
  );
}
