"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Save, X } from "lucide-react";
import type { AdminProduct } from "../../lib/admin/types";
import { saveProduct } from "./actions";
import "./product-form.css";

const emptyProduct: AdminProduct = {
  id: 0,
  name: "",
  category: "",
  price: 0,
  image: "",
  images: [],
  stock: 0,
  active: true,
  created_at: "",
};

export default function ProductForm({
  product = emptyProduct,
  cars,
  busy,
  onClose,
  onSaved,
}: {
  product?: AdminProduct;
  cars: string[];
  busy: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isNew = product.id === 0;
  const knownCar = cars.includes(product.category);
  const [name, setName] = useState(isNew ? "" : product.name);
  const [carChoice, setCarChoice] = useState(isNew || !knownCar ? "__new__" : product.category);
  const [newCar, setNewCar] = useState(isNew || knownCar ? "" : product.category);
  const [price, setPrice] = useState(isNew ? "" : String(product.price));
  const [stock, setStock] = useState(String(product.stock));
  const [keptPhotos, setKeptPhotos] = useState<string[]>(isNew ? [] : product.images.slice(0, 3));
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [localError, setLocalError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const next = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(next);
    return () => next.forEach((item) => URL.revokeObjectURL(item.url));
  }, [files]);
  const photoCount = keptPhotos.length + files.length;
  const carName = (carChoice === "__new__" ? newCar : carChoice).trim();

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const room = 3 - keptPhotos.length - files.length;
    const next = [...files, ...Array.from(list)].slice(0, files.length + Math.max(room, 0));
    if (list.length > room) setLocalError("A part can have 2 or 3 photos.");
    else setLocalError("");
    setFiles(next);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (photoCount < 2 || photoCount > 3) {
      setLocalError("Add 2 or 3 photos. Shoppers see all of them in the preview.");
      return;
    }
    if (!carName) {
      setLocalError("Enter the car this part fits, for example Corolla.");
      return;
    }
    setLocalError("");
    setUploading(true);
    try {
      let uploaded: string[] = [];
      if (files.length) {
        const body = new FormData();
        files.forEach((file) => body.append("files", file));
        const response = await fetch("/api/admin/upload", { method: "POST", body });
        const result = await response.json() as { urls?: string[]; error?: string };
        if (!response.ok || !result.urls) {
          setLocalError(result.error || "The photos could not be uploaded.");
          return;
        }
        uploaded = result.urls;
      }
      const images = [...keptPhotos, ...uploaded].slice(0, 3);
      const result = await saveProduct({
        id: isNew ? null : product.id,
        name,
        category: carName,
        price: Number(price),
        stock: Number(stock),
        image: images[0],
        images,
      });
      if (!result.success) {
        setLocalError(result.error || "The product could not be saved.");
        return;
      }
      onSaved(isNew ? `${name.trim()} is now listed under ${carName}.` : "Product updated.");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "The product could not be saved.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form className="admin-panel admin-product-form" onSubmit={submit}>
      <div className="admin-panel-heading">
        <div>
          <p className="admin-eyebrow">{isNew ? "New part" : "Edit part"}</p>
          <h2>{isNew ? "Add a part" : product.name}</h2>
        </div>
        <button type="button" className="admin-icon-button" onClick={onClose} aria-label="Close product form"><X size={18} /></button>
      </div>
      <div className="admin-form-grid">
        <label>Part name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} placeholder="Ceramic brake pad set" required /></label>
        <label>Car
          <select value={carChoice} onChange={(event) => setCarChoice(event.target.value)}>
            <option value="__new__">New car</option>
            {cars.map((car) => <option key={car} value={car}>{car}</option>)}
          </select>
        </label>
        {carChoice === "__new__" && (
          <label className="admin-form-wide">Car name<input value={newCar} onChange={(event) => setNewCar(event.target.value)} maxLength={80} placeholder="Corolla" required /></label>
        )}
        <label>Price (₦)<input value={price} onChange={(event) => setPrice(event.target.value)} type="number" min="1" step="1" required /></label>
        <label>Stock quantity<input value={stock} onChange={(event) => setStock(event.target.value)} type="number" min="0" step="1" required /></label>
        <div className="admin-form-wide admin-photos">
          <div className="admin-photos-heading">
            <strong>Photos</strong>
            <span>{photoCount} of 3</span>
          </div>
          <p>Upload 2 or 3 pictures. The first photo is the one shown on the shop, and all of them open in the preview.</p>
          <div className="admin-photo-grid">
            {keptPhotos.map((src) => (
              <figure key={src}>
                <img src={src} alt="" />
                <button type="button" onClick={() => setKeptPhotos((current) => current.filter((item) => item !== src))} aria-label="Remove photo"><X size={14} /></button>
              </figure>
            ))}
            {previews.map(({ file, url }) => (
              <figure key={`${file.name}-${file.lastModified}`}>
                <img src={url} alt="" />
                <button type="button" onClick={() => setFiles((current) => current.filter((item) => item !== file))} aria-label={`Remove ${file.name}`}><X size={14} /></button>
              </figure>
            ))}
          </div>
          {photoCount < 3 && (
            <label className="admin-upload">
              Add photos
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
            </label>
          )}
        </div>
      </div>
      {localError && <p className="admin-alert" role="alert">{localError}</p>}
      <button className="admin-primary-button" type="submit" disabled={busy || uploading}>
        <Save size={16} />{uploading ? "Uploading photos…" : busy ? "Saving…" : "Save part"}
      </button>
    </form>
  );
}
