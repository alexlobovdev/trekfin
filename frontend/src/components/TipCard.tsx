import { useEffect, useState } from "react";
import { ArrowUpRight, Lightbulb, RefreshCw } from "lucide-react";
import { api, money } from "../api";
import type { Insight } from "../types";
import { Modal } from "./ui";
export default function TipCard({ initial }: { initial: Insight | null }) {
  const [tip, setTip] = useState(initial),
    [offset, setOffset] = useState(0),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (initial) setTip(initial);
  }, [initial]);
  const next = async () => {
    setBusy(true);
    setError("");
    try {
      setTip(await api<Insight>("insight?offset=" + (offset + 1)));
      setOffset(offset + 1);
    } catch {
      setError("Не удалось загрузить другой материал. Попробуйте позже.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="tip-card real-tip">
      <div className="tip-top">
        <span>
          <Lightbulb size={17} />
          СОВЕТ ДНЯ
        </span>
        <button
          className="icon-button"
          disabled={busy}
          onClick={next}
          aria-label="Другой совет"
        >
          <RefreshCw size={16} className={busy ? "spinning" : ""} />
        </button>
      </div>
      <h3>{tip?.title || "Загружаем полезный материал…"}</h3>
      {tip && (
        <>
          <p>
            {tip.body.length > 280
              ? tip.body.slice(0, 280).replace(/\s+\S*$/, "") + "…"
              : tip.body}
          </p>
          <button className="tip-read" onClick={() => setOpen(true)}>
            Прочитать совет <ArrowUpRight size={14} />
          </button>
          <small className="tip-source">
            {tip.source}
            {!tip.live ? " · сохранённый материал" : ""}
          </small>
        </>
      )}
      {error && (
        <p className="error" role="status">
          {error}
        </p>
      )}
      {tip?.rates && (
        <div className="rate-strip">
          <span>Курсы ЦБ · {tip.rates.date}</span>
          <div>
            {Object.entries(tip.rates.values).map(([currency, rate]) => (
              <strong key={currency}>
                {currency} <span>{money(Math.round(rate * 100))}</span>
              </strong>
            ))}
          </div>
        </div>
      )}
      {open && tip && (
        <Modal title="Совет дня" onClose={() => setOpen(false)}>
          <article className="tip-article">
            <span className="eyebrow">{tip.source}</span>
            <h2>{tip.title}</h2>
            {tip.section && <h3>{tip.section}</h3>}
            <p>{tip.body}</p>
            {tip.updated && <small>Обновлено в источнике: {tip.updated}</small>}
            <a
              className="button secondary full"
              href={tip.link}
              target="_blank"
              rel="noreferrer"
            >
              Читать полный материал <ArrowUpRight size={16} />
            </a>
            <button className="text-button" disabled={busy} onClick={next}>
              <RefreshCw size={15} />
              Другой совет
            </button>
          </article>
        </Modal>
      )}
    </section>
  );
}
