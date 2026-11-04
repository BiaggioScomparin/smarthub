import { DB } from "./db.ts";
import type { ChannelId } from "./types.ts";
import { catalogService } from "./services/catalog.ts";
import { inventoryService } from "./services/inventory.ts";
import { orderService } from "./services/orders.ts";

const PORT = Number(Deno.env.get("PORT")) || 3000;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

function html(content: string, status = 200) {
  return new Response(content, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

async function serveStaticFile(filePath: string, contentType: string) {
  try {
    const file = await Deno.readFile(filePath);
    return new Response(file, {
      status: 200,
      headers: { "Content-Type": contentType }
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

const publicDir = new URL("./public", import.meta.url).pathname;
const cleanPublicDir = Deno.build.os === "windows" && publicDir.startsWith("/") ? publicDir.slice(1) : publicDir;

Deno.serve({ port: PORT }, async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }

  try {
    // API Routes
    if (pathname === "/api/stats" && method === "GET") {
      const stats = DB.getStats();
      return json(stats);
    }

    if (pathname === "/api/logs" && method === "GET") {
      const logs = DB.getRecentLogs(30);
      return json(logs);
    }

    // Channels
    if (pathname === "/api/channels" && method === "GET") {
      const channels = DB.getChannels();
      return json(channels);
    }

    if (pathname.startsWith("/api/channels/") && method === "POST") {
      const channelId = pathname.replace("/api/channels/", "") as ChannelId;
      const body = await req.json();
      DB.updateChannel(channelId, body);
      DB.logActivity("channel_updated", `Configurações do canal ${channelId} atualizadas`, channelId);
      return json({ success: true, channel: DB.getChannel(channelId) });
    }

    // Products
    if (pathname === "/api/products" && method === "GET") {
      const products = DB.getProducts();
      return json(products);
    }

    if (pathname === "/api/products" && method === "POST") {
      const body = await req.json();
      const product = DB.createProduct(body);

      // If publishNow is set, immediately dispatch to all channels!
      let publishResults = null;
      if (body.publishNow) {
        publishResults = await catalogService.publishProductToChannels(product.id, body.channelSettings);
      }

      return json({ success: true, product: DB.getProductById(product.id), publishResults }, 201);
    }

    if (pathname.startsWith("/api/products/") && pathname.endsWith("/publish") && method === "POST") {
      const parts = pathname.split("/");
      const productId = parts[3];
      const body = await req.json().catch(() => ({}));
      const results = await catalogService.publishProductToChannels(productId, body.channelSettings);
      return json({ success: true, results, product: DB.getProductById(productId) });
    }

    if (pathname.startsWith("/api/products/") && method === "PUT") {
      const id = pathname.replace("/api/products/", "");
      const body = await req.json();
      const updated = DB.updateProduct(id, body);
      if (!updated) return json({ error: "Produto não encontrado" }, 404);

      // If stock changed, propagate to all connected channels
      if (body.stock !== undefined) {
        await inventoryService.syncStockAcrossChannels(updated.sku, updated.stock);
      }

      return json({ success: true, product: updated });
    }

    if (pathname.startsWith("/api/products/") && method === "DELETE") {
      const id = pathname.replace("/api/products/", "");
      DB.deleteProduct(id);
      return json({ success: true });
    }

    // Orders
    if (pathname === "/api/orders" && method === "GET") {
      const status = url.searchParams.get("status") || "all";
      const orders = DB.getOrders(status);
      return json(orders);
    }

    if (pathname.startsWith("/api/orders/") && pathname.endsWith("/label") && method === "GET") {
      const parts = pathname.split("/");
      const orderId = parts[3];
      const labelData = await orderService.getPrintableShippingLabel(orderId);
      if (url.searchParams.get("format") === "json") {
        return json(labelData);
      }
      return html(labelData.htmlContent || "Etiqueta indisponível");
    }

    if (pathname.startsWith("/api/orders/") && pathname.endsWith("/ship") && method === "POST") {
      const parts = pathname.split("/");
      const orderId = parts[3];
      const success = await orderService.markOrderAsShipped(orderId);
      return json({ success, order: DB.getOrderById(orderId) });
    }

    // Simulate incoming order to test multi-channel flow in 1-click
    if (pathname === "/api/orders/simulate" && method === "POST") {
      const body = await req.json();
      const channelId = body.channelId || "mercadolibre";
      const sku = body.sku || "FONE-BT-PRO";
      const product = DB.getProductBySku(sku);

      if (!product) {
        return json({ error: `Produto SKU '${sku}' não encontrado` }, 400);
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

      return json({
        success: true,
        order,
        updatedProduct: DB.getProductById(product.id)
      });
    }

    // Webhooks for real channels
    if (pathname.startsWith("/api/webhooks/") && method === "POST") {
      const channelId = pathname.replace("/api/webhooks/", "") as ChannelId;
      const payload = await req.json();
      DB.logActivity("webhook_received", `Notificação Webhook recebida do canal ${channelId}`, channelId, payload);
      // Fast acknowledgement
      return json({ received: true });
    }

    // Static Frontend files
    if (pathname === "/" || pathname === "/index.html") {
      return serveStaticFile(`${cleanPublicDir}/index.html`, "text/html; charset=utf-8");
    }
    if (pathname === "/app.js") {
      return serveStaticFile(`${cleanPublicDir}/app.js`, "application/javascript; charset=utf-8");
    }
    if (pathname === "/styles.css") {
      return serveStaticFile(`${cleanPublicDir}/styles.css`, "text/css; charset=utf-8");
    }

    return new Response("Not Found", { status: 404 });
  } catch (err: any) {
    console.error("Server Error:", err);
    return json({ error: err.message }, 500);
  }
});

console.log(`🚀 Hub de Marketplaces ativo em: http://localhost:${PORT}`);
