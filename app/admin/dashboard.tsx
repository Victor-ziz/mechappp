"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Boxes, Car, CircleDollarSign, ClipboardList, LayoutDashboard, LogOut, PackagePlus, ShieldCheck, Star, Users } from "lucide-react";
import type { StaffPermission } from "../../lib/admin/access";
import { supabase } from "../../lib/supabase/client";
import type { AdminCustomer, AdminOrder, AdminOrderItem, AdminProduct, AdminReview, StoreAccount } from "../../lib/admin/types";
import { moderateReview, renameCar, setProductActive, updateOrderStatus } from "./actions";
import ProductForm from "./product-form";
import StaffPanel from "./staff-panel";

type Section = "overview" | "cars" | "products" | "orders" | "reviews" | "customers" | "staff";

const sections: { id: Section; label: string; icon: typeof LayoutDashboard; permission?: StaffPermission }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "cars", label: "Cars", icon: Car, permission: "products" },
  { id: "products", label: "Parts & stock", icon: Boxes, permission: "products" },
  { id: "orders", label: "Orders", icon: ClipboardList, permission: "orders" },
  { id: "reviews", label: "Reviews", icon: Star, permission: "reviews" },
  { id: "customers", label: "Customers", icon: Users, permission: "customers" },
  { id: "staff", label: "Staff", icon: ShieldCheck },
];

const statuses: AdminOrder["status"][] = [
  "whatsapp_requested",
  "awaiting_payment",
  "paid",
  "processing",
  "completed",
  "cancelled",
];

const formatNaira = (value: number) => `₦${value.toLocaleString("en-NG")}`;
const formatDate = (value: string) => new Date(value).toLocaleDateString("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default function AdminDashboard({
  products,
  orders,
  customers,
  reviews,
  reviewsError,
  adminEmail,
  role,
  permissions,
  currentUserId,
  accounts,
}: {
  products: AdminProduct[];
  orders: AdminOrder[];
  customers: AdminCustomer[];
  reviews: AdminReview[];
  reviewsError: string;
  adminEmail: string;
  role: "admin" | "staff";
  permissions: StaffPermission[];
  currentUserId: string;
  accounts: StoreAccount[];
}) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [editing, setEditing] = useState<AdminProduct | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();
  const paidSales = orders
    .filter((order) => ["paid", "processing", "completed"].includes(order.status))
    .reduce((sum, order) => sum + order.total, 0);
  const lowStock = products.filter((product) => product.active && product.stock <= 3).length;

  const finishAction = (result: { success: boolean; error?: string; notice?: string }, successMessage: string) => {
    if (!result.success) {
      setError(result.error || "The update could not be completed.");
      setNotice("");
      return;
    }
    setError("");
    setNotice(result.notice || successMessage);
    setEditing(null);
    router.refresh();
  };

  const cars = [...new Set(products.map((product) => product.category))].sort((a, b) => a.localeCompare(b));
  const visibleSections = sections.filter((item) => {
    if (item.id === "staff") return role === "admin" || role === "staff";
    if (!item.permission) return true;
    return permissions.includes(item.permission);
  }).map((item) => item.id === "staff" && role === "staff" ? { ...item, label: "Password" } : item);
  const showProducts = permissions.includes("products");
  const showOrders = permissions.includes("orders");
  const showCustomers = permissions.includes("customers");

  const updateProductActive = (product: AdminProduct) => {
    startTransition(async () => {
      finishAction(await setProductActive(product.id, !product.active), product.active ? "Product hidden from the shop." : "Product is live in the shop.");
    });
  };

  const changeOrderStatus = (id: string, status: AdminOrder["status"]) => {
    startTransition(async () => finishAction(await updateOrderStatus(id, status), "Order status updated."));
  };

  const decideReview = (id: string, status: "approved" | "rejected") => {
    startTransition(async () => finishAction(await moderateReview(id, status), status === "approved" ? "Review published." : "Review kept off the shop."));
  };

  const signOut = () => {
    if (!supabase) return;
    const client = supabase;
    startTransition(async () => {
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) {
        setError(signOutError.message);
        return;
      }
      window.location.assign("/admin");
    });
  };

  return (
    <main className="admin-app">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/" aria-label="FRAN6 store home">
          <Image src="/fran6-header-logo.png" alt="FRAN6 Car Parts" width={88} height={34} unoptimized />
          <span>Store admin</span>
        </Link>
        <nav className="admin-nav" aria-label="Admin sections">
          {visibleSections.map(({ id, label, icon: Icon }) => (
            <button type="button" className={section === id ? "active" : ""} key={id} onClick={() => { setSection(id); setEditing(null); }}>
              <Icon size={18} />{label}
              {id === "orders" && orders.length > 0 && <span className="admin-nav-count">{orders.length}</span>}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <p><ShieldCheck size={16} /> Signed in as {role === "admin" ? "admin" : "staff"}</p>
          <span>{adminEmail}</span>
          <button type="button" onClick={signOut} disabled={busy}><LogOut size={16} />Sign out</button>
          <Link href="/"><ArrowLeft size={16} />Back to shop</Link>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">FRAN6 control room</p>
            <h1>{visibleSections.find((item) => item.id === section)?.label}</h1>
          </div>
          {showProducts && (section === "products" || section === "cars") && !editing && (
            <button type="button" className="admin-primary-button" onClick={() => { setSection("products"); setEditing("new"); }}>
              <PackagePlus size={17} />Add part
            </button>
          )}
        </header>

        {error && <p className="admin-alert" role="alert">{error}</p>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}

        {section === "overview" && (
          <div className="admin-content">
            <div className="admin-stats">
              {showProducts && <article><span><Boxes size={17} />Active products</span><strong>{products.filter((product) => product.active).length}</strong></article>}
              {showOrders && <article><span><ClipboardList size={17} />Recent orders</span><strong>{orders.length}</strong></article>}
              {showCustomers && <article><span><Users size={17} />Recent customers</span><strong>{customers.length}</strong></article>}
              {showOrders && <article><span><CircleDollarSign size={17} />Sales in recent orders</span><strong>{formatNaira(paidSales)}</strong></article>}
            </div>
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div><p className="admin-eyebrow">Needs attention</p><h2>Stock and recent orders</h2></div>
                <span className={lowStock ? "admin-status warning" : "admin-status"}>{lowStock} low-stock</span>
              </div>
              <div className="admin-attention-grid">
                {showProducts && <div><h3>Low stock</h3>{products.filter((product) => product.active && product.stock <= 3).length === 0
                  ? <p className="admin-muted">All active products have more than 3 in stock.</p>
                  : products.filter((product) => product.active && product.stock <= 3).map((product) => <p className="admin-attention-row" key={product.id}><span>{product.name}</span><strong>{product.stock} left</strong></p>)}
                </div>}
                {showOrders && <div><h3>Latest orders</h3>{orders.slice(0, 5).length === 0
                  ? <p className="admin-muted">No orders yet.</p>
                  : orders.slice(0, 5).map((order) => <p className="admin-attention-row" key={order.id}><span>{order.customer_name} · {order.reference}</span><strong>{formatNaira(order.total)}</strong></p>)}
                </div>}
              </div>
            </section>
          </div>
        )}

        {section === "cars" && (
          <div className="admin-content admin-car-list">
            <section className="admin-panel">
              <p className="admin-eyebrow">How the shop is organised</p>
              <h2>One car, then its parts</h2>
              <p className="admin-muted">Shoppers pick a car such as Corolla. Only the parts saved under that car are shown, each with a 2 or 3 photo preview.</p>
            </section>
            {cars.map((car) => {
              const count = products.filter((product) => product.category === car).length;
              return (
                <CarRename key={car} name={car} count={count} busy={busy} onRename={(nextName) => {
                  startTransition(async () => finishAction(await renameCar(car, nextName), `${car} is now ${nextName.trim()}.`));
                }} />
              );
            })}
            {cars.length === 0 && <section className="admin-panel admin-empty"><Car size={28} /><h2>No cars yet</h2><p>Add a part and name its car, for example Corolla.</p></section>}
          </div>
        )}

        {section === "products" && (
          <div className="admin-content">
            {editing && (
              <ProductForm
                key={editing === "new" ? "new" : editing.id}
                product={editing === "new" ? undefined : editing}
                cars={cars}
                busy={busy}
                onClose={() => setEditing(null)}
                onSaved={(message) => finishAction({ success: true }, message)}
              />
            )}
            <div className="admin-products-list">
              {products.map((product) => (
                <article className="admin-product-card" key={product.id}>
                  <Image src={product.image} alt="" width={70} height={70} unoptimized />
                  <div className="admin-product-details">
                    <p>{product.category} · {product.active ? "Live" : "Hidden"}</p>
                    <h2>{product.name}</h2>
                    <strong>{formatNaira(product.price)}</strong>
                  </div>
                  <div className="admin-product-stock"><span>Stock</span><strong className={product.stock <= 3 ? "low" : ""}>{product.stock}</strong></div>
                  <div className="admin-product-actions">
                    <button type="button" onClick={() => setEditing(product)}>Edit</button>
                    <button type="button" onClick={() => updateProductActive(product)} disabled={busy}>{product.active ? "Hide" : "Publish"}</button>
                  </div>
                </article>
              ))}
              {products.length === 0 && <p className="admin-muted">No products yet. Add the first listing above.</p>}
            </div>
          </div>
        )}

        {section === "orders" && (
          <div className="admin-content admin-orders">
            {orders.map((order) => (
              <article className="admin-panel admin-order-card" key={order.id}>
                <div className="admin-order-heading">
                  <div><p className="admin-eyebrow">{order.reference} · {order.channel}</p><h2>{order.customer_name}</h2><a href={`mailto:${order.customer_email}`}>{order.customer_email}</a>{order.customer_phone && <a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>}</div>
                  <strong>{formatNaira(order.total)}</strong>
                </div>
                <div className="admin-order-items">{(order.items as AdminOrderItem[]).map((item) => <p key={`${order.id}-${item.id}`}>{item.name} × {item.quantity}<span>{formatNaira(item.price * item.quantity)}</span></p>)}</div>
                <div className="admin-order-footer">
                  <span>{formatDate(order.created_at)}</span>
                  <label>Status<select value={order.status} onChange={(event) => changeOrderStatus(order.id, event.target.value as AdminOrder["status"])} disabled={busy}>
                    {statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                  </select></label>
                </div>
              </article>
            ))}
            {orders.length === 0 && <section className="admin-panel admin-empty"><ClipboardList size={28} /><h2>No orders to show</h2><p>Orders placed through checkout will appear here.</p></section>}
          </div>
        )}

        {section === "reviews" && (
          <div className="admin-content">
            {reviewsError && <p className="admin-alert" role="alert">{reviewsError}</p>}
            {reviews.map((review) => (
              <article className="admin-panel admin-review-card" key={review.id}>
                <div>
                  <p className="admin-eyebrow">{(Array.isArray(review.products) ? review.products[0]?.name : review.products?.name) ?? "Part"} · {review.status}</p>
                  <h2>{review.customer_name} · {review.rating} / 5</h2>
                  <p>{review.comment}</p>
                  <time dateTime={review.created_at}>{formatDate(review.created_at)}</time>
                </div>
                {review.status === "pending" && (
                  <div className="admin-review-actions">
                    <button type="button" onClick={() => decideReview(review.id, "approved")} disabled={busy}>Approve</button>
                    <button type="button" onClick={() => decideReview(review.id, "rejected")} disabled={busy}>Reject</button>
                  </div>
                )}
              </article>
            ))}
            {reviews.length === 0 && !reviewsError && <section className="admin-panel admin-empty"><Star size={28} /><h2>No reviews yet</h2><p>Reviews appear here after a customer who bought the part sends one.</p></section>}
          </div>
        )}

        {section === "customers" && (
          <div className="admin-content admin-customer-list">
            {customers.map((customer) => (
              <article className="admin-customer-card" key={customer.id}>
                <span className="admin-customer-avatar">{(customer.full_name || customer.email).slice(0, 1).toUpperCase()}</span>
                <div><h2>{customer.full_name || "Customer"}</h2><a href={`mailto:${customer.email}`}>{customer.email}</a>{customer.phone && <a href={`tel:${customer.phone}`}>{customer.phone}</a>}</div>
                <time dateTime={customer.created_at}>Joined {formatDate(customer.created_at)}</time>
              </article>
            ))}
            {customers.length === 0 && <section className="admin-panel admin-empty"><Users size={28} /><h2>No customers yet</h2><p>Customer accounts will appear here after signup.</p></section>}
          </div>
        )}

        {section === "staff" && (
          <StaffPanel
            accounts={accounts}
            currentUserId={currentUserId}
            isAdmin={role === "admin"}
            busy={busy}
            onDone={(result, message) => {
              startTransition(async () => finishAction(await result, message));
            }}
          />
        )}
      </section>
    </main>
  );
}

function CarRename({
  name,
  count,
  busy,
  onRename,
}: {
  name: string;
  count: number;
  busy: boolean;
  onRename: (nextName: string) => void;
}) {
  const [nextName, setNextName] = useState(name);
  return (
    <article className="admin-car-card">
      <div>
        <h2>{name}</h2>
        <p>{count} {count === 1 ? "part" : "parts"} in the shop</p>
      </div>
      <form className="admin-car-rename" onSubmit={(event) => { event.preventDefault(); if (nextName.trim() && nextName.trim() !== name) onRename(nextName); }}>
        <input value={nextName} onChange={(event) => setNextName(event.target.value)} aria-label={`Rename ${name}`} maxLength={80} />
        <button type="submit" disabled={busy || nextName.trim() === name}>Rename</button>
      </form>
    </article>
  );
}
