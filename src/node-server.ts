import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { DB } from "./db.ts";
import type { ChannelId } from "./types.ts";
import { catalogService } from "./services/catalog.ts";
import { inventoryService } from "./services/inventory.ts";
import { orderService } from "./services/orders.ts";
import { calculatePriceForChannel } from "./services/pricing.ts";

const PORT = Number(process.env.PORT) || 3000;

function sendJson(res: http.ServerResponse, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}

function sendHtml(res: http.ServerResponse, html: string, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(html);
}

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function serveStatic(res: http.ServerResponse, filePath: string, contentType: string) {
  if (fs.existsSync(filePath)) {
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(fs.readFileSync(filePath));
    return true;
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  const method = req.method;
  const rawUrl = req.url || "/";
  const urlObj = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
  const pathname = urlObj.pathname;

  // CORS
  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.end();
  }

  try {
    // API Routes
    if (pathname === "/api/stats" && method === "GET") {
      const stats = await DB.getStats();
      return sendJson(res, stats);
    }

    if (pathname === "/api/logs" && method === "GET") {
      const logs = await DB.getRecentLogs(30);
      return sendJson(res, logs);
    }

    // Channels
    if (pathname === "/api/channels" && method === "GET") {
      const channels = await DB.getChannels();
      return sendJson(res, channels);
    }

    if (pathname.startsWith("/api/channels/") && method === "POST") {
      const channelId = pathname.replace("/api/channels/", "") as ChannelId;
      const body = await parseBody(req);
      await DB.updateChannel(channelId, body);
      await DB.logActivity("channel_updated", `Configurações do canal ${channelId} atualizadas`, channelId);
      const ch = await DB.getChannel(channelId);
      return sendJson(res, { success: true, channel: ch });
    }

    // Products
    if (pathname === "/api/products" && method === "GET") {
      const products = await DB.getProducts();
      return sendJson(res, products);
    }

    if (pathname === "/api/products" && method === "POST") {
      const body = await parseBody(req);
      const product = await DB.createProduct(body);

      let publishResults = null;
      if (body.publishNow) {
        publishResults = await catalogService.publishProductToChannels(product.id, body.channelSettings);
      }

      const freshProduct = await DB.getProductById(product.id);
      return sendJson(res, { success: true, product: freshProduct, publishResults }, 201);
    }

    if (pathname.startsWith("/api/products/") && pathname.endsWith("/publish") && method === "POST") {
      const parts = pathname.split("/");
      const productId = parts[3];
      const body = await parseBody(req);
      const results = await catalogService.publishProductToChannels(productId, body.channelSettings);
      const freshProduct = await DB.getProductById(productId);
      return sendJson(res, { success: true, results, product: freshProduct });
    }

    if (pathname.startsWith("/api/products/") && method === "PUT") {
      const id = pathname.replace("/api/products/", "");
      const body = await parseBody(req);
      const updated = await DB.updateProduct(id, body);
      if (!updated) return sendJson(res, { error: "Produto não encontrado" }, 404);

      if (body.stock !== undefined) {
        await inventoryService.syncStockAcrossChannels(updated.sku, updated.stock);
      }

      return sendJson(res, { success: true, product: updated });
    }

    if (pathname.startsWith("/api/products/") && method === "DELETE") {
      const id = pathname.replace("/api/products/", "");
      await DB.deleteProduct(id);
      return sendJson(res, { success: true });
    }

    // Orders
    if (pathname === "/api/orders" && method === "GET") {
      const status = urlObj.searchParams.get("status") || "all";
      const orders = await DB.getOrders(status);
      return sendJson(res, orders);
    }

    // Batch Shipping Labels (with Declaração de Conteúdo, 2 per A4 sheet)
    if (pathname === "/api/orders/batch-labels") {
      let orderIds: string[] = [];
      if (method === "GET") {
        const idsParam = urlObj.searchParams.get("ids");
        orderIds = idsParam ? idsParam.split(",").map(s => s.trim()).filter(Boolean) : [];
      } else if (method === "POST") {
        const body = await parseBody(req);
        orderIds = Array.isArray(body.orderIds) ? body.orderIds : [];
      }

      if (orderIds.length === 0) {
        return sendJson(res, { error: "Nenhum pedido selecionado para impressão" }, 400);
      }

      const orders = await DB.getOrdersByIds(orderIds);
      if (orders.length === 0) {
        return sendJson(res, { error: "Nenhum pedido válido encontrado" }, 404);
      }

      const doc = await orderService.generateBatchShippingDocument(orders);
      if (method === "GET" || urlObj.searchParams.get("format") === "html") {
        return sendHtml(res, doc.htmlContent || "Etiquetas indisponíveis");
      }
      return sendJson(res, doc);
    }

    // Batch Ship Orders
    if (pathname === "/api/orders/batch-ship" && method === "POST") {
      const body = await parseBody(req);
      const orderIds = Array.isArray(body.orderIds) ? body.orderIds : [];
      if (orderIds.length === 0) {
        return sendJson(res, { error: "Nenhum pedido selecionado para despacho" }, 400);
      }
      const count = await orderService.markBatchOrdersAsShipped(orderIds);
      return sendJson(res, { success: true, count });
    }

    if (pathname.startsWith("/api/orders/") && pathname.endsWith("/label") && method === "GET") {
      const parts = pathname.split("/");
      const orderId = parts[3];
      const labelData = await orderService.getPrintableShippingLabel(orderId);
      if (urlObj.searchParams.get("format") === "json") {
        return sendJson(res, labelData);
      }
      return sendHtml(res, labelData.htmlContent || "Etiqueta indisponível");
    }

    if (pathname.startsWith("/api/orders/") && pathname.endsWith("/ship") && method === "POST") {
      const parts = pathname.split("/");
      const orderId = parts[3];
      const success = await orderService.markOrderAsShipped(orderId);
      const ord = await DB.getOrderById(orderId);
      return sendJson(res, { success, order: ord });
    }

    // Smart Pricing Calculation for Channels
    if (pathname === "/api/pricing/calculate" && method === "POST") {
      const body = await parseBody(req);
      const channels = await DB.getChannels();
      const results = channels.map(ch => calculatePriceForChannel(ch, {
        cost_price: Number(body.cost_price) || 0,
        packaging_cost: Number(body.packaging_cost) || 0,
        other_costs: Number(body.other_costs) || 0,
        tax_percent: Number(body.tax_percent) || 0,
        target_profit_type: body.target_profit_type === "fixed" ? "fixed" : "percent",
        target_profit_value: Number(body.target_profit_value) || 25
      }));
      return sendJson(res, { success: true, results });
    }

    // Simulate order
    if (pathname === "/api/orders/simulate" && method === "POST") {
      const body = await parseBody(req);
      const channelId = body.channelId || "mercadolibre";
      const sku = body.sku || "FONE-BT-PRO";
      const product = await DB.getProductBySku(sku);

      if (!product) {
        return sendJson(res, { error: `Produto SKU '${sku}' não encontrado` }, 400);
      }

      const order = await orderService.processIncomingOrder({
        channelId,
        remoteOrderId: `${channelId.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`,
        customerName: body.customerName || "Maria Clara Pereira",
        customerDocument: "123.456.789-00",
        items: [
          {
            sku: product.sku,
            title: product.title,
            quantity: body.quantity || 1,
            unit_price: product.base_price
          }
        ],
        totalAmount: (body.quantity || 1) * product.base_price,
        shippingAddress: {
          recipient_name: body.customerName || "Maria Clara Pereira",
          street: "Rua das Flores",
          number: "340",
          neighborhood: "Jardins",
          city: "Curitiba",
          state: "PR",
          zip_code: "80020-100",
          phone: "(41) 99887-6655"
        }
      });

      const updatedProduct = await DB.getProductById(product.id);
      return sendJson(res, { success: true, order, updatedProduct });
    }

    // Webhooks
    if (pathname.startsWith("/api/webhooks/") && method === "POST") {
      const channelId = pathname.replace("/api/webhooks/", "") as ChannelId;
      const payload = await parseBody(req);
      await DB.logActivity("webhook_received", `Notificação Webhook recebida do canal ${channelId}`, channelId, payload);
      return sendJson(res, { received: true });
    }

    // Static Assets
    const rootDir = process.cwd();
    if (pathname === "/" || pathname === "/index.html") {
      if (serveStatic(res, path.join(rootDir, "index.html"), "text/html; charset=utf-8")) return;
      if (serveStatic(res, path.join(rootDir, "public", "index.html"), "text/html; charset=utf-8")) return;
    }
    if (pathname === "/app.js") {
      if (serveStatic(res, path.join(rootDir, "app.js"), "application/javascript; charset=utf-8")) return;
      if (serveStatic(res, path.join(rootDir, "public", "app.js"), "application/javascript; charset=utf-8")) return;
    }
    if (pathname === "/styles.css") {
      if (serveStatic(res, path.join(rootDir, "styles.css"), "text/css; charset=utf-8")) return;
      if (serveStatic(res, path.join(rootDir, "public", "styles.css"), "text/css; charset=utf-8")) return;
    }

    return sendJson(res, { error: "Rota não encontrada" }, 404);
  } catch (err: any) {
    console.error("Server Error:", err);
    return sendJson(res, { error: err.message }, 500);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SmartHub Node Server rodando na porta ${PORT}`);
});
