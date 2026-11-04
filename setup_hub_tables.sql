-- Schema for SmartHub on PostgreSQL / Supabase VPS

CREATE TABLE IF NOT EXISTS hub_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  mode TEXT NOT NULL DEFAULT 'sandbox',
  credentials_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC(10,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  weight_kg NUMERIC(6,3) NOT NULL DEFAULT 0.300,
  height_cm NUMERIC(6,2) NOT NULL DEFAULT 10.00,
  width_cm NUMERIC(6,2) NOT NULL DEFAULT 15.00,
  length_cm NUMERIC(6,2) NOT NULL DEFAULT 20.00,
  images_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_product_channel_links (
  id SERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES hub_products(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  remote_product_id TEXT,
  channel_category_id TEXT,
  channel_price NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  published_at TIMESTAMPTZ,
  UNIQUE(product_id, channel_id)
);

CREATE TABLE IF NOT EXISTS hub_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  remote_order_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_document TEXT,
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(10,2) NOT NULL,
  shipping_address_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  shipping_label_url TEXT,
  tracking_code TEXT,
  shipping_service TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready_to_ship',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_activity_logs (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  channel_id TEXT,
  message TEXT NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial channels if not exists
INSERT INTO hub_channels (id, name, enabled, mode, credentials_json)
VALUES 
  ('mercadolibre', 'Mercado Livre', TRUE, 'sandbox', '{"app_id":"","client_secret":"","access_token":"","seller_id":""}'::jsonb),
  ('shopee', 'Shopee', TRUE, 'sandbox', '{"partner_id":"","partner_key":"","shop_id":"","access_token":""}'::jsonb),
  ('tiktok', 'TikTok Shop', TRUE, 'sandbox', '{"app_key":"","app_secret":"","shop_cipher":"","access_token":""}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Seed sample products if table is empty
DO $$
DECLARE
  v_prod1_id UUID;
  v_prod2_id UUID;
  v_order1_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM hub_products LIMIT 1) THEN
    INSERT INTO hub_products (sku, title, description, base_price, stock, weight_kg, height_cm, width_cm, length_cm, images_json)
    VALUES (
      'FONE-BT-PRO',
      'Fone de Ouvido Bluetooth Sem Fio Pro com Cancelamento de Ruído',
      'Fone intra-auricular com bateria de até 30 horas, som estéreo Hi-Fi e estojo de carregamento rápido.',
      149.90,
      25,
      0.25,
      5,
      10,
      10,
      '["https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop"]'::jsonb
    ) RETURNING id INTO v_prod1_id;

    INSERT INTO hub_products (sku, title, description, base_price, stock, weight_kg, height_cm, width_cm, length_cm, images_json)
    VALUES (
      'GARRAFA-TERM-1L',
      'Garrafa Térmica Inox 1000ml a Vácuo Parede Dupla',
      'Mantém a água gelada por 24 horas ou quente por 12 horas. Tampa antivazamento e acabamento fosco antiderrapante.',
      79.90,
      18,
      0.45,
      28,
      9,
      9,
      '["https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop"]'::jsonb
    ) RETURNING id INTO v_prod2_id;

    -- Links for prod 1
    INSERT INTO hub_product_channel_links (product_id, channel_id, remote_product_id, channel_category_id, channel_price, status, published_at)
    VALUES 
      (v_prod1_id, 'mercadolibre', 'DEMO-ML-101', 'CAT-ELEC-01', 159.90, 'synced', NOW()),
      (v_prod1_id, 'shopee', 'DEMO-SHP-101', 'CAT-ELEC-01', 159.90, 'synced', NOW()),
      (v_prod1_id, 'tiktok', 'DEMO-TTS-101', 'CAT-ELEC-01', 159.90, 'synced', NOW());

    -- Links for prod 2
    INSERT INTO hub_product_channel_links (product_id, channel_id, remote_product_id, channel_category_id, channel_price, status, published_at)
    VALUES 
      (v_prod2_id, 'mercadolibre', 'DEMO-ML-102', 'CAT-HOME-02', 84.90, 'synced', NOW()),
      (v_prod2_id, 'shopee', 'DEMO-SHP-102', 'CAT-HOME-02', 84.90, 'synced', NOW()),
      (v_prod2_id, 'tiktok', 'DEMO-TTS-102', 'CAT-HOME-02', 84.90, 'synced', NOW());

    -- Sample Order
    INSERT INTO hub_orders (
      channel_id, remote_order_id, customer_name, customer_document, items_json, total_amount, shipping_address_json, tracking_code, shipping_service, status
    ) VALUES (
      'mercadolibre',
      'MLB-20261103-9821',
      'Carlos Eduardo Silva',
      '***.482.918-**',
      '[{"sku":"FONE-BT-PRO","title":"Fone de Ouvido Bluetooth Sem Fio Pro","quantity":1,"unit_price":159.90}]'::jsonb,
      159.90,
      '{"recipient_name":"Carlos Eduardo Silva","street":"Av. Paulista","number":"1578","complement":"Apto 82","neighborhood":"Bela Vista","city":"São Paulo","state":"SP","zip_code":"01310-200","phone":"(11) 98765-4321"}'::jsonb,
      'BR-MLB-8729104',
      'Mercado Envios Coleta',
      'ready_to_ship'
    );
  END IF;
END $$;
