"use client";

import { useState, type FormEvent } from "react";
import "./access.css";
import Link from "next/link";
import { supabase } from "../../lib/supabase/client";
import { createFirstAdmin } from "./actions";

export default function AdminAccess({ mode }: { mode: "setup" | "sign-in" | "forbidden" }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase is not configured in this app.");
      return;
    }
    setError("");
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError(signInError.message);
      setBusy(false);
      return;
    }
    window.location.assign("/admin");
  };

  const createAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const result = await createFirstAdmin({ fullName, email, password });
    if (!result.success) {
      setError(result.error || "Could not create the admin account.");
      setBusy(false);
      return;
    }
    if (!supabase) {
      setError("Admin account created. Sign in from this page.");
      setBusy(false);
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError(signInError.message);
      setBusy(false);
      return;
    }
    window.location.assign("/admin");
  };

  const signOut = async () => {
    if (!supabase) return;
    setBusy(true);
    await supabase.auth.signOut();
    window.location.assign("/admin");
  };

  return (
    <main className="admin-access">
      <section className="admin-access-card">
        <p className="admin-eyebrow">FRAN6</p>
        {mode === "setup" && (
          <>
            <h1>Create the store admin</h1>
            <p>This is the first admin account. It can manage products, stock, orders, and customers. Later accounts use sign-in.</p>
            <form onSubmit={createAdmin}>
              <label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required /></label>
              <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
              <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
              {error && <p className="admin-alert" role="alert">{error}</p>}
              <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create admin and open dashboard"}</button>
            </form>
          </>
        )}
        {mode === "sign-in" && (
          <>
            <h1>Store admin</h1>
            <p>Sign in with the admin account to manage the shop.</p>
            <form onSubmit={signIn}>
              <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
              <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
              {error && <p className="admin-alert" role="alert">{error}</p>}
              <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
            </form>
          </>
        )}
        {mode === "forbidden" && (
          <>
            <h1>No store access</h1>
            <p>This account can shop, but it is not allowed to manage the store. Ask the admin if you need staff access.</p>
            {error && <p className="admin-alert" role="alert">{error}</p>}
            <button className="admin-primary-button" type="button" onClick={signOut} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>
          </>
        )}
        <Link className="admin-access-back" href="/">Back to the shop</Link>
      </section>
    </main>
  );
}
