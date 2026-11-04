import pgPkg from "pg";
import type { ChannelConfig, ChannelId, Order, Product, ProductChannelLink } from "./types.ts";

const Pool = (pgPkg as any).Pool || ((pgPkg as any).default && (pgPkg as any).default.Pool);

const DEFAULT_DATABASE_URL = "postgresql://postgres.your-tenant-id:dcad519bf34b193c9e81461b097fecf4@184.107.176.201:6543/postgres";
const DATABASE_URL = (typeof Deno !== "undefined" ? Deno.env.get("DATABASE_URL") : process.env.DATABASE_URL) || DEFAULT_DATABASE_URL;

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: false
});

export const DB = {
  // Channels
  async getChannels(): Promise<ChannelConfig[]> {
    const res = await pool.query("SELECT * FROM hub_channels ORDER BY id ASC");
    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      enabled: Boolean(r.enabled),
      mode: r.mode,
      fee_percent: Number(r.fee_percent || 16.0),
      fixed_fee: Number(r.fixed_fee || 5.0),
      free_shipping_threshold: Number(r.free_shipping_threshold || 79.0),
      credentials: typeof r.credentials_json === "string" ? JSON.parse(r.credentials_json || "{}") : (r.credentials_json || {}),
      last_sync_at: r.last_sync_at ? new Date(r.last_sync_at).toISOString() : null
    }));
  },

  async getChannel(id: ChannelId): Promise<ChannelConfig | null> {
    const res = await pool.query("SELECT * FROM hub_channels WHERE id = $1", [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      enabled: Boolean(r.enabled),
      mode: r.mode,
      fee_percent: Number(r.fee_percent || 16.0),
      fixed_fee: Number(r.fixed_fee || 5.0),
      free_shipping_threshold: Number(r.free_shipping_threshold || 79.0),
      credentials: typeof r.credentials_json === "string" ? JSON.parse(r.credentials_json || "{}") : (r.credentials_json || {}),
      last_sync_at: r.last_sync_at ? new Date(r.last_sync_at).toISOString() : null
    };
  },

  async updateChannel(id: ChannelId, data: Partial<ChannelConfig>) {
    const current = await this.getChannel(id);
    if (!current) return;

    const enabled = data.enabled !== undefined ? data.enabled : current.enabled;
    const mode = data.mode || current.mode;
    const credentials = data.credentials || current.credentials;
    const fee_percent = data.fee_percent !== undefined ? data.fee_percent : current.fee_percent;
    const fixed_fee = data.fixed_fee !== undefined ? data.fixed_fee : current.fixed_fee;

    await pool.query(
      `UPDATE hub_channels
       SET enabled = $1, mode = $2, credentials_json = $3, fee_percent = $4, fixed_fee = $5, last_sync_at = NOW()
       WHERE id = $6`,
      [enabled, mode, JSON.stringify(credentials), fee_percent, fixed_fee, id]
    );
  },

  // Products
  async getProducts(): Promise<Product[]> {
    const pRes = await pool.query("SELECT * FROM hub_products ORDER BY created_at DESC");
    const lRes = await pool.query("SELECT * FROM hub_product_channel_links");

    const linksMap = new Map<string, ProductChannelLink[]>();
    for (const l of lRes.rows) {
      const pid = String(l.product_id);
      if (!linksMap.has(pid)) linksMap.set(pid, []);
      linksMap.get(pid)!.push({
        id: l.id,
        product_id: pid,
        channel_id: l.channel_id,
        remote_product_id: l.remote_product_id,
        channel_category_id: l.channel_category_id,
        channel_price: l.channel_price ? Number(l.channel_price) : undefined,
        status: l.status,
        last_error: l.last_error,
        published_at: l.published_at ? new Date(l.published_at).toISOString() : null
      });
    }

    return pRes.rows.map((r: any) => ({
      id: r.id,
      sku: r.sku,
      title: r.title,
      description: r.description || "",
      base_price: Number(r.base_price),
      cost_price: Number(r.cost_price || 0),
      packaging_cost: Number(r.packaging_cost || 2.5),
      other_costs: Number(r.other_costs || 0),
      tax_percent: Number(r.tax_percent || 6.0),
      target_profit_percent: Number(r.target_profit_percent || 30.0),
      stock: Number(r.stock),
      min_stock: Number(r.min_stock || 5),
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

  async getProductById(id: string): Promise<Product | null> {
    const res = await pool.query("SELECT * FROM hub_products WHERE id = $1", [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    const lRes = await pool.query("SELECT * FROM hub_product_channel_links WHERE product_id = $1", [id]);
    const links: ProductChannelLink[] = lRes.rows.map((l: any) => ({
      id: l.id,
      product_id: String(l.product_id),
      channel_id: l.channel_id,
      remote_product_id: l.remote_product_id,
      channel_category_id: l.channel_category_id,
      channel_price: l.channel_price ? Number(l.channel_price) : undefined,
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
      cost_price: Number(r.cost_price || 0),
      packaging_cost: Number(r.packaging_cost || 2.5),
      other_costs: Number(r.other_costs || 0),
      tax_percent: Number(r.tax_percent || 6.0),
      target_profit_percent: Number(r.target_profit_percent || 30.0),
      stock: Number(r.stock),
      min_stock: Number(r.min_stock || 5),
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

  async getProductBySku(sku: string): Promise<Product | null> {
    const res = await pool.query("SELECT * FROM hub_products WHERE sku = $1", [sku]);
    if (res.rows.length === 0) return null;
    return this.getProductById(res.rows[0].id);
  },

  async createProduct(data: Omit<Product, "id" | "created_at" | "updated_at">): Promise<Product> {
    const res = await pool.query(
      `INSERT INTO hub_products (
        sku, title, description, base_price, cost_price, packaging_cost, other_costs,
        tax_percent, target_profit_percent, stock, min_stock, weight_kg, height_cm, width_cm, length_cm, images_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id`,
      [
        data.sku.trim(),
        data.title.trim(),
        data.description || "",
        data.base_price,
        data.cost_price || 0,
        data.packaging_cost || 2.5,
        data.other_costs || 0,
        data.tax_percent || 6.0,
        data.target_profit_percent || 30.0,
        data.stock,
        data.min_stock || 5,
        data.weight_kg || 0.3,
        data.height_cm || 10,
        data.width_cm || 15,
        data.length_cm || 20,
        JSON.stringify(data.images || [])
      ]
    );

    const newId = res.rows[0].id;
    return (await this.getProductById(newId))!;
  },

  async updateProduct(id: string, data: Partial<Product>): Promise<Product | null> {
    const existing = await this.getProductById(id);
    if (!existing) return null;

    await pool.query(
      `UPDATE hub_products
       SET sku = $1, title = $2, description = $3, base_price = $4,
           cost_price = $5, packaging_cost = $6, other_costs = $7, tax_percent = $8,
           target_profit_percent = $9, stock = $10, min_stock = $11, weight_kg = $12,
           height_cm = $13, width_cm = $14, length_cm = $15, images_json = $16, updated_at = NOW()
       WHERE id = $17`,
      [
        data.sku !== undefined ? data.sku.trim() : existing.sku,
        data.title !== undefined ? data.title.trim() : existing.title,
        data.description !== undefined ? data.description : existing.description,
        data.base_price !== undefined ? data.base_price : existing.base_price,
        data.cost_price !== undefined ? data.cost_price : existing.cost_price,
        data.packaging_cost !== undefined ? data.packaging_cost : existing.packaging_cost,
        data.other_costs !== undefined ? data.other_costs : existing.other_costs,
        data.tax_percent !== undefined ? data.tax_percent : existing.tax_percent,
        data.target_profit_percent !== undefined ? data.target_profit_percent : existing.target_profit_percent,
        data.stock !== undefined ? data.stock : existing.stock,
        data.min_stock !== undefined ? data.min_stock : existing.min_stock,
        data.weight_kg !== undefined ? data.weight_kg : existing.weight_kg,
        data.height_cm !== undefined ? data.height_cm : existing.height_cm,
        data.width_cm !== undefined ? data.width_cm : existing.width_cm,
        data.length_cm !== undefined ? data.length_cm : existing.length_cm,
        data.images ? JSON.stringify(data.images) : JSON.stringify(existing.images),
        id
      ]
    );

    return this.getProductById(id);
  },

  async deleteProduct(id: string) {
    await pool.query("DELETE FROM hub_products WHERE id = $1", [id]);
  },

  async updateStock(productId: string, newStock: number) {
    await pool.query("UPDATE hub_products SET stock = $1, updated_at = NOW() WHERE id = $2", [newStock, productId]);
  },

  // Product Channel Links
  async saveChannelLink(link: ProductChannelLink) {
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
  async getOrders(status?: string): Promise<Order[]> {
    let sql = "SELECT * FROM hub_orders";
    const params: any[] = [];
    if (status && status !== "all") {
      sql += " WHERE status = $1";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC";

    const res = await pool.query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      channel_id: r.channel_id,
      remote_order_id: r.remote_order_id,
      customer_name: r.customer_name,
      customer_document: r.customer_document || "",
      items: typeof r.items_json === "string" ? JSON.parse(r.items_json || "[]") : (r.items_json || []),
      total_amount: Number(r.total_amount),
      shipping_address: typeof r.shipping_address_json === "string" ? JSON.parse(r.shipping_address_json || "{}") : (r.shipping_address_json || {}),
      shipping_label_url: r.shipping_label_url || "",
      tracking_code: r.tracking_code || "",
      shipping_service: r.shipping_service,
      status: r.status,
      created_at: new Date(r.created_at).toISOString()
    }));
  },

  async getOrderById(id: string): Promise<Order | null> {
    const res = await pool.query("SELECT * FROM hub_orders WHERE id = $1", [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      channel_id: r.channel_id,
      remote_order_id: r.remote_order_id,
      customer_name: r.customer_name,
      customer_document: r.customer_document || "",
      items: typeof r.items_json === "string" ? JSON.parse(r.items_json || "[]") : (r.items_json || []),
      total_amount: Number(r.total_amount),
      shipping_address: typeof r.shipping_address_json === "string" ? JSON.parse(r.shipping_address_json || "{}") : (r.shipping_address_json || {}),
      shipping_label_url: r.shipping_label_url || "",
      tracking_code: r.tracking_code || "",
      shipping_service: r.shipping_service,
      status: r.status,
      created_at: new Date(r.created_at).toISOString()
    };
  },

  async getOrdersByIds(ids: string[]): Promise<Order[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const res = await pool.query(`SELECT * FROM hub_orders WHERE id IN (${placeholders}) ORDER BY created_at DESC`, ids);
    return res.rows.map((r: any) => ({
      id: r.id,
      channel_id: r.channel_id,
      remote_order_id: r.remote_order_id,
      customer_name: r.customer_name,
      customer_document: r.customer_document || "",
      items: typeof r.items_json === "string" ? JSON.parse(r.items_json || "[]") : (r.items_json || []),
      total_amount: Number(r.total_amount),
      shipping_address: typeof r.shipping_address_json === "string" ? JSON.parse(r.shipping_address_json || "{}") : (r.shipping_address_json || {}),
      shipping_label_url: r.shipping_label_url || "",
      tracking_code: r.tracking_code || "",
      shipping_service: r.shipping_service,
      status: r.status,
      created_at: new Date(r.created_at).toISOString()
    }));
  },

  async createOrder(order: Omit<Order, "id" | "created_at">): Promise<Order> {
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
    return (await this.getOrderById(newId))!;
  },

  async updateOrderStatus(id: string, status: Order["status"], trackingCode?: string) {
    if (trackingCode) {
      await pool.query("UPDATE hub_orders SET status = $1, tracking_code = $2 WHERE id = $3", [status, trackingCode, id]);
    } else {
      await pool.query("UPDATE hub_orders SET status = $1 WHERE id = $2", [status, id]);
    }
  },

  // Activity Logs
  async logActivity(type: string, message: string, channelId?: string, metadata?: any) {
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
    return res.rows.map((r: any) => ({
      ...r,
      metadata: typeof r.metadata_json === "string" ? JSON.parse(r.metadata_json || "null") : r.metadata_json,
      created_at: new Date(r.created_at).toISOString()
    }));
  },

  async getStats() {
    const [pCount, oCount, rCount, revCount, stockStats] = await Promise.all([
      pool.query("SELECT COUNT(*) as c FROM hub_products"),
      pool.query("SELECT COUNT(*) as c FROM hub_orders"),
      pool.query("SELECT COUNT(*) as c FROM hub_orders WHERE status = 'ready_to_ship'"),
      pool.query("SELECT COALESCE(SUM(total_amount), 0) as s FROM hub_orders WHERE status != 'cancelled'"),
      pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE stock <= min_stock) as low_stock_count,
          COALESCE(SUM(stock * cost_price), 0) as total_cost_value,
          COALESCE(SUM(stock * base_price), 0) as total_retail_value,
          COALESCE(SUM(stock), 0) as total_units
        FROM hub_products
      `)
    ]);

    const stock = stockStats.rows[0];
    const costVal = Number(Number(stock.total_cost_value).toFixed(2));
    const retailVal = Number(Number(stock.total_retail_value).toFixed(2));
    const potentialProfit = Number((retailVal - costVal).toFixed(2));

    return {
      totalProducts: Number(pCount.rows[0].c),
      totalOrders: Number(oCount.rows[0].c),
      readyToShip: Number(rCount.rows[0].c),
      totalRevenue: Number(Number(revCount.rows[0].s).toFixed(2)),
      lowStockCount: Number(stock.low_stock_count || 0),
      totalCostValue: costVal,
      totalRetailValue: retailVal,
      potentialProfit: potentialProfit,
      totalUnitsInStock: Number(stock.total_units || 0)
    };
  }
};
