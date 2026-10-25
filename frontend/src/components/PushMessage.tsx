import { useEffect, useState, type FormEvent } from "react";
import { Bell, Check, Send } from "lucide-react";
import { api } from "../api";
import type { Person } from "../types";
import { Avatar, Modal } from "./ui";

export default function PushMessage({ onClose }: { onClose: () => void }) {
  const [recipient, setRecipient] = useState<{
      user: Person;
      subscribed: boolean;
    } | null>(null),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<{ sent: number; message: string } | null>(
      null,
    );
  useEffect(() => {
    api<{ user: Person; subscribed: boolean }>("push/recipient")
      .then(setRecipient)
      .catch((e) => setError(e.message));
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api("push/send", "POST", { message: text.trim() }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Отправить пуш" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {recipient && (
          <div className="push-recipient">
            <Avatar name={recipient.user.name} />
            <div>
              <strong>
                Для{" "}
                {recipient.user.name === "Вика"
                  ? "Вики"
                  : recipient.user.name === "Алексей"
                    ? "Алексея"
                    : recipient.user.name}
              </strong>
              <span>
                {recipient.subscribed
                  ? "Уведомления подключены"
                  : "Уведомления пока не подключены"}
              </span>
            </div>
            <Bell size={19} />
          </div>
        )}
        <label>
          Ваше сообщение
          <textarea
            autoFocus
            required
            maxLength={500}
            rows={4}
            placeholder="Например: давай вечером обсудим бюджет на отпуск"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
          />
        </label>
        <div className="message-hint">
          <span>Получатель увидит ваше имя в заголовке</span>
          <span>{text.length}/500</span>
        </div>
        {recipient && !recipient.subscribed && (
          <p className="form-hint">
            Второму участнику нужно открыть Trekfin → «Ещё» → «Уведомления» и
            разрешить их на своём устройстве.
          </p>
        )}
        {result && (
          <p className={result.sent ? "success" : "form-hint"} role="status">
            {result.sent > 0 && <Check size={17} />} {result.message}
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button
          className="button primary full"
          disabled={busy || !recipient || !text.trim()}
        >
          <Send size={17} />
          {busy ? "Отправляем…" : "Отправить уведомление"}
        </button>
      </form>
    </Modal>
  );
}
