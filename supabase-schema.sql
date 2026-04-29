-- Supabase Schema for BizManager Pro

-- Profiles Table (Businesses)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE,
  business_name TEXT NOT NULL,
  owner_name TEXT,
  email TEXT,
  phone TEXT UNIQUE,
  address TEXT,
  gstin TEXT,
  logo_url TEXT,
  esign_url TEXT,
  invoice_terms TEXT DEFAULT 'No Return, No Exchange',
  invoice_theme_color TEXT DEFAULT '#4f46e5',
  invoice_theme TEXT DEFAULT 'gst',
  instagram_id TEXT,
  subscription_plan TEXT DEFAULT 'free',
  is_verified INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  gst_number TEXT,
  outstanding_balance DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers Table (Parties)
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  gst_number TEXT,
  outstanding_balance DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  sku TEXT,
  purchase_price DECIMAL NOT NULL,
  selling_price DECIMAL NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  low_stock_alert INTEGER DEFAULT 5,
  tax_percentage DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  purchase_number TEXT NOT NULL,
  supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  invoice_number TEXT,
  subtotal DECIMAL DEFAULT 0,
  tax_amount DECIMAL DEFAULT 0,
  discount_amount DECIMAL DEFAULT 0,
  additional_charges DECIMAL DEFAULT 0,
  total_amount DECIMAL NOT NULL,
  amount_paid DECIMAL DEFAULT 0,
  balance_due DECIMAL DEFAULT 0,
  payment_status TEXT CHECK(payment_status IN ('paid', 'unpaid', 'partial')) DEFAULT 'unpaid',
  payment_mode TEXT CHECK(payment_mode IN ('cash', 'upi', 'both')),
  cash_amount DECIMAL DEFAULT 0,
  upi_amount DECIMAL DEFAULT 0,
  purchase_date TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, purchase_number)
);

-- Purchase Items Table
CREATE TABLE IF NOT EXISTS purchase_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  purchase_id BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price DECIMAL NOT NULL,
  total DECIMAL NOT NULL
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
  subtotal DECIMAL NOT NULL,
  tax_amount DECIMAL NOT NULL,
  discount_amount DECIMAL DEFAULT 0,
  total_amount DECIMAL NOT NULL,
  amount_paid DECIMAL DEFAULT 0,
  payment_status TEXT CHECK(payment_status IN ('paid', 'unpaid', 'partial')),
  payment_mode TEXT CHECK(payment_mode IN ('cash', 'upi', 'both')),
  cash_amount DECIMAL DEFAULT 0,
  upi_amount DECIMAL DEFAULT 0,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, invoice_number)
);

-- Invoice Items Table
CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price DECIMAL NOT NULL,
  discount_amount DECIMAL DEFAULT 0,
  total DECIMAL NOT NULL
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invoice_id BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  amount DECIMAL NOT NULL,
  payment_mode TEXT,
  transaction_reference TEXT,
  notes TEXT,
  payment_date TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier Payments (Pay Out)
CREATE TABLE IF NOT EXISTS supplier_payments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  purchase_id BIGINT REFERENCES purchases(id) ON DELETE SET NULL,
  supplier_id BIGINT REFERENCES suppliers(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  payment_mode TEXT CHECK(payment_mode IN ('cash', 'upi', 'both')),
  cash_amount DECIMAL DEFAULT 0,
  upi_amount DECIMAL DEFAULT 0,
  transaction_reference TEXT,
  notes TEXT,
  payment_date TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  amount DECIMAL NOT NULL,
  payment_mode TEXT CHECK(payment_mode IN ('cash', 'upi', 'both')),
  cash_amount DECIMAL DEFAULT 0,
  upi_amount DECIMAL DEFAULT 0,
  expense_date TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 'cash', 'upi'
  balance DECIMAL DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, name)
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

-- Storage Buckets and Policies
-- These usually need to be run as superuser or via the dashboard, 
-- but including them here for completeness if the user runs this in the SQL editor.

-- Create policies for storage
-- Note: We use DO blocks to safely handle storage schema if it exists
DO $$
BEGIN
    -- Ensure buckets exist (this might fail if run without enough permissions, but we try)
    INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', true) ON CONFLICT (id) DO NOTHING;
    INSERT INTO storage.buckets (id, name, public) VALUES ('business_logos', 'business_logos', true) ON CONFLICT (id) DO NOTHING;
EXCEPTION
    WHEN others THEN 
        RAISE NOTICE 'Could not create buckets automatically. Please create "invoices" and "business_logos" buckets in the Supabase dashboard.';
END $$;

-- Storage Policies for Objects
-- We use a more permissive approach for service_role to ensure backend can always work
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id IN ('invoices', 'business_logos'));

DROP POLICY IF EXISTS "Service Role Storage Access" ON storage.objects;
CREATE POLICY "Service Role Storage Access" ON storage.objects FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated Insert" ON storage.objects;
CREATE POLICY "Authenticated Insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('invoices', 'business_logos'));

DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
CREATE POLICY "Authenticated Update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('invoices', 'business_logos'));

-- Storage Policies for Buckets (to allow createBucket from server)
DROP POLICY IF EXISTS "Service Role Bucket Access" ON storage.buckets;
CREATE POLICY "Service Role Bucket Access" ON storage.buckets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create RLS Policies for Tables

-- Profiles: Users can only see/edit their own profile
DROP POLICY IF EXISTS "Service Role Profiles Access" ON profiles;
CREATE POLICY "Service Role Profiles Access" ON profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Customers: Users can only see/edit data belonging to their business_id
DROP POLICY IF EXISTS "Service Role Customers Access" ON customers;
CREATE POLICY "Service Role Customers Access" ON customers FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own customers" ON customers;
CREATE POLICY "Users can view own customers" ON customers FOR SELECT TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can insert own customers" ON customers;
CREATE POLICY "Users can insert own customers" ON customers FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can update own customers" ON customers;
CREATE POLICY "Users can update own customers" ON customers FOR UPDATE TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can delete own customers" ON customers;
CREATE POLICY "Users can delete own customers" ON customers FOR DELETE TO authenticated USING (auth.uid() = business_id);

-- Products
DROP POLICY IF EXISTS "Service Role Products Access" ON products;
CREATE POLICY "Service Role Products Access" ON products FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own products" ON products;
CREATE POLICY "Users can view own products" ON products FOR SELECT TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can insert own products" ON products;
CREATE POLICY "Users can insert own products" ON products FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can update own products" ON products;
CREATE POLICY "Users can update own products" ON products FOR UPDATE TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can delete own products" ON products;
CREATE POLICY "Users can delete own products" ON products FOR DELETE TO authenticated USING (auth.uid() = business_id);

-- Purchases
DROP POLICY IF EXISTS "Service Role Purchases Access" ON purchases;
CREATE POLICY "Service Role Purchases Access" ON purchases FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own purchases" ON purchases;
CREATE POLICY "Users can view own purchases" ON purchases FOR SELECT TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can insert own purchases" ON purchases;
CREATE POLICY "Users can insert own purchases" ON purchases FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can update own purchases" ON purchases;
CREATE POLICY "Users can update own purchases" ON purchases FOR UPDATE TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can delete own purchases" ON purchases;
CREATE POLICY "Users can delete own purchases" ON purchases FOR DELETE TO authenticated USING (auth.uid() = business_id);

-- Purchase Items
DROP POLICY IF EXISTS "Service Role Purchase Items Access" ON purchase_items;
CREATE POLICY "Service Role Purchase Items Access" ON purchase_items FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own purchase items" ON purchase_items;
CREATE POLICY "Users can view own purchase items" ON purchase_items FOR SELECT TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can insert own purchase items" ON purchase_items;
CREATE POLICY "Users can insert own purchase items" ON purchase_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can update own purchase items" ON purchase_items;
CREATE POLICY "Users can update own purchase items" ON purchase_items FOR UPDATE TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can delete own purchase items" ON purchase_items;
CREATE POLICY "Users can delete own purchase items" ON purchase_items FOR DELETE TO authenticated USING (auth.uid() = business_id);

-- Invoices
DROP POLICY IF EXISTS "Service Role Invoices Access" ON invoices;
CREATE POLICY "Service Role Invoices Access" ON invoices FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
CREATE POLICY "Users can view own invoices" ON invoices FOR SELECT TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can insert own invoices" ON invoices;
CREATE POLICY "Users can insert own invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can update own invoices" ON invoices;
CREATE POLICY "Users can update own invoices" ON invoices FOR UPDATE TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can delete own invoices" ON invoices;
CREATE POLICY "Users can delete own invoices" ON invoices FOR DELETE TO authenticated USING (auth.uid() = business_id);

-- Invoice Items
DROP POLICY IF EXISTS "Service Role Invoice Items Access" ON invoice_items;
CREATE POLICY "Service Role Invoice Items Access" ON invoice_items FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own invoice items" ON invoice_items;
CREATE POLICY "Users can view own invoice items" ON invoice_items FOR SELECT TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can insert own invoice items" ON invoice_items;
CREATE POLICY "Users can insert own invoice items" ON invoice_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can update own invoice items" ON invoice_items;
CREATE POLICY "Users can update own invoice items" ON invoice_items FOR UPDATE TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can delete own invoice items" ON invoice_items;
CREATE POLICY "Users can delete own invoice items" ON invoice_items FOR DELETE TO authenticated USING (auth.uid() = business_id);

-- Payments
DROP POLICY IF EXISTS "Service Role Payments Access" ON payments;
CREATE POLICY "Service Role Payments Access" ON payments FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments" ON payments FOR SELECT TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can insert own payments" ON payments;
CREATE POLICY "Users can insert own payments" ON payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can update own payments" ON payments;
CREATE POLICY "Users can update own payments" ON payments FOR UPDATE TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can delete own payments" ON payments;
CREATE POLICY "Users can delete own payments" ON payments FOR DELETE TO authenticated USING (auth.uid() = business_id);

-- Expenses
DROP POLICY IF EXISTS "Service Role Expenses Access" ON expenses;
CREATE POLICY "Service Role Expenses Access" ON expenses FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
CREATE POLICY "Users can view own expenses" ON expenses FOR SELECT TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can insert own expenses" ON expenses;
CREATE POLICY "Users can insert own expenses" ON expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can update own expenses" ON expenses;
CREATE POLICY "Users can update own expenses" ON expenses FOR UPDATE TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;
CREATE POLICY "Users can delete own expenses" ON expenses FOR DELETE TO authenticated USING (auth.uid() = business_id);

-- Accounts
DROP POLICY IF EXISTS "Service Role Accounts Access" ON accounts;
CREATE POLICY "Service Role Accounts Access" ON accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own accounts" ON accounts;
CREATE POLICY "Users can view own accounts" ON accounts FOR SELECT TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can insert own accounts" ON accounts;
CREATE POLICY "Users can insert own accounts" ON accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;
CREATE POLICY "Users can update own accounts" ON accounts FOR UPDATE TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can delete own accounts" ON accounts;
CREATE POLICY "Users can delete own accounts" ON accounts FOR DELETE TO authenticated USING (auth.uid() = business_id);

-- Suppliers
DROP POLICY IF EXISTS "Service Role Suppliers Access" ON suppliers;
CREATE POLICY "Service Role Suppliers Access" ON suppliers FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own suppliers" ON suppliers;
CREATE POLICY "Users can view own suppliers" ON suppliers FOR SELECT TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can insert own suppliers" ON suppliers;
CREATE POLICY "Users can insert own suppliers" ON suppliers FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can update own suppliers" ON suppliers;
CREATE POLICY "Users can update own suppliers" ON suppliers FOR UPDATE TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can delete own suppliers" ON suppliers;
CREATE POLICY "Users can delete own suppliers" ON suppliers FOR DELETE TO authenticated USING (auth.uid() = business_id);

-- Supplier Payments
DROP POLICY IF EXISTS "Service Role Supplier Payments Access" ON supplier_payments;
CREATE POLICY "Service Role Supplier Payments Access" ON supplier_payments FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own supplier payments" ON supplier_payments;
CREATE POLICY "Users can view own supplier payments" ON supplier_payments FOR SELECT TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can insert own supplier payments" ON supplier_payments;
CREATE POLICY "Users can insert own supplier payments" ON supplier_payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can update own supplier payments" ON supplier_payments;
CREATE POLICY "Users can update own supplier payments" ON supplier_payments FOR UPDATE TO authenticated USING (auth.uid() = business_id);

DROP POLICY IF EXISTS "Users can delete own supplier payments" ON supplier_payments;
CREATE POLICY "Users can delete own supplier payments" ON supplier_payments FOR DELETE TO authenticated USING (auth.uid() = business_id);
