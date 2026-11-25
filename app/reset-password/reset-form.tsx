"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import "../admin/access.css";
import { supabase } from "../../lib/supabase/client";

export default function ResetPasswordForm() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      return;
    }
    const client = supabase;
    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setChecking(false);
      }
    });
    void (async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (!active) return;
        const { data } = await client.auth.getSession();
        if (exchangeError && !data.session) setError("This reset link is invalid or has expired. Request a new one.");
        if (data.session) setReady(true);
        setChecking(false);
        return;
      }

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        await client.auth.getSession();
        if (!active) return;
        const { data, error: sessionError } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!active) return;
        window.history.replaceState(window.history.state, "", window.location.pathname);
        if (sessionError || !data.session) setError("This reset link is invalid or has expired. Request a new one.");
        else setReady(true);
        setChecking(false);
        return;
      }

      const { data } = await client.auth.getSession();
      if (!active) return;
      if (data.session) setReady(true);
      setChecking(false);
    })();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    if (password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotice("Your password has been changed. Sign in with the new password.");
    setPassword("");
    setConfirm("");
  };

  return (
    <main className="admin-access">
      <section className="admin-access-card">
        <p className="admin-eyebrow">FRAN6</p>
        <h1>Choose a new password</h1>
        {checking && <p>Checking your reset link…</p>}
        {!checking && !ready && !notice && !error && (
          <p>Open the reset link in your email, or request a new one from sign-in.</p>
        )}
        {error && <p className="admin-alert" role="alert">{error}</p>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {ready && !notice && (
          <form onSubmit={save}>
            <label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
            <label>Confirm password<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
            <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
          </form>
        )}
        <Link className="admin-access-back" href="/">Back to the shop</Link>
      </section>
    </main>
  );
}
