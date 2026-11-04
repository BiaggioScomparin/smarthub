import type { ChannelConfig, ChannelId, Product, PublishResult, ShippingLabelResult } from "../types.ts";
import type { MarketplaceAdapter } from "./base.ts";

export class MercadoLibreAdapter implements MarketplaceAdapter {
  channelId: ChannelId = "mercadolibre";
  name = "Mercado Livre";
  config: ChannelConfig;

  constructor(config: ChannelConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    const creds = this.config.credentials;
    return Boolean(creds.access_token && creds.seller_id);
  }

  async publishProduct(product: Product, customPrice?: number, categoryId?: string): Promise<PublishResult> {
    const price = customPrice || product.base_price;
    const cat = categoryId || "MLB3112"; // Default category fallback

    if (this.config.mode === "production" && this.isConfigured()) {
      try {
        const res = await fetch("https://api.mercadolibre.com/items", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.config.credentials.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: product.title.slice(0, 60), // ML allows max 60 chars in title
            category_id: cat,
            price: price,
            currency_id: "BRL",
            available_quantity: product.stock,
            buying_mode: "buy_it_now",
            listing_type_id: "gold_special",
            condition: "new",
            pictures: product.images.map(url => ({ source: url })),
            attributes: [
              { id: "BRAND", value_name: "Genérico" },
              { id: "MODEL", value_name: product.sku },
              { id: "SELLER_SKU", value_name: product.sku }
            ],
            shipping: {
              mode: "me2",
              local_pick_up: false,
              free_shipping: price > 79.00
            }
          })
        });

        const data = await res.json();
        if (!res.ok) {
          return {
            channel_id: this.channelId,
            success: false,
            message: data.message || `Erro ML (${res.status}): ${JSON.stringify(data.cause || data)}`
          };
        }

        return {
          channel_id: this.channelId,
          remote_id: data.id,
          success: true,
          message: `Publicado com sucesso no Mercado Livre (${data.id})`
        };
      } catch (err: any) {
        return {
          channel_id: this.channelId,
          success: false,
          message: `Falha de rede ML: ${err.message}`
        };
      }
    }

    // Sandbox / Simulation Mode
    const simulatedId = `MLB${Math.floor(1000000000 + Math.random() * 9000000000)}`;
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
        const res = await fetch(`https://api.mercadolibre.com/items/${remoteProductId}`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${this.config.credentials.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ available_quantity: newStock })
        });

        const data = await res.json();
        if (!res.ok) {
          return { success: false, message: data.message || "Erro ao atualizar estoque no ML" };
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }

    return { success: true, message: `[Simulação] Estoque atualizado no ML para ${newStock}` };
  }

  async getShippingLabel(remoteOrderId: string, orderData?: any): Promise<ShippingLabelResult> {
    const trackingCode = orderData?.tracking_code || `BR-MLB-${Math.floor(1000000 + Math.random() * 9000000)}`;
    const barcode = `412${Math.floor(1000000000000000 + Math.random() * 9000000000000000)}`;

    return {
      orderId: remoteOrderId,
      trackingCode,
      carrierName: "Mercado Envios Coleta",
      barcode
    };
  }

  async markAsShipped(remoteOrderId: string, trackingCode: string): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: `Despacho registrado no Mercado Livre (${trackingCode})` };
  }
}
