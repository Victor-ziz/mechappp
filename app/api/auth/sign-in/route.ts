import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { findCustomerEmailByPhone } from "../../../../lib/supabase/admin";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: "Accounts are not configured yet." }, { status: 503 });
  }

  let phone = "";
  let password = "";
  try {
    const body = await request.json() as { phone?: unknown; password?: unknown };
    phone = typeof body.phone === "string" ? body.phone.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Enter your phone number and password." }, { status: 400 });
  }
  if (phone.replace(/\D/g, "").length < 10 || password.length < 8) {
    return NextResponse.json({ error: "Invalid login credentials." }, { status: 401 });
  }

  let email: string | null;
  try {
    email = await findCustomerEmailByPhone(phone);
  } catch {
    return NextResponse.json({ error: "Could not sign in right now. Try again in a moment." }, { status: 503 });
  }
  if (!email) return NextResponse.json({ error: "Invalid login credentials." }, { status: 401 });

  const auth = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return NextResponse.json({ error: "Invalid login credentials." }, { status: 401 });
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
