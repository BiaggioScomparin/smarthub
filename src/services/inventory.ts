import { DB } from "../db.ts";
import type { ChannelId } from "../types.ts";
import { MercadoLibreAdapter } from "../adapters/mercadolibre.ts";
import { ShopeeAdapter } from "../adapters/shopee.ts";
import { TikTokShopAdapter } from "../adapters/tiktok.ts";

export class InventoryService {
  async syncStockAcrossChannels(sku: string, newStock: number, originChannel?: ChannelId) {
    const product = DB.getProductBySku(sku);
    if (!product) {
      console.warn(`[Inventory] Produto SKU ${sku} não encontrado para sincronização`);
      return;
    }

    // Update local database stock
    DB.updateStock(product.id, newStock);

    // Get linked channels
    const links = product.links || [];
    const updates: Promise<any>[] = [];

    for (const link of links) {
      // Don't update the origin channel if the sale came from it (it already reduced stock)
      if (originChannel && link.channel_id === originChannel) {
        continue;
      }

      if (!link.remote_product_id) continue;

      const channel = DB.getChannel(link.channel_id);
      if (!channel || !channel.enabled) continue;

      const p = (async () => {
        try {
          let adapter;
          if (link.channel_id === "mercadolibre") adapter = new MercadoLibreAdapter(channel);
          else if (link.channel_id === "shopee") adapter = new ShopeeAdapter(channel);
          else if (link.channel_id === "tiktok") adapter = new TikTokShopAdapter(channel);

          if (adapter) {
            const res = await adapter.updateStock(link.remote_product_id!, newStock);
            if (res.success) {
              DB.logActivity(
                "stock_sync",
                `Estoque de '${product.title}' (${sku}) sincronizado para ${newStock} no ${adapter.name}`,
                link.channel_id
              );
            }
          }
        } catch (err: any) {
          DB.logActivity(
            "stock_sync_error",
            `Falha ao atualizar estoque no canal ${link.channel_id}: ${err.message}`,
            link.channel_id
          );
        }
      })();

      updates.push(p);
    }

    await Promise.all(updates);
  }

  async deductStockForOrder(items: { sku: string; quantity: number }[], originChannel: ChannelId) {
    for (const item of items) {
      const prod = DB.getProductBySku(item.sku);
      if (prod) {
        const newStock = Math.max(0, prod.stock - item.quantity);
        await this.syncStockAcrossChannels(item.sku, newStock, originChannel);
      }
    }
  }
}

export const inventoryService = new InventoryService();
