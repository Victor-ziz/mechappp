"use client";

import { useState, type FormEvent } from "react";
import type { StoreContact } from "../../lib/store-contact";
import { saveStoreContact } from "./actions";

export default function ContactPanel({
  contact,
  setupError,
  busy,
  onDone,
}: {
  contact: StoreContact;
  setupError: string;
  busy: boolean;
  onDone: (result: Promise<{ success: boolean; error?: string }>, message: string) => void;
}) {
  const [whatsappNumber, setWhatsappNumber] = useState(contact.whatsappNumber);
  const [instagramUrl, setInstagramUrl] = useState(contact.instagramUrl);
  const [facebookUrl, setFacebookUrl] = useState(contact.facebookUrl);
  const [tiktokUrl, setTiktokUrl] = useState(contact.tiktokUrl);
  const [xUrl, setXUrl] = useState(contact.xUrl);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onDone(saveStoreContact({ whatsappNumber, instagramUrl, facebookUrl, tiktokUrl, xUrl }), "Contact details saved. They are now on the shop.");
  };

  return (
    <div className="admin-content">
      <form className="admin-panel admin-contact" onSubmit={save}>
        <div className="admin-panel-heading">
          <div>
            <p className="admin-eyebrow">Shop contact</p>
            <h2>WhatsApp and social links</h2>
          </div>
        </div>
        {setupError && <p className="admin-alert" role="alert">{setupError}</p>}
        <label>WhatsApp number<input value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="2349069245835" required /></label>
        <label>Instagram<input value={instagramUrl} onChange={(event) => setInstagramUrl(event.target.value)} placeholder="https://instagram.com/yourpage" /></label>
        <label>Facebook<input value={facebookUrl} onChange={(event) => setFacebookUrl(event.target.value)} placeholder="https://facebook.com/yourpage" /></label>
        <label>TikTok<input value={tiktokUrl} onChange={(event) => setTiktokUrl(event.target.value)} placeholder="https://tiktok.com/@yourpage" /></label>
        <label>X<input value={xUrl} onChange={(event) => setXUrl(event.target.value)} placeholder="https://x.com/yourpage" /></label>
        <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save contact details"}</button>
      </form>
    </div>
  );
}
