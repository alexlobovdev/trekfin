import { money } from "../api";
import type { Receipt } from "../types";
export default function ReceiptDetails({ receipt }: { receipt: Receipt }) {
  return (
    <section className="receipt-details">
      <h3>Покупки по чеку</h3>
      {receipt.seller && <p className="muted">{receipt.seller}</p>}
      {receipt.status === "pending" ? (
        <p className="form-hint">Список покупок ещё не загружен.</p>
      ) : (
        <ul className="purchase-list">
          {receipt.purchases.map((item, i) => (
            <li key={item.id ?? i}>
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.quantity} × {money(item.price_cents, true)}
                </small>
              </span>
              <strong>{money(item.amount_cents, true)}</strong>
            </li>
          ))}
        </ul>
      )}
      <div className="receipt-total">
        <span>Итого по чеку</span>
        <strong>{money(receipt.total_cents, true)}</strong>
      </div>
    </section>
  );
}
