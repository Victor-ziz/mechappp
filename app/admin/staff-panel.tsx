"use client";

import { useState } from "react";
import { staffPermissions, type StaffPermission } from "../../lib/admin/access";
import type { StoreAccount } from "../../lib/admin/types";
import { createStaff, removeStaff, resetAccountPassword, updateStaffAccess } from "./actions";

export default function StaffPanel({
  accounts,
  currentUserId,
  isAdmin,
  busy,
  onDone,
}: {
  accounts: StoreAccount[];
  currentUserId: string;
  isAdmin: boolean;
  busy: boolean;
  onDone: (result: Promise<{ success: boolean; error?: string }>, message: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<StaffPermission[]>(["orders"]);
  const [ownPassword, setOwnPassword] = useState("");

  const toggle = (id: StaffPermission) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <div className="admin-content admin-staff">
      <section className="admin-panel">
        <p className="admin-eyebrow">Your sign-in</p>
        <h2>Reset your password</h2>
        <form className="admin-form-grid" onSubmit={(event) => {
          event.preventDefault();
          const nextPassword = ownPassword;
          onDone(resetAccountPassword(currentUserId, nextPassword).then((result) => {
            if (result.success) setOwnPassword("");
            return result;
          }), "Your password has been changed.");
        }}>
          <label>New password
            <input type="password" value={ownPassword} onChange={(event) => setOwnPassword(event.target.value)} minLength={8} autoComplete="new-password" required placeholder="At least 8 characters" />
          </label>
          <button type="submit" className="admin-primary-button" disabled={busy}>Save new password</button>
        </form>
      </section>

      {isAdmin && (
        <section className="admin-panel">
          <p className="admin-eyebrow">New person</p>
          <h2>Add staff</h2>
          <p className="admin-muted">They sign in at the admin page with this email and password. They only see the areas you tick.</p>
          <form className="admin-form-grid" onSubmit={(event) => {
            event.preventDefault();
            const staffName = name.trim();
            onDone(createStaff({ fullName: name, email, password, permissions: selected }).then((result) => {
              if (result.success) {
                setName("");
                setEmail("");
                setPassword("");
                setSelected(["orders"]);
              }
              return result;
            }), `${staffName} can now sign in.`);
          }}>
            <label>Full name
              <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} autoComplete="off" />
            </label>
            <label>Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="off" />
            </label>
            <label>Starting password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoComplete="new-password" placeholder="At least 8 characters" />
            </label>
            <PermissionChecks selected={selected} onToggle={toggle} />
            <button type="submit" className="admin-primary-button" disabled={busy || selected.length === 0}>Add staff</button>
          </form>
        </section>
      )}

      {isAdmin && accounts.map((account) => (
        <StaffAccount key={account.id} account={account} currentUserId={currentUserId} busy={busy} onDone={onDone} />
      ))}
    </div>
  );
}

function PermissionChecks({
  selected,
  onToggle,
}: {
  selected: StaffPermission[];
  onToggle: (id: StaffPermission) => void;
}) {
  return (
    <fieldset className="staff-permissions">
      <legend>This person can open</legend>
      {staffPermissions.map((item) => (
        <label key={item.id}>
          <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
          {item.label}
        </label>
      ))}
    </fieldset>
  );
}

function StaffAccount({
  account,
  currentUserId,
  busy,
  onDone,
}: {
  account: StoreAccount;
  currentUserId: string;
  busy: boolean;
  onDone: (result: Promise<{ success: boolean; error?: string }>, message: string) => void;
}) {
  const [selected, setSelected] = useState<StaffPermission[]>(account.permissions);
  const [password, setPassword] = useState("");
  const ownAccount = account.id === currentUserId;
  const toggle = (id: StaffPermission) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <article className="admin-panel admin-staff-card">
      <div>
        <p className="admin-eyebrow">{account.role === "admin" ? "Admin" : "Staff"}</p>
        <h2>{account.fullName || account.email}</h2>
        <p className="admin-muted">{account.email}</p>
      </div>
      {account.role === "admin" ? <p className="admin-muted">Full access to every area, including staff.</p> : (
        <form className="admin-form-grid" onSubmit={(event) => {
          event.preventDefault();
          onDone(updateStaffAccess(account.id, selected), "Staff access updated.");
        }}>
          <PermissionChecks selected={selected} onToggle={toggle} />
          <button type="submit" className="admin-primary-button" disabled={busy || selected.length === 0}>Save access</button>
        </form>
      )}
      {!ownAccount && account.role === "staff" && (
        <form className="admin-form-grid" onSubmit={(event) => {
          event.preventDefault();
          onDone(resetAccountPassword(account.id, password).then((result) => {
            if (result.success) setPassword("");
            return result;
          }), `Password updated for ${account.email}.`);
        }}>
          <label>New password for this person
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoComplete="new-password" placeholder="At least 8 characters" />
          </label>
          <div className="admin-staff-actions">
            <button type="submit" className="admin-primary-button" disabled={busy}>Reset password</button>
            <button type="button" disabled={busy} onClick={() => onDone(removeStaff(account.id), `${account.email} no longer has staff access.`)}>Remove access</button>
          </div>
        </form>
      )}
    </article>
  );
}
