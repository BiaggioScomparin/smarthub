export type ChannelId = "mercadolibre" | "shopee" | "tiktok";

export interface ChannelConfig {
  id: ChannelId;
  name: string;
  enabled: boolean;
  mode: "sandbox" | "production";
  credentials: Record<string, string>;
  fee_percent: number;
  fixed_fee: number;
  free_shipping_threshold: number;
  last_sync_at?: string | null;
}

export interface Product {
  id: string;
  sku: string;
  title: string;
  description: string;
  base_price: number;
  cost_price: number;
  packaging_cost: number;
  other_costs: number;
  tax_percent: number;
  target_profit_percent: number;
  stock: number;
  min_stock: number;
  weight_kg: number;
  height_cm: number;
  width_cm: number;
  length_cm: number;
  images: string[];
  created_at: string;
  updated_at: string;
  links?: ProductChannelLink[];
}

export interface ProductChannelLink {
  id?: number;
  product_id: string;
  channel_id: ChannelId;
  remote_product_id?: string;
  channel_category_id?: string;
  channel_price?: number;
  status: "synced" | "error" | "pending";
  last_error?: string | null;
  published_at?: string | null;
}

export interface OrderItem {
  product_id?: string;
  sku: string;
  title: string;
  quantity: number;
  unit_price: number;
}

export interface ShippingAddress {
  recipient_name: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  phone?: string;
}

export interface Order {
  id: string;
  channel_id: ChannelId;
  remote_order_id: string;
  customer_name: string;
  customer_document: string;
  items: OrderItem[];
  total_amount: number;
  shipping_address: ShippingAddress;
  shipping_label_url?: string;
  tracking_code?: string;
  shipping_service: string;
  status: "pending_payment" | "ready_to_ship" | "shipped" | "delivered" | "cancelled";
  created_at: string;
}

export interface PublishResult {
  channel_id: ChannelId;
  remote_id?: string;
  success: boolean;
  message?: string;
}

export interface ShippingLabelResult {
  orderId: string;
  trackingCode: string;
  carrierName: string;
  barcode: string;
  htmlContent?: string;
}

export interface PriceCalculationResult {
  channel_id: ChannelId;
  channel_name: string;
  total_cost: number;
  fee_percent: number;
  fixed_fee: number;
  tax_percent: number;
  suggested_price: number;
  marketplace_fee_amount: number;
  tax_amount: number;
  net_profit_amount: number;
  net_profit_margin_percent: number;
}
