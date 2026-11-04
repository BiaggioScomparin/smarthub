import type { ChannelConfig, ChannelId, Product, PublishResult, ShippingLabelResult } from "../types.ts";

export interface MarketplaceAdapter {
  channelId: ChannelId;
  name: string;
  config: ChannelConfig;

  // Verify whether the channel credentials are configured
  isConfigured(): boolean;

  // Publish or sync a product to this marketplace
  publishProduct(product: Product, customPrice?: number, categoryId?: string): Promise<PublishResult>;

  // Update stock level on the marketplace
  updateStock(remoteProductId: string, newStock: number): Promise<{ success: boolean; message?: string }>;

  // Fetch or generate a shipping label
  getShippingLabel(remoteOrderId: string, orderData?: any): Promise<ShippingLabelResult>;

  // Dispatch / mark order as shipped
  markAsShipped(remoteOrderId: string, trackingCode: string): Promise<{ success: boolean; message?: string }>;
}
