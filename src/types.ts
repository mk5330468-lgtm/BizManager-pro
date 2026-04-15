export interface User {
  id: number;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  subscription_plan: string;
  created_at: string;
}

export interface Customer {
  id: number;
  business_id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  gst_number: string;
  outstanding_balance: number;
  notes?: string;
  created_at: string;
}

export interface Business {
  id: number;
  owner_id: string;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
  logo_url: string;
  esign_url: string;
  invoice_terms: string;
  invoice_theme_color: string;
  invoice_theme: 'gst' | 'modern' | 'thermal';
  instagram_id?: string;
  created_at: string;
}

export interface Product {
  id: number;
  business_id: number;
  name: string;
  category: string;
  sku: string;
  purchase_price: number;
  selling_price: number;
  stock_quantity: number;
  low_stock_alert: number;
  tax_percentage: number;
  created_at: string;
}

export interface Invoice {
  id: number;
  business_id: string;
  invoice_number: string;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_gstin?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid?: number;
  payment_status: 'paid' | 'unpaid' | 'partial';
  payment_mode: 'cash' | 'upi' | 'both';
  pdf_url?: string;
  png_url?: string;
  created_at: string;
  items?: any[];
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  product_id: number;
  quantity: number;
  price: number;
  total: number;
}

export interface Purchase {
  id: number;
  business_id: number;
  purchase_number: string;
  supplier_name: string;
  invoice_number: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  additional_charges: number;
  total_amount: number;
  amount_paid?: number;
  balance_due: number;
  payment_status: 'paid' | 'unpaid' | 'partial';
  payment_mode: 'cash' | 'upi' | 'both';
  purchase_date: string;
}

export interface Expense {
  id: number;
  business_id: number;
  category: string;
  description: string;
  amount: number;
  payment_mode: 'cash' | 'upi' | 'both';
  expense_date: string;
}

export interface Account {
  id: number;
  business_id: number;
  name: string;
  balance: number;
  last_updated: string;
}

export interface DashboardStats {
  todaySales: number;
  todayCollections: number;
  todayInvoicesCount: number;
  todayCashReceived: number;
  todayOnlineReceived: number;
  monthlySales: number;
  monthlyCollections: number;
  monthlyInvoicesCount: number;
  monthlyCashReceived: number;
  monthlyOnlineReceived: number;
  totalSales: number;
  totalCollections: number;
  paymentModes: { payment_mode: string; total: number }[];
  pendingPayments: number;
  lowStockCount: number;
  pendingCustomers: {
    id: number;
    name: string;
    phone: string;
    outstanding_balance: number;
  }[];
  accounts: Account[];
}
