import { ChevronDown, ShoppingBasket } from "lucide-react";
import { money } from "../api";
import type { Receipt } from "../types";
export default function ReceiptDetails({ receipt }: { receipt: Receipt }) {
  return (
    <details className="receipt-details">
      <summary>
        <span>
          <ShoppingBasket size={18} />
          Покупки в чеке <small>{receipt.purchases.length}</small>
        </span>
        <ChevronDown size={17} />
      </summary>
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
      <div className="receipt-total">
        <span>Итого</span>
        <strong>{money(receipt.total_cents, true)}</strong>
      </div>
    </details>
  );
}
