"use client";

import Image from "next/image";
import "./shop.css";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronRight, Heart, LogOut, MessageCircle, Minus, Plus, Search, ShieldCheck, ShoppingBag, Trash2, UserRound, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase/client";
import PhotoSwipe from "./photo-swipe";
import ProductReviews, { StarRow } from "./product-reviews";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        reference: string;
        metadata?: Record<string, unknown>;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  image: string;
  images: string[];
  availability?: string;
  stock?: number;
};

const allCars = "All cars";

const products: Product[] = [
  { id: 1, name: "Ceramic Brake Pad Set", category: "Corolla", price: 48500, availability: "In stock", stock: 10, image: "/part8.jpg", images: ["/part8.jpg", "/part1.jpg", "/part9.jpg"] },
  { id: 2, name: "Premium Engine Air Filter", category: "Corolla", price: 18500, availability: "In stock", stock: 10, image: "/part1.jpg", images: ["/part1.jpg", "/part7.jpg", "/part10.jpg"] },
  { id: 3, name: "Synthetic Engine Oil 5W-30", category: "Corolla", price: 32000, availability: "In stock", stock: 10, image: "/part5.jpg", images: ["/part5.jpg", "/part1.jpg", "/part2.jpg"] },
  { id: 4, name: "Oxygen Sensor", category: "Camry", price: 27900, availability: "Low stock", stock: 3, image: "/part6.jpg", images: ["/part6.jpg", "/part2.jpg", "/part7.jpg"] },
  { id: 5, name: "Engine Timing Belt Kit", category: "Camry", price: 76500, availability: "In stock", stock: 10, image: "/part4.jpg", images: ["/part4.jpg", "/part5.jpg", "/part1.jpg"] },
  { id: 6, name: "Front Shock Absorber", category: "Hilux", price: 54900, availability: "In stock", stock: 10, image: "/part3.jpg", images: ["/part3.jpg", "/part12.jpg", "/car11.jpg"] },
  { id: 7, name: "Radiator Coolant 4L", category: "Hilux", price: 22400, availability: "In stock", stock: 10, image: "/part7.jpg", images: ["/part7.jpg", "/part2.jpg", "/part1.jpg"] },
  { id: 8, name: "Automatic Transmission Fluid", category: "Hilux", price: 29800, availability: "In stock", stock: 10, image: "/part10.jpg", images: ["/part10.jpg", "/part9.jpg", "/part5.jpg"] },
];

const formatNaira = (value: number) => `₦${value.toLocaleString("en-NG")}`;
const whatsappNumber = "2349069245835";

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(allCars);
  const [storeProducts, setStoreProducts] = useState(products);
  const [catalogError, setCatalogError] = useState("");
  const [ratings, setRatings] = useState<Record<number, { average: number; count: number }>>({});
  const [cart, setCart] = useState<Record<number, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [saved, setSaved] = useState<number[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [previewQuantity, setPreviewQuantity] = useState(1);
  const previewCloseButton = useRef<HTMLButtonElement>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutProduct, setCheckoutProduct] = useState<(Product & { quantity: number }) | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [pendingCardCheckout, setPendingCardCheckout] = useState(false);
  const [paystackReady, setPaystackReady] = useState(() => typeof window !== "undefined" && Boolean(window.PaystackPop));
  const [paystackLoadError, setPaystackLoadError] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [orderError, setOrderError] = useState("");
  const paystackConfigured = Boolean(process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase.from("products")
          .select("id,name,category,price,image,images,stock,active")
          .eq("active", true)
          .order("id");
        if (!active) return;
        if (error) {
          const missingTable = error.code === "PGRST205" || error.message.includes("public.products");
          setCatalogError(missingTable
            ? "Supabase is connected, but the store tables have not been created yet. Run supabase/migrations/202611210001_admin_dashboard.sql in the Supabase SQL editor."
            : `Live inventory could not load: ${error.message}`);
          return;
        }
        setCatalogError("");
        setStoreProducts((data ?? []).map((product) => {
          const photos = (Array.isArray(product.images) ? product.images : []).filter(Boolean).slice(0, 3);
          return {
            id: product.id,
            name: product.name,
            category: product.category,
            price: product.price,
            image: photos[0] || product.image,
            images: photos.length ? photos : [product.image],
            stock: product.stock,
            availability: product.stock === 0 ? "Out of stock" : product.stock <= 3 ? "Low stock" : "In stock",
          };
        }));
      } catch (error: unknown) {
        if (active) setCatalogError(error instanceof Error ? error.message : "Live inventory could not load.");
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.from("reviews").select("product_id,rating").eq("status", "approved").then(({ data }) => {
      if (!data) return;
      const grouped = new Map<number, number[]>();
      for (const row of data) {
        const scores = grouped.get(row.product_id) ?? [];
        scores.push(row.rating);
        grouped.set(row.product_id, scores);
      }
      const next: Record<number, { average: number; count: number }> = {};
      for (const [id, scores] of grouped) {
        next[id] = { average: scores.reduce((sum, score) => sum + score, 0) / scores.length, count: scores.length };
      }
      setRatings(next);
    });
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setAuthError(error.message);
          return;
        }
        setAuthUser(data.session?.user ?? null);
      })
      .catch((error: unknown) => {
        if (active) setAuthError(error instanceof Error ? error.message : "Could not load your account.");
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (window.PaystackPop) return;

    let script = document.querySelector<HTMLScriptElement>('script[src="https://js.paystack.co/v1/inline.js"]');
    const handleLoad = () => {
      if (window.PaystackPop) setPaystackReady(true);
      else setPaystackLoadError(true);
    };
    const handleError = () => setPaystackLoadError(true);

    if (!script) {
      script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
    }
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    if (!script.isConnected) document.body.appendChild(script);

    return () => {
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };
  }, []);

  useEffect(() => {
    if (!previewProduct) return;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    previewCloseButton.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewProduct(null);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [previewProduct]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return storeProducts.filter((product) => {
      const matchesCategory = activeCategory === allCars || product.category === activeCategory;
      const matchesQuery = !normalizedQuery || `${product.name} ${product.category}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query, storeProducts]);

  const cartItems = useMemo(
    () => storeProducts.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] })),
    [cart, storeProducts]
  );
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const checkoutItems = checkoutProduct ? [checkoutProduct] : cartItems;
  const checkoutCount = checkoutItems.reduce((sum, item) => sum + item.quantity, 0);
  const checkoutSubtotal = checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const updateQuantity = (id: number, amount: number) => {
    setCart((current) => {
      const quantity = (current[id] || 0) + amount;
      const product = storeProducts.find((item) => item.id === id);
      if (amount > 0 && product?.stock !== undefined && quantity > product.stock) return current;
      const next = { ...current };
      if (quantity <= 0) delete next[id];
      else next[id] = quantity;
      return next;
    });
  };

  const removeItem = (id: number) => {
    setCart((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const toggleSaved = (id: number) => {
    setSaved((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  };

  const openPreview = (product: Product) => {
    setPreviewQuantity(1);
    setPreviewProduct(product);
  };

  const openAccount = () => {
    setAuthMode("sign-in");
    setAuthError("");
    setAuthNotice("");
    setAuthOpen(true);
  };

  const closeAccount = () => {
    setAuthOpen(false);
    setPendingCardCheckout(false);
    setAuthPassword("");
  };

  const finishSignIn = (user: User) => {
    setAuthUser(user);
    setAuthPassword("");
    setAuthError("");
    setAuthNotice("");
    setAuthOpen(false);

    if (pendingCardCheckout) {
      setCustomerName(typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "");
      setCustomerEmail(user.email ?? "");
      setCheckoutOpen(true);
      setPendingCardCheckout(false);
    }
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setAuthError("Customer accounts are not configured yet. Please try again later.");
      return;
    }

    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");

    try {
      if (authMode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: {
            data: { full_name: authName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) {
          setAuthError(error.message);
        } else if (data.session && data.user) {
          finishSignIn(data.user);
        } else {
          setAuthPassword("");
          setAuthMode("sign-in");
          setAuthNotice("Account created. Check your email to confirm it, then sign in to continue.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) setAuthError(error.message);
        else if (data.user) finishSignIn(data.user);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not complete sign-in. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) setAuthError(error.message);
      else {
        setAuthUser(null);
        setAuthNotice("You are signed out.");
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const startCardCheckout = () => {
    setCheckoutError("");
    if (!authUser) {
      setCheckoutOpen(false);
      setPendingCardCheckout(true);
      setAuthMode("sign-in");
      setAuthError("");
      setAuthNotice("Sign in or create an account to continue with card checkout.");
      setAuthOpen(true);
      return;
    }

    setCustomerName(typeof authUser.user_metadata.full_name === "string" ? authUser.user_metadata.full_name : "");
    setCustomerEmail(authUser.email ?? "");
    setCheckoutOpen(true);
  };

  const startBuyNow = (product: Product, quantity = 1) => {
    setCheckoutError("");
    setOrderError("");
    setCheckoutProduct({ ...product, quantity });
    setCustomerName(typeof authUser?.user_metadata.full_name === "string" ? authUser.user_metadata.full_name : "");
    setCustomerEmail(authUser?.email ?? "");
    setPreviewProduct(null);
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const createStoreOrder = async (channel: "paystack" | "whatsapp", items: { id: number; quantity: number }[]) => {
    if (!supabase) throw new Error("Order database is not configured.");
    const { data, error } = await supabase.rpc("create_store_order", {
      p_customer_name: channel === "paystack" ? customerName.trim() : authUser?.user_metadata.full_name ?? "",
      p_customer_email: channel === "paystack" ? authUser?.email ?? "" : authUser?.email ?? "",
      p_channel: channel,
      p_items: items.map(({ id, quantity }) => ({ id, quantity })),
    });
    if (error) {
      const missingOrderFunction = error.code === "PGRST202" || error.message.includes("create_store_order");
      throw new Error(missingOrderFunction
        ? "Card checkout cannot start yet. Create the Supabase tables and order functions by running supabase/migrations/202611210001_admin_dashboard.sql in the Supabase SQL editor, then try again."
        : error.message);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("The order could not be created.");
    const order = data as { reference?: unknown; total?: unknown };
    if (typeof order.reference !== "string" || typeof order.total !== "number") throw new Error("The order service returned invalid data.");
    return { reference: order.reference, total: order.total };
  };

  const recordWhatsAppOrder = (items: { id: number; quantity: number }[]) => {
    setOrderError("");
    void createStoreOrder("whatsapp", items)
      .then(() => setOrderError(""))
      .catch((error: unknown) => setOrderError(error instanceof Error ? error.message : "Could not record this order."));
  };

  const verifyPaystackOrder = async (reference: string, singleProductCheckout: boolean) => {
    try {
      const response = await fetch("/api/paystack/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const result = await response.json() as { error?: string; verified?: boolean };
      if (!response.ok || !result.verified) {
        setCheckoutError(result.error || "Payment could not be verified yet. Keep your reference and contact us.");
        return;
      }
      window.alert(`Payment successful. Reference: ${reference}`);
      if (singleProductCheckout) setCheckoutProduct(null);
      else setCart({});
      setCheckoutOpen(false);
      setCartOpen(false);
      setCheckoutError("");
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Payment could not be verified. Please contact us with your reference.");
    }
  };

  const closeCheckout = () => {
    setCheckoutOpen(false);
    setCheckoutProduct(null);
    setCheckoutError("");
  };

  const payWithPaystack = async () => {
    if (!authUser) {
      setCheckoutOpen(false);
      setPendingCardCheckout(true);
      setAuthMode("sign-in");
      setAuthOpen(true);
      return;
    }
    if (!paystackConfigured) {
      setCheckoutError("Paystack payments are not set up yet. Please place your order via WhatsApp.");
      return;
    }
    if (!window.PaystackPop) {
      setCheckoutError(paystackLoadError ? "Paystack could not load. Please try again or order via WhatsApp." : "Paystack is still loading. Please try again in a moment.");
      return;
    }
    if (!customerName.trim() || !authUser.email) {
      setCheckoutError("Add your full name to your account to continue.");
      return;
    }

    setCheckoutError("");
    let order: { reference: string; total: number };
    try {
      order = await createStoreOrder("paystack", checkoutItems);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not create the payment order.");
      return;
    }
    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!publicKey) {
      setCheckoutError("Add NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY to enable payments.");
      return;
    }
    const handler = window.PaystackPop.setup({
      key: publicKey,
      email: authUser.email,
      amount: order.total * 100,
      currency: "NGN",
      reference: order.reference,
      metadata: {
        custom_fields: [{ display_name: "Customer name", variable_name: "customer_name", value: customerName }],
        cart: checkoutItems.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price })),
      },
      callback: (response) => {
        void verifyPaystackOrder(response.reference, Boolean(checkoutProduct));
      },
      onClose: () => undefined,
    });
    handler.openIframe();
  };

  const savedItems = storeProducts.filter((product) => saved.includes(product.id));

  const whatsappMessage = encodeURIComponent(
    `Hello FRAN6, I would like to order:\n${cartItems.map((item) => `• ${item.name} × ${item.quantity} — ${formatNaira(item.price * item.quantity)}`).join("\n")}\n\nSubtotal: ${formatNaira(subtotal)}\nPlease confirm availability, delivery options and payment details.`
  );
  const checkoutWhatsappMessage = encodeURIComponent(
    `Hello FRAN6, I would like to order:\n${checkoutItems.map((item) => `• ${item.name} × ${item.quantity} — ${formatNaira(item.price * item.quantity)}`).join("\n")}\n\nSubtotal: ${formatNaira(checkoutSubtotal)}\nPlease confirm availability, delivery options and payment details.`
  );

  return (
    <div className="storefront">
      <header className="header">
        <div className="shell header-inner">
          <a className="brand" href="#top" aria-label="FRAN6 home">
            <Image
              src="/fran6-header-logo.png"
              alt="FRAN6 Car Parts"
              width={1536}
              height={542}
              priority
              unoptimized
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </a>
          <form className="search" onSubmit={(event) => event.preventDefault()}>
            <Search size={17} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a car or part" aria-label="Search cars and parts" />
            {query && <button type="button" className="clear-search" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}
          </form>
          <div className="header-actions">
            {(authUser?.app_metadata.role === "admin" || authUser?.app_metadata.role === "staff") && (
              <a className="admin-shortcut" href="/admin" aria-label="Open admin dashboard">
                <ShieldCheck size={19} /><span>Admin</span>
              </a>
            )}
            <button className="saved-button" onClick={() => setSavedOpen(true)} aria-label="View saved parts">
              <Heart size={19} /><span>Saved</span>{saved.length > 0 && <b>{saved.length}</b>}
            </button>
            <button className="cart-button" onClick={() => setCartOpen(true)} aria-label="Open shopping cart">
              <ShoppingBag size={20} /><span>Cart</span>{cartCount > 0 && <b>{cartCount}</b>}
            </button>
            <button className="account-button" onClick={openAccount} aria-label={authUser ? "Open your account" : "Sign in or create an account"}>
              <UserRound size={19} /><span>{authUser ? "Account" : "Sign in"}</span>
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="intro shell">
          <h1>Every part, in its place.</h1>
          <p>Choose a car, then the parts for that car.</p>
        </section>

        <section className="category-section" aria-label="Cars">
          <div className="shell category-scroll">
            {[allCars, ...Array.from(new Set(storeProducts.map((product) => product.category))).sort((a, b) => a.localeCompare(b))].map((category) => (
              <button key={category} className={activeCategory === category ? "category active" : "category"} onClick={() => setActiveCategory(category)}>{category}</button>
            ))}
          </div>
        </section>

        <section className="shell products-section">
          <div className="products-heading">
            <h2>{activeCategory === allCars ? "Parts for every car" : `${activeCategory} parts`}</h2>
            <span>{filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}</span>
          </div>
          {catalogError && <p className="catalog-warning" role="status">{catalogError} Showing the saved catalog until the database is available.</p>}

          {filteredProducts.length > 0 ? (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <article className="product-card" key={product.id}>
                  <div className="product-image">
                    <button type="button" className="product-image-view" onClick={() => openPreview(product)} aria-label={`View photos of ${product.name}`}>
                      <img src={product.image} alt="" />
                    </button>
                    {product.availability && <span className="availability">{product.availability}</span>}
                    <span className="photo-count">{Math.min(product.images.length, 3)} photos</span>
                    <button className={saved.includes(product.id) ? "save-product active" : "save-product"} onClick={() => toggleSaved(product.id)} aria-label={saved.includes(product.id) ? `Remove ${product.name} from saved parts` : `Save ${product.name}`}>
                      <Heart size={16} fill={saved.includes(product.id) ? "currentColor" : "none"} />
                    </button>
                  </div>
                  <div className="product-info">
                    <p>{product.category}</p>
                    <h3><button type="button" className="product-title-button" onClick={() => openPreview(product)}>{product.name}</button></h3>
                    <div className="product-bottom">
                      <strong>{formatNaira(product.price)}</strong>
                      {ratings[product.id] && <p className="product-rating"><StarRow rating={ratings[product.id].average} />{ratings[product.id].average.toFixed(1)}</p>}
                      <div className="product-actions">
                        <button type="button" className="product-add" onClick={() => updateQuantity(product.id, 1)} aria-label={`Add ${product.name} to cart`} disabled={!product.stock}>Add to cart</button>
                        <button type="button" className="product-buy-now" onClick={() => startBuyNow(product)} disabled={!product.stock}>Buy now</button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="no-results">
              <h3>No matching parts</h3>
              <p>Try another search or choose a different category.</p>
              <button onClick={() => { setQuery(""); setActiveCategory(allCars); }}>View all cars</button>
            </div>
          )}
        </section>

        <section className="about-section">
          <div className="shell about-grid">
            <p className="section-label">About FRAN6</p>
            <div>
              <h2>Parts, made straightforward.</h2>
              <p>FRAN6 is an independent motor spare parts business. The goal is to help customers find the motor parts they need without unnecessary complications.</p>
            </div>
          </div>
        </section>

        <section className="contact-section" id="contact">
          <div className="shell contact-grid">
            <div><p className="section-label">Contact</p><h2>Need help finding a part?</h2></div>
            <div className="contact-actions">
              <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>
              <span>Phone: +234 906 924 5835</span>
            </div>
          </div>
        </section>
      </main>

      <div className={cartOpen ? "cart-overlay visible" : "cart-overlay"} onClick={() => setCartOpen(false)} />
      <aside className={cartOpen ? "cart-drawer open" : "cart-drawer"} aria-label="Shopping cart">
        <div className="cart-header">
          <div><p>Your cart</p><h2>{cartCount} {cartCount === 1 ? "item" : "items"}</h2></div>
          <button onClick={() => setCartOpen(false)} aria-label="Close cart"><X size={20} /></button>
        </div>
        <div className="cart-content">
          {cartItems.length === 0 ? (
            <div className="empty-cart"><ShoppingBag size={34} /><h3>Your cart is empty</h3><p>Add a motor part to begin.</p><button onClick={() => setCartOpen(false)}>Continue browsing</button></div>
          ) : cartItems.map((item) => (
            <div className="cart-item" key={item.id}>
              <img src={item.image} alt="" />
              <div className="cart-item-info">
                <p>{item.category}</p><h3>{item.name}</h3><strong>{formatNaira(item.price)}</strong>
                <div className="cart-item-controls">
                  <div className="quantity">
                    <button onClick={() => updateQuantity(item.id, -1)} aria-label="Decrease quantity"><Minus size={13} /></button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} aria-label="Increase quantity"><Plus size={13} /></button>
                  </div>
                  <button className="remove-item" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`}><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {cartItems.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total"><span>Parts subtotal</span><strong>{formatNaira(subtotal)}</strong></div>
            <div className="checkout-options">
              <p className="checkout-options-title">Choose how to order</p>
              <button
                type="button"
                className="paystack-button"
                disabled={!paystackConfigured || paystackLoadError}
                aria-describedby={!paystackConfigured || paystackLoadError ? "paystack-setup-note" : undefined}
                onClick={() => { setCheckoutProduct(null); startCardCheckout(); }}
              >
                Pay by card with Paystack
                <ChevronRight size={17} />
              </button>
              {(!paystackConfigured || paystackLoadError) && (
                <p className="checkout-option-note" id="paystack-setup-note">
                  {paystackLoadError ? "Card checkout could not load. Please order via WhatsApp." : "Card checkout is not set up yet. Order via WhatsApp for now."}
                </p>
              )}
              {orderError && <p className="checkout-error" role="alert">{orderError}</p>}
              <a className="whatsapp-button" href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`} onClick={() => recordWhatsAppOrder(cartItems)} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={17} />
                Order via WhatsApp
              </a>
              <p className="checkout-option-note">Message us to confirm availability and delivery options.</p>
            </div>
          </div>
        )}
      </aside>

      {previewProduct && (
        <div className="modal-backdrop preview-backdrop" onClick={() => setPreviewProduct(null)}>
          <article className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="product-details-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" ref={previewCloseButton} onClick={() => setPreviewProduct(null)} aria-label="Close product details"><X size={20} /></button>
            <div className="preview-scroll">
            <div className="preview-gallery" aria-label="Product photos">
              <PhotoSwipe key={previewProduct.id} images={previewProduct.images.length ? previewProduct.images : [previewProduct.image]} label={previewProduct.name} />
            </div>
            <div className="preview-info">
              <p className="preview-category">{previewProduct.category}</p>
              <h2 id="product-details-title">{previewProduct.name}</h2>
              <strong className="preview-price">{formatNaira(previewProduct.price)}</strong>
              <ProductReviews productId={previewProduct.id} onSignIn={() => { setPreviewProduct(null); openAccount(); }} />
              <span className={previewProduct.availability === "Low stock" ? "preview-availability low-stock" : "preview-availability"}>
                <span aria-hidden="true" />
                {previewProduct.availability || "Check availability"}
              </span>
              <div className="preview-quantity">
                <span>Quantity</span>
                <div className="quantity">
                  <button type="button" onClick={() => setPreviewQuantity((quantity) => Math.max(1, quantity - 1))} aria-label="Decrease quantity" disabled={previewQuantity <= 1}><Minus size={13} /></button>
                  <span aria-live="polite">{previewQuantity}</span>
                  <button type="button" onClick={() => setPreviewQuantity((quantity) => Math.min(previewProduct.stock ?? quantity + 1, quantity + 1))} aria-label="Increase quantity" disabled={previewProduct.stock !== undefined && previewQuantity >= previewProduct.stock}><Plus size={13} /></button>
                </div>
              </div>
              <p className="preview-hint">Add to cart to choose WhatsApp ordering or Paystack when available.</p>
              <div className="preview-actions">
                <button type="button" className="preview-save" onClick={() => toggleSaved(previewProduct.id)}><Heart size={17} fill={saved.includes(previewProduct.id) ? "currentColor" : "none"} />{saved.includes(previewProduct.id) ? "Saved" : "Save part"}</button>
                <button type="button" className="preview-add" disabled={!previewProduct.stock || previewQuantity > (previewProduct.stock ?? 0)} onClick={() => { updateQuantity(previewProduct.id, previewQuantity); setPreviewProduct(null); setCartOpen(true); }}><ShoppingBag size={17} />Add to cart</button>
                <button type="button" className="preview-buy-now" disabled={!previewProduct.stock || previewQuantity > (previewProduct.stock ?? 0)} onClick={() => startBuyNow(previewProduct, previewQuantity)}>Buy now</button>
              </div>
            </div>
            </div>
          </article>
        </div>
      )}

      {savedOpen && (
        <div className="modal-backdrop" onClick={() => setSavedOpen(false)}>
          <aside className="saved-panel" onClick={(event) => event.stopPropagation()}>
            <div className="saved-header"><div><p>Saved parts</p><h2>{saved.length} {saved.length === 1 ? "part" : "parts"}</h2></div><button onClick={() => setSavedOpen(false)} aria-label="Close saved parts"><X size={20} /></button></div>
            <div className="saved-content">
              {savedItems.length === 0 ? <div className="empty-saved"><Heart size={34} /><h3>No saved parts</h3><p>Tap the heart on any part to save it here.</p></div> : savedItems.map((item) => (
                <div className="saved-item" key={item.id}><button className="saved-image" onClick={() => { setSavedOpen(false); setPreviewProduct(item); }}><img src={item.image} alt={item.name} /></button><div><p>{item.category}</p><h3>{item.name}</h3><strong>{formatNaira(item.price)}</strong><button onClick={() => updateQuantity(item.id, 1)}>Add to cart</button></div><button className="saved-remove" onClick={() => toggleSaved(item.id)} aria-label={`Remove ${item.name}`}><X size={15} /></button></div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {authOpen && (
        <div className="modal-backdrop auth-backdrop" onClick={closeAccount}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={closeAccount} aria-label="Close account"><X size={20} /></button>
            {authUser ? (
              <div className="account-profile">
                <p className="checkout-label">Your FRAN6 account</p>
                <h2 id="account-title">You&apos;re signed in</h2>
                <p className="account-email">{authUser.email}</p>
                {(authUser.app_metadata.role === "admin" || authUser.app_metadata.role === "staff") && <a className="admin-account-link" href="/admin"><ShieldCheck size={17} />Open admin dashboard</a>}
                {pendingCardCheckout && <p className="auth-notice" role="status">Sign-in complete. Continue with card checkout when it is available.</p>}
                <button type="button" className="account-signout" onClick={signOut} disabled={authBusy}>
                  <LogOut size={17} />{authBusy ? "Signing out…" : "Sign out"}
                </button>
              </div>
            ) : (
              <>
                <p className="checkout-label">{pendingCardCheckout ? "Card checkout" : "FRAN6 account"}</p>
                <h2 id="account-title">{authMode === "sign-up" ? "Create your account" : "Welcome back"}</h2>
                <p className="auth-intro">
                  {pendingCardCheckout
                    ? "Sign in or create an account to continue with card payment. WhatsApp orders do not need an account."
                    : "Sign in to your account, or create one for faster card checkout. WhatsApp orders are always available as a guest."}
                </p>
                <div className="auth-tabs" role="tablist" aria-label="Account options">
                  <button type="button" role="tab" aria-selected={authMode === "sign-in"} className={authMode === "sign-in" ? "active" : ""} onClick={() => { setAuthMode("sign-in"); setAuthError(""); setAuthNotice(""); }}>Sign in</button>
                  <button type="button" role="tab" aria-selected={authMode === "sign-up"} className={authMode === "sign-up" ? "active" : ""} onClick={() => { setAuthMode("sign-up"); setAuthError(""); setAuthNotice(""); }}>Create account</button>
                </div>
                {!isSupabaseConfigured && (
                  <p className="auth-setup-note" role="status">
                    Accounts are not configured yet. Add the Supabase URL and publishable key to <code>.env.local</code>, then restart the app.
                  </p>
                )}
                {authNotice && <p className="auth-notice" role="status">{authNotice}</p>}
                {authError && <p className="auth-error" role="alert">{authError}</p>}
                <form className="auth-form" onSubmit={handleAuthSubmit}>
                  {authMode === "sign-up" && (
                    <label>Full name<input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Your name" autoComplete="name" required disabled={!isSupabaseConfigured || authBusy} /></label>
                  )}
                  <label>Email address<input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required disabled={!isSupabaseConfigured || authBusy} /></label>
                  <label>Password<input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder={authMode === "sign-up" ? "At least 8 characters" : "Your password"} autoComplete={authMode === "sign-up" ? "new-password" : "current-password"} minLength={authMode === "sign-up" ? 8 : undefined} required disabled={!isSupabaseConfigured || authBusy} /></label>
                  <button type="submit" className="auth-submit" disabled={!isSupabaseConfigured || authBusy}>
                    {authBusy ? "Please wait…" : authMode === "sign-up" ? "Create account" : "Sign in"}
                  </button>
                </form>
                {pendingCardCheckout && <button type="button" className="auth-continue-guest" onClick={closeAccount}>Cancel and keep shopping</button>}
              </>
            )}
          </section>
        </div>
      )}

      {checkoutOpen && (
        <div className="modal-backdrop" onClick={closeCheckout}>
          <form className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onSubmit={(event) => { event.preventDefault(); payWithPaystack(); }} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={closeCheckout} aria-label="Close checkout"><X size={20} /></button>
            <p className="checkout-label">{checkoutProduct ? "Buy now" : "Paystack checkout"}</p>
            <h2 id="checkout-title">Complete your order</h2>
            <p className="checkout-intro">
              {checkoutProduct
                ? `${checkoutProduct.name} × ${checkoutProduct.quantity} · Total ${formatNaira(checkoutSubtotal)}`
                : `${checkoutCount} ${checkoutCount === 1 ? "part" : "parts"} · Total ${formatNaira(checkoutSubtotal)}`}
            </p>
            {authUser ? (
              <>
                <label>Full name<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Your name" required /></label>
                <label>Account email<input type="email" value={customerEmail} readOnly required /></label>
              </>
            ) : (
              <p className="checkout-option-note">Sign in to pay by card, or order as a guest through WhatsApp.</p>
            )}
            <div className="checkout-total"><span>Total</span><strong>{formatNaira(checkoutSubtotal)}</strong></div>
            {paystackLoadError && <p className="checkout-error" role="alert">Paystack could not load. Close this window and order via WhatsApp instead.</p>}
            {checkoutError && <p className="checkout-error" role="alert">{checkoutError}</p>}
            {orderError && <p className="checkout-error" role="alert">{orderError}</p>}
            {authUser ? (
              <button type="submit" className="paystack-button" disabled={!paystackConfigured || !paystackReady || paystackLoadError}>
                {!paystackConfigured ? "Paystack is not set up" : paystackLoadError ? "Payment unavailable" : paystackReady ? `Pay ${formatNaira(checkoutSubtotal)} by card` : "Loading secure checkout…"}
              </button>
            ) : (
              <button type="button" className="paystack-button" onClick={startCardCheckout} disabled={!paystackConfigured || paystackLoadError}>
                {!paystackConfigured ? "Paystack is not set up" : paystackLoadError ? "Payment unavailable" : "Sign in to pay by card"}
              </button>
            )}
            <a className="whatsapp-button checkout-whatsapp" href={`https://wa.me/${whatsappNumber}?text=${checkoutWhatsappMessage}`} onClick={() => recordWhatsAppOrder(checkoutItems)} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={17} />Order via WhatsApp
            </a>
            {!paystackConfigured && <p className="checkout-option-note">Card payments are not configured yet. Close this window to order via WhatsApp.</p>}
          </form>
        </div>
      )}
    </div>
  );
}
