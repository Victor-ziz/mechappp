"use server";

import { revalidatePath } from "next/cache";
import { canAccess, cleanPermissions, storeRole, type StaffPermission } from "../../lib/admin/access";
import type { AdminActionResult, AdminOrder } from "../../lib/admin/types";
import { orderUpdateLetter, sendFran6Email } from "../../lib/email";
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

async function currentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Could not verify your account: ${error.message}`);
  if (!user) throw new Error("Sign in to manage the store.");
  return user;
}

async function requirePermission(permission: StaffPermission) {
  const user = await currentUser();
  if (!canAccess(user, permission)) throw new Error("You do not have permission to do that.");
  return createSupabaseAdminClient();
}

async function requireOwner() {
  const user = await currentUser();
  if (storeRole(user) !== "admin") throw new Error("Only the store admin can manage staff.");
  return user;
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
  const supabase = await requirePermission("products");
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
  const supabase = await requirePermission("products");
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
  const supabase = await requirePermission("products");
  if (!Number.isSafeInteger(id) || id < 1) return { success: false, error: "Invalid product." };
  const { error } = await supabase.from("products").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function updateOrderStatus(id: string, status: AdminOrder["status"]): Promise<AdminActionResult> {
  const supabase = await requirePermission("orders");
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

  const { data: existing, error: loadError } = await supabase
    .from("orders")
    .select("customer_name,customer_email,reference,total,items,status")
    .eq("id", id)
    .maybeSingle();
  if (loadError || !existing) return { success: false, error: loadError?.message || "Order not found." };

  const { error } = await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin");
  if (status === existing.status) return { success: true };

  const items = Array.isArray(existing.items)
    ? existing.items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as { name?: unknown; quantity?: unknown };
        const name = typeof row.name === "string" ? row.name : "";
        const quantity = typeof row.quantity === "number" ? row.quantity : 0;
        return name && quantity > 0 ? [{ name, quantity }] : [];
      })
    : [];
  const letter = orderUpdateLetter({
    name: existing.customer_name || "",
    reference: existing.reference,
    total: existing.total,
    status,
    items,
  });
  const email = existing.customer_email
    ? await sendFran6Email({ to: existing.customer_email, subject: letter.subject, html: letter.html, text: letter.text })
    : { sent: false as const, reason: "This order has no customer email." };
  if (!email.sent) return { success: true, notice: `Order updated. The email was not sent. ${email.reason}` };
  return { success: true, notice: "Order updated. The customer has been emailed." };
}

export async function moderateReview(id: string, status: "approved" | "rejected"): Promise<AdminActionResult> {
  const supabase = await requirePermission("reviews");
  if (!/^[0-9a-f-]{36}$/i.test(id) || (status !== "approved" && status !== "rejected")) {
    return { success: false, error: "Invalid review." };
  }
  const { error } = await supabase.from("reviews").update({ status }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function createStaff(input: {
  fullName: string;
  email: string;
  password: string;
  permissions: string[];
}): Promise<AdminActionResult> {
  await requireOwner();
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const permissions = cleanPermissions(input.permissions);
  if (fullName.length < 2 || fullName.length > 80) return { success: false, error: "Enter the staff member's name." };
  if (!emailPattern.test(email)) return { success: false, error: "Enter a valid email address." };
  if (input.password.length < 8) return { success: false, error: "Use a password of at least 8 characters." };
  if (permissions.length === 0) return { success: false, error: "Choose at least one area this person can open." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role: "staff", permissions },
  });
  if (error) {
    const message = /already.+registered|already.+exists/i.test(error.message)
      ? "That email already has an account. Use a different email for this staff member."
      : error.message;
    return { success: false, error: message };
  }
  revalidatePath("/admin");
  return { success: true };
}

export async function updateStaffAccess(userId: string, permissions: string[]): Promise<AdminActionResult> {
  await requireOwner();
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { success: false, error: "Invalid staff account." };
  const nextPermissions = cleanPermissions(permissions);
  if (nextPermissions.length === 0) return { success: false, error: "Choose at least one area, or remove the staff account." };

  const admin = createSupabaseAdminClient();
  const { data, error: lookupError } = await admin.auth.admin.getUserById(userId);
  if (lookupError || !data.user) return { success: false, error: lookupError?.message || "Staff account not found." };
  if (storeRole(data.user) !== "staff") return { success: false, error: "Only a staff account can have limited access." };

  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: "staff", permissions: nextPermissions },
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function resetAccountPassword(userId: string, password: string): Promise<AdminActionResult> {
  const actor = await currentUser();
  const actorRole = storeRole(actor);
  if (!actorRole) return { success: false, error: "You do not have permission to reset passwords." };
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { success: false, error: "Invalid account." };
  if (password.length < 8) return { success: false, error: "Use a password of at least 8 characters." };

  const admin = createSupabaseAdminClient();
  const { data, error: lookupError } = await admin.auth.admin.getUserById(userId);
  if (lookupError || !data.user) return { success: false, error: lookupError?.message || "Account not found." };
  const targetRole = storeRole(data.user);
  const ownAccount = actor.id === userId;
  const adminResettingStaff = actorRole === "admin" && targetRole === "staff";
  if (!ownAccount && !adminResettingStaff) return { success: false, error: "You can reset your own password, or a staff password." };

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function removeStaff(userId: string): Promise<AdminActionResult> {
  const actor = await requireOwner();
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { success: false, error: "Invalid staff account." };
  if (actor.id === userId) return { success: false, error: "You cannot remove your own admin access here." };

  const admin = createSupabaseAdminClient();
  const { data, error: lookupError } = await admin.auth.admin.getUserById(userId);
  if (lookupError || !data.user) return { success: false, error: lookupError?.message || "Staff account not found." };
  if (storeRole(data.user) !== "staff") return { success: false, error: "Only a staff account can be removed." };

  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: null, permissions: [] },
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin");
  return { success: true };
}
