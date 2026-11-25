import type { Metadata } from "next";
import Link from "next/link";
import { getCustomerOrder, type CustomerOrder } from "../../../lib/customer-orders";

type PageProps = { params: Promise<{ reference: string }>; searchParams: Promise<{ received?: string }> };

const formatNaira = (value: number) => `₦${value.toLocaleString("en-NG")}`;
const statusCopy: Record<CustomerOrder["status"], { label: string; detail: string }> = {
  awaiting_payment: { label: "Waiting for payment", detail: "This order is saved. FRAN6 is waiting for the Paystack payment." },
  paid: { label: "Order received", detail: "Your payment was received. FRAN6 will confirm the order and email you when it moves ahead." },
  whatsapp_requested: { label: "Order received", detail: "FRAN6 has your WhatsApp request and will confirm availability and delivery." },
  processing: { label: "Order confirmed", detail: "FRAN6 confirmed this order and is preparing it." },
  completed: { label: "Order complete", detail: "This order is complete." },
  cancelled: { label: "Order cancelled", detail: "FRAN6 cancelled this order." },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Order ${reference} | FRAN6` };
}

export default async function OrderDetailsPage({ params, searchParams }: PageProps) {
  const { reference } = await params;
  const { received } = await searchParams;
  let result: Awaited<ReturnType<typeof getCustomerOrder>>;
  try {
    result = await getCustomerOrder(reference);
  } catch {
    return (
      <main className="order-page shell">
        <h1>Order details</h1>
        <p>This order could not be loaded. Try again in a moment.</p>
        <p className="order-links"><Link href="/orders">Order history</Link><Link href="/">Back to the shop</Link></p>
      </main>
    );
  }

  if (!result.signedIn) {
    return (
      <main className="order-page shell">
        <p className="checkout-label">FRAN6</p>
        <h1>View this order</h1>
        <p>Sign in on the shop with the account that placed the order, then open this page again.</p>
        <p className="order-links"><Link href="/">Back to the shop</Link></p>
      </main>
    );
  }

  if (!result.order) {
    return (
      <main className="order-page shell">
        <p className="checkout-label">FRAN6</p>
        <h1>Order not found</h1>
        <p>This order is not on the signed-in account.</p>
        <p className="order-links"><Link href="/orders">Order history</Link><Link href="/">Back to the shop</Link></p>
      </main>
    );
  }

  const order = result.order;
  const copy = statusCopy[order.status];
  const justReceived = received === "1" && (order.status === "paid" || order.status === "whatsapp_requested" || order.status === "awaiting_payment");

  return (
    <main className="order-page shell">
      <p className="checkout-label">FRAN6</p>
      <h1>{justReceived ? "Order received" : copy.label}</h1>
      <p>{justReceived ? "FRAN6 has the order. It will be confirmed, and an email with this page will be sent when the status changes." : copy.detail}</p>
      <section className="order-card">
        <p className="checkout-label">{order.reference}</p>
        <p>{copy.label} · {order.channel === "paystack" ? "Paystack" : "WhatsApp"}</p>
        {order.items.map((item) => (
          <p className="order-line" key={`${item.name}-${item.quantity}-${item.price}`}>
            <span>{item.name} × {item.quantity}</span>
            <strong>{formatNaira(item.price * item.quantity)}</strong>
          </p>
        ))}
        <p className="order-line order-total"><span>Total</span><strong>{formatNaira(order.total)}</strong></p>
      </section>
      <p className="order-links"><Link href="/orders">Order history</Link><Link href="/">Back to the shop</Link></p>
    </main>
  );
}
