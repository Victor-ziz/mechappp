import type { Metadata } from "next";
import Link from "next/link";
import { listCustomerOrders, type CustomerOrder } from "../../lib/customer-orders";

export const metadata: Metadata = { title: "Order history | FRAN6" };

const formatNaira = (value: number) => `₦${value.toLocaleString("en-NG")}`;
const statusLabel: Record<CustomerOrder["status"], string> = {
  awaiting_payment: "Waiting for payment",
  paid: "Payment received",
  whatsapp_requested: "Waiting for confirmation",
  processing: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function OrderHistoryPage() {
  let result: Awaited<ReturnType<typeof listCustomerOrders>>;
  try {
    result = await listCustomerOrders();
  } catch {
    return (
      <main className="order-page shell">
        <h1>Order history</h1>
        <p>Orders could not be loaded. Try again in a moment.</p>
        <p className="order-links"><Link href="/">Back to the shop</Link></p>
      </main>
    );
  }

  return (
    <main className="order-page shell">
      <p className="checkout-label">FRAN6</p>
      <h1>Order history</h1>
      {!result.signedIn && <p>Sign in on the shop with the account that placed the order. Your orders will show here.</p>}
      {result.signedIn && result.orders.length === 0 && <p>You have no orders yet.</p>}
      {result.orders.map((order) => (
        <Link className="order-card order-history-row" href={`/orders/${order.reference}`} key={order.reference}>
          <span>
            <strong>{order.reference}</strong>
            <small>{statusLabel[order.status]} · {new Date(order.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</small>
          </span>
          <b>{formatNaira(order.total)}</b>
        </Link>
      ))}
      <p className="order-links"><Link href="/">Back to the shop</Link></p>
    </main>
  );
}
