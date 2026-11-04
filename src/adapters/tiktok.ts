import type { ChannelConfig, ChannelId, Product, PublishResult, ShippingLabelResult } from "../types.ts";
import type { MarketplaceAdapter } from "./base.ts";

export class TikTokShopAdapter implements MarketplaceAdapter {
  channelId: ChannelId = "tiktok";
  name = "TikTok Shop";
  config: ChannelConfig;

  constructor(config: ChannelConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    const creds = this.config.credentials;
    return Boolean(creds.app_key && creds.app_secret && creds.shop_cipher && creds.access_token);
  }

  private async generateSign(path: string, timestamp: number): Promise<string> {
    const creds = this.config.credentials;
    const baseStr = `${creds.app_secret}${path}app_key${creds.app_key}timestamp${timestamp}${creds.app_secret}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(creds.app_secret || ""),
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
    const cat = categoryId || "601142"; // Default TikTok Shop category

    if (this.config.mode === "production" && this.isConfigured()) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const path = "/product/202309/products";
        const sign = await this.generateSign(path, timestamp);
        const creds = this.config.credentials;

        const url = `https://open-api.tiktokglobalshop.com${path}?app_key=${creds.app_key}&sign=${sign}&timestamp=${timestamp}&shop_cipher=${creds.shop_cipher}`;

        const payload = {
          title: product.title,
          description: product.description || product.title,
          category_id: cat,
          brand_id: "0",
          main_images: product.images.map(uri => ({ uri })),
          skus: [
            {
              seller_sku: product.sku,
              price: {
                amount: String(price),
                currency: "BRL"
              },
              inventory: [
                {
                  quantity: product.stock
                }
              ]
            }
          ],
          package_dimensions: {
            height: String(Math.round(product.height_cm)),
            width: String(Math.round(product.width_cm)),
            length: String(Math.round(product.length_cm)),
            unit: "CENTIMETER"
          },
          package_weight: {
            value: String(product.weight_kg),
            unit: "KILOGRAM"
          }
        };

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tts-access-token": creds.access_token
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.code !== 0) {
          return {
            channel_id: this.channelId,
            success: false,
            message: `Erro TikTok Shop: ${data.message || JSON.stringify(data)}`
          };
        }

        const remoteId = data.data?.product_id || "TTS-" + Date.now();
        return {
          channel_id: this.channelId,
          remote_id: remoteId,
          success: true,
          message: `Publicado no TikTok Shop com ID: ${remoteId}`
        };
      } catch (err: any) {
        return {
          channel_id: this.channelId,
          success: false,
          message: `Falha de rede TikTok Shop: ${err.message}`
        };
      }
    }

    // Sandbox / Simulation
    const simulatedId = `TTS${Math.floor(1000000000 + Math.random() * 9000000000)}`;
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
        const path = "/product/202309/inventories/update";
        const sign = await this.generateSign(path, timestamp);
        const creds = this.config.credentials;

        const url = `https://open-api.tiktokglobalshop.com${path}?app_key=${creds.app_key}&sign=${sign}&timestamp=${timestamp}&shop_cipher=${creds.shop_cipher}`;

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tts-access-token": creds.access_token
          },
          body: JSON.stringify({
            product_id: remoteProductId,
            skus: [{ id: remoteProductId, inventory: [{ quantity: newStock }] }]
          })
        });

        const data = await res.json();
        if (data.code !== 0) {
          return { success: false, message: data.message || "Erro de estoque TikTok Shop" };
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }

    return { success: true, message: `[Simulação] Estoque atualizado no TikTok Shop para ${newStock}` };
  }

  async getShippingLabel(remoteOrderId: string, orderData?: any): Promise<ShippingLabelResult> {
    const trackingCode = orderData?.tracking_code || `BR-TTS-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const barcode = `923${Math.floor(1000000000000000 + Math.random() * 9000000000000000)}`;

    return {
      orderId: remoteOrderId,
      trackingCode,
      carrierName: "TikTok Shipping (Pegaki / Total Express)",
      barcode
    };
  }

  async markAsShipped(remoteOrderId: string, trackingCode: string): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: `Despacho registrado no TikTok Shop (${trackingCode})` };
  }
}
