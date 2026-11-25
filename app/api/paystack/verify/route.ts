import "server-only";

import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { orderUpdateLetter, sendFran6Email } from "../../../../lib/email";

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    amount: number;
    currency: string;
    reference: string;
    status: string;
    email: string;
    id: number;
  };
};

export async function POST(request: NextRequest) {
  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!paystackSecretKey || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Paystack received the payment, but the shop could not record it yet. Please contact FRAN6 and keep your payment reference." }, { status: 503 });
  }

  let reference: unknown;
  try {
    ({ reference } = await request.json() as { reference?: unknown });
  } catch {
    return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
  }
  const supplied = typeof reference === "string" ? reference.trim() : "";
  if (!/^FRAN6-[A-F0-9]{32}$/i.test(supplied)) {
    return NextResponse.json({ error: "Invalid payment reference." }, { status: 400 });
  }

  let paystackResponse: Response;
  try {
    paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(supplied)}`, {
      headers: { authorization: `Bearer ${paystackSecretKey}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Paystack could not be reached. Please try again shortly." }, { status: 502 });
  }
  if (!paystackResponse.ok) {
    return NextResponse.json({ error: "Paystack could not verify this transaction." }, { status: 502 });
  }

  let verification: PaystackVerifyResponse;
  try {
    verification = await paystackResponse.json() as PaystackVerifyResponse;
  } catch {
    return NextResponse.json({ error: "Paystack returned an unreadable verification response." }, { status: 502 });
  }
  const transaction = verification.data;
  if (!verification.status || transaction?.status !== "success" || transaction.reference.toUpperCase() !== supplied.toUpperCase() || transaction.currency !== "NGN") {
    return NextResponse.json({ error: "Paystack has not confirmed this payment." }, { status: 400 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: confirmationError } = await adminClient.rpc("confirm_store_order", {
    p_reference: supplied.toUpperCase(),
    p_transaction_id: transaction.id,
    p_amount: transaction.amount,
    p_email: transaction.email,
  });
  if (confirmationError) {
    return NextResponse.json({ error: `Payment was confirmed but the order could not be updated: ${confirmationError.message}` }, { status: 500 });
  }

  const { data: order } = await adminClient
    .from("orders")
    .select("customer_name,customer_email,reference,total,items,status")
    .eq("reference", supplied.toUpperCase())
    .maybeSingle();
  if (order?.customer_email) {
    const items = Array.isArray(order.items)
      ? order.items.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const row = item as { name?: unknown; quantity?: unknown };
          const name = typeof row.name === "string" ? row.name : "";
          const quantity = typeof row.quantity === "number" ? row.quantity : 0;
          return name && quantity > 0 ? [{ name, quantity }] : [];
        })
      : [];
    const letter = orderUpdateLetter({
      name: order.customer_name || "",
      reference: order.reference,
      total: order.total,
      status: order.status,
      items,
    });
    await sendFran6Email({ to: order.customer_email, subject: letter.subject, html: letter.html, text: letter.text });
  }

  return NextResponse.json({ verified: true });
}
