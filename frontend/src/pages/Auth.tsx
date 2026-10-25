import { useState, type FormEvent } from "react";
import { ArrowRight, Heart, LockKeyhole } from "lucide-react";
import { api, invalidateCsrf } from "../api";
import type { User } from "../types";
export default function Auth({
  onUser,
  user,
}: {
  onUser: (u: User) => void;
  user?: User;
}) {
  const [login, setLogin] = useState("alexey"),
    [password, setPassword] = useState(""),
    [next, setNext] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: User }>(
        user ? "password" : "login",
        user ? "PUT" : "POST",
        user
          ? {
              current_password: password,
              password: next,
              password_confirmation: confirm,
            }
          : { login, password },
      );
      invalidateCsrf();
      onUser(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <span className="logo-mark">
          t<span>•</span>
        </span>
        trekfin<span className="brand-dot">.</span>
      </div>
      <div className="auth-layout">
        <div className="auth-story">
          <span className="eyebrow">ФИНАНСЫ ДЛЯ ДВОИХ</span>
          <h1>
            Общие планы.
            <br />
            <span>Больше спокойствия.</span>
          </h1>
          <p>
            Все доходы, расходы и маленькие радости —<br />в одном уютном месте.
          </p>
          <div className="auth-art">
            <div className="art-ring" />
            <div className="art-card">
              <span>
                Наш бюджет <Heart size={17} />
              </span>
              <strong>Вместе проще</strong>
              <div className="art-bars">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <small>Шаг за шагом к вашим планам</small>
            </div>
            <span className="art-coin">₽</span>
            <span className="art-spark">✳</span>
          </div>
        </div>
        <section className="auth-card">
          <div className="lock-badge">
            <LockKeyhole size={23} />
          </div>
          <h2>{user ? "Ваш личный пароль" : "С возвращением"}</h2>
          <p>
            {user
              ? "Замените временный пароль, чтобы начать пользоваться приложением."
              : "Здесь ваши деньги и планы на будущее."}
          </p>
          <form className="form" onSubmit={submit}>
            {!user && (
              <label>
                Кто вы?
                <select
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                >
                  <option value="alexey">Алексей</option>
                  <option value="vika">Вика</option>
                </select>
              </label>
            )}
            <label>
              {user ? "Временный пароль" : "Пароль"}
              <input
                autoFocus
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
              />
            </label>
            {user && (
              <>
                <label>
                  Новый пароль
                  <input
                    required
                    minLength={12}
                    type="password"
                    autoComplete="new-password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    placeholder="Не менее 12 символов"
                  />
                </label>
                <label>
                  Повторите новый пароль
                  <input
                    required
                    minLength={12}
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
              </>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="button primary full" disabled={busy}>
              {busy
                ? "Секунду…"
                : user
                  ? "Сохранить и начать"
                  : "Войти в Trekfin"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="auth-footer">
            <span className="status-dot" />
            Только для вас двоих
          </div>
        </section>
      </div>
      <footer className="auth-bottom">
        Немного порядка в финансах. Много места для жизни.
      </footer>
    </div>
  );
}
