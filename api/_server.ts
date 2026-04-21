import express from "express";
// import { createServer as createViteServer } from "vite"; // Moved to dynamic import
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import NodeCache from "node-cache";
// import puppeteer from "puppeteer"; // Moved to dynamic import inside generateAndUploadInvoiceAssets

// Initialize Cache - 5 minutes TTL
const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

// Global Cache Invalidation Middleware for Data Changes
const cacheInvalidator = (req: any, res: any, next: any) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const originalJson = res.json;
    res.json = function(data: any) {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.businessId) {
        cache.del(`dashboard_stats_${req.businessId}`);
        console.log(`[Cache] Invalidated dashboard stats for businessId: ${req.businessId} due to ${req.method} ${req.path}`);
      }
      return originalJson.call(this, data);
    };
  }
  next();
};

console.log("-----------------------------------------");
console.log("Environment Debugging:");
console.log("- Current Working Directory:", process.cwd());

const envPath = path.resolve(process.cwd(), '.env');
console.log("- Looking for .env at:", envPath);

if (fs.existsSync(envPath)) {
  const stats = fs.statSync(envPath);
  console.log(`- .env file found! Size: ${stats.size} bytes`);
  
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error("- Dotenv config error:", result.error.message);
  } else {
    console.log("- Dotenv loaded successfully.");
    if (result.parsed) {
      console.log("- Keys found in .env:", Object.keys(result.parsed).join(', '));
    }
  }
} else {
  console.error("- .env file NOT FOUND at root.");
  // Try to list files in root to see what's there
  try {
    const files = fs.readdirSync(process.cwd());
    console.log("- Files in root:", files.join(', '));
  } catch (e) {
    console.error("- Could not list root files");
  }
}

const allKeys = Object.keys(process.env);
console.log("- Total process.env keys:", allKeys.length);
if (allKeys.length === 0) {
  console.error("CRITICAL: process.env is completely empty. This is abnormal.");
}

// Manual parsing fallback
if (!process.env.SUPABASE_URL && fs.existsSync(envPath)) {
  console.log("- Manual parsing of .env as fallback...");
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const k = key.trim();
          const v = valueParts.join('=').trim();
          process.env[k] = v;
          console.log(`  - Manually set: ${k}`);
        }
      }
    });
  } catch (e: any) {
    console.error("- Manual parsing failed:", e.message);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Use service role key if available, otherwise fallback to anon key (which will likely fail for admin tasks)
const activeKey = supabaseServiceKey || supabaseAnonKey;

console.log("Supabase Initialization Debug:");
console.log(`- URL present: ${!!supabaseUrl}`);
console.log(`- Service Role Key present: ${!!supabaseServiceKey}`);
console.log(`- Anon Key present: ${!!supabaseAnonKey}`);

if (supabaseUrl) console.log(`- URL starts with: ${supabaseUrl.substring(0, 15)}...`);

if (supabaseServiceKey) {
  console.log(`- Service Role Key length: ${supabaseServiceKey.length}`);
  if (supabaseServiceKey.length < 100) {
    console.warn("- WARNING: SUPABASE_SERVICE_ROLE_KEY seems too short. It should be a long JWT string.");
  }
} else {
  console.warn("- WARNING: SUPABASE_SERVICE_ROLE_KEY is missing. Backend operations like profile creation and bucket setup will likely fail.");
}

let supabase: any = null;

if (!supabaseUrl || !activeKey) {
  console.error("CRITICAL: Supabase URL or API Key is missing from environment variables.");
} else {
  try {
    supabase = createClient(
      supabaseUrl,
      activeKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    console.log(`- Supabase client initialized successfully using ${supabaseServiceKey ? 'SERVICE_ROLE' : 'ANON'} key.`);
    
    // Test query to verify connection and permissions
    supabase.from('profiles').select('count', { count: 'exact', head: true })
      .then(({ error }: any) => {
        if (error) {
          if (error.message.includes('relation "profiles" does not exist')) {
            console.error("- Supabase connection test FAILED: Database tables are missing.");
            console.error("  ACTION REQUIRED: Please run the SQL schema in your Supabase SQL Editor.");
          } else {
            console.error("- Supabase connection test FAILED:", error.message);
          }
        } else {
          console.log("- Supabase connection test successful.");
        }
      });
  } catch (initError: any) {
    console.error("- Failed to initialize Supabase client:", initError.message);
  }
}

// Helper to get IST date from UTC timestamp for grouping
const getISTDate = (utcDateStr: string | Date) => {
  if (!utcDateStr) return '';
  const date = new Date(utcDateStr);
  // IST is UTC + 5:30
  const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
  return istDate.toISOString();
};

// Middleware to ensure Supabase is initialized
const ensureSupabase = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!supabase) {
    console.error(`[${req.method} ${req.path}] Supabase client not initialized. Missing environment variables.`);
    return res.status(503).json({ 
      error: "Supabase client not initialized. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Settings > Secrets.",
      code: "SUPABASE_NOT_INITIALIZED"
    });
  }
  next();
};

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Apply ensureSupabase middleware to all /api routes except health
  app.use("/api", (req, res, next) => {
    if (req.path === "/health") return next();
    ensureSupabase(req, res, next);
  });

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    if (!supabase) {
      return res.status(500).json({ 
        status: 'error', 
        message: 'Supabase client not initialized',
        env: {
          hasUrl: !!process.env.SUPABASE_URL,
          hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      });
    }
    
    let bucketStatus = 'unknown';
    let tableStatus: any = {};
    
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const hasInvoices = buckets?.some((b: any) => b.name === 'invoices');
      bucketStatus = hasInvoices ? 'exists' : 'missing';
      
      // Check for critical tables
      const tables = ['profiles', 'customers', 'products', 'invoices', 'payments', 'accounts'];
      for (const table of tables) {
        const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
        tableStatus[table] = error ? (error.code === '42P01' ? 'missing' : 'error: ' + error.message) : 'ok';
      }
    } catch (e: any) {
      bucketStatus = 'error: ' + e.message;
    }

    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      supabaseInitialized: true,
      bucketStatus,
      tableStatus,
      vercel: !!process.env.VERCEL,
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasUrl: !!process.env.SUPABASE_URL,
        hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        cwd: process.cwd()
      }
    });
  });


  // Helper to update account balance
  const updateAccountBalance = async (businessId: string, name: string, amount: number, type: 'increment' | 'decrement') => {
    if (!name || amount === 0) return;
    const mode = name.toLowerCase();
    try {
      const rpcName = type === 'increment' ? 'increment_account_balance' : 'decrement_account_balance';
      const { error: rpcError } = await supabase.rpc(rpcName, { b_id: businessId, acc_name: mode, amt: amount });
      if (rpcError) throw rpcError;
    } catch (e) {
      const { data: acc } = await supabase.from('accounts').select('balance').eq('business_id', businessId).eq('name', mode).single();
      const currentBalance = acc ? Number(acc.balance) : 0;
      const newBalance = type === 'increment' ? currentBalance + amount : currentBalance - amount;
      
      await supabase.from('accounts').upsert({
        business_id: businessId,
        name: mode,
        balance: newBalance,
        last_updated: new Date().toISOString()
      }, { onConflict: 'business_id,name' });
    }
  };

  // Helper to update customer balance
  const updateCustomerBalance = async (businessId: string, customerId: number, amount: number, type: 'increment' | 'decrement') => {
    if (!customerId || amount === 0) return;
    try {
      const rpcName = type === 'increment' ? 'increment_customer_balance' : 'decrement_customer_balance';
      const { error: rpcError } = await supabase.rpc(rpcName, { c_id: customerId, amt: amount, b_id: businessId });
      if (rpcError) throw rpcError;
    } catch (e) {
      const { data: cust } = await supabase.from('customers').select('outstanding_balance').eq('id', customerId).single();
      const currentBalance = cust ? Number(cust.outstanding_balance) : 0;
      const newBalance = type === 'increment' ? currentBalance + amount : currentBalance - amount;
      
      await supabase.from('customers').update({ outstanding_balance: newBalance }).eq('id', customerId);
    }
  };

  app.post("/api/accounts/sync", async (req: any, res) => {
    try {
      const { businessId } = req;
      
      // 1. Get all financial records
      const { data: payments } = await supabase.from('payments').select('amount, payment_mode').eq('business_id', businessId);
      const { data: purchases } = await supabase.from('purchases').select('amount_paid, payment_mode').eq('business_id', businessId);
      const { data: expenses } = await supabase.from('expenses').select('amount, payment_mode').eq('business_id', businessId);
      
      const balances: Record<string, number> = {
        'cash': 0,
        'upi': 0
      };

      // Sum payments (income)
      payments?.forEach(p => {
        if (p.payment_mode && balances.hasOwnProperty(p.payment_mode)) {
          balances[p.payment_mode] += Number(p.amount) || 0;
        }
      });

      // Subtract purchases (expense)
      purchases?.forEach(p => {
        if (p.payment_mode && balances.hasOwnProperty(p.payment_mode)) {
          balances[p.payment_mode] -= Number(p.amount_paid) || 0;
        }
      });

      // Subtract expenses (expense)
      expenses?.forEach(e => {
        if (e.payment_mode && balances.hasOwnProperty(e.payment_mode)) {
          balances[e.payment_mode] -= Number(e.amount) || 0;
        }
      });

      // 2. Update accounts table
      for (const [name, balance] of Object.entries(balances)) {
        await supabase
          .from('accounts')
          .update({ balance, last_updated: new Date().toISOString() })
          .eq('business_id', businessId)
          .eq('name', name);
      }

      res.json({ success: true, balances });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Middleware to set and validate business ID for protected API routes
  app.use("/api", (req: any, res, next) => {
    // Skip for open/public API routes
    if (req.path === '/health' || req.path.startsWith('/public/')) {
      return next();
    }

    const headerId = req.headers['x-business-id'];
    
    // In Supabase migration, businessId is the user's UUID
    // Ensure we don't treat the string "null" or "undefined" as a valid UUID
    if (headerId && headerId !== 'null' && headerId !== 'undefined') {
      // Basic UUID validation
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(headerId);
      if (isUUID) {
        req.businessId = headerId;
        return next();
      }
    }
    
    // If we reach here, no valid business ID was found
    req.businessId = null;
    
    // Return early for routes that strictly require business ID
    // We'll allow it specifically for health and public routes (checked above)
    return res.status(400).json({ 
      error: "Business ID required", 
      message: "A valid business UUID must be provided in the x-business-id header."
    });
  });

  // Apply Cache Invalidation Middleware
  app.use("/api", cacheInvalidator);

  // Function to ensure default accounts exist (can be called from specific routes)
  const ensureDefaultAccounts = async (businessId: string) => {
    try {
      const accounts = ['cash', 'upi'];
      for (const accountName of accounts) {
        // Try to insert, if exists it will fail with 23505 (unique violation), which we ignore
        const { error } = await supabase
          .from('accounts')
          .insert([{ business_id: businessId, name: accountName, balance: 0 }]);
        
        if (error && error.code !== '23505') {
          console.warn(`[ensureDefaultAccounts] Note for ${accountName}: ${error.message}`);
        }
      }
    } catch (e) {
      console.warn('Failed to ensure default accounts:', e);
    }
  };

  // Function to ensure storage buckets exist
  const ensureBuckets = async () => {
    if (!supabase || !supabaseServiceKey) {
      console.log("Skipping bucket check: SUPABASE_SERVICE_ROLE_KEY is missing.");
      return;
    }
    try {
      const buckets = ['invoices', 'business_logos'];
      const { data: existingBuckets } = await supabase.storage.listBuckets();
      
      for (const bucketName of buckets) {
        const exists = existingBuckets?.find(b => b.name === bucketName);
        if (!exists) {
          console.log(`Creating bucket: ${bucketName}`);
          const { error: createError } = await supabase.storage.createBucket(bucketName, { public: true });
          if (createError) {
            if (createError.message.includes('already exists')) {
              console.log(`Bucket ${bucketName} already exists.`);
            } else {
              console.error(`Failed to create bucket ${bucketName}:`, createError.message);
            }
          } else {
            console.log(`Successfully created bucket: ${bucketName}`);
          }
        } else {
          console.log(`Bucket already exists: ${bucketName}`);
        }
      }
    } catch (error) {
      console.error('Error ensuring buckets:', error);
    }
  };

  app.get("/api/search", async (req: any, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ products: [], customers: [] });

    try {
      const businessId = req.businessId;
      
      const [productsRes, customersRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, selling_price, stock_quantity')
          .eq('business_id', businessId)
          .ilike('name', `%${q}%`)
          .limit(5),
        supabase
          .from('customers')
          .select('id, name, phone, outstanding_balance')
          .eq('business_id', businessId)
          .ilike('name', `%${q}%`)
          .limit(5)
      ]);

      res.json({
        products: productsRes.data || [],
        customers: customersRes.data || []
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Call ensureBuckets on startup
  ensureBuckets();

  // API Routes
  const DEFAULT_BUSINESS_ID = 1; // Kept for backward compatibility if needed, but we'll use req.businessId

  // Dashboard Stats
  app.get("/api/dashboard/stats", async (req: any, res) => {
    const debugLogs: string[] = [];
    try {
      const { businessId } = req;
      
      // Try cache first
      const cacheKey = `dashboard_stats_${businessId}`;
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        console.log(`[GET /api/dashboard/stats] Cache HIT for businessId: ${businessId}`);
        return res.json(cachedData);
      }

      console.log(`[GET /api/dashboard/stats] Cache MISS for businessId: ${businessId}`);
      debugLogs.push(`Fetching stats for businessId: ${businessId}`);

      // Ensure default accounts exist
      try {
        await ensureDefaultAccounts(businessId);
        debugLogs.push("Default accounts checked/created");
      } catch (accError: any) {
        debugLogs.push(`ensureDefaultAccounts failed: ${accError.message}`);
        console.error(`[GET /api/dashboard/stats] ${debugLogs[debugLogs.length-1]}`);
      }

      const getISTBoundaries = () => {
        const istNow = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
        const istYear = istNow.getUTCFullYear();
        const istMonth = String(istNow.getUTCMonth() + 1).padStart(2, '0');
        const istDay = String(istNow.getUTCDate()).padStart(2, '0');
        
        return {
          todayStart: `${istYear}-${istMonth}-${istDay}T00:00:00+05:30`,
          monthStart: `${istYear}-${istMonth}-01T00:00:00+05:30`
        };
      };

      const { todayStart, monthStart } = getISTBoundaries();

      debugLogs.push(`Date ranges (IST): todayStart=${todayStart}, monthStart=${monthStart}`);

      const queries = [
        supabase.from('payments').select('amount, payment_mode, invoice_id').eq('business_id', businessId).gte('payment_date', todayStart),
        supabase.from('invoices').select('id, total_amount').eq('business_id', businessId).gte('created_at', todayStart),
        supabase.from('payments').select('amount, payment_mode, invoice_id').eq('business_id', businessId).gte('payment_date', monthStart),
        supabase.from('invoices').select('id, total_amount').eq('business_id', businessId).gte('created_at', monthStart),
        supabase.from('payments').select('amount, payment_mode, invoice_id').eq('business_id', businessId),
        supabase.from('invoices').select('id, total_amount').eq('business_id', businessId),
        supabase.from('customers').select('outstanding_balance').eq('business_id', businessId),
        supabase.from('products').select('id, stock_quantity, low_stock_alert').eq('business_id', businessId),
        supabase.from('accounts').select('*').eq('business_id', businessId)
      ];

      debugLogs.push("Executing parallel queries...");
      const results = await Promise.all(queries);
      debugLogs.push("Parallel queries completed");

      // Check for errors in any of the results
      results.forEach((result, index) => {
        if (result.error) {
          const tableNames = ['payments', 'invoices', 'payments_monthly', 'invoices_monthly', 'payments_all', 'invoices_all', 'customers', 'products', 'accounts'];
          const tableName = tableNames[index] || 'unknown';
          const msg = `Query for "${tableName}" failed: ${result.error.message} (${result.error.code})`;
          debugLogs.push(msg);
          console.error(`[GET /api/dashboard/stats] ${msg}`);
          
          // If it's a "missing table" error, we should probably stop and inform the user
          if (result.error.code === '42P01') {
            const err = new Error(`Database table "${tableName}" is missing. Please run the SQL schema in your Supabase SQL Editor.`);
            (err as any).code = '42P01';
            (err as any).tableName = tableName;
            throw err;
          }
        }
      });

      const [
        { data: todayPayments },
        { data: todayInvoices },
        { data: monthlyPayments },
        { data: monthlyInvoices },
        { data: allPaymentsData },
        { data: allInvoicesData },
        { data: customersData },
        { data: productsData },
        { data: accountsData }
      ] = results;
      
      debugLogs.push("Data destructured successfully");

      // Fallback for payment modes
      const summary: any = {};
      if (allPaymentsData) {
        allPaymentsData.forEach(p => {
          if (p.payment_mode) {
            summary[p.payment_mode] = (summary[p.payment_mode] || 0) + (p.amount || 0);
          }
        });
      }
      const finalPaymentModes = Object.entries(summary).map(([mode, total]) => ({ payment_mode: mode, total }));
      debugLogs.push(`Calculated ${finalPaymentModes.length} payment modes`);

      const todayCollections = todayPayments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
      const todayCashReceived = todayPayments?.filter((p: any) => p.payment_mode?.toLowerCase() === 'cash').reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
      const todayOnlineReceived = todayPayments?.filter((p: any) => p.payment_mode?.toLowerCase() === 'upi').reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
      const todayInvoicesTotal = todayInvoices?.reduce((sum: number, i: any) => sum + (i.total_amount || 0), 0) || 0;
      const todayInvoicesCount = todayInvoices?.length || 0;

      const monthlyCollections = monthlyPayments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
      const monthlyCashReceived = monthlyPayments?.filter((p: any) => p.payment_mode?.toLowerCase() === 'cash').reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
      const monthlyOnlineReceived = monthlyPayments?.filter((p: any) => p.payment_mode?.toLowerCase() === 'upi').reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
      const monthlyInvoicesTotal = monthlyInvoices?.reduce((sum: number, i: any) => sum + (i.total_amount || 0), 0) || 0;
      const monthlyInvoicesCount = monthlyInvoices?.length || 0;

      const totalCollections = allPaymentsData?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
      const totalInvoicesTotal = allInvoicesData?.reduce((sum: number, i: any) => sum + (i.total_amount || 0), 0) || 0;

      const todaySales = todayInvoicesTotal;
      const monthlySales = monthlyInvoicesTotal;
      const totalSales = totalInvoicesTotal;

      const pendingPayments = customersData?.reduce((sum: number, c: any) => sum + (c.outstanding_balance || 0), 0) || 0;
      const lowStockCount = productsData?.filter((p: any) => p.stock_quantity <= p.low_stock_alert).length || 0;

      debugLogs.push("Fetching pending customers...");
      const { data: pendingCustomers, error: pendingError } = await supabase
        .from('customers')
        .select('id, name, phone, outstanding_balance')
        .eq('business_id', businessId)
        .gt('outstanding_balance', 0)
        .order('outstanding_balance', { ascending: false })
        .limit(5);
      
      if (pendingError) {
        debugLogs.push(`Pending customers query failed: ${pendingError.message}`);
      }

      const resultData = {
        todaySales,
        todayCollections,
        todayInvoicesCount,
        todayCashReceived,
        todayOnlineReceived,
        monthlySales,
        monthlyCollections,
        monthlyInvoicesCount,
        monthlyCashReceived,
        monthlyOnlineReceived,
        totalSales,
        totalCollections,
        paymentModes: finalPaymentModes,
        pendingPayments,
        lowStockCount,
        pendingCustomers: pendingCustomers || [],
        accounts: accountsData || []
      };

      // Set cache before sending
      cache.set(cacheKey, resultData);

      debugLogs.push("Sending response");
      res.json(resultData);
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch dashboard stats",
        code: error.code,
        tableName: error.tableName,
        debug: debugLogs,
        hint: error.code === '42P01' ? "Run the SQL schema in Supabase SQL Editor" : "Check Vercel logs for full details"
      });
    }
  });

  // Public Invoice Endpoint (No Auth Required)
  app.get("/api/public/invoice/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Fetch invoice with customer details
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (name, phone, address, gst_number),
          profiles:business_id (business_name, address, phone, email, gstin, logo_url, invoice_theme, invoice_theme_color, instagram_id)
        `)
        .eq('id', id)
        .single();
      
      if (error || !invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Fetch invoice items
      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select(`
          *,
          products (name, tax_percentage)
        `)
        .eq('invoice_id', id);

      // Fetch payments for this invoice
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('invoice_id', id);

      const amount_paid = payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;

      const formattedInvoice = {
        ...invoice,
        customer_name: (invoice as any).customers?.name,
        customer_phone: (invoice as any).customers?.phone,
        customer_address: (invoice as any).customers?.address,
        customer_gstin: (invoice as any).customers?.gst_number,
        business: (invoice as any).profiles,
        amount_paid,
        items: items?.map(item => ({
          ...item,
          product_name: (item as any).products?.name,
          tax_percentage: (item as any).products?.tax_percentage,
          discount: item.discount_amount
        })) || []
      };

      res.json(formattedInvoice);
    } catch (error: any) {
      console.error("Public invoice fetch error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Manual PDF Regeneration
  app.post("/api/invoices/:id/pdf", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { data: invoice } = await supabase.from('invoices').select('*, items:invoice_items(*)').eq('id', id).single();
      const { data: business } = await supabase.from('profiles').select('*').eq('id', req.businessId).single();
      
      if (!invoice || !business) {
        return res.status(404).json({ error: "Invoice or business not found" });
      }
      
      const urls = await generateAndUploadInvoiceAssets(invoice, business, supabase);
      res.json({ success: true, ...urls });
    } catch (error: any) {
      console.error("Manual PDF generation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Storage Endpoints
  app.get("/api/storage/list", async (req: any, res) => {
    if (!supabase) return res.status(501).json({ error: "Supabase not configured" });
    const { bucket, path } = req.query;
    if (!bucket) return res.status(400).json({ error: "Bucket is required" });
    
    try {
      const { data, error } = await supabase.storage.from(bucket as string).list(path as string || '');
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      console.error(`Storage List Error for ${bucket}/${path}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/storage/test-direct", async (req: any, res) => {
    if (!supabase) return res.status(501).json({ error: "Supabase not configured" });
    try {
      const testContent = "Test file content generated by server at " + new Date().toISOString();
      const { data, error } = await supabase.storage
        .from('invoices')
        .upload('test-connection.txt', Buffer.from(testContent), {
          contentType: 'text/plain',
          upsert: true
        });
      if (error) {
        // If bucket doesn't exist, try to create it
        if (error.message.includes('bucket not found') || error.message.includes('does not exist')) {
          await supabase.storage.createBucket('invoices', { public: true });
          const { data: retryData, error: retryError } = await supabase.storage
            .from('invoices')
            .upload('test-connection.txt', Buffer.from(testContent), {
              contentType: 'text/plain',
              upsert: true
            });
          if (retryError) throw retryError;
          return res.json({ success: true, message: "Bucket created and test file uploaded", data: retryData });
        }
        throw error;
      }
      res.json({ success: true, message: "Test file uploaded successfully", data });
    } catch (error: any) {
      console.error("Storage Direct Test Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/storage/upload", upload.single('file'), async (req: any, res) => {
    if (!supabase) return res.status(501).json({ error: "Supabase not configured" });
    if (!req.file) {
      console.error("Storage Upload: No file provided in request");
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    const { bucket, path } = req.body;
    if (!bucket || !path) {
      console.error("Storage Upload: Missing bucket or path", { bucket, path });
      return res.status(400).json({ error: "Bucket and path are required" });
    }

    console.log(`Storage Upload: Attempting to upload to ${bucket}/${path}`, {
      size: req.file.size,
      mimetype: req.file.mimetype,
      businessId: req.businessId,
      bodyKeys: Object.keys(req.body)
    });

    if (req.file.size === 0) {
      console.error("Storage Upload: File is empty (0 bytes)");
      return res.status(400).json({ error: "Uploaded file is empty" });
    }

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, req.file.buffer, {
          contentType: req.file.mimetype || 'application/pdf',
          upsert: true
        });

      if (error) {
        console.error(`Storage Upload Error for ${bucket}/${path}:`, error);
        // Check for various "bucket not found" error messages
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('bucket not found') || errorMsg.includes('does not exist')) {
          console.log(`Bucket ${bucket} not found, attempting to create it...`);
          try {
            await supabase.storage.createBucket(bucket, { public: true });
            console.log(`Bucket ${bucket} created successfully. Retrying upload...`);
            const { data: retryData, error: retryError } = await supabase.storage
              .from(bucket)
              .upload(path, req.file.buffer, {
                contentType: req.file.mimetype || 'application/pdf',
                upsert: true
              });
            if (retryError) {
              console.error(`Retry Upload Error for ${bucket}/${path}:`, retryError);
              throw retryError;
            }
            console.log(`Retry Upload Success for ${bucket}/${path}`);
            return res.json(retryData);
          } catch (createError: any) {
            console.error(`Failed to create bucket ${bucket}:`, createError);
            throw error; // Throw original error if bucket creation fails
          }
        } else if (errorMsg.includes('policy') || errorMsg.includes('permission denied')) {
          // If it's a policy error, try to ensure the bucket is public
          console.log(`Permission error for bucket ${bucket}, ensuring it is public...`);
          try {
            await supabase.storage.updateBucket(bucket, { public: true });
            // Retry upload
            const { data: retryData, error: retryError } = await supabase.storage
              .from(bucket)
              .upload(path, req.file.buffer, {
                contentType: req.file.mimetype || 'application/pdf',
                upsert: true
              });
            if (retryError) throw retryError;
            return res.json(retryData);
          } catch (e) {
            console.error(`Failed to update bucket ${bucket} to public:`, e);
            throw error;
          }
        }
        throw error;
      }
      console.log(`Storage Upload Success for ${bucket}/${path}`);
      res.json(data);
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/storage/url", async (req: any, res) => {
    if (!supabase) return res.status(501).json({ error: "Supabase not configured" });
    const { bucket, path } = req.query;
    if (!bucket || !path) return res.status(400).json({ error: "Bucket and path are required" });

    try {
      const { data } = supabase.storage.from(bucket as string).getPublicUrl(path as string);
      res.json({ url: data.publicUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Products
  app.get("/api/products", async (req: any, res) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', req.businessId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch products' });
    }
  });

  app.post("/api/products", async (req: any, res) => {
    try {
      const { name, category, sku, purchase_price, selling_price, stock_quantity, low_stock_alert, tax_percentage } = req.body;
      const { data, error } = await supabase
        .from('products')
        .insert([{
          business_id: req.businessId,
          name,
          category,
          sku,
          purchase_price,
          selling_price,
          stock_quantity: stock_quantity || 0,
          low_stock_alert: low_stock_alert || 5,
          tax_percentage: tax_percentage || 0
        }])
        .select()
        .single();
      
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      console.error('Error creating product:', error);
      res.status(500).json({ error: error.message || 'Failed to create product' });
    }
  });

  app.put("/api/products/:id", async (req: any, res) => {
    try {
      const { name, category, sku, purchase_price, selling_price, stock_quantity, low_stock_alert, tax_percentage } = req.body;
      const { error } = await supabase
        .from('products')
        .update({
          name,
          category,
          sku,
          purchase_price,
          selling_price,
          stock_quantity,
          low_stock_alert,
          tax_percentage
        })
        .eq('id', req.params.id)
        .eq('business_id', req.businessId);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating product:', error);
      res.status(500).json({ error: error.message || 'Failed to update product' });
    }
  });

  app.delete("/api/products/:id", async (req: any, res) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', req.params.id)
        .eq('business_id', req.businessId);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting product:', error);
      res.status(500).json({ error: error.message || 'Failed to delete product' });
    }
  });

  // Customers
  app.get("/api/customers", async (req: any, res) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', req.businessId)
        .order('name', { ascending: true });
      
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch customers' });
    }
  });

  app.delete("/api/customers/:id", async (req: any, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
        .eq('business_id', req.businessId);
      
      if (error) {
        if (error.code === '23503') { // Foreign key constraint
          return res.status(400).json({ error: "Cannot delete customer with existing invoices or payments." });
        }
        throw error;
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete customer error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/customers", async (req: any, res) => {
    try {
      const { name, phone, email, address, gst_number } = req.body;
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          business_id: req.businessId,
          name,
          phone,
          email,
          address,
          gst_number
        }])
        .select('id')
        .single();
      
      if (error) throw error;
      res.json({ id: data.id });
    } catch (error: any) {
      console.error('Error creating customer:', error);
      res.status(500).json({ error: error.message || 'Failed to create customer' });
    }
  });

  app.get("/api/customers/:id/payments", async (req: any, res) => {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        invoices (invoice_number)
      `)
      .eq('customer_id', req.params.id)
      .eq('business_id', req.businessId)
      .order('payment_date', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    
    // Flatten the result to match expected format
    const formattedData = data?.map(p => ({
      ...p,
      invoice_number: (p as any).invoices?.invoice_number
    }));
    
    res.json(formattedData);
  });

  // Invoices
  app.get("/api/invoices", async (req: any, res) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (name, phone)
        `)
        .eq('business_id', req.businessId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Get payments to calculate amount_paid
      const { data: payments } = await supabase
        .from('payments')
        .select('invoice_id, amount')
        .eq('business_id', req.businessId);

      const paymentsMap: any = {};
      payments?.forEach(p => {
        if (p.invoice_id) {
          paymentsMap[p.invoice_id] = (paymentsMap[p.invoice_id] || 0) + p.amount;
        }
      });

      const formattedData = data?.map(i => ({
        ...i,
        customer_name: (i as any).customers?.name,
        customer_phone: (i as any).customers?.phone,
        amount_paid: paymentsMap[i.id] || 0
      }));

      res.json(formattedData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/invoices/:id", async (req: any, res) => {
    try {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (name, phone, address, gst_number)
        `)
        .eq('id', req.params.id)
        .eq('business_id', req.businessId)
        .single();
      
      if (error) throw error;

      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('invoice_id', req.params.id);

      const amount_paid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

      const formattedInvoice = {
        ...invoice,
        customer_name: (invoice as any).customers?.name,
        customer_phone: (invoice as any).customers?.phone,
        customer_address: (invoice as any).customers?.address,
        customer_gstin: (invoice as any).customers?.gst_number,
        amount_paid
      };

      res.json(formattedInvoice);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/invoices/:id/items", async (req: any, res) => {
    try {
      // First verify the invoice belongs to the business
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .select('business_id')
        .eq('id', req.params.id)
        .eq('business_id', req.businessId)
        .single();
      
      if (invError || !invoice) {
        return res.status(403).json({ error: "Unauthorized access to invoice items" });
      }

      const { data, error } = await supabase
        .from('invoice_items')
        .select(`
          *,
          products (name, tax_percentage)
        `)
        .eq('invoice_id', req.params.id);
      
      if (error) throw error;

      const formattedItems = data?.map(item => ({
        ...item,
        product_name: (item as any).products?.name,
        tax_percentage: (item as any).products?.tax_percentage,
        discount: item.discount_amount
      }));

      res.json(formattedItems);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

    app.post("/api/invoices", async (req: any, res) => {
    try {
      const { customer_id, items, subtotal, tax_amount, discount_amount, total_amount, payment_status, payment_mode: raw_payment_mode, created_at, amount_paid, cash_amount, upi_amount, pdf_url } = req.body;
      
      const payment_mode = (raw_payment_mode === 'cash' || raw_payment_mode === 'upi' || raw_payment_mode === 'both') 
        ? raw_payment_mode 
        : (payment_status === 'unpaid' ? null : 'cash');
      
      // 1. Generate invoice number
      const { data: lastInvoices } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('business_id', req.businessId)
        .order('id', { ascending: false })
        .limit(1);

      const lastInvoice = lastInvoices?.[0];
      let nextId = 1;
      if (lastInvoice?.invoice_number) {
        const parts = lastInvoice.invoice_number.split('-');
        const lastId = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastId)) nextId = lastId + 1;
      }
      
      const dateObj = created_at ? new Date(created_at) : new Date();
      const monthNames = ["Ja", "Fe", "Mr", "Ap", "My", "Jn", "Jl", "Ag", "Se", "Oc", "No", "De"];
      const monthAbbr = monthNames[dateObj.getMonth()];
      const yearShort = dateObj.getFullYear().toString().slice(-2);
      const day = dateObj.getDate();
      const invoice_number = `${monthAbbr} ${yearShort}-${day}-${nextId}`;

      // Recalculate payment status based on amounts to ensure integrity
      const finalAmountPaid = Number(amount_paid) || 0;
      let finalStatus = payment_status;
      if (finalAmountPaid <= 0) {
        finalStatus = 'unpaid';
      } else if (finalAmountPaid < Number(total_amount)) {
        finalStatus = 'partial';
      } else {
        finalStatus = 'paid';
      }

      // 2. Create Invoice
      const invoiceDate = created_at || new Date().toISOString();
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .insert([{
          business_id: req.businessId,
          invoice_number,
          customer_id,
          subtotal,
          tax_amount,
          discount_amount,
          total_amount,
          payment_status: finalStatus,
          payment_mode,
          amount_paid: finalAmountPaid,
          cash_amount: cash_amount || 0,
          upi_amount: upi_amount || 0,
          created_at: invoiceDate,
          pdf_url: pdf_url || null
        }])
        .select()
        .single();

      if (invError) throw invError;
      const invoiceId = invoice.id;

      // 3. Save Items & Update Stock (Parallelized)
      const itemsToInsert = items.map((item: any) => ({
        business_id: req.businessId,
        invoice_id: invoiceId,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        discount_amount: item.discount || 0,
        total: item.total
      }));

      const itemInsertPromise = supabase.from('invoice_items').insert(itemsToInsert);

      // Branch 1: Stock updates
      const stockUpdatesPromise = Promise.all(items.map(async (item: any) => {
        try {
          const { error: rpcError } = await supabase.rpc('decrement_stock', { 
            p_id: item.product_id, 
            qty: item.quantity,
            b_id: req.businessId
          });
          if (rpcError) throw rpcError;
        } catch (e) {
          const { data: p } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
          if (p) await supabase.from('products').update({ stock_quantity: p.stock_quantity - item.quantity }).eq('id', item.product_id);
        }
      }));

    // Branch 2: Payment & Balances
    const paidAmount = Number(amount_paid) || 0;

    const paymentAndBalancePromise = (async () => {
      const tasks = [];

      if (paidAmount > 0) {
        if (payment_mode === 'both') {
          const cash = Number(cash_amount) || 0;
          const upi = Number(upi_amount) || 0;

          if (cash > 0) {
            tasks.push(supabase.from('payments').insert([{
              business_id: req.businessId,
              invoice_id: invoiceId,
              customer_id: customer_id || null,
              amount: cash,
              payment_mode: 'cash',
              payment_date: invoiceDate
            }]));
            
            tasks.push(updateAccountBalance(req.businessId, 'cash', cash, 'increment'));
          }

          if (upi > 0) {
            tasks.push(supabase.from('payments').insert([{
              business_id: req.businessId,
              invoice_id: invoiceId,
              customer_id: customer_id || null,
              amount: upi,
              payment_mode: 'upi',
              payment_date: invoiceDate
            }]));
            
            tasks.push(updateAccountBalance(req.businessId, 'upi', upi, 'increment'));
          }
        } else {
          tasks.push(supabase.from('payments').insert([{
            business_id: req.businessId,
            invoice_id: invoiceId,
            customer_id: customer_id || null,
            amount: paidAmount,
            payment_mode,
            payment_date: invoiceDate
          }]));

          tasks.push(updateAccountBalance(req.businessId, payment_mode, paidAmount, 'increment'));
        }
      }

      if (customer_id) {
        const unpaid = total_amount - paidAmount;
        if (unpaid > 0) {
          tasks.push(updateCustomerBalance(req.businessId, customer_id, unpaid, 'increment'));
        } else if (unpaid < 0) {
          tasks.push(updateCustomerBalance(req.businessId, customer_id, Math.abs(unpaid), 'decrement'));
        }
      }

      await Promise.all(tasks);
    })();

      // Await all parallel branches
      await Promise.all([itemInsertPromise, stockUpdatesPromise, paymentAndBalancePromise]);

      // 5. Generate PDF on Backend (Completely async, not blocking response)
      (async () => {
        try {
          const [{ data: business }, { data: fullInvoice }] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', req.businessId).single(),
            supabase.from('invoices').select('*, items:invoice_items(*)').eq('id', invoiceId).single()
          ]);
          
          if (business && fullInvoice) {
            await generateAndUploadInvoiceAssets(fullInvoice, business, supabase);
          }
        } catch (err) {
          console.error("Background asset generation failed:", err);
        }
      })().catch(() => {});

      res.json({ 
        id: invoiceId, 
        invoice_number,
        customer_id,
        business_id: req.businessId,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        payment_status,
        payment_mode,
        pdf_url: pdf_url || null,
        created_at: invoiceDate
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to create invoice" });
    }
  });

    app.put("/api/invoices/:id", async (req: any, res) => {
    try {
      const { customer_id, items, subtotal, tax_amount, discount_amount, total_amount, payment_status, payment_mode: raw_payment_mode, created_at, amount_paid, cash_amount, upi_amount, pdf_url } = req.body;
      
      const payment_mode = (raw_payment_mode === 'cash' || raw_payment_mode === 'upi' || raw_payment_mode === 'both') 
        ? raw_payment_mode 
        : (payment_status === 'unpaid' ? null : 'cash');
      
      // 1. Get old invoice to reverse stock and balance
      const { data: oldInvoice, error: oldInvError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', req.params.id)
        .eq('business_id', req.businessId)
        .single();
      
      if (oldInvError || !oldInvoice) throw new Error("Invoice not found");

      const { data: oldItems } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', req.params.id);
      
      // Reverse stock
      if (oldItems) {
        for (const item of oldItems) {
          try {
            const { error: rpcError } = await supabase.rpc('increment_stock', { p_id: item.product_id, qty: item.quantity, b_id: req.businessId });
            if (rpcError) throw rpcError;
          } catch (e) {
            const { data: p } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
            if (p) await supabase.from('products').update({ stock_quantity: p.stock_quantity + item.quantity }).eq('id', item.product_id);
          }
        }
      }
      
      // Reverse customer balance for the OLD customer
      const { data: oldPayments } = await supabase
        .from('payments')
        .select('amount, payment_mode')
        .eq('invoice_id', req.params.id);
      
      const oldPaid = oldPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const oldBalance = oldInvoice.total_amount - oldPaid;
      
      if (oldInvoice.customer_id) {
        try {
          const { error: rpcError } = await supabase.rpc('decrement_customer_balance', { c_id: oldInvoice.customer_id, amt: oldBalance, b_id: req.businessId });
          if (rpcError) throw rpcError;
        } catch (e) {
          const { data: cust } = await supabase.from('customers').select('outstanding_balance').eq('id', oldInvoice.customer_id).single();
          if (cust) await supabase.from('customers').update({ outstanding_balance: Number(cust.outstanding_balance) - oldBalance }).eq('id', oldInvoice.customer_id);
        }
      }

      // Reverse account balance for each old payment
      // If payment records are missing but invoice says amount was paid, try to reverse from invoice fields
      if (oldPayments && oldPayments.length > 0) {
        for (const p of oldPayments) {
          try {
            const { error: rpcError } = await supabase.rpc('decrement_account_balance', { b_id: req.businessId, acc_name: p.payment_mode, amt: p.amount });
            if (rpcError) throw rpcError;
          } catch (e) {
            const { data: acc } = await supabase.from('accounts').select('balance').eq('business_id', req.businessId).eq('name', p.payment_mode).single();
            if (acc) await supabase.from('accounts').update({ balance: Number(acc.balance) - p.amount, last_updated: new Date().toISOString() }).eq('business_id', req.businessId).eq('name', p.payment_mode);
          }
        }
      } else if (oldInvoice.amount_paid > 0 && oldInvoice.payment_mode) {
        // Fallback reversal using invoice fields if payments records are missing
        if (oldInvoice.payment_mode === 'both') {
          const modes = ['cash', 'upi'] as const;
          for (const mode of modes) {
            const amt = mode === 'cash' ? (oldInvoice.cash_amount || 0) : (oldInvoice.upi_amount || 0);
            if (amt > 0) {
              try {
                const { error: rpcError } = await supabase.rpc('decrement_account_balance', { b_id: req.businessId, acc_name: mode, amt });
                if (rpcError) throw rpcError;
              } catch (e) {
                const { data: acc } = await supabase.from('accounts').select('balance').eq('business_id', req.businessId).eq('name', mode).single();
                if (acc) await supabase.from('accounts').update({ balance: Number(acc.balance) - amt, last_updated: new Date().toISOString() }).eq('business_id', req.businessId).eq('name', mode);
              }
            }
          }
        } else {
          try {
            const { error: rpcError } = await supabase.rpc('decrement_account_balance', { b_id: req.businessId, acc_name: oldInvoice.payment_mode, amt: oldInvoice.amount_paid });
            if (rpcError) throw rpcError;
          } catch (e) {
            const { data: acc } = await supabase.from('accounts').select('balance').eq('business_id', req.businessId).eq('name', oldInvoice.payment_mode).single();
            if (acc) await supabase.from('accounts').update({ balance: Number(acc.balance) - oldInvoice.amount_paid, last_updated: new Date().toISOString() }).eq('business_id', req.businessId).eq('name', oldInvoice.payment_mode);
          }
        }
      }

      // Recalculate payment status based on amounts to ensure integrity
      const finalAmountPaid = Number(amount_paid) || 0;
      let finalStatus = payment_status;
      if (finalAmountPaid <= 0) {
        finalStatus = 'unpaid';
      } else if (finalAmountPaid < Number(total_amount)) {
        finalStatus = 'partial';
      } else {
        finalStatus = 'paid';
      }

      // 2. Update Invoice
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          customer_id,
          subtotal,
          tax_amount,
          discount_amount,
          total_amount,
          payment_status: finalStatus,
          payment_mode,
          amount_paid: finalAmountPaid,
          cash_amount: cash_amount || 0,
          upi_amount: upi_amount || 0,
          created_at,
          pdf_url: pdf_url || null
        })
        .eq('id', req.params.id)
        .eq('business_id', req.businessId);
      
      if (updateError) throw updateError;

      // 3. Delete old items and add new ones (Parallelized)
      await supabase.from('invoice_items').delete().eq('invoice_id', req.params.id);
      
      const itemsToInsert = items.map((item: any) => ({
        business_id: req.businessId,
        invoice_id: req.params.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        discount_amount: item.discount || 0,
        total: item.total
      }));

      const itemInsertPromise = supabase.from('invoice_items').insert(itemsToInsert);

      // Branch: Stock updates
      const stockUpdatesPromise = Promise.all(items.map(async (item: any) => {
        try {
          const { error: rpcError } = await supabase.rpc('decrement_stock', { p_id: item.product_id, qty: item.quantity, b_id: req.businessId });
          if (rpcError) throw rpcError;
        } catch (e) {
          const { data: p } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
          if (p) await supabase.from('products').update({ stock_quantity: p.stock_quantity - item.quantity }).eq('id', item.product_id);
        }
      }));

      // 4. Update payments (Parallelized)
      const paidAmount = Number(amount_paid) || 0;
      const paymentUpdatePromise = (async () => {
        await supabase.from('payments').delete().eq('invoice_id', req.params.id);
        const tasks = [];

        if (paidAmount > 0) {
          if (payment_mode === 'both') {
            const cash = Number(cash_amount) || 0;
            const upi = Number(upi_amount) || 0;

            if (cash > 0) {
              tasks.push(supabase.from('payments').insert([{
                business_id: req.businessId,
                invoice_id: req.params.id,
                customer_id: customer_id || null,
                amount: cash,
                payment_mode: 'cash',
                payment_date: created_at
              }]));
              
              tasks.push(updateAccountBalance(req.businessId, 'cash', cash, 'increment'));
            }

            if (upi > 0) {
              tasks.push(supabase.from('payments').insert([{
                business_id: req.businessId,
                invoice_id: req.params.id,
                customer_id: customer_id || null,
                amount: upi,
                payment_mode: 'upi',
                payment_date: created_at
              }]));
              
              tasks.push(updateAccountBalance(req.businessId, 'upi', upi, 'increment'));
            }
          } else {
            tasks.push(supabase.from('payments').insert([{
              business_id: req.businessId,
              invoice_id: req.params.id,
              customer_id: customer_id || null,
              amount: paidAmount,
              payment_mode,
              payment_date: created_at
            }]));

            tasks.push(updateAccountBalance(req.businessId, payment_mode, paidAmount, 'increment'));
          }
        }
        await Promise.all(tasks);
      })();

      // 5. Update customer balance for the NEW customer
      const balanceToUpdate = total_amount - paidAmount;
      const customerUpdatePromise = (async () => {
        if (customer_id) {
          // Note: Here it's ADDING to balance (outstanding balance increases by unpaid portion)
          // Actually, our updateCustomerBalance helper does increment/decrement of the balance ITSELF.
          // In invoices, the outstanding balance increases by (TOTAL - PAID).
          const unpaid = total_amount - paidAmount;
          if (unpaid > 0) {
            await updateCustomerBalance(req.businessId, customer_id, unpaid, 'increment');
          } else if (unpaid < 0) {
            await updateCustomerBalance(req.businessId, customer_id, Math.abs(unpaid), 'decrement');
          }
        }
      })();

      // Await all parallel operations
      await Promise.all([itemInsertPromise, stockUpdatesPromise, paymentUpdatePromise, customerUpdatePromise]);

      // Trigger background PDF generation
      (async () => {
        try {
          const [{ data: business }, { data: fullInvoice }] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', req.businessId).single(),
            supabase.from('invoices').select('*, items:invoice_items(*)').eq('id', req.params.id).single()
          ]);
          
          if (business && fullInvoice) {
            await generateAndUploadInvoiceAssets(fullInvoice, business, supabase);
          }
        } catch (err) {
          console.error("Background asset generation failed:", err);
        }
      })().catch(() => {});

      res.json({ 
        id: req.params.id,
        invoice_number: oldInvoice.invoice_number,
        customer_id,
        business_id: req.businessId,
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        payment_status,
        payment_mode,
        pdf_url: pdf_url || null,
        created_at
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to update invoice" });
    }
  });

  app.patch("/api/invoices/:id/pdf-url", async (req: any, res) => {
    const { pdf_url } = req.body;
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ pdf_url })
        .eq('id', id)
        .eq('business_id', req.businessId);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to update PDF URL" });
    }
  });

  app.delete("/api/invoices/:id", async (req: any, res) => {
    try {
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', req.params.id)
        .eq('business_id', req.businessId)
        .single();
      
      if (invError || !invoice) throw new Error("Invoice not found");

      const { data: items } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', req.params.id);
      
      // Reverse stock
      if (items) {
        for (const item of items) {
          try {
            const { error: rpcError } = await supabase.rpc('increment_stock', { p_id: item.product_id, qty: item.quantity, b_id: req.businessId });
            if (rpcError) throw rpcError;
          } catch (e) {
            const { data: p } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
            if (p) await supabase.from('products').update({ stock_quantity: p.stock_quantity + item.quantity }).eq('id', item.product_id);
          }
        }
      }
      
      // Reverse customer balance and account balance
      const invoiceId = Number(req.params.id);
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, payment_mode')
        .eq('invoice_id', invoiceId);
      
      const paid = payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
      const unpaidBalance = Number(invoice.total_amount) - paid;
      
      if (invoice.customer_id) {
        if (unpaidBalance !== 0) {
          const action = unpaidBalance > 0 ? 'decrement' : 'increment';
          await updateCustomerBalance(req.businessId, invoice.customer_id, Math.abs(unpaidBalance), action);
        }
      }

      // Reverse account balance for each payment and delete them
      if (payments && payments.length > 0) {
        for (const p of payments) {
          await updateAccountBalance(req.businessId, p.payment_mode, p.amount, 'decrement');
        }
        await supabase.from('payments').delete().eq('invoice_id', invoiceId);
      }

      await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
      await supabase.from('invoices').delete().eq('id', invoiceId).eq('business_id', req.businessId);

      res.json({ success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to delete invoice" });
    }
  });

  // Purchases
  app.get("/api/purchases/last-number", async (req: any, res) => {
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('purchase_number')
        .eq('business_id', req.businessId)
        .order('id', { ascending: false })
        .limit(1);
      
      res.json({ lastNumber: data?.[0]?.purchase_number || null });
    } catch (error) {
      res.json({ lastNumber: null });
    }
  });

  app.get("/api/purchases", async (req: any, res) => {
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('business_id', req.businessId)
        .order('purchase_date', { ascending: false });
      
      if (error) throw error;
      
      const formattedData = data?.map(p => ({
        ...p,
        amount_paid: p.amount_paid !== undefined ? p.amount_paid : (p.total_amount - (p.balance_due || 0))
      }));

      res.json(formattedData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/purchases/:id/items", async (req: any, res) => {
    try {
      const { data, error } = await supabase
        .from('purchase_items')
        .select(`
          *,
          products (name)
        `)
        .eq('purchase_id', req.params.id);
      
      if (error) throw error;

      const formattedItems = data?.map(item => ({
        ...item,
        name: (item as any).products?.name
      }));

      res.json(formattedItems);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/purchases/:id/items", async (req: any, res) => {
    try {
      const { data, error } = await supabase
        .from('purchase_items')
        .select('*, products(name)')
        .eq('purchase_id', req.params.id)
        .eq('business_id', req.businessId);
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

    app.post("/api/purchases", async (req: any, res) => {
    try {
      const { 
        supplier_name, 
        purchase_number,
        invoice_number, 
        purchase_date,
        subtotal,
        tax_amount,
        discount_amount,
        additional_charges,
        total_amount, 
        amount_paid,
        balance_due,
        payment_status,
        payment_mode: raw_payment_mode, 
        items 
      } = req.body;

      const payment_mode = (raw_payment_mode === 'cash' || raw_payment_mode === 'upi' || raw_payment_mode === 'both') 
        ? raw_payment_mode 
        : (payment_status === 'unpaid' ? null : 'cash');
      
      const { data: purchase, error: pError } = await supabase
        .from('purchases')
        .insert([{
          business_id: req.businessId,
          supplier_name,
          purchase_number,
          invoice_number,
          purchase_date: purchase_date || new Date().toISOString().split('T')[0],
          subtotal: subtotal || 0,
          tax_amount: tax_amount || 0,
          discount_amount: discount_amount || 0,
          additional_charges: additional_charges || 0,
          total_amount,
          amount_paid: Number(amount_paid) || 0,
          balance_due: balance_due || 0,
          payment_status: payment_status || 'paid',
          payment_mode
        }])
        .select()
        .single();

      if (pError) throw pError;
      const purchaseId = purchase.id;

      if (items && items.length > 0) {
        // Parallelized Item Insertion and Stock Updates
        const itemInsertions = items.map((item: any) => ({
          business_id: req.businessId,
          purchase_id: purchaseId,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          total: item.total
        }));
        
        const itemInsertPromise = supabase.from('purchase_items').insert(itemInsertions);

        const stockUpdatePromise = Promise.all(items.map(async (item: any) => {
          try {
            const { error: rpcError } = await supabase.rpc('increment_stock', {
              p_id: item.product_id,
              qty: item.quantity,
              b_id: req.businessId
            });
            if (rpcError) throw rpcError;
          } catch (e) {
            const { data: p } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
            if (p) await supabase.from('products').update({ stock_quantity: p.stock_quantity + item.quantity }).eq('id', item.product_id);
          }
        }));

        await Promise.all([itemInsertPromise, stockUpdatePromise]);
      }

      // Update account balance if paid
      const paidAmount = amount_paid !== undefined ? Number(amount_paid) : (payment_status === 'paid' ? total_amount : (total_amount - (balance_due || 0)));
      
      if (payment_mode && paidAmount > 0) {
        await updateAccountBalance(req.businessId, payment_mode, paidAmount, 'decrement');
      }

      res.json({ id: purchaseId });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to record purchase" });
    }
  });

  app.delete("/api/purchases/:id", async (req: any, res) => {
    const { id } = req.params;
    const businessId = req.businessId;

    try {
      // 1. Get purchase details and items
      const { data: purchase, error: pError } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', id)
        .eq('business_id', businessId)
        .single();

      if (pError || !purchase) throw new Error("Purchase not found or unauthorized");

      const { data: items, error: iError } = await supabase
        .from('purchase_items')
        .select('*')
        .eq('purchase_id', id);

      if (iError) throw iError;

      // 2. Reverse stock updates
      if (items && items.length > 0) {
        for (const item of items) {
          try {
            const { error: rpcError } = await supabase.rpc('decrement_stock', {
              p_id: item.product_id,
              qty: item.quantity,
              b_id: businessId
            });
            if (rpcError) throw rpcError;
          } catch (e) {
            const { data: p } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
            if (p) {
              await supabase.from('products').update({ stock_quantity: p.stock_quantity - item.quantity }).eq('id', item.product_id);
            }
          }
        }
      }

      // 3. Reverse account balance update
      const paidAmount = purchase.amount_paid || (purchase.total_amount - (purchase.balance_due || 0));
      if (purchase.payment_mode && paidAmount > 0) {
        try {
          const { error: rpcError } = await supabase.rpc('increment_account_balance', {
            b_id: businessId,
            acc_name: purchase.payment_mode,
            amt: paidAmount
          });
          if (rpcError) throw rpcError;
        } catch (e) {
          const { data: acc } = await supabase.from('accounts').select('balance').eq('business_id', businessId).eq('name', purchase.payment_mode).single();
          if (acc) {
            await supabase.from('accounts').update({ balance: Number(acc.balance) + paidAmount, last_updated: new Date().toISOString() }).eq('business_id', businessId).eq('name', purchase.payment_mode);
          }
        }
      }

      // 4. Delete purchase items then purchase
      await supabase.from('purchase_items').delete().eq('purchase_id', id);
      const { error: deleteError } = await supabase.from('purchases').delete().eq('id', id);
      if (deleteError) throw deleteError;

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete purchase error:", error);
      res.status(500).json({ error: error.message || "Failed to delete purchase" });
    }
  });

  app.put("/api/purchases/:id", async (req: any, res) => {
    const { id } = req.params;
    const businessId = req.businessId;
    const { 
      supplier_name, 
      purchase_number,
      invoice_number, 
      purchase_date,
      subtotal,
      tax_amount,
      discount_amount,
      additional_charges,
      total_amount, 
      amount_paid,
      balance_due,
      payment_status,
      payment_mode: raw_payment_mode, 
      items 
    } = req.body;

    const payment_mode = (raw_payment_mode === 'cash' || raw_payment_mode === 'upi' || raw_payment_mode === 'both') 
      ? raw_payment_mode 
      : (payment_status === 'unpaid' ? null : 'cash');

    try {
      // 1. Get old purchase details and items
      const { data: oldPurchase, error: pError } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', id)
        .eq('business_id', businessId)
        .single();

      if (pError || !oldPurchase) throw new Error("Purchase not found or unauthorized");

      const { data: oldItems, error: iError } = await supabase
        .from('purchase_items')
        .select('*')
        .eq('purchase_id', id);

      if (iError) throw iError;

      // 2. Reverse old stock updates (Parallelized)
      if (oldItems && oldItems.length > 0) {
        await Promise.all(oldItems.map(async (item: any) => {
          try {
            const { error: rpcError } = await supabase.rpc('decrement_stock', {
              p_id: item.product_id,
              qty: item.quantity,
              b_id: businessId
            });
            if (rpcError) throw rpcError;
          } catch (e) {
            const { data: p } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
            if (p) await supabase.from('products').update({ stock_quantity: p.stock_quantity - item.quantity }).eq('id', item.product_id);
          }
        }));
      }

      // 3. Reverse old account balance update
      const oldPaidAmount = oldPurchase.amount_paid || (oldPurchase.total_amount - (oldPurchase.balance_due || 0));
      if (oldPurchase.payment_mode && oldPaidAmount > 0) {
        try {
          const { error: rpcError } = await supabase.rpc('increment_account_balance', {
            b_id: businessId,
            acc_name: oldPurchase.payment_mode,
            amt: oldPaidAmount
          });
          if (rpcError) throw rpcError;
        } catch (e) {
          const { data: acc } = await supabase.from('accounts').select('balance').eq('business_id', businessId).eq('name', oldPurchase.payment_mode).single();
          if (acc) {
            await supabase.from('accounts').update({ balance: Number(acc.balance) + oldPaidAmount, last_updated: new Date().toISOString() }).eq('business_id', businessId).eq('name', oldPurchase.payment_mode);
          }
        }
      }

      // 4. Update purchase record
      const { data: updatedPurchase, error: updateError } = await supabase
        .from('purchases')
        .update({
          supplier_name,
          purchase_number,
          invoice_number,
          purchase_date,
          subtotal: subtotal || 0,
          tax_amount: tax_amount || 0,
          discount_amount: discount_amount || 0,
          additional_charges: additional_charges || 0,
          total_amount,
          amount_paid: Number(amount_paid) || 0,
          balance_due: balance_due || 0,
          payment_status: payment_status || 'paid',
          payment_mode
        })
        .eq('id', id)
        .eq('business_id', businessId)
        .select()
        .single();

      if (updateError) throw updateError;

      // 5. Delete old items and insert new ones (Parallelized)
      await supabase.from('purchase_items').delete().eq('purchase_id', id);
      
      if (items && items.length > 0) {
        const itemInsertions = items.map((item: any) => ({
          business_id: businessId,
          purchase_id: id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          total: item.total
        }));
        
        const insertPromise = supabase.from('purchase_items').insert(itemInsertions);

        const stockPromise = Promise.all(items.map(async (item: any) => {
          try {
            const { error: rpcError } = await supabase.rpc('increment_stock', {
              p_id: item.product_id,
              qty: item.quantity,
              b_id: businessId
            });
            if (rpcError) throw rpcError;
          } catch (e) {
            const { data: p } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
            if (p) await supabase.from('products').update({ stock_quantity: p.stock_quantity + item.quantity }).eq('id', item.product_id);
          }
        }));

        await Promise.all([insertPromise, stockPromise]);
      }

      // 6. Apply new account balance update
      const newPaidAmount = amount_paid !== undefined ? Number(amount_paid) : (payment_status === 'paid' ? total_amount : (total_amount - (balance_due || 0)));
      if (payment_mode && newPaidAmount > 0) {
        try {
          const { error: rpcError } = await supabase.rpc('decrement_account_balance', {
            b_id: businessId,
            acc_name: payment_mode,
            amt: newPaidAmount
          });
          if (rpcError) throw rpcError;
        } catch (e) {
          const { data: acc } = await supabase.from('accounts').select('balance').eq('business_id', businessId).eq('name', payment_mode).single();
          if (acc) {
            await supabase.from('accounts').update({ balance: Number(acc.balance) - newPaidAmount, last_updated: new Date().toISOString() }).eq('business_id', businessId).eq('name', payment_mode);
          }
        }
      }

      res.json(updatedPurchase);
    } catch (error: any) {
      console.error("Update purchase error:", error);
      res.status(500).json({ error: error.message || "Failed to update purchase" });
    }
  });

  // Customer Payments (Payment In)
  app.get("/api/payments", async (req: any, res) => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          customers (name),
          invoices (invoice_number)
        `)
        .eq('business_id', req.businessId)
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      
      const formattedData = data?.map(p => ({
        ...p,
        customer_name: (p as any).customers?.name || 'General / Walk-in',
        invoice_number: (p as any).invoices?.invoice_number
      }));

      res.json(formattedData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/payments/:id", async (req: any, res) => {
    const { id } = req.params;
    const businessId = req.businessId;

    try {
      // 1. Get payment details
      const { data: payment, error: pError } = await supabase
        .from('payments')
        .select(`
          *,
          customers (business_id)
        `)
        .eq('id', id)
        .single();

      if (pError || !payment) throw new Error("Payment not found or unauthorized");

      // 2. Reverse account balance
      await updateAccountBalance(businessId, payment.payment_mode, payment.amount, 'decrement');

      // 3. Reverse customer balance
      if (payment.customer_id) {
        await updateCustomerBalance(businessId, payment.customer_id, payment.amount, 'increment');
      }

      // 4. If linked to an invoice, reverse invoice status
      if (payment.invoice_id) {
        const { data: invoice } = await supabase.from('invoices').select('total_amount').eq('id', payment.invoice_id).single();
        
        if (invoice) {
          const { data: otherPayments } = await supabase.from('payments').select('amount').eq('invoice_id', payment.invoice_id).neq('id', id);
          const totalPaid = otherPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
          
          let newStatus = 'unpaid';
          if (totalPaid > 0) {
            newStatus = totalPaid >= invoice.total_amount ? 'paid' : 'partial';
          }
          await supabase.from('invoices').update({ 
            payment_status: newStatus,
            amount_paid: totalPaid 
          }).eq('id', payment.invoice_id);
        }
      }

      // 5. Delete the payment
      await supabase.from('payments').delete().eq('id', id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete payment error:", error);
      res.status(500).json({ error: error.message || "Failed to delete payment" });
    }
  });

  app.put("/api/payments/:id", async (req: any, res) => {
    const { id } = req.params;
    const { amount, payment_mode, payment_date, transaction_reference, notes } = req.body;
    const businessId = req.businessId;

    try {
      // 1. Get old payment details
      const { data: oldPayment, error: pError } = await supabase
        .from('payments')
        .select(`
          *,
          customers (business_id)
        `)
        .eq('id', id)
        .single();

      if (pError || !oldPayment) throw new Error("Payment not found or unauthorized");

      // 2. Reverse old values
      await updateAccountBalance(businessId, oldPayment.payment_mode, oldPayment.amount, 'decrement');
      await updateCustomerBalance(businessId, oldPayment.customer_id, oldPayment.amount, 'increment');

      // 3. Apply new values
      await updateAccountBalance(businessId, payment_mode, amount, 'increment');
      await updateCustomerBalance(businessId, oldPayment.customer_id, amount, 'decrement');

      // 4. Update payment record
      await supabase.from('payments').update({
        amount,
        payment_mode,
        payment_date,
        transaction_reference,
        notes
      }).eq('id', id);

      // 5. If linked to an invoice, update invoice status
      if (oldPayment.invoice_id) {
        const { data: invoice } = await supabase.from('invoices').select('total_amount').eq('id', oldPayment.invoice_id).single();
        if (invoice) {
          const { data: payments } = await supabase.from('payments').select('amount').eq('invoice_id', oldPayment.invoice_id);
          const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
          
          let newStatus = 'unpaid';
          if (totalPaid > 0) {
            newStatus = totalPaid >= invoice.total_amount ? 'paid' : 'partial';
          }
          await supabase.from('invoices').update({ 
            payment_status: newStatus,
            amount_paid: totalPaid
          }).eq('id', oldPayment.invoice_id);
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Update payment error:", error);
      res.status(500).json({ error: error.message || "Failed to update payment" });
    }
  });

  app.post("/api/payments/customer", async (req: any, res) => {
    const { customer_id, amount, payment_mode, payment_date, notes, settlements, cash_amount, upi_amount } = req.body;
    
    try {
      const results = [];
      const totalAmount = payment_mode === 'both' ? (Number(cash_amount) + Number(upi_amount)) : Number(amount);

      // Helper to record a payment and update account balance
      const recordPayment = async (amt: number, mode: string, invId?: number, customNotes?: string) => {
        const { data: payment, error: pError } = await supabase
          .from('payments')
          .insert([{
            business_id: req.businessId,
            customer_id,
            invoice_id: invId,
            amount: amt,
            payment_mode: mode,
            payment_date: payment_date || new Date().toISOString(),
            notes: customNotes || notes
          }])
          .select()
          .single();
        
        if (pError) throw pError;
        
        // Update Account Balance
        await updateAccountBalance(req.businessId, mode, amt, 'increment');
        
        return payment;
      };

      let remainingCash = payment_mode === 'both' ? Number(cash_amount) : (payment_mode === 'cash' ? totalAmount : 0);
      let remainingUpi = payment_mode === 'both' ? Number(upi_amount) : (payment_mode === 'upi' ? totalAmount : 0);

      if (settlements && Array.isArray(settlements) && settlements.length > 0) {
        for (const settlement of settlements) {
          const { invoice_id, amount: settlementAmount } = settlement;
          let amtToSettle = Number(settlementAmount);
          if (amtToSettle <= 0) continue;

          // Split settlement between cash and upi if needed
          if (payment_mode === 'both') {
            const fromCash = Math.min(amtToSettle, remainingCash);
            if (fromCash > 0) {
              results.push(await recordPayment(fromCash, 'cash', invoice_id, `Settlement for invoice #${invoice_id} (Cash part). ${notes || ''}`));
              remainingCash -= fromCash;
              amtToSettle -= fromCash;
            }
            
            const fromUpi = Math.min(amtToSettle, remainingUpi);
            if (fromUpi > 0) {
              results.push(await recordPayment(fromUpi, 'upi', invoice_id, `Settlement for invoice #${invoice_id} (UPI part). ${notes || ''}`));
              remainingUpi -= fromUpi;
              amtToSettle -= fromUpi;
            }
          } else {
            results.push(await recordPayment(amtToSettle, payment_mode, invoice_id, `Settlement for invoice #${invoice_id}. ${notes || ''}`));
            if (payment_mode === 'cash') remainingCash -= amtToSettle;
            else remainingUpi -= amtToSettle;
          }

          // Update invoice status
          const { data: invoice } = await supabase.from('invoices').select('total_amount').eq('id', invoice_id).single();
          const { data: payments } = await supabase.from('payments').select('amount').eq('invoice_id', invoice_id);
          const paidSoFar = payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
          
          let status = 'unpaid';
          if (paidSoFar > 0) {
            status = paidSoFar >= Number(invoice.total_amount) ? 'paid' : 'partial';
          }
          
          await supabase.from('invoices').update({ 
            payment_status: status,
            amount_paid: paidSoFar
          }).eq('id', invoice_id);
        }
      }

      // Handle general payments (if no settlements were provided OR if there are remaining amounts)
      if (payment_mode === 'both') {
        if (remainingCash > 0) {
          results.push(await recordPayment(remainingCash, 'cash', undefined, notes));
        }
        if (remainingUpi > 0) {
          results.push(await recordPayment(remainingUpi, 'upi', undefined, notes));
        }
      } else {
        const leftover = payment_mode === 'cash' ? remainingCash : remainingUpi;
        if (leftover > 0) {
          results.push(await recordPayment(leftover, payment_mode, undefined, notes));
        }
      }

      // Update customer's total outstanding balance (always if customer_id is provided)
      if (customer_id && totalAmount > 0) {
        await updateCustomerBalance(req.businessId, customer_id, totalAmount, 'decrement');
      }

      res.json(results[0] || { success: true });
    } catch (error: any) {
      console.error('Error recording payment:', error);
      res.status(500).json({ error: error.message || 'Failed to record payment' });
    }
  });

  // Customer Invoices
  app.get("/api/customers/:id/invoices", async (req: any, res) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', req.params.id)
        .eq('business_id', req.businessId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Get payments for these invoices to calculate amount_paid
      const invoiceIds = data?.map(i => i.id) || [];
      const { data: payments } = await supabase
        .from('payments')
        .select('invoice_id, amount')
        .in('invoice_id', invoiceIds)
        .eq('business_id', req.businessId);

      const paymentsMap: any = {};
      payments?.forEach(p => {
        if (p.invoice_id) {
          paymentsMap[p.invoice_id] = (paymentsMap[p.invoice_id] || 0) + p.amount;
        }
      });

      const formattedData = data?.map(i => ({
        ...i,
        amount_paid: paymentsMap[i.id] || 0
      }));
      
      res.json(formattedData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/reports/monthly-summary", async (req: any, res) => {
    const { month } = req.query; // Format: YYYY-MM
    if (!month) return res.status(400).json({ error: "Month is required" });

    const monthStart = `${month}-01T00:00:00+05:30`;
    const nextMonthDate = new Date(month as string + '-01');
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const monthEnd = `${nextMonthStr}-01T00:00:00+05:30`;

    try {
      // 1. Sales (Payments received)
      const { data: sales } = await supabase
        .from('payments')
        .select('amount, payment_mode')
        .eq('business_id', req.businessId)
        .gte('payment_date', monthStart)
        .lt('payment_date', monthEnd);

      // 2. Goods (Purchases)
      const { data: purchases } = await supabase
        .from('purchases')
        .select('total_amount, payment_mode')
        .eq('business_id', req.businessId)
        .gte('purchase_date', monthStart)
        .lt('purchase_date', monthEnd);

      // 3. Expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, payment_mode')
        .eq('business_id', req.businessId)
        .gte('expense_date', monthStart)
        .lt('expense_date', monthEnd);

      const summary = {
        sales: { cash: 0, upi: 0 },
        goods: { cash: 0, upi: 0 },
        expenses: { cash: 0, upi: 0 },
        stillHave: { cash: 0, upi: 0 }
      };

      sales?.forEach((s: any) => {
        if (s.payment_mode === 'cash') summary.sales.cash += s.amount;
        else summary.sales.upi += s.amount;
      });

      purchases?.forEach((p: any) => {
        if (p.payment_mode === 'cash') summary.goods.cash += p.total_amount;
        else summary.goods.upi += p.total_amount;
      });

      expenses?.forEach((e: any) => {
        if (e.payment_mode === 'cash') summary.expenses.cash += e.amount;
        else summary.expenses.upi += e.amount;
      });

      summary.stillHave.cash = summary.sales.cash - summary.goods.cash - summary.expenses.cash;
      summary.stillHave.upi = summary.sales.upi - summary.goods.upi - summary.expenses.upi;

      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Business Profile API
  app.get("/api/business/:id", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', req.params.id)
        .single();
      
      if (error) {
        if (error.code === '42P01') {
          return res.status(500).json({ 
            error: `Database table missing: ${error.message}. Please run the SQL schema in Supabase.`,
            code: error.code
          });
        }
        return res.status(500).json({ error: error.message });
      }
      res.json(data);
    } catch (error: any) {
      console.error("[GET /api/business/:id] Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch business profile" });
    }
  });

  app.put("/api/business/:id", async (req, res) => {
    const { username, business_name, owner_name, email, phone, address, gstin, logo_url, esign_url, invoice_terms, invoice_theme_color, invoice_theme, instagram_id } = req.body;
    const id = req.params.id;
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id, 
          username,
          business_name, 
          owner_name, 
          email, 
          phone, 
          address, 
          gstin, 
          logo_url, 
          esign_url, 
          invoice_terms, 
          invoice_theme_color, 
          invoice_theme, 
          instagram_id,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("Update business error:", error);
      res.status(500).json({ error: error.message || "Failed to update business profile" });
    }
  });

  app.get("/api/business", async (req: any, res) => {
    // Prefer businessId from header/middleware, fallback to query for public/admin if needed
    const id = req.businessId || req.query.id;
    if (!id) return res.status(400).json({ error: "Business ID required" });

    // Validate UUID format
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUUID) {
      console.warn(`Warning: ID ${id} is not a valid UUID. This might cause issues with Supabase.`);
    }

    try {
      console.log(`[GET /api/business] Fetching profile for ID: ${id}`);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01') { // Not found or table doesn't exist
          console.log(`[GET /api/business] Profile not found for ${id}, attempting to create default...`);
          
          // Log the key type being used for the insert
          const isUsingServiceKey = !!supabaseServiceKey;
          const keyLength = supabaseServiceKey ? supabaseServiceKey.length : 0;
          console.log(`[GET /api/business] Using ${isUsingServiceKey ? 'SERVICE_ROLE' : 'ANON'} key for insert. Key length: ${keyLength}`);
          
          if (isUsingServiceKey && keyLength < 100) {
            console.warn("WARNING: SUPABASE_SERVICE_ROLE_KEY seems too short. Are you sure it's the service_role key and not the anon key?");
          }

          // Create a default profile for the new user
          const { data: newUser, error: createError } = await supabase
            .from('profiles')
            .insert([{ 
              id, 
              business_name: 'My Business',
              owner_name: 'Business Owner',
              phone: null, 
              invoice_theme: 'gst',
              invoice_theme_color: '#4f46e5',
              invoice_terms: 'No Return, No Exchange',
              updated_at: new Date().toISOString()
            }])
            .select()
            .single();
          
          if (createError) {
            console.error("[GET /api/business] Error creating default profile:", {
              message: createError.message,
              code: createError.code,
              details: createError.details,
              hint: createError.hint
            });
            
            if (createError.message.includes('row-level security policy')) {
              return res.status(500).json({ 
                error: "Configuration Error", 
                message: "The server is missing the SUPABASE_SERVICE_ROLE_KEY or the key is incorrect. This key is required to create new business profiles.",
                hint: "Please add SUPABASE_SERVICE_ROLE_KEY to your Vercel Environment Variables. You can find it in Supabase > Settings > API > service_role key."
              });
            }
            throw createError;
          }

          console.log(`[GET /api/business] Default profile created for ${id}. Initializing accounts...`);
          // Initialize default accounts using robust helper
          await ensureDefaultAccounts(id);
          
          return res.json(newUser);
        }
        throw error;
      }
      console.log(`[GET /api/business] Profile found for ${id}.`);
      res.json(data);
    } catch (error: any) {
      console.error("[GET /api/business] Final error catch:", error);
      
      let message = error.message || "Failed to fetch business profile";
      if (error.code === '42P01') {
        message = `Database table missing: ${error.message}. Please run the SQL schema in Supabase.`;
      } else if (error.message?.includes('row-level security policy')) {
        message = "Supabase RLS policy violation. Please ensure SUPABASE_SERVICE_ROLE_KEY is correctly set in Vercel secrets.";
      }
      
      res.status(500).json({ 
        error: message,
        code: error.code,
        details: error.details,
        hint: "If you see RLS errors, ensure SUPABASE_SERVICE_ROLE_KEY is set in your environment variables. Check the server logs for 'Supabase Initialization Debug' to verify the key is loaded."
      });
    }
  });

  app.delete("/api/business/:id/account", async (req: any, res) => {
    const { id } = req.params;
    if (id !== req.businessId) return res.status(403).json({ error: "Unauthorized" });

    try {
      // 1. Delete the profile (this should cascade if using the provided schema)
      // We use the active Supabase client which has service role if configured
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (profileError) throw profileError;

      // 2. Also try to clean up other tables just in case cascade is missing
      const tables = [
        'customers', 'products', 'invoices', 'invoice_items', 
        'purchases', 'purchase_items', 'expenses', 'accounts', 
        'payments', 'quotations', 'quotation_items', 'payment_vouchers'
      ];
      for (const table of tables) {
        try {
          // Supabase query builder is thenable but might not have .catch() directly before execution
          await supabase.from(table).delete().eq('business_id', id);
        } catch (cleanupError) {
          console.warn(`Manual cleanup for table ${table} failed:`, cleanupError);
        }
      }

      // 3. Attempt to delete the auth user (requires service role)
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { error: authError } = await supabase.auth.admin.deleteUser(id);
        if (authError) console.warn("Auth deletion failed:", authError.message);
      }

      res.json({ success: true, message: "Account and all associated data deleted successfully." });
    } catch (error: any) {
      console.error("[DELETE /api/business/:id/account] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reports
  app.get("/api/reports/sales", async (req: any, res) => {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: "Month is required" });

    try {
      // Define boundaries in IST
      const monthStart = `${month}-01T00:00:00+05:30`;
      const nextMonthDate = new Date(month as string + '-01');
      nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
      const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
      const monthEnd = `${nextMonthStr}-01T00:00:00+05:30`;

      // Current Month Data
      const { data: currentData } = await supabase
        .from('payments')
        .select('payment_date, amount')
        .eq('business_id', req.businessId)
        .gte('payment_date', monthStart)
        .lt('payment_date', monthEnd);
      
      // Calculate Previous Month
      const [year, monthNum] = (month as string).split('-').map(Number);
      const prevDate = new Date(year, monthNum - 2, 1);
      const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      const prevMonthStart = `${prevMonthStr}-01T00:00:00+05:30`;
      const prevMonthEnd = monthStart;

      // Previous Month Data
      const { data: prevData } = await supabase
        .from('payments')
        .select('payment_date, amount')
        .eq('business_id', req.businessId)
        .gte('payment_date', prevMonthStart)
        .lt('payment_date', prevMonthEnd);
      
      // Group by date (adjusted for IST)
      const groupData = (data: any[]) => {
        const groups: { [key: string]: number } = {};
        data.forEach(p => {
          const istDate = getISTDate(p.payment_date);
          const date = istDate.split('T')[0];
          groups[date] = (groups[date] || 0) + p.amount;
        });
        return Object.entries(groups).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date));
      };

      res.json({
        current: groupData(currentData || []),
        previous: groupData(prevData || []),
        prevMonthLabel: prevMonthStr
      });
    } catch (error: any) {
      console.error("Sales report error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/reports/yearly-stats", async (req: any, res) => {
    try {
      const { businessId } = req;
      if (!businessId) return res.status(400).json({ error: "Business ID required" });

      const now = new Date();
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(now.getMonth() - 11);
      twelveMonthsAgo.setDate(1);
      const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().split('T')[0];

      const { data: invoices, error: invError } = await supabase
        .from('invoices')
        .select('total_amount, created_at')
        .eq('business_id', businessId)
        .gte('created_at', twelveMonthsAgoStr);

      if (invError) throw invError;

      const { data: payments, error: payError } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .eq('business_id', businessId)
        .gte('payment_date', twelveMonthsAgoStr);

      if (payError) throw payError;

      const monthlyData: Record<string, { total: number, collection: number }> = {};
      
      // Initialize last 12 months in IST
      for (let i = 0; i < 12; i++) {
        const d = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
        d.setUTCMonth(d.getUTCMonth() - i);
        const monthKey = d.toISOString().slice(0, 7); // YYYY-MM
        monthlyData[monthKey] = { total: 0, collection: 0 };
      }

      invoices?.forEach(inv => {
        const monthKey = getISTDate(inv.created_at).slice(0, 7);
        if (monthlyData[monthKey] !== undefined) {
          monthlyData[monthKey].total += (inv.total_amount || 0);
        }
      });

      payments?.forEach(pay => {
        const monthKey = getISTDate(pay.payment_date).slice(0, 7);
        if (monthlyData[monthKey] !== undefined) {
          monthlyData[monthKey].collection += (pay.amount || 0);
        }
      });

      const result = Object.entries(monthlyData)
        .map(([month, data]) => ({ 
          month, 
          total: data.total,
          collection: data.collection 
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/reports/detailed-transactions", async (req: any, res) => {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: "Month is required" });

    try {
      const monthStart = `${month}-01T00:00:00+05:30`;
      const nextMonthDate = new Date(month as string + '-01');
      nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
      const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
      const monthEnd = `${nextMonthStr}-01T00:00:00+05:30`;

      const { data: payments, error } = await supabase
        .from('payments')
        .select(`
          id, amount, payment_date, payment_mode,
          customers (name),
          invoices (invoice_number)
        `)
        .eq('business_id', req.businessId)
        .gte('payment_date', monthStart)
        .lt('payment_date', monthEnd);
      
      if (error) throw error;

      const formatted = payments?.map((p: any) => ({
        type: 'payment',
        id: p.id,
        reference: p.invoices?.invoice_number || 'Direct',
        customer_name: p.customers?.name || 'General / Walk-in',
        amount: p.amount,
        date: getISTDate(p.payment_date),
        status: p.payment_mode
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json(formatted);
    } catch (error: any) {
      console.error("Detailed transactions report error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Expenses API
  app.get("/api/expenses", async (req: any, res) => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('business_id', req.businessId)
        .order('expense_date', { ascending: false });
      
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/expenses", async (req: any, res) => {
    const { category, description, amount, payment_mode: raw_payment_mode, expense_date } = req.body;
    
    const payment_mode = (raw_payment_mode === 'cash' || raw_payment_mode === 'upi' || raw_payment_mode === 'both') 
      ? raw_payment_mode 
      : 'cash';
    
    try {
      const { data: expense, error } = await supabase
        .from('expenses')
        .insert([{
          business_id: req.businessId,
          category,
          description,
          amount,
          payment_mode,
          expense_date: expense_date || new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;

      // Update account balance
      await updateAccountBalance(req.businessId, payment_mode, amount, 'decrement');

      res.json(expense);
    } catch (error: any) {
      console.error('Error recording expense:', error);
      res.status(500).json({ error: error.message || 'Failed to record expense' });
    }
  });

  app.delete("/api/expenses/:id", async (req: any, res) => {
    try {
      const { data: expense } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', req.params.id)
        .eq('business_id', req.businessId)
        .single();
      
      if (expense) {
        // Reverse account balance
      // Reverse account balance
      if (expense) {
        await updateAccountBalance(req.businessId, expense.payment_mode, expense.amount, 'increment');
      }

      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', req.params.id)
        .eq('business_id', req.businessId);
        
        if (error) throw error;
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      res.status(500).json({ error: error.message || 'Failed to delete expense' });
    }
  });

  app.get("/api/accounts", async (req: any, res) => {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('business_id', req.businessId);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/reports/stats", async (req: any, res) => {
    const { month } = req.query;
    const businessId = req.businessId;

    try {
      // 1. Per Product Profit
      // We need to fetch invoice items and products to calculate profit
      const { data: items } = await supabase
        .from('invoice_items')
        .select(`
          quantity, price,
          products!inner (name, purchase_price, business_id)
        `)
        .eq('products.business_id', businessId);
      
      const productProfits: { [key: string]: number } = {};
      items?.forEach((item: any) => {
        if (item.products) {
          const profit = (item.price - (item.products.purchase_price || 0)) * item.quantity;
          productProfits[item.products.name] = (productProfits[item.products.name] || 0) + profit;
        }
      });

      const perProductProfit = Object.entries(productProfits)
        .map(([name, profit]) => ({ name, profit }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5);

      // 2. Monthly Sale Report (Last 6 months)
      // Fetch invoices and payments
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, total_amount, created_at')
        .eq('business_id', businessId);
      
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, payment_date, invoice_id')
        .eq('business_id', businessId);

      const monthlySales: { [key: string]: number } = {};
      
      invoices?.forEach(inv => {
        const istDate = getISTDate(inv.created_at);
        const m = istDate.substring(0, 7); // YYYY-MM
        monthlySales[m] = (monthlySales[m] || 0) + inv.total_amount;
      });

      // Add payments that are not linked to invoices or linked to invoices from previous months
      payments?.forEach(p => {
        const istDate = getISTDate(p.payment_date);
        const m = istDate.substring(0, 7); // YYYY-MM
        if (!p.invoice_id) {
          monthlySales[m] = (monthlySales[m] || 0) + p.amount;
        } else {
          const inv = invoices?.find(i => i.id === p.invoice_id);
          const invM = inv ? getISTDate(inv.created_at).substring(0, 7) : null;
          if (inv && invM && invM < m) {
            monthlySales[m] = (monthlySales[m] || 0) + p.amount;
          }
        }
      });

      const monthlySaleReport = Object.entries(monthlySales)
        .map(([month, total]) => ({ month, total }))
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 6);

      // 3. Top Category
      const { data: products } = await supabase
        .from('products')
        .select('category')
        .eq('business_id', businessId);
      
      const categories: { [key: string]: number } = {};
      products?.forEach(p => {
        if (p.category) categories[p.category] = (categories[p.category] || 0) + 1;
      });

      const topCategory = Object.entries(categories)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      res.json({
        perProductProfit,
        monthlySaleReport,
        topCategory
      });
    } catch (error: any) {
      console.error("Stats error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/reports/detailed-product-profit", async (req: any, res) => {
    const { month } = req.query;
    const businessId = req.businessId;

    try {
      let query = supabase
        .from('invoice_items')
        .select(`
          quantity, price, discount_amount, total,
          invoices!inner (created_at),
          products (name, purchase_price)
        `)
        .eq('business_id', businessId);

      if (month) {
        const monthStart = `${month}-01T00:00:00+05:30`;
        const nextMonthDate = new Date(month + '-01');
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
        const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
        const monthEnd = `${nextMonthStr}-01T00:00:00+05:30`;
        
        query = query.gte('invoices.created_at', monthStart)
                     .lt('invoices.created_at', monthEnd);
      }

      const { data: items, error } = await query;
      if (error) throw error;

      const detailedProfit = (items || []).filter((item: any) => {
        const inv = Array.isArray(item.invoices) ? item.invoices[0] : item.invoices;
        const prod = Array.isArray(item.products) ? item.products[0] : item.products;
        return inv && prod;
      }).map((item: any) => {
        const inv = Array.isArray(item.invoices) ? item.invoices[0] : item.invoices;
        const prod = Array.isArray(item.products) ? item.products[0] : item.products;
        
        const quantity = Number(item.quantity) || 0;
        const total = Number(item.total) || 0;
        const sellingPriceAfterDiscount = quantity > 0 ? total / quantity : 0;
        const purchasePrice = Number(prod?.purchase_price) || 0;
        const profitPerUnit = sellingPriceAfterDiscount - purchasePrice;
        const totalProfit = profitPerUnit * quantity;

        return {
          date: getISTDate(inv?.created_at),
          product_name: prod?.name,
          quantity: quantity,
          selling_price_after_discount: sellingPriceAfterDiscount,
          purchase_price: purchasePrice,
          profit_per_unit: profitPerUnit,
          total_profit: totalProfit
        };
      });

      res.json(detailedProfit);
    } catch (error: any) {
      console.error("Detailed profit report error:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        stack: error.stack
      });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/reports/monthly-invoices/:month", async (req: any, res) => {
    const { month } = req.params; // Format: YYYY-MM
    const monthStart = `${month}-01T00:00:00+05:30`;
    const nextMonthDate = new Date(month + '-01');
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const monthEnd = `${nextMonthStr}-01T00:00:00+05:30`;

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (name)
        `)
        .eq('business_id', req.businessId)
        .gte('created_at', monthStart)
        .lt('created_at', monthEnd)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      const formattedData = data?.map(i => ({
        ...i,
        customer_name: (i as any).customers?.name
      }));

      // Get payments for these invoices to calculate amount_paid
      const invoiceIds = formattedData?.map(i => i.id) || [];
      const { data: payments } = await supabase
        .from('payments')
        .select('invoice_id, amount')
        .in('invoice_id', invoiceIds)
        .eq('business_id', req.businessId);

      const paymentsMap: any = {};
      payments?.forEach(p => {
        if (p.invoice_id) {
          paymentsMap[p.invoice_id] = (paymentsMap[p.invoice_id] || 0) + p.amount;
        }
      });

      const finalData = formattedData?.map(i => ({
        ...i,
        amount_paid: paymentsMap[i.id] || 0
      }));

      res.json(finalData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PDF/PNG Generation Helper
  async function generateAndUploadInvoiceAssets(invoice: any, business: any, supabase: any) {
    let browser;
    try {
      console.log(`Generating assets for invoice ${invoice.invoice_number}...`);
      
      const html = getInvoiceHTMLForBackend(invoice, business);
      
      // Dynamic import for puppeteer to prevent startup crashes on Vercel
      let puppeteer;
      let executablePath;
      
      if (process.env.VERCEL) {
        // Vercel environment
        const chromium = (await import("@sparticuz/chromium")).default;
        puppeteer = (await import("puppeteer-core")).default;
        executablePath = await chromium.executablePath();
      } else {
        // Local environment
        puppeteer = (await import("puppeteer")).default;
      }
      
      browser = await puppeteer.launch({
        args: process.env.VERCEL ? (await import("@sparticuz/chromium")).default.args : ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: executablePath,
        headless: process.env.VERCEL ? (await import("@sparticuz/chromium")).default.headless : true
      });
      
      const page = await browser.newPage();
      // Use a larger viewport for better quality
      await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 2 });
      
      // Use 'load' and a delay to ensure images/fonts are rendered
      await page.setContent(html, { waitUntil: 'load' });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
      });
      
      // Generate PNG
      const pngBuffer = await page.screenshot({
        type: 'png',
        fullPage: true
      });
      
      const timestamp = Date.now();
      const pdfFileName = `Invoice_${invoice.invoice_number}_${timestamp}.pdf`;
      const pngFileName = `Invoice_${invoice.invoice_number}_${timestamp}.png`;
      const pdfFilePath = `${business.id}/${pdfFileName}`;
      const pngFilePath = `${business.id}/${pngFileName}`;
      
      // Upload PDF
      const { error: pdfError } = await supabase.storage
        .from('invoices')
        .upload(pdfFilePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });
        
      if (pdfError) console.error('PDF Upload Error:', pdfError);
      
      // Upload PNG
      const { error: pngError } = await supabase.storage
        .from('invoices')
        .upload(pngFilePath, pngBuffer, {
          contentType: 'image/png',
          upsert: true
        });
        
      if (pngError) console.error('PNG Upload Error:', pngError);
      
      const { data: { publicUrl: pdfUrl } } = supabase.storage.from('invoices').getPublicUrl(pdfFilePath);
      const { data: { publicUrl: pngUrl } } = supabase.storage.from('invoices').getPublicUrl(pngFilePath);
      
      // Update invoice with URLs
      try {
        // Try updating both, if png_url column exists
        const { error: updateError } = await supabase
          .from('invoices')
          .update({ 
            pdf_url: pdfUrl,
            png_url: pngUrl 
          } as any)
          .eq('id', invoice.id);
          
        if (updateError) {
          // Fallback if png_url doesn't exist
          await supabase.from('invoices').update({ pdf_url: pdfUrl }).eq('id', invoice.id);
        }
      } catch (e) {
        await supabase.from('invoices').update({ pdf_url: pdfUrl }).eq('id', invoice.id);
      }
      
      console.log(`Successfully generated assets for invoice ${invoice.invoice_number}: PDF=${pdfUrl}, PNG=${pngUrl}`);
      return { pdfUrl, pngUrl };
    } catch (err) {
      console.error(`Error in generateAndUploadInvoiceAssets for ${invoice.invoice_number}:`, err);
      throw err;
    } finally {
      if (browser) await browser.close();
    }
  }

  function getInvoiceHTMLForBackend(invoice: any, business: any) {
    const theme = business?.invoice_theme || 'gst';
    const themeColor = business?.invoice_theme_color || '#4f46e5';

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
      }).format(amount);
    };

    const renderSignature = () => {
      if (!business?.esign_url) return '';
      try {
        const data = JSON.parse(business.esign_url);
        if (data.text) {
          return `<div style="font-family: '${data.font || 'Dancing Script'}', cursive; font-size: 32px; color: ${themeColor}; margin-bottom: 8px; line-height: 1;">${data.text}</div>`;
        }
      } catch (e) {
        if (business.esign_url.startsWith('http')) {
          return `<img src="${business.esign_url}" style="height: 50px; margin-bottom: 8px;" />`;
        }
      }
      return '';
    };

    const renderLogo = () => {
      if (!business?.logo_url) return '';
      // Ensure the URL is absolute for Puppeteer
      const logoUrl = business.logo_url;
      console.log(`Rendering logo for PDF: ${logoUrl}`);
      return `<img src="${logoUrl}" style="height: 50px;" onerror="this.style.display='none'" />`;
    };

    // Simplified GST Theme for Backend
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          body { margin: 0; padding: 0; background: white; }
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
        </style>
      </head>
      <body>
        <div style="font-family: 'Inter', sans-serif; width: 794px; min-height: 1123px; padding: 40px; background: white; color: #000; border: 1px solid #000; margin: 0 auto;">
          <div style="text-align: center; border-bottom: 1px solid #000; padding-bottom: 10px; margin-bottom: 0;">
            <h1 style="font-size: 20px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 2px;">Tax Invoice</h1>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #000;">
            <div style="padding: 15px; border-right: 1px solid #000;">
              <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                ${renderLogo()}
                <h2 style="font-size: 18px; font-weight: 900; margin: 0;">${business?.business_name || 'Business Name'}</h2>
              </div>
              <p style="font-size: 12px; margin: 2px 0; line-height: 1.4;">${business?.address}</p>
              <p style="font-size: 12px; margin: 5px 0;"><b>GSTIN/UIN:</b> ${business?.gstin || 'N/A'}</p>
              <p style="font-size: 12px; margin: 2px 0;"><b>Contact:</b> ${business?.phone}</p>
            </div>
            <div style="display: grid; grid-template-rows: 1fr 1fr;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #000;">
                <div style="padding: 10px; border-right: 1px solid #000;">
                  <p style="font-size: 10px; margin: 0; color: #666;">Invoice No.</p>
                  <p style="font-size: 12px; font-weight: 900; margin: 2px 0;">${invoice.invoice_number}</p>
                </div>
                <div style="padding: 10px;">
                  <p style="font-size: 10px; margin: 0; color: #666;">Dated</p>
                  <p style="font-size: 12px; font-weight: 900; margin: 2px 0;">${new Date(invoice.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr;">
                <div style="padding: 10px; border-right: 1px solid #000;">
                  <p style="font-size: 10px; margin: 0; color: #666;">Payment Mode</p>
                  <p style="font-size: 12px; font-weight: 900; margin: 2px 0; text-transform: uppercase;">${invoice.payment_mode}</p>
                </div>
                <div style="padding: 10px;">
                  <p style="font-size: 10px; margin: 0; color: #666;">Status</p>
                  <p style="font-size: 12px; font-weight: 900; margin: 2px 0; text-transform: uppercase;">${invoice.payment_status}</p>
                </div>
              </div>
            </div>
          </div>

          <div style="padding: 15px; border-bottom: 1px solid #000;">
            <p style="font-size: 10px; margin: 0; color: #666;">Buyer (Bill to)</p>
            <p style="font-size: 14px; font-weight: 900; margin: 5px 0;">${invoice.customer_name}</p>
            <p style="font-size: 12px; margin: 2px 0; line-height: 1.4;">${invoice.customer_address || 'N/A'}</p>
            <p style="font-size: 12px; margin: 5px 0;"><b>Contact:</b> ${invoice.customer_phone || 'N/A'}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; border-bottom: 1px solid #000;">
            <thead>
              <tr style="border-bottom: 1px solid #000;">
                <th style="border-right: 1px solid #000; padding: 8px; font-size: 11px; text-align: center; width: 40px;">Sl No.</th>
                <th style="border-right: 1px solid #000; padding: 8px; font-size: 11px; text-align: left;">Description of Goods</th>
                <th style="border-right: 1px solid #000; padding: 8px; font-size: 11px; text-align: center; width: 60px;">Quantity</th>
                <th style="border-right: 1px solid #000; padding: 8px; font-size: 11px; text-align: center; width: 80px;">Rate</th>
                <th style="padding: 8px; font-size: 11px; text-align: right; width: 100px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items?.map((item, i) => `
                <tr>
                  <td style="border-right: 1px solid #000; padding: 8px; font-size: 12px; text-align: center; vertical-align: top;">${i + 1}</td>
                  <td style="border-right: 1px solid #000; padding: 8px; font-size: 12px; vertical-align: top;">
                    <p style="font-weight: 700; margin: 0;">${item.name || item.product_name || 'Product'}</p>
                  </td>
                  <td style="border-right: 1px solid #000; padding: 8px; font-size: 12px; text-align: center; vertical-align: top;"><b>${item.quantity} Nos</b></td>
                  <td style="border-right: 1px solid #000; padding: 8px; font-size: 12px; text-align: right; vertical-align: top;">${item.price.toFixed(2)}</td>
                  <td style="padding: 8px; font-size: 12px; text-align: right; font-weight: 900; vertical-align: top;">${item.total.toFixed(2)}</td>
                </tr>
              `).join('')}
              ${Array(Math.max(0, 8 - (invoice.items?.length || 0))).fill(0).map(() => `
                <tr>
                  <td style="border-right: 1px solid #000; padding: 15px;"></td>
                  <td style="border-right: 1px solid #000; padding: 15px;"></td>
                  <td style="border-right: 1px solid #000; padding: 15px;"></td>
                  <td style="border-right: 1px solid #000; padding: 15px;"></td>
                  <td style="padding: 15px;"></td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="border-top: 1px solid #000;">
                <td colspan="2" style="border-right: 1px solid #000; padding: 8px; text-align: right; font-size: 11px; font-weight: 900;">Total</td>
                <td style="border-right: 1px solid #000; padding: 8px; text-align: center; font-size: 11px; font-weight: 900;">${invoice.items?.reduce((acc, item) => acc + item.quantity, 0)} Nos</td>
                <td style="border-right: 1px solid #000;"></td>
                <td style="padding: 8px; text-align: right; font-size: 12px; font-weight: 900;">${formatCurrency(invoice.total_amount)}</td>
              </tr>
            </tfoot>
          </table>

          <div style="display: grid; grid-template-columns: 1.5fr 1fr; border-bottom: 1px solid #000;">
            <div style="padding: 15px; border-right: 1px solid #000;">
              <p style="font-size: 11px; margin: 0 0 10px 0;">Amount Chargeable (in words)</p>
              <p style="font-size: 12px; font-weight: 900; margin: 0;">INR ${invoice.total_amount.toLocaleString('en-IN')} Only</p>
              
              <div style="margin-top: 20px;">
                <p style="font-size: 10px; font-weight: 700; text-decoration: underline; margin-bottom: 5px;">Declaration:</p>
                <p style="font-size: 10px; line-height: 1.4; margin: 0;">${business?.invoice_terms || 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.'}</p>
              </div>
            </div>
            <div style="padding: 15px; text-align: right;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px;">
                <span>Subtotal:</span>
                <span>${formatCurrency(invoice.subtotal)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 12px;">
                <span>Tax:</span>
                <span>${formatCurrency(invoice.tax_amount)}</span>
              </div>
              <div style="border-top: 1px solid #000; padding-top: 10px;">
                <p style="font-size: 10px; margin: 0; color: #666;">Total Amount</p>
                <p style="font-size: 24px; font-weight: 900; margin: 0;">${formatCurrency(invoice.total_amount)}</p>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 12px;">
                <span>Paid Amount:</span>
                <span style="font-weight: 700;">${formatCurrency(invoice.amount_paid || 0)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 12px;">
                <span>Balance Due:</span>
                <span style="font-weight: 900; color: #e11d48;">${formatCurrency(Math.max(0, invoice.total_amount - (invoice.amount_paid || 0)))}</span>
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr;">
            <div style="padding: 15px; border-right: 1px solid #000;">
              ${business?.instagram_id ? `
                <p style="font-size: 10px; color: #666; margin-bottom: 5px;">Follow Us</p>
                <p style="font-size: 14px; font-weight: 900; margin: 0;">@${business.instagram_id}</p>
              ` : ''}
            </div>
            <div style="padding: 15px; text-align: right;">
              <p style="font-size: 11px; margin: 0 0 40px 0;">for <b>${business?.business_name}</b></p>
              ${renderSignature()}
              <p style="font-size: 11px; font-weight: 900; margin: 0; text-transform: uppercase;">Authorised Signatory</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    // Only serve static files manually if NOT on Vercel
    // Vercel handles static files via vercel.json rewrites
    app.use(express.static(path.join(__dirname, "../dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "../dist", "index.html"));
    });
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled Express Error:", err);
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message || "An unexpected error occurred",
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  // Only listen if not running as a serverless function (e.g., on Vercel)
  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

export const appPromise = startServer().catch(err => {
  console.error("CRITICAL: Failed to start server:", err);
  throw err;
});
export default appPromise;
