ALTER TABLE hub_products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE hub_products ADD COLUMN IF NOT EXISTS packaging_cost NUMERIC(10,2) DEFAULT 2.50;
ALTER TABLE hub_products ADD COLUMN IF NOT EXISTS other_costs NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE hub_products ADD COLUMN IF NOT EXISTS tax_percent NUMERIC(5,2) DEFAULT 6.00;
ALTER TABLE hub_products ADD COLUMN IF NOT EXISTS target_profit_percent NUMERIC(5,2) DEFAULT 30.00;
ALTER TABLE hub_products ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 5;

ALTER TABLE hub_channels ADD COLUMN IF NOT EXISTS fee_percent NUMERIC(5,2) DEFAULT 17.00;
ALTER TABLE hub_channels ADD COLUMN IF NOT EXISTS fixed_fee NUMERIC(10,2) DEFAULT 6.00;
ALTER TABLE hub_channels ADD COLUMN IF NOT EXISTS free_shipping_threshold NUMERIC(10,2) DEFAULT 79.00;

-- Update defaults per marketplace
UPDATE hub_channels SET fee_percent = 17.00, fixed_fee = 6.00, free_shipping_threshold = 79.00 WHERE id = 'mercadolibre';
UPDATE hub_channels SET fee_percent = 20.00, fixed_fee = 4.00, free_shipping_threshold = 50.00 WHERE id = 'shopee';
UPDATE hub_channels SET fee_percent = 14.00, fixed_fee = 3.00, free_shipping_threshold = 69.00 WHERE id = 'tiktok';

-- Seed reasonable cost prices for the demo products
UPDATE hub_products SET cost_price = 45.00, packaging_cost = 3.00, other_costs = 2.00, tax_percent = 6.00, target_profit_percent = 35.00, min_stock = 10 WHERE sku = 'FONE-BT-PRO';
UPDATE hub_products SET cost_price = 22.00, packaging_cost = 2.50, other_costs = 1.50, tax_percent = 6.00, target_profit_percent = 30.00, min_stock = 8 WHERE sku = 'GARRAFA-TERM-1L';
