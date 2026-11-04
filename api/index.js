let realHandler = null;
let initError = null;

try {
  const fs = require("node:fs");
  const path = require("node:path");
  const pg = require("pg");
  const Pool = pg.Pool || (pg.default && pg.default.Pool);

  const DEFAULT_DATABASE_URL = "postgresql://postgres.your-tenant-id:dcad519bf34b193c9e81461b097fecf4@184.107.176.201:6543/postgres";
  const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    ssl: false
  });

  realHandler = async function(req, res) {
    const rawUrl = req.url || "/";
    const urlObj = new URL(rawUrl, `http://${req.headers?.host || "localhost"}`);
    const pathname = urlObj.pathname;
    const method = req.method;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }

    // Static fallback
    if (pathname === "/" || pathname === "/index.html") {
      const p = path.join(process.cwd(), "index.html");
      if (fs.existsSync(p)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.end(fs.readFileSync(p, "utf-8"));
      }
    }
    if (pathname === "/app.js") {
      const p = path.join(process.cwd(), "app.js");
      if (fs.existsSync(p)) {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        return res.end(fs.readFileSync(p, "utf-8"));
      }
    }
    if (pathname === "/styles.css") {
      const p = path.join(process.cwd(), "styles.css");
      if (fs.existsSync(p)) {
        res.setHeader("Content-Type", "text/css; charset=utf-8");
        return res.end(fs.readFileSync(p, "utf-8"));
      }
    }

    // API stats
    if (pathname.endsWith("/stats")) {
      const [pCount, oCount, rCount, revCount, sCount] = await Promise.all([
        pool.query("SELECT COUNT(*) as c FROM hub_products"),
        pool.query("SELECT COUNT(*) as c FROM hub_orders"),
        pool.query("SELECT COUNT(*) as c FROM hub_orders WHERE status = 'ready_to_ship'"),
        pool.query("SELECT COALESCE(SUM(total_amount), 0) as s FROM hub_orders WHERE status != 'cancelled'"),
        pool.query("SELECT COUNT(*) as c FROM hub_products WHERE stock <= 5")
      ]);
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({
        totalProducts: Number(pCount.rows[0].c),
        totalOrders: Number(oCount.rows[0].c),
        readyToShip: Number(rCount.rows[0].c),
        totalRevenue: Number(Number(revCount.rows[0].s).toFixed(2)),
        lowStockCount: Number(sCount.rows[0].c)
      }));
    }

    // API channels
    if (pathname.endsWith("/channels") && method === "GET") {
      const q = await pool.query("SELECT * FROM hub_channels ORDER BY id ASC");
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(q.rows.map(r => ({
        id: r.id,
        name: r.name,
        enabled: Boolean(r.enabled),
        mode: r.mode,
        credentials: typeof r.credentials_json === "string" ? JSON.parse(r.credentials_json || "{}") : (r.credentials_json || {}),
        last_sync_at: r.last_sync_at ? new Date(r.last_sync_at).toISOString() : null
      }))));
    }

    // API products
    if (pathname.endsWith("/products") && method === "GET") {
      const pRes = await pool.query("SELECT * FROM hub_products ORDER BY created_at DESC");
      const lRes = await pool.query("SELECT * FROM hub_product_channel_links");
      const linksMap = new Map();
      for (const l of lRes.rows) {
        const pid = String(l.product_id);
        if (!linksMap.has(pid)) linksMap.set(pid, []);
        linksMap.get(pid).push(l);
      }
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(pRes.rows.map(r => ({
        ...r,
        base_price: Number(r.base_price),
        stock: Number(r.stock),
        images: Array.isArray(r.images_json) ? r.images_json : JSON.parse(r.images_json || "[]"),
        links: linksMap.get(String(r.id)) || []
      }))));
    }

    // API orders
    if (pathname.endsWith("/orders") && method === "GET") {
      const q = await pool.query("SELECT * FROM hub_orders ORDER BY created_at DESC");
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(q.rows.map(r => ({
        ...r,
        total_amount: Number(r.total_amount),
        items: typeof r.items_json === "string" ? JSON.parse(r.items_json || "[]") : (r.items_json || []),
        shipping_address: typeof r.shipping_address_json === "string" ? JSON.parse(r.shipping_address_json || "{}") : (r.shipping_address_json || {})
      }))));
    }

    // API logs
    if (pathname.endsWith("/logs") && method === "GET") {
      const q = await pool.query("SELECT * FROM hub_activity_logs ORDER BY created_at DESC LIMIT 25");
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(q.rows));
    }

    // Fallback
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "SmartHub API Active", pathname }));
  };
} catch (err) {
  initError = err;
}

module.exports = async function handler(req, res) {
  if (initError) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    return res.end("INIT_ERROR: " + initError.stack);
  }
  try {
    await realHandler(req, res);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end("RUNTIME_ERROR: " + err.stack);
  }
};
