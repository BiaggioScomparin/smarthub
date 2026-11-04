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

    await inventoryService.deductStockForOrder(params.items, params.channelId);
    return order;
  }

  private renderSingleOrderUnit(order: Order, carrierName: string, trackingCode: string): string {
    const channelLabel = order.channel_id === "mercadolibre"
      ? "🟡 Mercado Livre"
      : order.channel_id === "shopee"
      ? "🟠 Shopee"
      : "⚫ TikTok Shop";

    const addr = order.shipping_address;

    return `
    <div class="order-unit">
      <!-- Metade Esquerda: Etiqueta de Envio -->
      <div class="shipping-half">
        <div class="unit-header">
          <span class="channel-pill">${channelLabel}</span>
          <span class="carrier-pill">${carrierName}</span>
        </div>

        <div class="barcode-wrapper">
          <div class="barcode-graphic"></div>
          <div class="tracking-text">${trackingCode}</div>
          <div class="remote-id">Pedido: ${order.remote_order_id}</div>
        </div>

        <div class="box dest-box">
          <div class="box-title">DESTINATÁRIO</div>
          <div class="line-dest"><strong>${order.customer_name}</strong></div>
          <div>${addr.street}, ${addr.number} ${addr.complement ? "- " + addr.complement : ""}</div>
          <div>${addr.neighborhood || ""} • ${addr.city} / ${addr.state}</div>
          <div class="zip-highlight">CEP: ${addr.zip_code}</div>
          <div class="doc-text">Doc: ${order.customer_document}</div>
        </div>

        <div class="box rem-box">
          <div class="box-title">REMETENTE</div>
          <div><strong>SmartHub E-commerce LTDA</strong></div>
          <div>Av. Logística e Distribuição, 1000 - SP</div>
          <div>CEP: 01001-000 • São Paulo - SP</div>
        </div>
      </div>

      <!-- Metade Direita: Declaração de Conteúdo -->
      <div class="declaration-half">
        <div class="decl-title">DECLARAÇÃO DE CONTEÚDO</div>

        <div class="decl-subbox">
          <div class="decl-header-row">
            <div><strong>Remetente:</strong> SmartHub LTDA</div>
            <div><strong>Destinatário:</strong> ${order.customer_name.slice(0, 24)}</div>
          </div>
          <div class="decl-header-row">
            <div><strong>Cidade/UF:</strong> São Paulo/SP</div>
            <div><strong>Cidade/UF:</strong> ${addr.city}/${addr.state}</div>
          </div>
        </div>

        <table class="decl-items-table">
          <thead>
            <tr>
              <th style="width: 50%;">Item / Conteúdo</th>
              <th style="width: 15%; text-align: center;">SKU</th>
              <th style="width: 10%; text-align: center;">Qtd</th>
              <th style="width: 25%; text-align: right;">Total R$</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(it => `
              <tr>
                <td>${it.title.slice(0, 28)}</td>
                <td style="text-align: center; font-family: monospace;">${it.sku}</td>
                <td style="text-align: center;">${it.quantity}</td>
                <td style="text-align: right;">R$ ${(it.quantity * it.unit_price).toFixed(2)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="decl-totals">
          <span>Qtd Total: ${order.items.reduce((acc, it) => acc + it.quantity, 0)} itens</span>
          <strong>Valor Declarado: R$ ${order.total_amount.toFixed(2)}</strong>
        </div>

        <div class="decl-legal">
          Declaro que não me enquadro no conceito de contribuinte previsto no art. 4º da Lei Complementar nº 87/1996, não realizando, de forma habitual ou em volume comercial, operações de circulação de mercadorias.
        </div>

        <div class="signature-line">
          <div>Data: ___/___/2026</div>
          <div style="border-top: 1px solid #333; width: 55%; text-align: center;">Assinatura do Remetente</div>
        </div>
      </div>
    </div>
    `;
  }

  async getPrintableShippingLabel(orderId: string): Promise<ShippingLabelResult> {
    const order = await DB.getOrderById(orderId);
    if (!order) throw new Error("Pedido não encontrado");

    return this.generateBatchShippingDocument([order]);
  }

  async generateBatchShippingDocument(orders: Order[]): Promise<ShippingLabelResult> {
    if (orders.length === 0) {
      throw new Error("Nenhum pedido selecionado para impressão");
    }

    const carrierName = orders[0].shipping_service || "Logística Integrada";
    const trackingCode = orders[0].tracking_code || `BR-HUB-${Date.now()}`;

    // Group in pairs of 2 per A4 sheet
    const pagesHtml: string[] = [];
    for (let i = 0; i < orders.length; i += 2) {
      const pair = orders.slice(i, i + 2);
      const unitsHtml = pair.map(ord => {
        const trk = ord.tracking_code || `BR-HUB-${Math.floor(10000000 + Math.random() * 90000000)}`;
        return this.renderSingleOrderUnit(ord, ord.shipping_service, trk);
      }).join("\n<div class='cut-line'>- - - - - - - - - - - - - - - - - - - - - - - - - - - - - CORTE AQUI - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>\n");

      pagesHtml.push(`
        <div class="a4-sheet">
          ${unitsHtml}
        </div>
      `);
    }

    const fullHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Etiquetas de Envio com Declaração de Conteúdo (${orders.length} pedidos)</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 6mm;
        }
        * { box-sizing: border-box; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          background: #e2e8f0;
          margin: 0;
          padding: 15px;
          color: #0f172a;
        }
        .top-toolbar {
          max-width: 210mm;
          margin: 0 auto 15px auto;
          background: #1e293b;
          color: #fff;
          padding: 12px 20px;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 4px 10px rgba(0,0,0,0.15);
        }
        .btn-print {
          background: #10b981;
          color: #fff;
          border: none;
          padding: 10px 22px;
          font-size: 14px;
          font-weight: bold;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .btn-print:hover { background: #059669; }
        .sheet-info { font-size: 13px; color: #cbd5e1; }

        /* A4 Sheet format (210mm x 297mm) */
        .a4-sheet {
          width: 200mm;
          min-height: 285mm;
          background: #fff;
          margin: 0 auto 20px auto;
          padding: 6mm;
          border: 1px solid #cbd5e1;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          page-break-after: always;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .cut-line {
          text-align: center;
          font-size: 9px;
          color: #64748b;
          letter-spacing: 2px;
          margin: 4mm 0;
          border-bottom: 1px dashed #94a3b8;
          line-height: 0.1em;
        }

        /* Order Unit (Etiqueta + Declaração lado a lado) */
        .order-unit {
          width: 100%;
          height: 134mm;
          display: flex;
          border: 1.5px solid #000;
          background: #fff;
          overflow: hidden;
        }

        /* Left side: Shipping Label */
        .shipping-half {
          width: 50%;
          border-right: 1.5px solid #000;
          padding: 6px 8px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .unit-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #000;
          padding-bottom: 4px;
        }
        .channel-pill { font-weight: 800; font-size: 11px; }
        .carrier-pill { background: #000; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 3px; }

        .barcode-wrapper {
          text-align: center;
          margin: 3px 0;
          padding: 4px;
          border: 1px dashed #cbd5e1;
        }
        .barcode-graphic {
          height: 34px;
          width: 90%;
          margin: 0 auto;
          background: repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 7px, #fff 7px, #fff 9px);
        }
        .tracking-text { font-family: monospace; font-size: 12px; font-weight: bold; margin-top: 3px; }
        .remote-id { font-size: 8px; color: #475569; }

        .box {
          border: 1px solid #000;
          padding: 5px;
          font-size: 9px;
          line-height: 1.35;
        }
        .box-title { font-weight: 900; font-size: 9px; border-bottom: 1px solid #cbd5e1; margin-bottom: 3px; }
        .line-dest { font-size: 10px; font-weight: bold; }
        .zip-highlight { font-weight: 900; font-size: 11px; margin-top: 2px; }
        .doc-text { font-size: 8px; color: #475569; }

        /* Right side: Declaration of Content */
        .declaration-half {
          width: 50%;
          padding: 6px 8px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-size: 9px;
          background: #fff;
        }
        .decl-title {
          font-weight: 900;
          text-align: center;
          font-size: 11px;
          letter-spacing: 0.5px;
          border-bottom: 1.5px solid #000;
          padding-bottom: 3px;
        }
        .decl-subbox {
          border: 1px solid #000;
          padding: 4px;
          font-size: 8.5px;
          line-height: 1.3;
          margin-top: 3px;
        }
        .decl-header-row { display: flex; justify-content: space-between; }

        .decl-items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8.5px;
          margin-top: 4px;
        }
        .decl-items-table th, .decl-items-table td {
          border: 1px solid #cbd5e1;
          padding: 2px 4px;
        }
        .decl-items-table th { background: #f1f5f9; font-weight: bold; text-align: left; }

        .decl-totals {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          margin-top: 2px;
          padding: 3px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
        }
        .decl-legal {
          font-size: 7px;
          color: #475569;
          line-height: 1.2;
          margin: 3px 0;
          text-align: justify;
        }
        .signature-line {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          font-size: 8px;
          padding-top: 4px;
        }

        @media print {
          body { background: transparent; padding: 0; }
          .top-toolbar { display: none; }
          .a4-sheet {
            margin: 0;
            padding: 4mm;
            border: none;
            box-shadow: none;
            width: 100%;
            height: 100%;
          }
        }
      </style>
    </head>
    <body>
      <div class="top-toolbar">
        <div>
          <strong style="font-size: 16px;">Central de Impressão de Etiquetas</strong>
          <div class="sheet-info">
            Total de Pedidos: <strong>${orders.length}</strong> • Folhas A4 necessárias: <strong>${Math.ceil(orders.length / 2)}</strong> (2 pedidos completos por folha)
          </div>
        </div>
        <button class="btn-print" onclick="window.print()">
          🖨️ Imprimir Todas as Folhas (${orders.length})
        </button>
      </div>

      ${pagesHtml.join("\n")}
    </body>
    </html>
    `;

    return {
      orderId: orders[0].id,
      trackingCode,
      carrierName,
      barcode: trackingCode,
      htmlContent: fullHtml
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

  async markBatchOrdersAsShipped(orderIds: string[]): Promise<number> {
    let count = 0;
    for (const id of orderIds) {
      const ok = await this.markOrderAsShipped(id);
      if (ok) count++;
    }
    return count;
  }
}

export const orderService = new OrderService();
