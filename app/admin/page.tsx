import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import AdminAccess from "./access";
import AdminDashboard from "./dashboard";
import { canAccess, permissionsFor, storeRole } from "../../lib/admin/access";
import type { AdminCustomer, AdminOrder, AdminProduct, AdminReview, StoreAccount } from "../../lib/admin/types";
import { createSupabaseAdminClient, listStoreAccounts, storeHasAdmin } from "../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../lib/supabase/server";

export const metadata: Metadata = {
  title: "FRAN6 admin",
};

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="admin-setup"><h1>Loading admin dashboard…</h1></main>}>
      <AdminPageContent />
    </Suspense>
  );
}

async function AdminPageContent() {
  await connection();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return (
      <main className="admin-setup">
        <h1>Admin setup required</h1>
        <p>Configure Supabase before opening the store dashboard.</p>
      </main>
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <main className="admin-setup">
        <h1>Admin setup required</h1>
        <p>Add SUPABASE_SERVICE_ROLE_KEY to .env.local, then restart the app.</p>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError && user) {
    return (
      <main className="admin-setup">
        <h1>Could not verify your account</h1>
        <p>{authError.message}</p>
      </main>
    );
  }
  if (!user) {
    let hasAdmin = false;
    try {
      hasAdmin = await storeHasAdmin();
    } catch (error) {
      return (
        <main className="admin-setup">
          <h1>Could not check admin accounts</h1>
          <p>{error instanceof Error ? error.message : "Try again in a moment."}</p>
        </main>
      );
    }
    return <AdminAccess mode={hasAdmin ? "sign-in" : "setup"} />;
  }
  const role = storeRole(user);
  const permissions = permissionsFor(user);
  if (!role || permissions.length === 0) return <AdminAccess mode="forbidden" />;

  const database = createSupabaseAdminClient();
  const empty = Promise.resolve({ data: [], error: null });
  const [productsResult, ordersResult, customersResult, reviewsResult, accounts] = await Promise.all([
    canAccess(user, "products") ? database.from("products").select("id,name,category,price,image,images,stock,active,created_at").order("id") : empty,
    canAccess(user, "orders") ? database.from("orders").select("id,reference,customer_name,customer_email,channel,status,total,items,created_at").order("created_at", { ascending: false }).limit(100) : empty,
    canAccess(user, "customers") ? database.from("customer_profiles").select("id,email,full_name,created_at").order("created_at", { ascending: false }).limit(200) : empty,
    canAccess(user, "reviews") ? database.from("reviews").select("id,product_id,customer_name,rating,comment,status,created_at,products(name)").order("created_at", { ascending: false }).limit(100) : empty,
    role === "admin" ? listStoreAccounts() : Promise.resolve([] as StoreAccount[]),
  ]);
  const dataError = productsResult.error || ordersResult.error || customersResult.error;
  if (dataError) {
    return (
      <main className="admin-setup">
        <h1>Admin database setup required</h1>
        <p>{dataError.message}</p>
        <p>Apply the FRAN6 admin migration in your Supabase SQL Editor, then reload this page.</p>
      </main>
    );
  }

  return (
    <AdminDashboard
      products={(productsResult.data ?? []) as AdminProduct[]}
      orders={(ordersResult.data ?? []) as AdminOrder[]}
      customers={(customersResult.data ?? []) as AdminCustomer[]}
      reviews={(reviewsResult.data ?? []) as AdminReview[]}
      reviewsError={reviewsResult.error ? "Reviews are not ready yet. Run supabase/migrations/202611240001_reviews.sql in the Supabase SQL editor." : ""}
      adminEmail={user.email ?? ""}
      role={role}
      permissions={permissions}
      currentUserId={user.id}
      accounts={accounts}
    />
  );
}
