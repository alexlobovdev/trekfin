import { useEffect, useState, type FormEvent } from "react";
import {
  Bell,
  BellRing,
  Check,
  Download,
  ExternalLink,
  Handshake,
  KeyRound,
  Plus,
  Repeat2,
  ShieldCheck,
  Smartphone,
  Target,
  Trash2,
} from "lucide-react";
import { api, monthLabel, money } from "../api";
import type { Bootstrap, Category, User } from "../types";
import { CategoryIcon, Modal } from "../components/ui";
export default function Settings({
  data,
  user,
  onRefresh,
  onNavigate,
}: {
  data: Bootstrap;
  user: User;
  onRefresh: () => void;
  onNavigate: (p: string) => void;
}) {
  const [tab, setTab] = useState("categories"),
    [category, setCategory] = useState<Partial<Category> | null>(null),
    [password, setPassword] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.ready
        .then((r) => r.pushManager?.getSubscription())
        .then((s) => setSubscribed(!!s))
        .catch(() => {});
  }, []);
  const notify = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!("PushManager" in window) || !("Notification" in window))
        throw new Error(
          "На iPhone откройте Trekfin с экрана «Домой». Для уведомлений нужен iOS 16.4 или новее.",
        );
      if (!data.push_key) throw new Error("Ключ уведомлений ещё не настроен.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw new Error(
          "Разрешите уведомления для Trekfin в настройках Safari или устройства.",
        );
      const r = await navigator.serviceWorker.ready;
      let s = await r.pushManager.getSubscription();
      if (!s) {
        const raw = atob(data.push_key.replace(/-/g, "+").replace(/_/g, "/"));
        const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        s = await r.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        });
      }
      await api("push", "POST", s.toJSON());
      setSubscribed(true);
      setMessage("Уведомления включены на этом устройстве.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    setBusy(true);
    try {
      const r = await navigator.serviceWorker.ready;
      const s = await r.pushManager.getSubscription();
      if (s) {
        await api("push", "DELETE", { endpoint: s.endpoint });
        await s.unsubscribe();
      }
      setSubscribed(false);
      setMessage("Уведомления на этом устройстве выключены.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="mobile-shortcuts">
        <button onClick={() => onNavigate("recurring")}>
          <Repeat2 size={20} />
          Регулярные платежи
        </button>
        <button onClick={() => onNavigate("debts")}>
          <Handshake size={20} />
          Долги и кредиты
        </button>
        <button onClick={() => onNavigate("savings")}>
          <Target size={20} />
          Накопления
        </button>
      </div>
      <div className="tabs">
        {[
          ["categories", "Категории"],
          ["notifications", "Уведомления"],
          ["data", "Данные и доступ"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "selected" : ""}
            onClick={() => {
              setTab(id);
              setMessage("");
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          <Check size={17} />
          {message}
        </p>
      )}
      {tab === "categories" && (
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Ваши категории</h2>
              <p>Убирайте лишнее и добавляйте то, что важно вам</p>
            </div>
            <button
              className="button secondary"
              onClick={() =>
                setCategory({
                  kind: "expense",
                  mode: "payment",
                  color: "#d3437b",
                  icon: "wallet",
                  active: true,
                })
              }
            >
              <Plus size={16} />
              Категория
            </button>
          </div>
          {["expense", "income"].map((kind) => (
            <div key={kind}>
              <div className="list-section-label">
                {kind === "expense" ? "РАСХОДЫ" : "ДОХОДЫ"}
              </div>
              <div className="category-grid">
                {data.categories
                  .filter((c) => c.active && c.kind === kind)
                  .map((c) => (
                    <button
                      className="category-tile"
                      key={c.id}
                      onClick={() => setCategory(c)}
                    >
                      <CategoryIcon category={c} />
                      <strong>{c.name}</strong>
                      <span>
                        {c.mode === "limit" ? "Лимит месяца" : "Платёж"}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          ))}
          <p className="source-note">
            Удалённые категории остаются в старых операциях. История
            сохраняется.
          </p>
        </section>
      )}
      {tab === "notifications" && (
        <div className="settings-grid">
          <section className="panel settings-card">
            <span className="feature-icon">
              <BellRing size={26} />
            </span>
            <h2>Ненавязчивые напоминания</h2>
            <p>
              Утром, в 09:00 — о платежах на сегодня и завтра. Вечером, в 21:00
              — короткое напоминание записать расходы.
            </p>
            <p className="source-note">
              Время Екатеринбурга · Уведомления настроены отдельно для каждого
              устройства.
            </p>
            <button className="button primary" disabled={busy} onClick={notify}>
              <Bell size={17} />
              {busy
                ? "Подключаем…"
                : subscribed
                  ? "Обновить подключение"
                  : "Включить уведомления"}
            </button>
            {subscribed && (
              <div className="push-actions">
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await api<{ sent: number }>(
                        "push/preview",
                        "POST",
                      );
                      setMessage(
                        r.sent
                          ? "Уведомление отправлено. Проверьте центр уведомлений."
                          : "Пока нет доступных подписок. Включите уведомления ещё раз.",
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Отправить пример
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={disable}
                >
                  Выключить
                </button>
              </div>
            )}
          </section>
          <section className="panel settings-card install-card">
            <span className="feature-icon">
              <Smartphone size={26} />
            </span>
            <h2>Trekfin на экране «Домой»</h2>
            <p>
              На iPhone откройте сайт в Safari, нажмите «Поделиться» и выберите
              «На экран “Домой”».
            </p>
            <p>
              На Mac в Safari: «Файл» → «Добавить в Dock». Открывайте приложение
              с новой иконки.
            </p>
            <span className="quiet-pill">
              <ShieldCheck size={14} />
              Уведомления работают через HTTPS
            </span>
          </section>
        </div>
      )}
      {tab === "data" && (
        <>
          <section className="panel settings-card">
            <div className="panel-title">
              <div>
                <h2>Данные на своём месте</h2>
                <p>Ваш аккаунт: {user.name}</p>
              </div>
              <ShieldCheck size={22} />
            </div>
            <div className="data-actions">
              <button
                className="button secondary"
                onClick={() => setPassword(true)}
              >
                <KeyRound size={17} />
                Сменить пароль
              </button>
              <a href="/api/export" className="button secondary">
                <Download size={17} />
                Скачать операции CSV
              </a>
              <a href="/api/import-source" className="button secondary">
                <ExternalLink size={16} />
                Архив импорта
              </a>
            </div>
          </section>
          {data.import && (
            <section className="panel settings-card import-report">
              <div className="panel-title">
                <div>
                  <h2>Импорт завершён</h2>
                  <p>
                    {data.import.sheets.length} листов · суммы сверены с
                    таблицей
                  </p>
                </div>
                <span className="success-badge">
                  <Check size={15} />
                  Проверено
                </span>
              </div>
              <div className="import-months">
                {data.import.months.map((m) => (
                  <div key={m.month}>
                    <span>{monthLabel(m.month)}</span>
                    <strong>{money(m.remaining_cents)}</strong>
                    <small>Остаток по плану</small>
                  </div>
                ))}
              </div>
              <ul>
                {data.import.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {category && (
        <CategoryForm
          category={category}
          onClose={() => setCategory(null)}
          onSaved={() => {
            setCategory(null);
            onRefresh();
          }}
        />
      )}
      {password && (
        <Modal title="Сменить пароль" onClose={() => setPassword(false)}>
          <form
            className="form"
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api(
                  "password",
                  "PUT",
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
                setPassword(false);
                setMessage("Пароль обновлён.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Текущий пароль
              <input
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              Новый пароль
              <input
                name="password"
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              Ещё раз новый пароль
              <input
                name="password_confirmation"
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="button primary" disabled={busy}>
              Сохранить пароль
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function CategoryForm({
  category,
  onClose,
  onSaved,
}: {
  category: Partial<Category>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState(false);
  return (
    <Modal
      title={category.id ? "Изменить категорию" : "Новая категория"}
      onClose={onClose}
    >
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(
              "categories" + (category.id ? "/" + category.id : ""),
              category.id ? "PUT" : "POST",
              {
                ...Object.fromEntries(new FormData(e.currentTarget)),
                active: true,
              },
            );
            onSaved();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <label>
          Название
          <input
            name="name"
            autoFocus
            required
            maxLength={80}
            defaultValue={category.name}
          />
        </label>
        <label>
          Тип
          <select name="kind" defaultValue={category.kind}>
            <option value="expense">Расход</option>
            <option value="income">Доход</option>
          </select>
        </label>
        <label>
          Как учитывать план
          <select name="mode" defaultValue={category.mode || "payment"}>
            <option value="limit">Лимит на месяц</option>
            <option value="payment">Конкретный платёж</option>
          </select>
        </label>
        <div className="form-grid">
          <label>
            Цвет
            <input type="color" name="color" defaultValue={category.color} />
          </label>
          <label>
            Иконка
            <select name="icon" defaultValue={category.icon}>
              {Object.entries({
                wallet: "Кошелёк",
                home: "Дом",
                basket: "Покупки",
                car: "Транспорт",
                coffee: "Кофе",
                utensils: "Еда",
                activity: "Спорт",
                briefcase: "Работа",
                receipt: "Платежи",
                handshake: "Долги",
                "credit-card": "Карта",
                zap: "Коммуналка",
                wifi: "Интернет",
              }).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          {category.id && (
            <button
              type="button"
              className="danger-link"
              disabled={busy}
              onClick={async () => {
                if (!deleting) {
                  setDeleting(true);
                  return;
                }
                setBusy(true);
                try {
                  await api("categories/" + category.id, "DELETE");
                  onSaved();
                } catch (e) {
                  setError((e as Error).message);
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={16} />
              {deleting ? "Убрать категорию?" : "Убрать"}
            </button>
          )}
          <button className="button primary" disabled={busy}>
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  );
}
