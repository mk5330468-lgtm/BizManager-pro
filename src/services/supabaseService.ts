import { Product, Customer, Invoice, Purchase } from '../types';
import { safeJson } from '../lib/utils';
import { supabase } from '../lib/supabase';

let cachedBusinessId: string | null = null;

const getBusinessId = async () => {
  if (cachedBusinessId && cachedBusinessId !== 'null') return cachedBusinessId;
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Session timeout')), 10000)
    );
    const { data } = await Promise.race([sessionPromise, timeoutPromise]) as any;
    const id = data.session?.user?.id;
    cachedBusinessId = id && id !== 'null' ? id : null;
    return cachedBusinessId;
  } catch (error) {
    console.warn('Could not get business ID:', error);
    return null;
  }
};

const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes

const getCacheKey = (url: string, options: RequestInit) => {
  return `${options.method || 'GET'}:${url}`;
};

const clearCache = () => {
  cache.clear();
};

let cachedSession: any = null;
let lastSessionFetch = 0;
const SESSION_CACHE_TTL = 300000; // 5 minutes

const fetchWithBusinessId = async (url: string, options: RequestInit = {}) => {
  const method = options.method || 'GET';
  const isGet = method === 'GET';
  const cacheKey = getCacheKey(url, options);

  // Check cache for GET requests
  if (isGet) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return {
        ok: true,
        json: async () => cached.data,
        text: async () => JSON.stringify(cached.data),
        clone: () => ({
          json: async () => cached.data,
          text: async () => JSON.stringify(cached.data)
        })
      } as any;
    }
  } else {
    // Clear cache on mutations
    clearCache();
  }

  let session = cachedSession;
  if (!session || Date.now() - lastSessionFetch > SESSION_CACHE_TTL) {
    try {
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session timeout')), 10000)
      );
      const { data } = await Promise.race([sessionPromise, timeoutPromise]) as any;
      session = data.session;
      cachedSession = session;
      lastSessionFetch = Date.now();
      const id = session?.user?.id;
      if (id && id !== 'null') {
        cachedBusinessId = id;
        console.log('Supabase session fetched, businessId:', cachedBusinessId);
      } else {
        console.warn('Supabase session fetched but no valid user ID found');
      }
    } catch (error) {
      console.warn('Could not get supabase session:', error);
    }
  }

  const businessId = session?.user?.id;
  const accessToken = session?.access_token;
  
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (businessId && businessId !== 'null') {
    headers['x-business-id'] = businessId;
  } else {
    console.warn(`No valid businessId for request to ${url}`);
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const res = await fetch(url, { ...options, headers });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || `Request failed with status ${res.status}`;
      console.error(`API error for ${url}:`, errorMessage, errorData);
      throw new Error(errorMessage);
    }

    // Cache successful GET responses
    if (isGet) {
      const data = await res.clone().json();
      cache.set(cacheKey, { data, timestamp: Date.now() });
    } else {
      // Dispatch global refresh event after successful mutation
      window.dispatchEvent(new CustomEvent('refresh-data'));
    }
    
    return res;
  } catch (error: any) {
    console.error(`Fetch error for ${url}:`, error.message || error);
    throw error;
  }
};

export const supabaseService = {
  // Business Profile
  async getBusiness(id?: string | number) {
    const businessId = id || await getBusinessId();
    const url = businessId ? `/api/business?id=${businessId}` : '/api/business';
    const res = await fetchWithBusinessId(url);
    return await safeJson(res);
  },

  async updateBusiness(updates: any) {
    const id = updates.id || await getBusinessId();
    const res = await fetchWithBusinessId(`/api/business/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update business');
  },

  // Products
  async getProducts() {
    const res = await fetchWithBusinessId('/api/products');
    if (!res.ok) throw new Error('Failed to fetch products');
    return await safeJson(res) as Product[];
  },

  async createProduct(product: Omit<Product, 'id'>) {
    const res = await fetchWithBusinessId('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    if (!res.ok) throw new Error('Failed to create product');
    return await safeJson(res);
  },

  async updateProduct(id: number, updates: Partial<Product>) {
    const res = await fetchWithBusinessId(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update product');
  },

  async deleteProduct(id: number) {
    const res = await fetchWithBusinessId(`/api/products/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete product');
  },

  // Customers
  async getCustomers() {
    const res = await fetchWithBusinessId('/api/customers');
    if (!res.ok) throw new Error('Failed to fetch customers');
    return await safeJson(res) as Customer[];
  },

  async createCustomer(customer: Omit<Customer, 'id'>) {
    const res = await fetchWithBusinessId('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer)
    });
    if (!res.ok) throw new Error('Failed to create customer');
    return await safeJson(res);
  },

  async deleteCustomer(id: number) {
    const res = await fetchWithBusinessId(`/api/customers/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete customer');
  },

  async getCustomerHistory(customerId: number) {
    const res = await fetchWithBusinessId(`/api/customers/${customerId}/payments`);
    if (!res.ok) throw new Error('Failed to fetch customer history');
    return await safeJson(res);
  },

  async getCustomerInvoices(customerId: number) {
    const res = await fetchWithBusinessId(`/api/customers/${customerId}/invoices`);
    if (!res.ok) throw new Error('Failed to fetch customer invoices');
    return await safeJson(res);
  },

  async recordCustomerPayment(paymentData: any) {
    const response = await fetchWithBusinessId('/api/payments/customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });
    if (!response.ok) throw new Error('Failed to record payment');
    return await safeJson(response);
  },

  async getPayments() {
    const res = await fetchWithBusinessId('/api/payments');
    if (!res.ok) throw new Error('Failed to fetch payments');
    return await safeJson(res);
  },

  async deletePayment(id: number) {
    const res = await fetchWithBusinessId(`/api/payments/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete payment');
  },

  async updatePayment(id: number, updates: any) {
    const res = await fetchWithBusinessId(`/api/payments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update payment');
  },

  // Invoices
  async getInvoice(id: number) {
    const res = await fetchWithBusinessId(`/api/invoices/${id}`);
    if (!res.ok) throw new Error('Failed to fetch invoice');
    return await safeJson(res);
  },

  async getInvoiceItems(invoiceId: number) {
    const res = await fetchWithBusinessId(`/api/invoices/${invoiceId}/items`);
    if (!res.ok) throw new Error('Failed to fetch invoice items');
    return await safeJson(res);
  },

  async updateInvoice(id: number, invoiceData: any) {
    const res = await fetchWithBusinessId(`/api/invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData)
    });
    if (!res.ok) throw new Error('Failed to update invoice');
    return await safeJson(res);
  },

  async updateInvoicePdfUrl(id: number, pdfUrl: string) {
    const res = await fetchWithBusinessId(`/api/invoices/${id}/pdf-url`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf_url: pdfUrl })
    });
    if (!res.ok) throw new Error('Failed to update invoice PDF URL');
    return await safeJson(res);
  },

  async regenerateInvoicePdf(id: number) {
    const res = await fetchWithBusinessId(`/api/invoices/${id}/pdf`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to regenerate invoice PDF');
    return await safeJson(res);
  },

  async deleteInvoice(id: number) {
    const res = await fetchWithBusinessId(`/api/invoices/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete invoice');
  },

  async getInvoices() {
    const res = await fetchWithBusinessId('/api/invoices');
    if (!res.ok) throw new Error('Failed to fetch invoices');
    return await safeJson(res);
  },

  async createInvoice(invoiceData: any) {
    const res = await fetchWithBusinessId('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData)
    });
    if (!res.ok) throw new Error('Failed to create invoice');
    return await safeJson(res);
  },

  // Purchases
  async getPurchases() {
    const res = await fetchWithBusinessId('/api/purchases');
    if (!res.ok) throw new Error('Failed to fetch purchases');
    return await safeJson(res);
  },

  async getPurchaseItems(id: number) {
    const res = await fetchWithBusinessId(`/api/purchases/${id}/items`);
    if (!res.ok) throw new Error('Failed to fetch purchase items');
    return await safeJson(res);
  },

  async createPurchase(purchaseData: any) {
    const res = await fetchWithBusinessId('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchaseData)
    });
    if (!res.ok) throw new Error('Failed to create purchase');
    return await safeJson(res);
  },

  async updatePurchase(id: number, purchaseData: any) {
    const res = await fetchWithBusinessId(`/api/purchases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchaseData)
    });
    if (!res.ok) throw new Error('Failed to update purchase');
    return await safeJson(res);
  },

  async deletePurchase(id: number) {
    const res = await fetchWithBusinessId(`/api/purchases/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete purchase');
  },

  async getLastPurchaseNumber() {
    const res = await fetchWithBusinessId('/api/purchases/last-number');
    if (!res.ok) return null;
    const data = await safeJson(res);
    return data?.lastNumber;
  },

  // Expenses
  async getExpenses() {
    const res = await fetchWithBusinessId('/api/expenses');
    if (!res.ok) throw new Error('Failed to fetch expenses');
    return await safeJson(res);
  },

  async createExpense(expenseData: any) {
    const res = await fetchWithBusinessId('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expenseData)
    });
    if (!res.ok) throw new Error('Failed to create expense');
    return await safeJson(res);
  },

  async deleteExpense(id: number) {
    const res = await fetchWithBusinessId(`/api/expenses/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete expense');
  },

  async getDashboardStats() {
    const res = await fetchWithBusinessId('/api/dashboard/stats');
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return await safeJson(res);
  },

  // Reports
  async getSalesReport(month?: string) {
    const query = month ? `?month=${month}` : '';
    const res = await fetchWithBusinessId(`/api/reports/sales${query}`);
    if (!res.ok) throw new Error('Failed to fetch sales report');
    return await safeJson(res);
  },

  async getYearlyStats() {
    const res = await fetchWithBusinessId('/api/reports/yearly-stats');
    if (!res.ok) throw new Error('Failed to fetch yearly stats');
    return await safeJson(res);
  },

  async getStatsReport(month?: string) {
    const query = month ? `?month=${month}` : '';
    const res = await fetchWithBusinessId(`/api/reports/stats${query}`);
    if (!res.ok) throw new Error('Failed to fetch stats report');
    return await safeJson(res);
  },

  async getDetailedTransactionsReport(month?: string) {
    const query = month ? `?month=${month}` : '';
    const res = await fetchWithBusinessId(`/api/reports/detailed-transactions${query}`);
    if (!res.ok) throw new Error('Failed to fetch detailed transactions report');
    return await safeJson(res);
  },

  async getDetailedProductProfit(month?: string) {
    const query = month ? `?month=${month}` : '';
    const res = await fetchWithBusinessId(`/api/reports/detailed-product-profit${query}`);
    if (!res.ok) throw new Error('Failed to fetch detailed product profit');
    return await safeJson(res);
  },

  async getMonthlyInvoices(month: string) {
    const res = await fetchWithBusinessId(`/api/reports/monthly-invoices/${month}`);
    if (!res.ok) throw new Error('Failed to fetch monthly invoices');
    return await safeJson(res);
  },

  async getMonthlySummary(monthStr: string) {
    const res = await fetchWithBusinessId(`/api/reports/monthly-summary?month=${monthStr}`);
    if (!res.ok) throw new Error('Failed to fetch monthly summary');
    return await safeJson(res);
  },

  async exportBackup() {
    const res = await fetchWithBusinessId('/api/backup/export');
    if (!res.ok) throw new Error('Failed to export backup');
    return await safeJson(res);
  },

  async importBackup(data: any) {
    const res = await fetchWithBusinessId('/api/backup/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to import backup');
    return await safeJson(res);
  },

  async cloudSync() {
    const res = await fetchWithBusinessId('/api/backup/cloud-sync', {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Cloud sync failed');
    return await safeJson(res);
  },

  async cloudRestore() {
    const res = await fetchWithBusinessId('/api/backup/cloud-restore', {
      method: 'POST'
    });
    if (!res.ok) {
      const errorData = await safeJson(res);
      throw new Error(errorData?.error || 'Cloud restore failed');
    }
    return await safeJson(res);
  },

  // Storage
  async uploadFile(bucket: string, path: string, file: Blob | File) {
    console.log(`Uploading file to ${bucket}/${path}`, {
      type: file.type,
      size: file.size,
      isBlob: file instanceof Blob,
      isFile: file instanceof File
    });

    const formData = new FormData();
    // Move other fields before file for better compatibility with some multipart parsers
    formData.append('path', path);
    formData.append('bucket', bucket);
    // Add filename to the file append to ensure proper handling
    const fileName = path.split('/').pop() || 'file.pdf';
    formData.append('file', file, fileName);

    const res = await fetchWithBusinessId('/api/storage/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Failed to upload file');
    return await safeJson(res);
  },

  async getFileUrl(bucket: string, path: string) {
    const res = await fetchWithBusinessId(`/api/storage/url?bucket=${bucket}&path=${path}`);
    if (!res.ok) throw new Error('Failed to get file URL');
    const data = await safeJson(res);
    return data.url;
  },
  
  async listStorage(bucket: string, path: string = '') {
    const res = await fetchWithBusinessId(`/api/storage/list?bucket=${bucket}&path=${path}`);
    if (!res.ok) throw new Error('Failed to list storage');
    return await safeJson(res);
  },

  async testStorageDirect() {
    const res = await fetchWithBusinessId('/api/storage/test-direct');
    if (!res.ok) throw new Error('Storage direct test failed');
    return await safeJson(res);
  }
};
