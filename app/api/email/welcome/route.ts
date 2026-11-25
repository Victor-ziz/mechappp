import { NextResponse } from "next/server";
import { sendFran6Email, welcomeLetter } from "../../../../lib/email";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let email = "";
  let name = "";
  try {
    const body = await request.json() as { email?: unknown; name?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  } catch {
    return NextResponse.json({ sent: false });
  }
  if (!emailPattern.test(email)) return NextResponse.json({ sent: false });

  try {
    const admin = createSupabaseAdminClient();
    let match: { id: string; created_at: string; user_metadata: Record<string, unknown> } | null = null;
    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return NextResponse.json({ sent: false });
      const user = data.users.find((item) => item.email?.toLowerCase() === email);
      if (user) {
        match = { id: user.id, created_at: user.created_at, user_metadata: user.user_metadata ?? {} };
        break;
      }
      if (data.users.length < 200) break;
    }
    if (!match || match.user_metadata.welcome_sent) return NextResponse.json({ sent: false });
    const age = Date.now() - new Date(match.created_at).getTime();
    if (!Number.isFinite(age) || age < 0 || age > 30 * 60 * 1000) return NextResponse.json({ sent: false });

    const letter = welcomeLetter(name);
    const result = await sendFran6Email({ to: email, subject: "Welcome to FRAN6", ...letter });
    if (!result.sent) return NextResponse.json({ sent: false });
    await admin.auth.admin.updateUserById(match.id, {
      user_metadata: { ...match.user_metadata, welcome_sent: true },
    });
    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ sent: false });
  }
}
