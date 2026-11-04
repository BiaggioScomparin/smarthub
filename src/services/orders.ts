import { DB } from "../db.ts";
import type { ChannelId, Order, ShippingAddress, ShippingLabelResult } from "../types.ts";
import { inventoryService } from "./inventory.ts";
import { MercadoLibreAdapter } from "../adapters/mercadolibre.ts";
import { ShopeeAdapter } from "../adapters/shopee.ts";
import { TikTokShopAdapter } from "../adapters/tiktok.ts";

export class OrderService {
  async processIncomingOrder(params: {
    channelId: ChannelId;
    remoteOrderId: string;
    customerName: string;
    customerDocument?: string;
    items: { sku: string; title: string; quantity: number; unit_price: number }[];
    totalAmount: number;
    shippingAddress: ShippingAddress;
    shippingService?: string;
  }): Promise<Order> {
    const channel = await DB.getChannel(params.channelId);
    let carrierName = params.shippingService;
    if (!carrierName) {
      if (params.channelId === "mercadolibre") carrierName = "Mercado Envios";
      else if (params.channelId === "shopee") carrierName = "Shopee Xpress (SPX)";
      else carrierName = "TikTok Shipping (Pegaki)";
    }

    // Generate tracking code
    const prefix = params.channelId === "mercadolibre" ? "BR-MLB" : params.channelId === "shopee" ? "BR-SPX" : "BR-TTS";
    const trackingCode = `${prefix}-${Math.floor(10000000 + Math.random() * 90000000)}`;

    const order = await DB.createOrder({
      channel_id: params.channelId,
      remote_order_id: params.remoteOrderId,
      customer_name: params.customerName,
      customer_document: params.customerDocument || "000.000.000-00",
      items: params.items,
      total_amount: params.totalAmount,
      shipping_address: params.shippingAddress,
      tracking_code: trackingCode,
      shipping_service: carrierName,
      status: "ready_to_ship"
    });

    await DB.logActivity(
      "order_created",
      `Novo pedido #${order.remote_order_id} recebido de ${channel?.name || params.channelId} (R$ ${order.total_amount.toFixed(2)})`,
      params.channelId,
      { order_id: order.id }
    );

    // Automatic Stock Deduction across all other channels!
    await inventoryService.deductStockForOrder(params.items, params.channelId);

    return order;
  }

  async getPrintableShippingLabel(orderId: string): Promise<ShippingLabelResult> {
    const order = await DB.getOrderById(orderId);
    if (!order) {
      throw new Error("Pedido não encontrado");
    }

    const channel = await DB.getChannel(order.channel_id);
    let adapter;
    if (order.channel_id === "mercadolibre") adapter = new MercadoLibreAdapter(channel!);
    else if (order.channel_id === "shopee") adapter = new ShopeeAdapter(channel!);
    else adapter = new TikTokShopAdapter(channel!);

    const labelInfo = await adapter.getShippingLabel(order.remote_order_id, order);

    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Etiqueta de Envio - Pedido ${order.remote_order_id}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; }
        .label-container { width: 100mm; min-height: 140mm; background: #fff; border: 2px solid #1e293b; margin: 0 auto; padding: 12px; box-sizing: border-box; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
        .channel-tag { font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
        .carrier { font-size: 13px; font-weight: bold; background: #000; color: #fff; padding: 3px 8px; border-radius: 4px; }
        .barcode-section { text-align: center; margin: 12px 0; border: 1px dashed #cbd5e1; padding: 10px; }
        .barcode-bars { height: 42px; background: repeating-linear-gradient(90deg, #000, #000 2px, #fff 2px, #fff 5px, #000 5px, #000 8px, #fff 8px, #fff 10px); width: 85%; margin: 0 auto; }
        .tracking-code { font-family: monospace; font-size: 14px; font-weight: 700; margin-top: 6px; }
        .section-box { border: 1px solid #000; padding: 8px; margin-bottom: 8px; font-size: 11px; line-height: 1.4; }
        .section-title { font-weight: bold; font-size: 11px; text-transform: uppercase; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
        .items-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
        .items-table th, .items-table td { border: 1px solid #e2e8f0; padding: 3px 6px; text-align: left; }
        .no-print-btn { display: block; margin: 20px auto; background: #2563eb; color: #fff; border: none; padding: 10px 20px; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 14px; }
        @media print {
          body { background: transparent; padding: 0; }
          .no-print-btn { display: none; }
          .label-container { border: 2px solid #000; page-break-after: always; }
        }
      </style>
    </head>
    <body>
      <button class="no-print-btn" onclick="window.print()">🖨️ Imprimir Etiqueta</button>
      <div class="label-container">
        <div class="header">
          <div class="channel-tag">
            ${order.channel_id === "mercadolibre" ? "🟡 Mercado Livre" : order.channel_id === "shopee" ? "🟠 Shopee" : "⚫ TikTok Shop"}
          </div>
          <div class="carrier">${labelInfo.carrierName}</div>
        </div>

        <div class="barcode-section">
          <div class="barcode-bars"></div>
          <div class="tracking-code">${labelInfo.trackingCode}</div>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Cód. Rastreio / Pacote: ${order.remote_order_id}</div>
        </div>

        <div class="section-box">
          <div class="section-title">DESTINATÁRIO</div>
          <div><strong>Nome:</strong> ${order.customer_name}</div>
          <div><strong>Endereço:</strong> ${order.shipping_address.street}, ${order.shipping_address.number} ${order.shipping_address.complement ? "- " + order.shipping_address.complement : ""}</div>
          <div><strong>Bairro:</strong> ${order.shipping_address.neighborhood} | <strong>Cidade:</strong> ${order.shipping_address.city} - ${order.shipping_address.state}</div>
          <div><strong>CEP:</strong> ${order.shipping_address.zip_code}</div>
          <div><strong>Doc:</strong> ${order.customer_document}</div>
        </div>

        <div class="section-box">
          <div class="section-title">REMETENTE</div>
          <div><strong>Empresa:</strong> Minha Loja Hub Multi-Canal LTDA</div>
          <div><strong>Endereço:</strong> Centro de Distribuição / Expedição</div>
          <div><strong>Origem:</strong> São Paulo - SP</div>
        </div>

        <div class="section-box">
          <div class="section-title">CONTEÚDO DO PACOTE (DECLARAÇÃO DE CONTEÚDO)</div>
          <table class="items-table">
            <thead>
              <tr><th>Item</th><th>SKU</th><th>Qtd</th><th>Valor Unit.</th></tr>
            </thead>
            <tbody>
              ${order.items.map(it => `
                <tr>
                  <td>${it.title.slice(0, 30)}</td>
                  <td><strong>${it.sku}</strong></td>
                  <td>${it.quantity}</td>
                  <td>R$ ${it.unit_price.toFixed(2)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div style="text-align: right; margin-top: 4px; font-weight: bold; font-size: 11px;">
            Total: R$ ${order.total_amount.toFixed(2)}
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    return {
      ...labelInfo,
      htmlContent: html
    };
  }

  async markOrderAsShipped(orderId: string): Promise<boolean> {
    const order = await DB.getOrderById(orderId);
    if (!order) return false;

    const channel = await DB.getChannel(order.channel_id);
    let adapter;
    if (order.channel_id === "mercadolibre") adapter = new MercadoLibreAdapter(channel!);
    else if (order.channel_id === "shopee") adapter = new ShopeeAdapter(channel!);
    else adapter = new TikTokShopAdapter(channel!);

    await adapter.markAsShipped(order.remote_order_id, order.tracking_code || "");
    await DB.updateOrderStatus(orderId, "shipped");

    await DB.logActivity(
      "order_shipped",
      `Pedido #${order.remote_order_id} marcado como despachado no ${channel?.name || order.channel_id}`,
      order.channel_id
    );

    return true;
  }
}

export const orderService = new OrderService();
