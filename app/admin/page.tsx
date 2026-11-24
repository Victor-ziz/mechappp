import type { Metadata } from "next";
import { Suspense } from "react";
import AdminAccess from "./access";
import AdminDashboard from "./dashboard";
import { storeHasAdmin } from "../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import type { AdminCustomer, AdminOrder, AdminProduct } from "../../lib/admin/types";

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
  if (user.app_metadata.role !== "admin") return <AdminAccess mode="forbidden" />;

  const [productsResult, ordersResult, customersResult] = await Promise.all([
    supabase.from("products").select("id,name,category,price,image,images,stock,active,created_at").order("id"),
    supabase.from("orders").select("id,reference,customer_name,customer_email,channel,status,total,items,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("customer_profiles").select("id,email,full_name,created_at").order("created_at", { ascending: false }).limit(200),
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
      adminEmail={user.email ?? ""}
    />
  );
}
