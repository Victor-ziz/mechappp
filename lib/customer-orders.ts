import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";
import { createSupabaseServerClient } from "./supabase/server";

export type CustomerOrderItem = { name: string; quantity: number; price: number };

export type CustomerOrder = {
  reference: string;
  customer_name: string;
  channel: "paystack" | "whatsapp";
  status: "whatsapp_requested" | "awaiting_payment" | "paid" | "processing" | "completed" | "cancelled";
  total: number;
  items: CustomerOrderItem[];
  created_at: string;
};

const statuses = new Set<CustomerOrder["status"]>([
  "whatsapp_requested",
  "awaiting_payment",
  "paid",
  "processing",
  "completed",
  "cancelled",
]);

function readItems(value: unknown): CustomerOrderItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { name?: unknown; quantity?: unknown; price?: unknown };
    const name = typeof row.name === "string" ? row.name : "";
    const quantity = typeof row.quantity === "number" ? row.quantity : 0;
    const price = typeof row.price === "number" ? row.price : 0;
    return name && quantity > 0 ? [{ name, quantity, price }] : [];
  });
}

function readOrder(row: {
  reference: string;
  customer_name: string;
  channel: string;
  status: string;
  total: number;
  items: unknown;
  created_at: string;
}): CustomerOrder | null {
  if (!statuses.has(row.status as CustomerOrder["status"])) return null;
  if (row.channel !== "paystack" && row.channel !== "whatsapp") return null;
  return {
    reference: row.reference,
    customer_name: row.customer_name,
    channel: row.channel,
    status: row.status as CustomerOrder["status"],
    total: row.total,
    items: readItems(row.items),
    created_at: row.created_at,
  };
}

async function customerId() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listCustomerOrders() {
  const id = await customerId();
  if (!id) return { signedIn: false as const, orders: [] as CustomerOrder[] };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("reference,customer_name,channel,status,total,items,created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return { signedIn: true as const, orders: (data ?? []).flatMap((row) => { const order = readOrder(row); return order ? [order] : []; }) };
}

export async function getCustomerOrder(reference: string) {
  if (!/^FRAN6-[A-F0-9]{32}$/i.test(reference)) return { signedIn: true as const, order: null };
  const id = await customerId();
  if (!id) return { signedIn: false as const, order: null };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("reference,customer_name,channel,status,total,items,created_at")
    .eq("customer_id", id)
    .eq("reference", reference.toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { signedIn: true as const, order: data ? readOrder(data) : null };
}
