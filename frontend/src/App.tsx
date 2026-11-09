import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  Ellipsis,
  Heart,
  House,
  LogOut,
  Plus,
  Settings as SettingsIcon,
  Wallet,
  Send,
  PiggyBank,
  Target,
  ShoppingBasket,
} from "lucide-react";
import { api, ApiError, invalidateCsrf, money, monthLabel, today } from "./api";
import type { Bootstrap, Debt, Entry, Insight, Month, User } from "./types";
import { Avatar, MonthPicker } from "./components/ui";
import EntryForm, { type EntryDraft } from "./components/EntryForm";
import PushMessage from "./components/PushMessage";
import Calendar from "./pages/Calendar";
import Auth from "./pages/Auth";
import Overview from "./pages/Overview";
import Budget from "./pages/Budget";
import Purchases from "./pages/Purchases";
import Transactions from "./pages/Transactions";
import Goals from "./pages/Goals";
import Settings from "./pages/Settings";
const pages = [
  { id: "overview", label: "Обзор", icon: House },
  { id: "budget", label: "План", icon: PiggyBank },
  { id: "calendar", label: "Календарь", icon: CalendarDays },
  { id: "transactions", label: "История", icon: Wallet },
  { id: "purchases", label: "Покупки", icon: ShoppingBasket },
  { id: "goals", label: "Цели", icon: Target },
];
const labels: Record<string, string> = {
  overview: "Обзор",
  budget: "План",
  calendar: "Календарь",
  transactions: "История",
  purchases: "Покупки",
  goals: "Цели",
  settings: "Настройки",
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
    [receipt, setReceipt] = useState<Entry | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [calendarDay, setCalendarDay] = useState(today()),
    [pushOpen, setPushOpen] = useState(false),
    [moreOpen, setMoreOpen] = useState(false),
    [settingsTab, setSettingsTab] = useState("categories"),
    [goalsTab, setGoalsTab] = useState<"savings" | "debts">("savings");
  const calendarDate = calendarDay.startsWith(month)
    ? calendarDay
    : month === today().slice(0, 7)
      ? today()
      : month + "-01";
  const sequence = useRef(0);
  const paying = useRef(new Set<number>());
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
      setReceipt(null);
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
    if (p === "debts") {
      setGoalsTab("debts");
      p = "goals";
    } else if (p === "goals") setGoalsTab("savings");
    setPage(p);
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openSettings = (tab: string) => {
    setSettingsTab(tab);
    navigate("settings");
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
  const pay = async (e: Entry) => {
    if (e.paid_cents >= e.amount_cents) {
      const actual = snapshot?.entries.find((a) => a.state === "actual" && a.plan_id === e.id);
      if (actual) setDraft(actual);
      return;
    }
    if (paying.current.has(e.id)) return;
    paying.current.add(e.id);
    try {
      const actual = await api<Entry>("entries/" + e.id + "/pay", "POST");
      setReceipt(actual);
      await refresh();
    } catch (error) {
      fail(error);
    } finally {
      paying.current.delete(e.id);
    }
  };
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
  const monthTitle = monthLabel(month).replace(/^./, (letter) =>
    letter.toUpperCase(),
  );
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
        <button
          className={"sidebar-settings" + (page === "settings" ? " active" : "")}
          onClick={() => openSettings("categories")}
        >
          <SettingsIcon size={19} strokeWidth={1.7} />
          Настройки
          {page === "settings" && <span className="active-dot" />}
        </button>
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
          <div className="topbar-actions">
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
              aria-label="Уведомления"
              onClick={() => openSettings("notifications")}
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
            <h1>
              {page === "overview" ? monthTitle : labels[page]}
              <span className="heading-dot">.</span>
            </h1>
            <div className="heading-actions">
              {["overview", "budget", "transactions", "calendar", "purchases"].includes(
                page,
              ) && <MonthPicker month={month} onChange={setMonth} />}
              {!["goals", "settings"].includes(page) && (
                <button
                  className="button primary add-main"
                  onClick={() => add(page === "budget")}
                >
                  <Plus size={18} />
                  <span>Записать</span>
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
          {receipt && (
            <div className="info-banner payment-receipt" role="status">
              <span>✓ {receipt.kind === "income" ? "Доход записан" : "Оплата записана"}: {receipt.title} · {money(receipt.amount_cents)}</span>
              <button className="text-button" onClick={() => setDraft(receipt)}>Изменить сумму или дату</button>
              <button className="text-button" onClick={() => setReceipt(null)} aria-label="Скрыть сообщение об оплате">Скрыть</button>
            </div>
          )}
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
              {page === "purchases" && <Purchases month={snapshot} onEdit={setDraft} onScan={() => setDraft({ state: "actual", author_id: user.id, scan: true })} />}
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
              {page === "goals" && (
                <Goals
                  data={data}
                  month={snapshot}
                  userId={user.id}
                  section={goalsTab}
                  onSection={setGoalsTab}
                  onRefresh={refresh}
                  onEdit={setDraft}
                  onPay={payDebt}
                />
              )}{" "}
              {page === "settings" && (
                <Settings
                  data={data}
                  user={user}
                  tab={settingsTab}
                  onTab={setSettingsTab}
                  onRefresh={refresh}
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
      {moreOpen && (
        <button
          className="more-backdrop"
          aria-label="Закрыть меню"
          onClick={() => setMoreOpen(false)}
        />
      )}
      {moreOpen && (
        <div className="more-sheet" role="menu">
          <button
            className={page === "transactions" ? "active" : ""}
            onClick={() => navigate("transactions")}
          >
            <Wallet size={18} />
            История
          </button>
          <button className={page === "purchases" ? "active" : ""} onClick={() => navigate("purchases")}><ShoppingBasket size={18} />Покупки</button>
          <button
            className={page === "goals" ? "active" : ""}
            onClick={() => navigate("goals")}
          >
            <Target size={18} />
            Цели
          </button>
          <button
            className={page === "settings" ? "active" : ""}
            onClick={() => openSettings("categories")}
          >
            <SettingsIcon size={18} />
            Настройки
          </button>
        </div>
      )}
      <nav className="bottom-nav">
        <button
          className={page === "overview" ? "active" : ""}
          onClick={() => navigate("overview")}
        >
          <House size={21} />
          <span>Обзор</span>
        </button>
        <button
          className={page === "budget" ? "active" : ""}
          onClick={() => navigate("budget")}
        >
          <PiggyBank size={21} />
          <span>План</span>
        </button>
        <button
          className="mobile-add"
          onClick={() => add(page === "budget")}
          aria-label="Записать"
        >
          <Plus size={25} />
        </button>
        <button
          className={page === "calendar" ? "active" : ""}
          onClick={() => navigate("calendar")}
        >
          <CalendarDays size={21} />
          <span>Календарь</span>
        </button>
        <button
          className={
            moreOpen ||
            ["transactions", "purchases", "goals", "settings"].includes(page)
              ? "active"
              : ""
          }
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
        >
          <Ellipsis size={21} />
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
            snapshot?.entries.filter((e) => e.state === "planned") || []
          }
          progress={snapshot?.categories || []}
          onClose={() => { setDraft(null); void refresh(); }}
          onSaved={() => {
            setDraft(null);
            setReceipt(null);
            void refresh();
          }}
        />
      )}
      {pushOpen && <PushMessage onClose={() => setPushOpen(false)} />}
    </div>
  );
}
