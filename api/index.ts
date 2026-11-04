import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { DB } from "../src/db.ts";
import type { ChannelId } from "../src/types.ts";
import { catalogService } from "../src/services/catalog.ts";
import { inventoryService } from "../src/services/inventory.ts";
import { orderService } from "../src/services/orders.ts";

function sendJson(res: ServerResponse, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}

function sendHtml(res: ServerResponse, html: string, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(html);
}

function parseBody(req: IncomingMessage): Promise<any> {
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

function getFileContent(filename: string): string | null {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "public", filename),
    path.join(cwd, filename)
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        return fs.readFileSync(c, "utf-8");
      }
    } catch {
      // Continue search
    }
  }
  return null;
}

export default async function handler(req: any, res: any) {
  const method = req.method;
  const rawUrl = req.url || "/";
  const urlObj = new URL(rawUrl, `http://${req.headers?.host || "localhost"}`);
  const pathname = urlObj.pathname;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.end();
  }

  try {
    // Static files fallback if routed through function
    if (pathname === "/" || pathname === "/index.html") {
      const htmlContent = getFileContent("index.html");
      if (htmlContent) return sendHtml(res, htmlContent);
    }
    if (pathname === "/app.js") {
      const jsContent = getFileContent("app.js");
      if (jsContent) {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        return res.end(jsContent);
      }
    }
    if (pathname === "/styles.css") {
      const cssContent = getFileContent("styles.css");
      if (cssContent) {
        res.setHeader("Content-Type", "text/css; charset=utf-8");
        return res.end(cssContent);
      }
    }

    // Stats
    if (pathname === "/api/stats" && method === "GET") {
      const stats = await DB.getStats();
      return sendJson(res, stats);
    }

    // Logs
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

    return sendJson(res, { error: "Rota não encontrada" }, 404);
  } catch (err: any) {
    console.error("Vercel Function Error:", err);
    return sendJson(res, { error: err.message, stack: err.stack }, 500);
  }
}
