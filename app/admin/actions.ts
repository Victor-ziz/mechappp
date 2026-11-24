"use server";

import { revalidatePath } from "next/cache";
import type { AdminActionResult, AdminOrder } from "../../lib/admin/types";
import { createSupabaseAdminClient, storeHasAdmin } from "../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../lib/supabase/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createFirstAdmin(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<AdminActionResult> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  if (fullName.length < 2 || fullName.length > 80) return { success: false, error: "Enter your name." };
  if (!emailPattern.test(email)) return { success: false, error: "Enter a valid email address." };
  if (input.password.length < 8) return { success: false, error: "Use a password of at least 8 characters." };

  try {
    if (await storeHasAdmin()) return { success: false, error: "An admin account already exists. Sign in instead." };
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role: "admin" },
    });
    if (error) return { success: false, error: error.message };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not create the admin account." };
  }

  revalidatePath("/admin");
  return { success: true };
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Could not verify your account: ${error.message}`);
  if (!user || user.app_metadata.role !== "admin") throw new Error("You do not have permission to manage the store.");
  return supabase;
}

export async function saveProduct(input: {
  id: number | null;
  name: string;
  category: string;
  price: number;
  image: string;
  images: string[];
  stock: number;
}): Promise<AdminActionResult> {
  const supabase = await requireAdmin();
  const name = input.name.trim();
  const category = input.category.trim();
  const image = input.image.trim();
  const images = input.images.map((src) => src.trim());
  const safeImage = (src: string) => src.startsWith("/") || src.startsWith("https://");
  if (!name || name.length > 160 || !category || category.length > 80) {
    return { success: false, error: "Enter the part name and the car it fits, such as Corolla." };
  }
  if (!Number.isSafeInteger(input.price) || input.price <= 0 || !Number.isSafeInteger(input.stock) || input.stock < 0) {
    return { success: false, error: "Price must be positive and stock cannot be negative." };
  }
  if (images.length < 2 || images.length > 3 || images.some((src) => !safeImage(src) || src.length > 1000) || !safeImage(image) || image !== images[0]) {
    return { success: false, error: "Add 2 or 3 photos. The first photo is the main shop image." };
  }

  const product = {
    name,
    category,
    price: input.price,
    image,
    images,
    stock: input.stock,
    updated_at: new Date().toISOString(),
  };
  const result = input.id === null
    ? await supabase.from("products").insert(product).select("id").single()
    : await supabase.from("products").update(product).eq("id", input.id).select("id").single();
  if (result.error) return { success: false, error: result.error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function renameCar(currentName: string, nextName: string): Promise<AdminActionResult> {
  const supabase = await requireAdmin();
  const from = currentName.trim();
  const to = nextName.trim();
  if (!from || !to || to.length > 80) return { success: false, error: "Enter a car name, like Corolla." };
  const { error } = await supabase.from("products").update({ category: to, updated_at: new Date().toISOString() }).eq("category", from);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function setProductActive(id: number, active: boolean): Promise<AdminActionResult> {
  const supabase = await requireAdmin();
  if (!Number.isSafeInteger(id) || id < 1) return { success: false, error: "Invalid product." };
  const { error } = await supabase.from("products").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function updateOrderStatus(id: string, status: AdminOrder["status"]): Promise<AdminActionResult> {
  const supabase = await requireAdmin();
  const allowedStatuses: AdminOrder["status"][] = [
    "whatsapp_requested",
    "awaiting_payment",
    "paid",
    "processing",
    "completed",
    "cancelled",
  ];
  if (!/^[0-9a-f-]{36}$/i.test(id) || !allowedStatuses.includes(status)) {
    return { success: false, error: "Invalid order update." };
  }

  const { error } = await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin");
  return { success: true };
}
