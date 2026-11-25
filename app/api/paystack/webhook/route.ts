import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

type PaystackWebhookEvent = {
  event?: string;
  data?: {
    amount?: number;
    currency?: string;
    email?: string;
    id?: number;
    reference?: string;
    status?: string;
  };
};

export async function POST(request: NextRequest) {
  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!paystackSecretKey || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Webhook verification is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("x-paystack-signature");
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const rawBody = await request.text();
  const expectedSignature = createHmac("sha512", paystackSecretKey).update(rawBody).digest();
  const receivedSignature = Buffer.from(signature, "hex");
  if (!timingSafeEqual(expectedSignature, receivedSignature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  if (event.event !== "charge.success") return NextResponse.json({ received: true });

  const transaction = event.data;
  if (
    transaction?.status !== "success"
    || typeof transaction.reference !== "string"
    || !/^FRAN6-[A-F0-9]{32}$/i.test(transaction.reference.trim())
    || typeof transaction.amount !== "number"
    || !Number.isSafeInteger(transaction.amount)
    || transaction.currency !== "NGN"
    || typeof transaction.email !== "string"
    || typeof transaction.id !== "number"
  ) {
    return NextResponse.json({ error: "Incomplete successful transaction event." }, { status: 400 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await adminClient.rpc("confirm_store_order", {
    p_reference: transaction.reference.trim().toUpperCase(),
    p_transaction_id: transaction.id,
    p_amount: transaction.amount,
    p_email: transaction.email,
  });
  if (error) {
    return NextResponse.json({ error: `Could not update the paid order: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
