export type AdminProduct = {
  id: number;
  name: string;
  category: string;
  price: number;
  image: string;
  images: string[];
  stock: number;
  active: boolean;
  created_at: string;
};

export type AdminOrderItem = {
  id: number;
  name: string;
  quantity: number;
  price: number;
};

export type AdminOrder = {
  id: string;
  reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  channel: "paystack" | "whatsapp";
  status: "whatsapp_requested" | "awaiting_payment" | "paid" | "processing" | "completed" | "cancelled";
  total: number;
  items: AdminOrderItem[];
  created_at: string;
};

export type AdminCustomer = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  created_at: string;
};

export type AdminReview = {
  id: string;
  product_id: number;
  customer_name: string;
  rating: number;
  comment: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  products: { name: string } | { name: string }[] | null;
};

export type StoreAccount = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "staff";
  permissions: Array<"products" | "orders" | "reviews" | "customers">;
};

export type AdminActionResult = {
  success: boolean;
  error?: string;
};
