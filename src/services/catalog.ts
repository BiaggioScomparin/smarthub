import { DB } from "../db.ts";
import type { ChannelId, Product, PublishResult } from "../types.ts";
import type { MarketplaceAdapter } from "../adapters/base.ts";
import { MercadoLibreAdapter } from "../adapters/mercadolibre.ts";
import { ShopeeAdapter } from "../adapters/shopee.ts";
import { TikTokShopAdapter } from "../adapters/tiktok.ts";

export class CatalogService {
  private getAdapter(channelId: ChannelId): MarketplaceAdapter {
    const config = DB.getChannel(channelId)!;
    switch (channelId) {
      case "mercadolibre":
        return new MercadoLibreAdapter(config);
      case "shopee":
        return new ShopeeAdapter(config);
      case "tiktok":
        return new TikTokShopAdapter(config);
      default:
        throw new Error(`Canal não suportado: ${channelId}`);
    }
  }

  async publishProductToChannels(
    productId: string,
    channelSettings?: Record<ChannelId, { enabled: boolean; customPrice?: number; categoryId?: string }>
  ): Promise<PublishResult[]> {
    const product = DB.getProductById(productId);
    if (!product) {
      throw new Error(`Produto não encontrado: ${productId}`);
    }

    const channels = DB.getChannels().filter(c => c.enabled);
    const results: PublishResult[] = [];

    for (const channel of channels) {
      const channelId = channel.id;
      const setting = channelSettings ? channelSettings[channelId] : { enabled: true };

      if (channelSettings && !setting.enabled) {
        continue;
      }

      const adapter = this.getAdapter(channelId);
      const customPrice = setting?.customPrice || product.base_price;
      const categoryId = setting?.categoryId;

      try {
        const result = await adapter.publishProduct(product, customPrice, categoryId);
        results.push(result);

        if (result.success && result.remote_id) {
          DB.saveChannelLink({
            product_id: product.id,
            channel_id: channelId,
            remote_product_id: result.remote_id,
            channel_category_id: categoryId,
            channel_price: customPrice,
            status: "synced",
            published_at: new Date().toISOString()
          });

          DB.logActivity(
            "publish_success",
            `Produto '${product.title}' (${product.sku}) publicado no ${adapter.name}`,
            channelId,
            { remote_id: result.remote_id }
          );
        } else {
          DB.saveChannelLink({
            product_id: product.id,
            channel_id: channelId,
            status: "error",
            last_error: result.message
          });

          DB.logActivity(
            "publish_error",
            `Falha ao publicar '${product.title}' no ${adapter.name}: ${result.message}`,
            channelId
          );
        }
      } catch (err: any) {
        results.push({
          channel_id: channelId,
          success: false,
          message: err.message
        });

        DB.saveChannelLink({
          product_id: product.id,
          channel_id: channelId,
          status: "error",
          last_error: err.message
        });
      }
    }

    return results;
  }
}

export const catalogService = new CatalogService();
