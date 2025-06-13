-- Create categories table
CREATE TABLE kategoriler (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ad VARCHAR(255) NOT NULL,
    sira INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ad VARCHAR(255) NOT NULL,
    fiyat DECIMAL(10, 2) NOT NULL,
    resim TEXT,
    kategori_id UUID REFERENCES kategoriler(id) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    masa INT NOT NULL,
    urunler JSONB NOT NULL,
    durum VARCHAR(50) NOT NULL DEFAULT 'hazırlanıyor',
    kaynak VARCHAR(50) NOT NULL DEFAULT 'müşteri',
    zaman TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tables table
CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    masa_no INT NOT NULL UNIQUE,
    durum VARCHAR(50) NOT NULL DEFAULT 'boş',
    aktif_siparis UUID REFERENCES orders(id) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create masalar table (used in error messages)
CREATE TABLE masalar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    masa_no INT NOT NULL UNIQUE,
    durum VARCHAR(50) NOT NULL DEFAULT 'boş',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sample categories
INSERT INTO kategoriler (ad, sira) VALUES
('Hamburgerler', 1),
('İçecekler', 2),
('Yan Ürünler', 3),
('Ana Yemekler', 4),
('Tatlılar', 5);

-- Create sample products
INSERT INTO products (ad, fiyat, resim, kategori_id) VALUES
('Hamburger', 85.00, 'https://via.placeholder.com/300x200.png?text=Hamburger', (SELECT id FROM kategoriler WHERE ad = 'Hamburgerler')),
('Cheeseburger', 95.00, 'https://via.placeholder.com/300x200.png?text=Cheeseburger', (SELECT id FROM kategoriler WHERE ad = 'Hamburgerler')),
('Tavuk Burger', 75.00, 'https://via.placeholder.com/300x200.png?text=Tavuk+Burger', (SELECT id FROM kategoriler WHERE ad = 'Hamburgerler')),
('Patates Kızartması', 35.00, 'https://via.placeholder.com/300x200.png?text=Patates', (SELECT id FROM kategoriler WHERE ad = 'Yan Ürünler')),
('Cola', 20.00, 'https://via.placeholder.com/300x200.png?text=Cola', (SELECT id FROM kategoriler WHERE ad = 'İçecekler')),
('Ayran', 15.00, 'https://via.placeholder.com/300x200.png?text=Ayran', (SELECT id FROM kategoriler WHERE ad = 'İçecekler')),
('Su', 10.00, 'https://via.placeholder.com/300x200.png?text=Su', (SELECT id FROM kategoriler WHERE ad = 'İçecekler')),
('Çıtır Tavuk', 90.00, 'https://via.placeholder.com/300x200.png?text=Çıtır+Tavuk', (SELECT id FROM kategoriler WHERE ad = 'Ana Yemekler')),
('Pizza', 120.00, 'https://via.placeholder.com/300x200.png?text=Pizza', (SELECT id FROM kategoriler WHERE ad = 'Ana Yemekler')),
('Makarna', 65.00, 'https://via.placeholder.com/300x200.png?text=Makarna', (SELECT id FROM kategoriler WHERE ad = 'Ana Yemekler')),
('Salata', 45.00, 'https://via.placeholder.com/300x200.png?text=Salata', (SELECT id FROM kategoriler WHERE ad = 'Yan Ürünler')),
('Sufle', 40.00, 'https://via.placeholder.com/300x200.png?text=Sufle', (SELECT id FROM kategoriler WHERE ad = 'Tatlılar')),
('Künefe', 55.00, 'https://via.placeholder.com/300x200.png?text=Künefe', (SELECT id FROM kategoriler WHERE ad = 'Tatlılar'));

-- Create sample tables
INSERT INTO tables (masa_no, durum) VALUES
(1, 'boş'),
(2, 'boş'),
(3, 'boş'),
(4, 'boş'),
(5, 'boş'),
(6, 'boş'),
(7, 'boş'),
(8, 'boş'),
(9, 'boş'),
(10, 'boş');

-- Insert into masalar table too
INSERT INTO masalar (masa_no, durum) VALUES
(1, 'boş'),
(2, 'boş'),
(3, 'boş'),
(4, 'boş'),
(5, 'boş'),
(6, 'boş'),
(7, 'boş'),
(8, 'boş'),
(9, 'boş'),
(10, 'boş');

-- Enable row level security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE kategoriler ENABLE ROW LEVEL SECURITY;
ALTER TABLE masalar ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Everyone can read products
CREATE POLICY "Allow public read access to products" ON products
    FOR SELECT USING (true);

-- Everyone can read categories
CREATE POLICY "Allow public read access to kategoriler" ON kategoriler
    FOR SELECT USING (true);

-- Everyone can read masalar
CREATE POLICY "Allow public read access to masalar" ON masalar
    FOR SELECT USING (true);

-- Only authenticated users can modify products
CREATE POLICY "Allow authenticated users to modify products" ON products
    FOR ALL USING (auth.role() = 'authenticated');

-- Everyone can read orders
CREATE POLICY "Allow public read access to orders" ON orders
    FOR SELECT USING (true);

-- Everyone can insert orders (for customer ordering)
CREATE POLICY "Allow public insert access to orders" ON orders
    FOR INSERT WITH CHECK (true);

-- Only authenticated users can update orders
CREATE POLICY "Allow authenticated users to modify orders" ON orders
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Everyone can read tables
CREATE POLICY "Allow public read access to tables" ON tables
    FOR SELECT USING (true);

-- Only authenticated users can modify tables
CREATE POLICY "Allow authenticated users to modify tables" ON tables
    FOR ALL USING (auth.role() = 'authenticated');

-- Create function to update table status when orders change
CREATE OR REPLACE FUNCTION update_table_status()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- When a new order is created, update the table status
        UPDATE tables
        SET durum = 'dolu', aktif_siparis = NEW.id
        WHERE masa_no = NEW.masa;
        
        -- Also update masalar table
        UPDATE masalar
        SET durum = 'dolu'
        WHERE masa_no = NEW.masa;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.durum = 'teslim edildi' THEN
            -- When an order is delivered, set the table back to empty
            UPDATE tables
            SET durum = 'boş', aktif_siparis = NULL
            WHERE masa_no = NEW.masa AND aktif_siparis = NEW.id;
            
            -- Also update masalar table
            UPDATE masalar
            SET durum = 'boş'
            WHERE masa_no = NEW.masa;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for order status changes
CREATE TRIGGER on_order_insert
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION update_table_status();

CREATE TRIGGER on_order_update
AFTER UPDATE ON orders
FOR EACH ROW
WHEN (OLD.durum IS DISTINCT FROM NEW.durum)
EXECUTE FUNCTION update_table_status(); 