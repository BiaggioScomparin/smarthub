var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/index.ts
var api_exports = {};
__export(api_exports, {
  default: () => handler
});
module.exports = __toCommonJS(api_exports);
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = __toESM(require("node:path"));

// src/db.ts
var import_pg = __toESM(require("pg"));
var Pool = import_pg.default.Pool || import_pg.default.default && import_pg.default.default.Pool;
var DEFAULT_DATABASE_URL = "postgresql://postgres.your-tenant-id:dcad519bf34b193c9e81461b097fecf4@184.107.176.201:6543/postgres";
var DATABASE_URL = (typeof Deno !== "undefined" ? Deno.env.get("DATABASE_URL") : process.env.DATABASE_URL) || DEFAULT_DATABASE_URL;
var pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 5e3,
  ssl: false
});
var DB = {
  // Channels
  async getChannels() {
    const res = await pool.query("SELECT * FROM hub_channels ORDER BY id ASC");
    return res.rows.map((r) => ({
      id: r.id,
      name: r.name,
      enabled: Boolean(r.enabled),
      mode: r.mode,
      credentials: typeof r.credentials_json === "string" ? JSON.parse(r.credentials_json || "{}") : r.credentials_json || {},
      last_sync_at: r.last_sync_at ? new Date(r.last_sync_at).toISOString() : null
    }));
  },
  async getChannel(id) {
    const res = await pool.query("SELECT * FROM hub_channels WHERE id = $1", [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      enabled: Boolean(r.enabled),
      mode: r.mode,
      credentials: typeof r.credentials_json === "string" ? JSON.parse(r.credentials_json || "{}") : r.credentials_json || {},
      last_sync_at: r.last_sync_at ? new Date(r.last_sync_at).toISOString() : null
    };
  },
  async updateChannel(id, data) {
    const current = await this.getChannel(id);
    if (!current) return;
    const enabled = data.enabled !== void 0 ? data.enabled : current.enabled;
    const mode = data.mode || current.mode;
    const credentials = data.credentials || current.credentials;
    await pool.query(
      `UPDATE hub_channels
       SET enabled = $1, mode = $2, credentials_json = $3, last_sync_at = NOW()
       WHERE id = $4`,
      [enabled, mode, JSON.stringify(credentials), id]
    );
  },
  // Products
  async getProducts() {
    const pRes = await pool.query("SELECT * FROM hub_products ORDER BY created_at DESC");
    const lRes = await pool.query("SELECT * FROM hub_product_channel_links");
    const linksMap = /* @__PURE__ */ new Map();
    for (const l of lRes.rows) {
      const pid = String(l.product_id);
      if (!linksMap.has(pid)) linksMap.set(pid, []);
      linksMap.get(pid).push({
        id: l.id,
        product_id: pid,
        channel_id: l.channel_id,
        remote_product_id: l.remote_product_id,
        channel_category_id: l.channel_category_id,
        channel_price: l.channel_price ? Number(l.channel_price) : void 0,
        status: l.status,
        last_error: l.last_error,
        published_at: l.published_at ? new Date(l.published_at).toISOString() : null
      });
    }
    return pRes.rows.map((r) => ({
      id: r.id,
      sku: r.sku,
      title: r.title,
      description: r.description || "",
      base_price: Number(r.base_price),
      stock: Number(r.stock),
      weight_kg: Number(r.weight_kg),
      height_cm: Number(r.height_cm),
      width_cm: Number(r.width_cm),
      length_cm: Number(r.length_cm),
      images: Array.isArray(r.images_json) ? r.images_json : JSON.parse(r.images_json || "[]"),
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
      links: linksMap.get(String(r.id)) || []
    }));
  },
  async getProductById(id) {
    const res = await pool.query("SELECT * FROM hub_products WHERE id = $1", [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    const lRes = await pool.query("SELECT * FROM hub_product_channel_links WHERE product_id = $1", [id]);
    const links = lRes.rows.map((l) => ({
      id: l.id,
      product_id: String(l.product_id),
      channel_id: l.channel_id,
      remote_product_id: l.remote_product_id,
      channel_category_id: l.channel_category_id,
      channel_price: l.channel_price ? Number(l.channel_price) : void 0,
      status: l.status,
      last_error: l.last_error,
      published_at: l.published_at ? new Date(l.published_at).toISOString() : null
    }));
    return {
      id: r.id,
      sku: r.sku,
      title: r.title,
      description: r.description || "",
      base_price: Number(r.base_price),
      stock: Number(r.stock),
      weight_kg: Number(r.weight_kg),
      height_cm: Number(r.height_cm),
      width_cm: Number(r.width_cm),
      length_cm: Number(r.length_cm),
      images: Array.isArray(r.images_json) ? r.images_json : JSON.parse(r.images_json || "[]"),
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
      links
    };
  },
  async getProductBySku(sku) {
    const res = await pool.query("SELECT * FROM hub_products WHERE sku = $1", [sku]);
    if (res.rows.length === 0) return null;
    return this.getProductById(res.rows[0].id);
  },
  async createProduct(data) {
    const res = await pool.query(
      `INSERT INTO hub_products (sku, title, description, base_price, stock, weight_kg, height_cm, width_cm, length_cm, images_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        data.sku.trim(),
        data.title.trim(),
        data.description || "",
        data.base_price,
        data.stock,
        data.weight_kg || 0.3,
        data.height_cm || 10,
        data.width_cm || 15,
        data.length_cm || 20,
        JSON.stringify(data.images || [])
      ]
    );
    const newId = res.rows[0].id;
    return await this.getProductById(newId);
  },
  async updateProduct(id, data) {
    const existing = await this.getProductById(id);
    if (!existing) return null;
    await pool.query(
      `UPDATE hub_products
       SET sku = $1, title = $2, description = $3, base_price = $4, stock = $5,
           weight_kg = $6, height_cm = $7, width_cm = $8, length_cm = $9,
           images_json = $10, updated_at = NOW()
       WHERE id = $11`,
      [
        data.sku !== void 0 ? data.sku.trim() : existing.sku,
        data.title !== void 0 ? data.title.trim() : existing.title,
        data.description !== void 0 ? data.description : existing.description,
        data.base_price !== void 0 ? data.base_price : existing.base_price,
        data.stock !== void 0 ? data.stock : existing.stock,
        data.weight_kg !== void 0 ? data.weight_kg : existing.weight_kg,
        data.height_cm !== void 0 ? data.height_cm : existing.height_cm,
        data.width_cm !== void 0 ? data.width_cm : existing.width_cm,
        data.length_cm !== void 0 ? data.length_cm : existing.length_cm,
        data.images ? JSON.stringify(data.images) : JSON.stringify(existing.images),
        id
      ]
    );
    return this.getProductById(id);
  },
  async deleteProduct(id) {
    await pool.query("DELETE FROM hub_products WHERE id = $1", [id]);
  },
  async updateStock(productId, newStock) {
    await pool.query("UPDATE hub_products SET stock = $1, updated_at = NOW() WHERE id = $2", [newStock, productId]);
  },
  // Product Channel Links
  async saveChannelLink(link) {
    await pool.query(
      `INSERT INTO hub_product_channel_links (product_id, channel_id, remote_product_id, channel_category_id, channel_price, status, last_error, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (product_id, channel_id) DO UPDATE SET
         remote_product_id = EXCLUDED.remote_product_id,
         channel_category_id = EXCLUDED.channel_category_id,
         channel_price = EXCLUDED.channel_price,
         status = EXCLUDED.status,
         last_error = EXCLUDED.last_error,
         published_at = NOW()`,
      [
        link.product_id,
        link.channel_id,
        link.remote_product_id || null,
        link.channel_category_id || null,
        link.channel_price || null,
        link.status,
        link.last_error || null
      ]
    );
  },
  // Orders
  async getOrders(status) {
    let sql = "SELECT * FROM hub_orders";
    const params = [];
    if (status && status !== "all") {
      sql += " WHERE status = $1";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC";
    const res = await pool.query(sql, params);
    return res.rows.map((r) => ({
      id: r.id,
      channel_id: r.channel_id,
      remote_order_id: r.remote_order_id,
      customer_name: r.customer_name,
      customer_document: r.customer_document || "",
      items: typeof r.items_json === "string" ? JSON.parse(r.items_json || "[]") : r.items_json || [],
      total_amount: Number(r.total_amount),
      shipping_address: typeof r.shipping_address_json === "string" ? JSON.parse(r.shipping_address_json || "{}") : r.shipping_address_json || {},
      shipping_label_url: r.shipping_label_url || "",
      tracking_code: r.tracking_code || "",
      shipping_service: r.shipping_service,
      status: r.status,
      created_at: new Date(r.created_at).toISOString()
    }));
  },
  async getOrderById(id) {
    const res = await pool.query("SELECT * FROM hub_orders WHERE id = $1", [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      channel_id: r.channel_id,
      remote_order_id: r.remote_order_id,
      customer_name: r.customer_name,
      customer_document: r.customer_document || "",
      items: typeof r.items_json === "string" ? JSON.parse(r.items_json || "[]") : r.items_json || [],
      total_amount: Number(r.total_amount),
      shipping_address: typeof r.shipping_address_json === "string" ? JSON.parse(r.shipping_address_json || "{}") : r.shipping_address_json || {},
      shipping_label_url: r.shipping_label_url || "",
      tracking_code: r.tracking_code || "",
      shipping_service: r.shipping_service,
      status: r.status,
      created_at: new Date(r.created_at).toISOString()
    };
  },
  async createOrder(order) {
    const res = await pool.query(
      `INSERT INTO hub_orders (channel_id, remote_order_id, customer_name, customer_document, items_json, total_amount, shipping_address_json, shipping_label_url, tracking_code, shipping_service, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        order.channel_id,
        order.remote_order_id,
        order.customer_name,
        order.customer_document || "",
        JSON.stringify(order.items),
        order.total_amount,
        JSON.stringify(order.shipping_address),
        order.shipping_label_url || "",
        order.tracking_code || "",
        order.shipping_service,
        order.status
      ]
    );
    const newId = res.rows[0].id;
    return await this.getOrderById(newId);
  },
  async updateOrderStatus(id, status, trackingCode) {
    if (trackingCode) {
      await pool.query("UPDATE hub_orders SET status = $1, tracking_code = $2 WHERE id = $3", [status, trackingCode, id]);
    } else {
      await pool.query("UPDATE hub_orders SET status = $1 WHERE id = $2", [status, id]);
    }
  },
  // Activity Logs
  async logActivity(type, message, channelId, metadata) {
    await pool.query(
      `INSERT INTO hub_activity_logs (type, channel_id, message, metadata_json)
       VALUES ($1, $2, $3, $4)`,
      [
        type,
        channelId || null,
        message,
        metadata ? JSON.stringify(metadata) : null
      ]
    );
  },
  async getRecentLogs(limit = 25) {
    const res = await pool.query("SELECT * FROM hub_activity_logs ORDER BY created_at DESC LIMIT $1", [limit]);
    return res.rows.map((r) => ({
      ...r,
      metadata: typeof r.metadata_json === "string" ? JSON.parse(r.metadata_json || "null") : r.metadata_json,
      created_at: new Date(r.created_at).toISOString()
    }));
  },
  async getStats() {
    const [pCount, oCount, rCount, revCount, sCount] = await Promise.all([
      pool.query("SELECT COUNT(*) as c FROM hub_products"),
      pool.query("SELECT COUNT(*) as c FROM hub_orders"),
      pool.query("SELECT COUNT(*) as c FROM hub_orders WHERE status = 'ready_to_ship'"),
      pool.query("SELECT COALESCE(SUM(total_amount), 0) as s FROM hub_orders WHERE status != 'cancelled'"),
      pool.query("SELECT COUNT(*) as c FROM hub_products WHERE stock <= 5")
    ]);
    return {
      totalProducts: Number(pCount.rows[0].c),
      totalOrders: Number(oCount.rows[0].c),
      readyToShip: Number(rCount.rows[0].c),
      totalRevenue: Number(Number(revCount.rows[0].s).toFixed(2)),
      lowStockCount: Number(sCount.rows[0].c)
    };
  }
};

// src/adapters/mercadolibre.ts
var MercadoLibreAdapter = class {
  channelId = "mercadolibre";
  name = "Mercado Livre";
  config;
  constructor(config) {
    this.config = config;
  }
  isConfigured() {
    const creds = this.config.credentials;
    return Boolean(creds.access_token && creds.seller_id);
  }
  async publishProduct(product, customPrice, categoryId) {
    const price = customPrice || product.base_price;
    const cat = categoryId || "MLB3112";
    if (this.config.mode === "production" && this.isConfigured()) {
      try {
        const res = await fetch("https://api.mercadolibre.com/items", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.config.credentials.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: product.title.slice(0, 60),
            // ML allows max 60 chars in title
            category_id: cat,
            price,
            currency_id: "BRL",
            available_quantity: product.stock,
            buying_mode: "buy_it_now",
            listing_type_id: "gold_special",
            condition: "new",
            pictures: product.images.map((url) => ({ source: url })),
            attributes: [
              { id: "BRAND", value_name: "Gen\xE9rico" },
              { id: "MODEL", value_name: product.sku },
              { id: "SELLER_SKU", value_name: product.sku }
            ],
            shipping: {
              mode: "me2",
              local_pick_up: false,
              free_shipping: price > 79
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
      } catch (err) {
        return {
          channel_id: this.channelId,
          success: false,
          message: `Falha de rede ML: ${err.message}`
        };
      }
    }
    const simulatedId = `MLB${Math.floor(1e9 + Math.random() * 9e9)}`;
    return {
      channel_id: this.channelId,
      remote_id: simulatedId,
      success: true,
      message: `[Modo Simula\xE7\xE3o] An\xFAncio gerado com sucesso: ${simulatedId}`
    };
  }
  async updateStock(remoteProductId, newStock) {
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
      } catch (err) {
        return { success: false, message: err.message };
      }
    }
    return { success: true, message: `[Simula\xE7\xE3o] Estoque atualizado no ML para ${newStock}` };
  }
  async getShippingLabel(remoteOrderId, orderData) {
    const trackingCode = orderData?.tracking_code || `BR-MLB-${Math.floor(1e6 + Math.random() * 9e6)}`;
    const barcode = `412${Math.floor(1e15 + Math.random() * 9e15)}`;
    return {
      orderId: remoteOrderId,
      trackingCode,
      carrierName: "Mercado Envios Coleta",
      barcode
    };
  }
  async markAsShipped(remoteOrderId, trackingCode) {
    return { success: true, message: `Despacho registrado no Mercado Livre (${trackingCode})` };
  }
};

// src/adapters/shopee.ts
var ShopeeAdapter = class {
  channelId = "shopee";
  name = "Shopee";
  config;
  constructor(config) {
    this.config = config;
  }
  isConfigured() {
    const creds = this.config.credentials;
    return Boolean(creds.partner_id && creds.partner_key && creds.shop_id && creds.access_token);
  }
  async generateSign(path2, timestamp) {
    const creds = this.config.credentials;
    const baseStr = `${creds.partner_id}${path2}${timestamp}${creds.access_token || ""}${creds.shop_id || ""}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(creds.partner_key || ""),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, enc.encode(baseStr));
    return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async publishProduct(product, customPrice, categoryId) {
    const price = customPrice || product.base_price;
    const cat = Number(categoryId) || 100010;
    if (this.config.mode === "production" && this.isConfigured()) {
      try {
        const timestamp = Math.floor(Date.now() / 1e3);
        const path2 = "/api/v2/product/add_item";
        const sign = await this.generateSign(path2, timestamp);
        const creds = this.config.credentials;
        const url = `https://partner.shopeemobile.com${path2}?partner_id=${creds.partner_id}&timestamp=${timestamp}&sign=${sign}&access_token=${creds.access_token}&shop_id=${creds.shop_id}`;
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
      } catch (err) {
        return {
          channel_id: this.channelId,
          success: false,
          message: `Falha de rede Shopee: ${err.message}`
        };
      }
    }
    const simulatedId = `SHP${Math.floor(1e9 + Math.random() * 9e9)}`;
    return {
      channel_id: this.channelId,
      remote_id: simulatedId,
      success: true,
      message: `[Modo Simula\xE7\xE3o] An\xFAncio gerado com sucesso: ${simulatedId}`
    };
  }
  async updateStock(remoteProductId, newStock) {
    if (this.config.mode === "production" && this.isConfigured()) {
      try {
        const timestamp = Math.floor(Date.now() / 1e3);
        const path2 = "/api/v2/product/update_stock";
        const sign = await this.generateSign(path2, timestamp);
        const creds = this.config.credentials;
        const url = `https://partner.shopeemobile.com${path2}?partner_id=${creds.partner_id}&timestamp=${timestamp}&sign=${sign}&access_token=${creds.access_token}&shop_id=${creds.shop_id}`;
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
      } catch (err) {
        return { success: false, message: err.message };
      }
    }
    return { success: true, message: `[Simula\xE7\xE3o] Estoque atualizado na Shopee para ${newStock}` };
  }
  async getShippingLabel(remoteOrderId, orderData) {
    const trackingCode = orderData?.tracking_code || `BR-SPX-${Math.floor(1e7 + Math.random() * 9e7)}`;
    const barcode = `809${Math.floor(1e15 + Math.random() * 9e15)}`;
    return {
      orderId: remoteOrderId,
      trackingCode,
      carrierName: "Shopee Xpress (SPX)",
      barcode
    };
  }
  async markAsShipped(remoteOrderId, trackingCode) {
    return { success: true, message: `Despacho registrado na Shopee (${trackingCode})` };
  }
};

// src/adapters/tiktok.ts
var TikTokShopAdapter = class {
  channelId = "tiktok";
  name = "TikTok Shop";
  config;
  constructor(config) {
    this.config = config;
  }
  isConfigured() {
    const creds = this.config.credentials;
    return Boolean(creds.app_key && creds.app_secret && creds.shop_cipher && creds.access_token);
  }
  async generateSign(path2, timestamp) {
    const creds = this.config.credentials;
    const baseStr = `${creds.app_secret}${path2}app_key${creds.app_key}timestamp${timestamp}${creds.app_secret}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(creds.app_secret || ""),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, enc.encode(baseStr));
    return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async publishProduct(product, customPrice, categoryId) {
    const price = customPrice || product.base_price;
    const cat = categoryId || "601142";
    if (this.config.mode === "production" && this.isConfigured()) {
      try {
        const timestamp = Math.floor(Date.now() / 1e3);
        const path2 = "/product/202309/products";
        const sign = await this.generateSign(path2, timestamp);
        const creds = this.config.credentials;
        const url = `https://open-api.tiktokglobalshop.com${path2}?app_key=${creds.app_key}&sign=${sign}&timestamp=${timestamp}&shop_cipher=${creds.shop_cipher}`;
        const payload = {
          title: product.title,
          description: product.description || product.title,
          category_id: cat,
          brand_id: "0",
          main_images: product.images.map((uri) => ({ uri })),
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
      } catch (err) {
        return {
          channel_id: this.channelId,
          success: false,
          message: `Falha de rede TikTok Shop: ${err.message}`
        };
      }
    }
    const simulatedId = `TTS${Math.floor(1e9 + Math.random() * 9e9)}`;
    return {
      channel_id: this.channelId,
      remote_id: simulatedId,
      success: true,
      message: `[Modo Simula\xE7\xE3o] An\xFAncio gerado com sucesso: ${simulatedId}`
    };
  }
  async updateStock(remoteProductId, newStock) {
    if (this.config.mode === "production" && this.isConfigured()) {
      try {
        const timestamp = Math.floor(Date.now() / 1e3);
        const path2 = "/product/202309/inventories/update";
        const sign = await this.generateSign(path2, timestamp);
        const creds = this.config.credentials;
        const url = `https://open-api.tiktokglobalshop.com${path2}?app_key=${creds.app_key}&sign=${sign}&timestamp=${timestamp}&shop_cipher=${creds.shop_cipher}`;
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
      } catch (err) {
        return { success: false, message: err.message };
      }
    }
    return { success: true, message: `[Simula\xE7\xE3o] Estoque atualizado no TikTok Shop para ${newStock}` };
  }
  async getShippingLabel(remoteOrderId, orderData) {
    const trackingCode = orderData?.tracking_code || `BR-TTS-${Math.floor(1e7 + Math.random() * 9e7)}`;
    const barcode = `923${Math.floor(1e15 + Math.random() * 9e15)}`;
    return {
      orderId: remoteOrderId,
      trackingCode,
      carrierName: "TikTok Shipping (Pegaki / Total Express)",
      barcode
    };
  }
  async markAsShipped(remoteOrderId, trackingCode) {
    return { success: true, message: `Despacho registrado no TikTok Shop (${trackingCode})` };
  }
};

// src/services/catalog.ts
var CatalogService = class {
  async getAdapter(channelId) {
    const config = await DB.getChannel(channelId);
    if (!config) throw new Error(`Canal n\xE3o configurado: ${channelId}`);
    switch (channelId) {
      case "mercadolibre":
        return new MercadoLibreAdapter(config);
      case "shopee":
        return new ShopeeAdapter(config);
      case "tiktok":
        return new TikTokShopAdapter(config);
      default:
        throw new Error(`Canal n\xE3o suportado: ${channelId}`);
    }
  }
  async publishProductToChannels(productId, channelSettings) {
    const product = await DB.getProductById(productId);
    if (!product) {
      throw new Error(`Produto n\xE3o encontrado: ${productId}`);
    }
    const channels = (await DB.getChannels()).filter((c) => c.enabled);
    const results = [];
    for (const channel of channels) {
      const channelId = channel.id;
      const setting = channelSettings ? channelSettings[channelId] : { enabled: true };
      if (channelSettings && !setting.enabled) {
        continue;
      }
      const adapter = await this.getAdapter(channelId);
      const customPrice = setting?.customPrice || product.base_price;
      const categoryId = setting?.categoryId;
      try {
        const result = await adapter.publishProduct(product, customPrice, categoryId);
        results.push(result);
        if (result.success && result.remote_id) {
          await DB.saveChannelLink({
            product_id: product.id,
            channel_id: channelId,
            remote_product_id: result.remote_id,
            channel_category_id: categoryId,
            channel_price: customPrice,
            status: "synced",
            published_at: (/* @__PURE__ */ new Date()).toISOString()
          });
          await DB.logActivity(
            "publish_success",
            `Produto '${product.title}' (${product.sku}) publicado no ${adapter.name}`,
            channelId,
            { remote_id: result.remote_id }
          );
        } else {
          await DB.saveChannelLink({
            product_id: product.id,
            channel_id: channelId,
            status: "error",
            last_error: result.message
          });
          await DB.logActivity(
            "publish_error",
            `Falha ao publicar '${product.title}' no ${adapter.name}: ${result.message}`,
            channelId
          );
        }
      } catch (err) {
        results.push({
          channel_id: channelId,
          success: false,
          message: err.message
        });
        await DB.saveChannelLink({
          product_id: product.id,
          channel_id: channelId,
          status: "error",
          last_error: err.message
        });
      }
    }
    return results;
  }
};
var catalogService = new CatalogService();

// src/services/inventory.ts
var InventoryService = class {
  async syncStockAcrossChannels(sku, newStock, originChannel) {
    const product = await DB.getProductBySku(sku);
    if (!product) {
      console.warn(`[Inventory] Produto SKU ${sku} n\xE3o encontrado para sincroniza\xE7\xE3o`);
      return;
    }
    await DB.updateStock(product.id, newStock);
    const links = product.links || [];
    const updates = [];
    for (const link of links) {
      if (originChannel && link.channel_id === originChannel) {
        continue;
      }
      if (!link.remote_product_id) continue;
      const channel = await DB.getChannel(link.channel_id);
      if (!channel || !channel.enabled) continue;
      const p = (async () => {
        try {
          let adapter;
          if (link.channel_id === "mercadolibre") adapter = new MercadoLibreAdapter(channel);
          else if (link.channel_id === "shopee") adapter = new ShopeeAdapter(channel);
          else if (link.channel_id === "tiktok") adapter = new TikTokShopAdapter(channel);
          if (adapter) {
            const res = await adapter.updateStock(link.remote_product_id, newStock);
            if (res.success) {
              await DB.logActivity(
                "stock_sync",
                `Estoque de '${product.title}' (${sku}) sincronizado para ${newStock} no ${adapter.name}`,
                link.channel_id
              );
            }
          }
        } catch (err) {
          await DB.logActivity(
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
  async deductStockForOrder(items, originChannel) {
    for (const item of items) {
      const prod = await DB.getProductBySku(item.sku);
      if (prod) {
        const newStock = Math.max(0, prod.stock - item.quantity);
        await this.syncStockAcrossChannels(item.sku, newStock, originChannel);
      }
    }
  }
};
var inventoryService = new InventoryService();

// src/services/orders.ts
var OrderService = class {
  async processIncomingOrder(params) {
    const channel = await DB.getChannel(params.channelId);
    let carrierName = params.shippingService;
    if (!carrierName) {
      if (params.channelId === "mercadolibre") carrierName = "Mercado Envios";
      else if (params.channelId === "shopee") carrierName = "Shopee Xpress (SPX)";
      else carrierName = "TikTok Shipping (Pegaki)";
    }
    const prefix = params.channelId === "mercadolibre" ? "BR-MLB" : params.channelId === "shopee" ? "BR-SPX" : "BR-TTS";
    const trackingCode = `${prefix}-${Math.floor(1e7 + Math.random() * 9e7)}`;
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
  async getPrintableShippingLabel(orderId) {
    const order = await DB.getOrderById(orderId);
    if (!order) {
      throw new Error("Pedido n\xE3o encontrado");
    }
    const channel = await DB.getChannel(order.channel_id);
    let adapter;
    if (order.channel_id === "mercadolibre") adapter = new MercadoLibreAdapter(channel);
    else if (order.channel_id === "shopee") adapter = new ShopeeAdapter(channel);
    else adapter = new TikTokShopAdapter(channel);
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
      <button class="no-print-btn" onclick="window.print()">\u{1F5A8}\uFE0F Imprimir Etiqueta</button>
      <div class="label-container">
        <div class="header">
          <div class="channel-tag">
            ${order.channel_id === "mercadolibre" ? "\u{1F7E1} Mercado Livre" : order.channel_id === "shopee" ? "\u{1F7E0} Shopee" : "\u26AB TikTok Shop"}
          </div>
          <div class="carrier">${labelInfo.carrierName}</div>
        </div>

        <div class="barcode-section">
          <div class="barcode-bars"></div>
          <div class="tracking-code">${labelInfo.trackingCode}</div>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">C\xF3d. Rastreio / Pacote: ${order.remote_order_id}</div>
        </div>

        <div class="section-box">
          <div class="section-title">DESTINAT\xC1RIO</div>
          <div><strong>Nome:</strong> ${order.customer_name}</div>
          <div><strong>Endere\xE7o:</strong> ${order.shipping_address.street}, ${order.shipping_address.number} ${order.shipping_address.complement ? "- " + order.shipping_address.complement : ""}</div>
          <div><strong>Bairro:</strong> ${order.shipping_address.neighborhood} | <strong>Cidade:</strong> ${order.shipping_address.city} - ${order.shipping_address.state}</div>
          <div><strong>CEP:</strong> ${order.shipping_address.zip_code}</div>
          <div><strong>Doc:</strong> ${order.customer_document}</div>
        </div>

        <div class="section-box">
          <div class="section-title">REMETENTE</div>
          <div><strong>Empresa:</strong> Minha Loja Hub Multi-Canal LTDA</div>
          <div><strong>Endere\xE7o:</strong> Centro de Distribui\xE7\xE3o / Expedi\xE7\xE3o</div>
          <div><strong>Origem:</strong> S\xE3o Paulo - SP</div>
        </div>

        <div class="section-box">
          <div class="section-title">CONTE\xDADO DO PACOTE (DECLARA\xC7\xC3O DE CONTE\xDADO)</div>
          <table class="items-table">
            <thead>
              <tr><th>Item</th><th>SKU</th><th>Qtd</th><th>Valor Unit.</th></tr>
            </thead>
            <tbody>
              ${order.items.map((it) => `
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
  async markOrderAsShipped(orderId) {
    const order = await DB.getOrderById(orderId);
    if (!order) return false;
    const channel = await DB.getChannel(order.channel_id);
    let adapter;
    if (order.channel_id === "mercadolibre") adapter = new MercadoLibreAdapter(channel);
    else if (order.channel_id === "shopee") adapter = new ShopeeAdapter(channel);
    else adapter = new TikTokShopAdapter(channel);
    await adapter.markAsShipped(order.remote_order_id, order.tracking_code || "");
    await DB.updateOrderStatus(orderId, "shipped");
    await DB.logActivity(
      "order_shipped",
      `Pedido #${order.remote_order_id} marcado como despachado no ${channel?.name || order.channel_id}`,
      order.channel_id
    );
    return true;
  }
};
var orderService = new OrderService();

// api/index.ts
function sendJson(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}
function sendHtml(res, html, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(html);
}
function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => body += chunk);
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}
function getFileContent(filename) {
  const cwd = process.cwd();
  const candidates = [
    import_node_path.default.join(cwd, "public", filename),
    import_node_path.default.join(cwd, filename)
  ];
  for (const c of candidates) {
    try {
      if (import_node_fs.default.existsSync(c)) {
        return import_node_fs.default.readFileSync(c, "utf-8");
      }
    } catch {
    }
  }
  return null;
}
async function handler(req, res) {
  const method = req.method;
  const rawUrl = req.url || "/";
  const urlObj = new URL(rawUrl, `http://${req.headers?.host || "localhost"}`);
  const pathname = urlObj.pathname;
  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.end();
  }
  try {
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
    if (pathname === "/api/stats" && method === "GET") {
      const stats = await DB.getStats();
      return sendJson(res, stats);
    }
    if (pathname === "/api/logs" && method === "GET") {
      const logs = await DB.getRecentLogs(30);
      return sendJson(res, logs);
    }
    if (pathname === "/api/channels" && method === "GET") {
      const channels = await DB.getChannels();
      return sendJson(res, channels);
    }
    if (pathname.startsWith("/api/channels/") && method === "POST") {
      const channelId = pathname.replace("/api/channels/", "");
      const body = await parseBody(req);
      await DB.updateChannel(channelId, body);
      await DB.logActivity("channel_updated", `Configura\xE7\xF5es do canal ${channelId} atualizadas`, channelId);
      const ch = await DB.getChannel(channelId);
      return sendJson(res, { success: true, channel: ch });
    }
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
      if (!updated) return sendJson(res, { error: "Produto n\xE3o encontrado" }, 404);
      if (body.stock !== void 0) {
        await inventoryService.syncStockAcrossChannels(updated.sku, updated.stock);
      }
      return sendJson(res, { success: true, product: updated });
    }
    if (pathname.startsWith("/api/products/") && method === "DELETE") {
      const id = pathname.replace("/api/products/", "");
      await DB.deleteProduct(id);
      return sendJson(res, { success: true });
    }
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
      return sendHtml(res, labelData.htmlContent || "Etiqueta indispon\xEDvel");
    }
    if (pathname.startsWith("/api/orders/") && pathname.endsWith("/ship") && method === "POST") {
      const parts = pathname.split("/");
      const orderId = parts[3];
      const success = await orderService.markOrderAsShipped(orderId);
      const ord = await DB.getOrderById(orderId);
      return sendJson(res, { success, order: ord });
    }
    if (pathname === "/api/orders/simulate" && method === "POST") {
      const body = await parseBody(req);
      const channelId = body.channelId || "mercadolibre";
      const sku = body.sku || "FONE-BT-PRO";
      const product = await DB.getProductBySku(sku);
      if (!product) {
        return sendJson(res, { error: `Produto SKU '${sku}' n\xE3o encontrado` }, 400);
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
    if (pathname.startsWith("/api/webhooks/") && method === "POST") {
      const channelId = pathname.replace("/api/webhooks/", "");
      const payload = await parseBody(req);
      await DB.logActivity("webhook_received", `Notifica\xE7\xE3o Webhook recebida do canal ${channelId}`, channelId, payload);
      return sendJson(res, { received: true });
    }
    return sendJson(res, { error: "Rota n\xE3o encontrada" }, 404);
  } catch (err) {
    console.error("Vercel Function Error:", err);
    return sendJson(res, { error: err.message, stack: err.stack }, 500);
  }
}
