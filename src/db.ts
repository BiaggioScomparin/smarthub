import { Database } from "@db/sqlite";
import type { ChannelConfig, ChannelId, Order, Product, ProductChannelLink } from "./types.ts";

const dbPath = new URL("../hub.db", import.meta.url).pathname;
// On Windows, handle leading slash if needed
const cleanPath = Deno.build.os === "windows" && dbPath.startsWith("/") ? dbPath.slice(1) : dbPath;
const db = new Database(cleanPath);

// Enable WAL mode for high concurrency
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    mode TEXT NOT NULL DEFAULT 'sandbox',
    credentials_json TEXT NOT NULL DEFAULT '{}',
    last_sync_at TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    base_price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    weight_kg REAL NOT NULL DEFAULT 0.3,
    height_cm REAL NOT NULL DEFAULT 10,
    width_cm REAL NOT NULL DEFAULT 15,
    length_cm REAL NOT NULL DEFAULT 20,
    images_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS product_channel_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    remote_product_id TEXT,
    channel_category_id TEXT,
    channel_price REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    last_error TEXT,
    published_at TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(product_id, channel_id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    remote_order_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_document TEXT,
    items_json TEXT NOT NULL DEFAULT '[]',
    total_amount REAL NOT NULL,
    shipping_address_json TEXT NOT NULL DEFAULT '{}',
    shipping_label_url TEXT,
    tracking_code TEXT,
    shipping_service TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready_to_ship',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    channel_id TEXT,
    message TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL
  );
`);

// Seed channels if not existing
const existingChannels = db.prepare("SELECT COUNT(*) as count FROM channels").get() as { count: number };
if (existingChannels.count === 0) {
  const insertChannel = db.prepare(`
    INSERT INTO channels (id, name, enabled, mode, credentials_json, last_sync_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertChannel.run(
    "mercadolibre",
    "Mercado Livre",
    1,
    "sandbox",
    JSON.stringify({
      app_id: "",
      client_secret: "",
      access_token: "",
      seller_id: ""
    }),
    new Date().toISOString()
  );

  insertChannel.run(
    "shopee",
    "Shopee",
    1,
    "sandbox",
    JSON.stringify({
      partner_id: "",
      partner_key: "",
      shop_id: "",
      access_token: ""
    }),
    new Date().toISOString()
  );

  insertChannel.run(
    "tiktok",
    "TikTok Shop",
    1,
    "sandbox",
    JSON.stringify({
      app_key: "",
      app_secret: "",
      shop_cipher: "",
      access_token: ""
    }),
    new Date().toISOString()
  );
}

// Seed sample products if empty to let user test immediately
const existingProducts = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
if (existingProducts.count === 0) {
  const now = new Date().toISOString();
  const insertProduct = db.prepare(`
    INSERT INTO products (id, sku, title, description, base_price, stock, weight_kg, height_cm, width_cm, length_cm, images_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const prod1Id = crypto.randomUUID();
  insertProduct.run(
    prod1Id,
    "FONE-BT-PRO",
    "Fone de Ouvido Bluetooth Sem Fio Pro com Cancelamento de Ruído",
    "Fone intra-auricular com bateria de até 30 horas, som estéreo Hi-Fi e estojo de carregamento rápido.",
    149.90,
    25,
    0.25,
    5,
    10,
    10,
    JSON.stringify(["https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop"]),
    now,
    now
  );

  const prod2Id = crypto.randomUUID();
  insertProduct.run(
    prod2Id,
    "GARRAFA-TERM-1L",
    "Garrafa Térmica Inox 1000ml a Vácuo Parede Dupla",
    "Mantém a água gelada por 24 horas ou quente por 12 horas. Tampa antivazamento e acabamento fosco antiderrapante.",
    79.90,
    18,
    0.45,
    28,
    9,
    9,
    JSON.stringify(["https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop"]),
    now,
    now
  );

  // Link products to channels
  const insertLink = db.prepare(`
    INSERT INTO product_channel_links (product_id, channel_id, remote_product_id, channel_category_id, channel_price, status, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const channelId of ["mercadolibre", "shopee", "tiktok"]) {
    insertLink.run(prod1Id, channelId, `DEMO-${channelId.toUpperCase()}-101`, "CAT-ELEC-01", 159.90, "synced", now);
    insertLink.run(prod2Id, channelId, `DEMO-${channelId.toUpperCase()}-102`, "CAT-HOME-02", 84.90, "synced", now);
  }

  // Seed sample initial order ready to ship
  const insertOrder = db.prepare(`
    INSERT INTO orders (id, channel_id, remote_order_id, customer_name, customer_document, items_json, total_amount, shipping_address_json, tracking_code, shipping_service, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const order1Id = crypto.randomUUID();
  insertOrder.run(
    order1Id,
    "mercadolibre",
    "MLB-20261103-9821",
    "Carlos Eduardo Silva",
    "***.482.918-**",
    JSON.stringify([
      { sku: "FONE-BT-PRO", title: "Fone de Ouvido Bluetooth Sem Fio Pro", quantity: 1, unit_price: 159.90 }
    ]),
    159.90,
    JSON.stringify({
      recipient_name: "Carlos Eduardo Silva",
      street: "Av. Paulista",
      number: "1578",
      complement: "Apto 82",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
      zip_code: "01310-200",
      phone: "(11) 98765-4321"
    }),
    "BR-MLB-8729104",
    "Mercado Envios Coleta",
    "ready_to_ship",
    now
  );
}

// Database helper queries
export const DB = {
  // Channels
  getChannels(): ChannelConfig[] {
    const rows = db.prepare("SELECT * FROM channels").all() as any[];
    return rows.map(r => ({
      ...r,
      enabled: Boolean(r.enabled),
      credentials: JSON.parse(r.credentials_json || "{}")
    }));
  },

  getChannel(id: ChannelId): ChannelConfig | null {
    const row = db.prepare("SELECT * FROM channels WHERE id = ?").get(id) as any;
    if (!row) return null;
    return {
      ...row,
      enabled: Boolean(row.enabled),
      credentials: JSON.parse(row.credentials_json || "{}")
    };
  },

  updateChannel(id: ChannelId, data: Partial<ChannelConfig>) {
    const current = this.getChannel(id);
    if (!current) return;

    const enabled = data.enabled !== undefined ? (data.enabled ? 1 : 0) : (current.enabled ? 1 : 0);
    const mode = data.mode || current.mode;
    const credentials = data.credentials ? JSON.stringify(data.credentials) : JSON.stringify(current.credentials);

    db.prepare(`
      UPDATE channels
      SET enabled = ?, mode = ?, credentials_json = ?, last_sync_at = ?
      WHERE id = ?
    `).run(enabled, mode, credentials, new Date().toISOString(), id);
  },

  // Products
  getProducts(): Product[] {
    const rows = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all() as any[];
    return rows.map(r => {
      const links = db.prepare("SELECT * FROM product_channel_links WHERE product_id = ?").all(r.id) as any[];
      return {
        ...r,
        images: JSON.parse(r.images_json || "[]"),
        links: links.map(l => ({ ...l }))
      };
    });
  },

  getProductById(id: string): Product | null {
    const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as any;
    if (!row) return null;
    const links = db.prepare("SELECT * FROM product_channel_links WHERE product_id = ?").all(id) as any[];
    return {
      ...row,
      images: JSON.parse(row.images_json || "[]"),
      links: links.map(l => ({ ...l }))
    };
  },

  getProductBySku(sku: string): Product | null {
    const row = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku) as any;
    if (!row) return null;
    const links = db.prepare("SELECT * FROM product_channel_links WHERE product_id = ?").all(row.id) as any[];
    return {
      ...row,
      images: JSON.parse(row.images_json || "[]"),
      links: links.map(l => ({ ...l }))
    };
  },

  createProduct(data: Omit<Product, "id" | "created_at" | "updated_at">): Product {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO products (id, sku, title, description, base_price, stock, weight_kg, height_cm, width_cm, length_cm, images_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.sku.trim(),
      data.title.trim(),
      data.description || "",
      data.base_price,
      data.stock,
      data.weight_kg || 0.3,
      data.height_cm || 10,
      data.width_cm || 15,
      data.length_cm || 20,
      JSON.stringify(data.images || []),
      now,
      now
    );

    return this.getProductById(id)!;
  },

  updateProduct(id: string, data: Partial<Product>): Product | null {
    const existing = this.getProductById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE products
      SET sku = ?, title = ?, description = ?, base_price = ?, stock = ?,
          weight_kg = ?, height_cm = ?, width_cm = ?, length_cm = ?,
          images_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.sku !== undefined ? data.sku.trim() : existing.sku,
      data.title !== undefined ? data.title.trim() : existing.title,
      data.description !== undefined ? data.description : existing.description,
      data.base_price !== undefined ? data.base_price : existing.base_price,
      data.stock !== undefined ? data.stock : existing.stock,
      data.weight_kg !== undefined ? data.weight_kg : existing.weight_kg,
      data.height_cm !== undefined ? data.height_cm : existing.height_cm,
      data.width_cm !== undefined ? data.width_cm : existing.width_cm,
      data.length_cm !== undefined ? data.length_cm : existing.length_cm,
      data.images ? JSON.stringify(data.images) : JSON.stringify(existing.images),
      now,
      id
    );

    return this.getProductById(id);
  },

  deleteProduct(id: string) {
    db.prepare("DELETE FROM product_channel_links WHERE product_id = ?").run(id);
    db.prepare("DELETE FROM products WHERE id = ?").run(id);
  },

  updateStock(productId: string, newStock: number) {
    db.prepare("UPDATE products SET stock = ?, updated_at = ? WHERE id = ?").run(
      newStock,
      new Date().toISOString(),
      productId
    );
  },

  // Product Channel Links
  saveChannelLink(link: ProductChannelLink) {
    db.prepare(`
      INSERT INTO product_channel_links (product_id, channel_id, remote_product_id, channel_category_id, channel_price, status, last_error, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(product_id, channel_id) DO UPDATE SET
        remote_product_id = excluded.remote_product_id,
        channel_category_id = excluded.channel_category_id,
        channel_price = excluded.channel_price,
        status = excluded.status,
        last_error = excluded.last_error,
        published_at = excluded.published_at
    `).run(
      link.product_id,
      link.channel_id,
      link.remote_product_id || null,
      link.channel_category_id || null,
      link.channel_price || null,
      link.status,
      link.last_error || null,
      link.published_at || new Date().toISOString()
    );
  },

  // Orders
  getOrders(status?: string): Order[] {
    let sql = "SELECT * FROM orders";
    const params: any[] = [];
    if (status && status !== "all") {
      sql += " WHERE status = ?";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC";

    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      ...r,
      items: JSON.parse(r.items_json || "[]"),
      shipping_address: JSON.parse(r.shipping_address_json || "{}")
    }));
  },

  getOrderById(id: string): Order | null {
    const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as any;
    if (!row) return null;
    return {
      ...row,
      items: JSON.parse(row.items_json || "[]"),
      shipping_address: JSON.parse(row.shipping_address_json || "{}")
    };
  },

  createOrder(order: Omit<Order, "id" | "created_at">): Order {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO orders (id, channel_id, remote_order_id, customer_name, customer_document, items_json, total_amount, shipping_address_json, shipping_label_url, tracking_code, shipping_service, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
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
      order.status,
      now
    );

    return this.getOrderById(id)!;
  },

  updateOrderStatus(id: string, status: Order["status"], trackingCode?: string) {
    if (trackingCode) {
      db.prepare("UPDATE orders SET status = ?, tracking_code = ? WHERE id = ?").run(status, trackingCode, id);
    } else {
      db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
    }
  },

  // Activity Logs
  logActivity(type: string, message: string, channelId?: string, metadata?: any) {
    db.prepare(`
      INSERT INTO activity_logs (type, channel_id, message, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      type,
      channelId || null,
      message,
      metadata ? JSON.stringify(metadata) : null,
      new Date().toISOString()
    );
  },

  getRecentLogs(limit = 20) {
    return db.prepare("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?").all(limit);
  },

  getStats() {
    const totalProducts = (db.prepare("SELECT COUNT(*) as c FROM products").get() as any).c;
    const totalOrders = (db.prepare("SELECT COUNT(*) as c FROM orders").get() as any).c;
    const readyToShip = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'ready_to_ship'").get() as any).c;
    const totalRevenue = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as s FROM orders WHERE status != 'cancelled'").get() as any).s;
    const lowStockCount = (db.prepare("SELECT COUNT(*) as c FROM products WHERE stock <= 5").get() as any).c;

    return {
      totalProducts,
      totalOrders,
      readyToShip,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      lowStockCount
    };
  }
};
