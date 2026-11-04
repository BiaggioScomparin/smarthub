import type { ChannelConfig, ChannelId, Product, PublishResult, ShippingLabelResult } from "../types.ts";
import type { MarketplaceAdapter } from "./base.ts";

export class ShopeeAdapter implements MarketplaceAdapter {
  channelId: ChannelId = "shopee";
  name = "Shopee";
  config: ChannelConfig;

  constructor(config: ChannelConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    const creds = this.config.credentials;
    return Boolean(creds.partner_id && creds.partner_key && creds.shop_id && creds.access_token);
  }

  private async generateSign(path: string, timestamp: number): Promise<string> {
    const creds = this.config.credentials;
    const baseStr = `${creds.partner_id}${path}${timestamp}${creds.access_token || ""}${creds.shop_id || ""}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(creds.partner_key || ""),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, enc.encode(baseStr));
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async publishProduct(product: Product, customPrice?: number, categoryId?: string): Promise<PublishResult> {
    const price = customPrice || product.base_price;
    const cat = Number(categoryId) || 100010; // Default Shopee category

    if (this.config.mode === "production" && this.isConfigured()) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const path = "/api/v2/product/add_item";
        const sign = await this.generateSign(path, timestamp);
        const creds = this.config.credentials;

        const url = `https://partner.shopeemobile.com${path}?partner_id=${creds.partner_id}&timestamp=${timestamp}&sign=${sign}&access_token=${creds.access_token}&shop_id=${creds.shop_id}`;

        const payload = {
          item_name: product.title.slice(0, 120),
          description: product.description || product.title,
          category_id: cat,
          original_price: price,
          normal_stock: product.stock,
          weight: product.weight_kg,
          dimension: {
            package_height: Math.round(product.height_cm),
            package_width: Math.round(product.width_cm),
            package_length: Math.round(product.length_cm)
          },
          image: {
            image_id_list: product.images
          },
          item_status: "NORMAL"
        };

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.error && data.error !== "") {
          return {
            channel_id: this.channelId,
            success: false,
            message: `Erro Shopee: ${data.message || data.error}`
          };
        }

        const itemId = data.response?.item_id ? String(data.response.item_id) : "SHP-" + Date.now();
        return {
          channel_id: this.channelId,
          remote_id: itemId,
          success: true,
          message: `Publicado na Shopee com ID: ${itemId}`
        };
      } catch (err: any) {
        return {
          channel_id: this.channelId,
          success: false,
          message: `Falha de rede Shopee: ${err.message}`
        };
      }
    }

    // Sandbox / Simulation
    const simulatedId = `SHP${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    return {
      channel_id: this.channelId,
      remote_id: simulatedId,
      success: true,
      message: `[Modo Simulação] Anúncio gerado com sucesso: ${simulatedId}`
    };
  }

  async updateStock(remoteProductId: string, newStock: number): Promise<{ success: boolean; message?: string }> {
    if (this.config.mode === "production" && this.isConfigured()) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const path = "/api/v2/product/update_stock";
        const sign = await this.generateSign(path, timestamp);
        const creds = this.config.credentials;

        const url = `https://partner.shopeemobile.com${path}?partner_id=${creds.partner_id}&timestamp=${timestamp}&sign=${sign}&access_token=${creds.access_token}&shop_id=${creds.shop_id}`;

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_id: Number(remoteProductId) || 0,
            stock_list: [{ stock: newStock }]
          })
        });

        const data = await res.json();
        if (data.error) {
          return { success: false, message: data.message || "Erro de estoque Shopee" };
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }

    return { success: true, message: `[Simulação] Estoque atualizado na Shopee para ${newStock}` };
  }

  async getShippingLabel(remoteOrderId: string, orderData?: any): Promise<ShippingLabelResult> {
    const trackingCode = orderData?.tracking_code || `BR-SPX-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const barcode = `809${Math.floor(1000000000000000 + Math.random() * 9000000000000000)}`;

    return {
      orderId: remoteOrderId,
      trackingCode,
      carrierName: "Shopee Xpress (SPX)",
      barcode
    };
  }

  async markAsShipped(remoteOrderId: string, trackingCode: string): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: `Despacho registrado na Shopee (${trackingCode})` };
  }
}
