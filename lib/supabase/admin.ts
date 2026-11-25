import "server-only";

import { createClient } from "@supabase/supabase-js";
import { permissionsFor, storeRole } from "../admin/access";
import type { StoreAccount } from "../admin/types";

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service role key is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function storeHasAdmin() {
  const admin = createSupabaseAdminClient();
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    if (data.users.some((user) => user.app_metadata?.role === "admin")) return true;
    if (data.users.length < 200) return false;
  }
  return false;
}

export async function listStoreAccounts() {
  const admin = createSupabaseAdminClient();
  const accounts: StoreAccount[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    for (const user of data.users) {
      const role = storeRole(user);
      if (!role) continue;
      accounts.push({
        id: user.id,
        email: user.email ?? "",
        fullName: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "",
        role,
        permissions: permissionsFor(user),
      });
    }
    if (data.users.length < 200) break;
  }
  return accounts.sort((a, b) => a.role.localeCompare(b.role) || a.email.localeCompare(b.email));
}

const samePhone = (stored: string, digits: string) => {
  const storedDigits = stored.replace(/\D/g, "");
  return storedDigits.length >= 10 && storedDigits.slice(-10) === digits.slice(-10);
};

export async function findCustomerEmailByPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  const admin = createSupabaseAdminClient();
  const profiles = await admin.from("customer_profiles").select("email,phone");
  if (!profiles.error) {
    const match = (profiles.data ?? []).find((row) => typeof row.phone === "string" && row.email && samePhone(row.phone, digits));
    if (match?.email) return match.email;
  }

  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const match = data.users.find((user) => {
      const stored = user.user_metadata?.phone;
      return typeof stored === "string" && user.email && samePhone(stored, digits);
    });
    if (match?.email) return match.email;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function listCustomerPhones() {
  const admin = createSupabaseAdminClient();
  const phones: Record<string, string> = {};
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    for (const user of data.users) {
      const phone = user.user_metadata?.phone;
      if (typeof phone === "string" && phone.trim()) phones[user.id] = phone.trim();
    }
    if (data.users.length < 200) break;
  }
  return phones;
}
