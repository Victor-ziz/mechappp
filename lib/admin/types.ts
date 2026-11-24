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
  created_at: string;
};

export type AdminActionResult = {
  success: boolean;
  error?: string;
};
