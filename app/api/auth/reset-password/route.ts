import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { findCustomerEmailByPhone } from "../../../../lib/supabase/admin";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sent = { message: "If an account matches, a reset link is on its way to the email for that account." };

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: "Accounts are not configured yet." }, { status: 503 });
  }

  let identifier = "";
  try {
    const body = await request.json() as { identifier?: unknown };
    identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  } catch {
    return NextResponse.json({ error: "Enter the email or phone number on the account." }, { status: 400 });
  }

  const digits = identifier.replace(/\D/g, "");
  const isEmail = identifier.includes("@");
  if (!isEmail && (digits.length < 10 || digits.length > 15)) {
    return NextResponse.json({ error: "Enter the email or phone number on the account." }, { status: 400 });
  }
  if (isEmail && !emailPattern.test(identifier)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  let email = isEmail ? identifier.toLowerCase() : null;
  if (!email) {
    try {
      email = await findCustomerEmailByPhone(identifier);
    } catch {
      return NextResponse.json({ error: "Could not send the reset link right now. Try again in a moment." }, { status: 503 });
    }
    if (!email) return NextResponse.json(sent);
  }

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const auth = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await auth.auth.resetPasswordForEmail(email, {
    redirectTo: `${proto}://${host}/reset-password`,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(sent);
}
