import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  UserPlus, 
  Save, 
  ChevronLeft,
  ChevronRight,
  Calculator,
  Percent,
  Tag,
  Calendar as CalendarIcon,
  X,
  Smartphone,
  Download,
  Printer,
  Banknote,
  Box
} from 'lucide-react';
import { Customer, Product, Invoice } from '../types';
import { formatCurrency, cn, formatWhatsAppLink } from '../lib/utils';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { generateInvoicePDF } from '../lib/pdf';
import InvoicePreviewModal from '../components/InvoicePreviewModal';
import { supabaseService } from '../services/supabaseService';
import { invoiceFileService } from '../services/invoiceFileService';

interface LineItem {
  product_id: number;
  name: string;
  quantity: number;
  price: number;
  tax_percentage: number;
  discount: number;
  total: number;
}

export default function CreateInvoice() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isQuickProductAddOpen, setIsQuickProductAddOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [newProduct, setNewProduct] = useState({ 
    name: '', 
    category: '',
    sku: '',
    purchase_price: 0,
    selling_price: 0, 
    stock_quantity: 0,
    low_stock_alert: 5,
    tax_percentage: 0
  });
  
  const [productSearch, setProductSearch] = useState('');
  const [showProductResults, setShowProductResults] = useState(false);
  
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'partial'>('paid');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'both' | ''>('');
  const [cashAmount, setCashAmount] = useState<number | ''>('');
  const [upiAmount, setUpiAmount] = useState<number | ''>('');
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedInvoiceData, setSavedInvoiceData] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [customersData, productsData] = await Promise.all([
          supabaseService.getCustomers(),
          supabaseService.getProducts()
        ]);
        setCustomers(customersData);
        setProducts(productsData);

        if (id) {
          const invoiceId = Number(id);
          const invoiceData = await supabaseService.getInvoice(invoiceId);
          setSelectedCustomerId(invoiceData.customer_id);
          setCustomerSearch(invoiceData.customer_name || '');
          setInvoiceDate(new Date(invoiceData.created_at).toISOString().split('T')[0]);
          setDiscount(invoiceData.discount_amount);
          setAmountPaid(invoiceData.amount_paid || 0);
          setPaymentStatus(invoiceData.payment_status || 'unpaid');
          setPaymentMode(invoiceData.payment_mode || ''); // Use empty string as fallback to prevent hidden fields
          setCashAmount(invoiceData.cash_amount || '');
          setUpiAmount(invoiceData.upi_amount || '');

          const items = await supabaseService.getInvoiceItems(invoiceId);
          const itemsData = items.map((item: any) => ({
            product_id: item.product_id,
            name: item.product_name || 'Product',
            quantity: item.quantity,
            price: item.price,
            tax_percentage: item.tax_percentage || 0,
            discount: item.discount || 0,
            total: item.total
          }));
          setLineItems(itemsData);
          setSavedInvoiceData({
            ...invoiceData,
            items: itemsData
          });
        }
      } catch (error) {
        console.error('Error loading invoice data:', error);
      }
    };
    loadData();

    // Listen for global data refresh events
    const handleRefresh = () => {
      loadData();
    };
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, [id]);

  const fetchCustomers = async () => {
    try {
      const data = await supabaseService.getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name) return;
    
    try {
      const data = await supabaseService.createCustomer(newCustomer as any);
      const addedCustomer = { id: data.id, ...newCustomer, business_id: data.business_id, email: '', address: '', gst_number: '', outstanding_balance: 0, created_at: new Date().toISOString() };
      setCustomers([...customers, addedCustomer]);
      setSelectedCustomerId(data.id);
      setCustomerSearch(newCustomer.name);
      setIsQuickAddOpen(false);
      setNewCustomer({ name: '', phone: '' });
    } catch (error) {
      console.error('Error adding customer:', error);
    }
  };

  const filteredCustomers = customers.filter(c => 
    (c.name || '').toLowerCase().includes((customerSearch || '').toLowerCase()) || 
    (c.phone || '').includes(customerSearch)
  );

  const filteredProducts = products.filter(p => 
    (p.name || '').toLowerCase().includes((productSearch || '').toLowerCase()) || 
    (p.sku || '').toLowerCase().includes((productSearch || '').toLowerCase())
  );

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const addLineItem = (product: Product) => {
    if (!product || !product.id) return;
    
    setLineItems(prevItems => {
      const existing = prevItems.find(item => item.product_id === product.id);
      if (existing) {
        return prevItems.map(item => 
          item.product_id === product.id 
            ? { ...item, quantity: item.quantity + 1, total: ((item.quantity + 1) * item.price) - item.discount }
            : item
        );
      } else {
        return [...prevItems, {
          product_id: product.id,
          name: product.name || 'Unknown Product',
          quantity: 1,
          price: product.selling_price || 0,
          tax_percentage: product.tax_percentage || 0,
          discount: 0,
          total: product.selling_price || 0
        }];
      }
    });
  };

  const handleQuickAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name) return;
    
    try {
      const savedProduct = await supabaseService.createProduct(newProduct as any);
      setProducts(prev => [...prev, savedProduct]);
      addLineItem(savedProduct);
      setIsQuickProductAddOpen(false);
      setNewProduct({ 
        name: '', category: '', sku: '', purchase_price: 0, selling_price: 0, stock_quantity: 0, low_stock_alert: 5, tax_percentage: 0 
      });
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Failed to add product. Please check if SKU is unique.');
    }
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, qty: number) => {
    if (qty < 1) return;
    setLineItems(lineItems.map((item, i) => 
      i === index ? { ...item, quantity: qty, total: (qty * item.price) - item.discount } : item
    ));
  };

  const updateDiscount = (index: number, disc: number) => {
    setLineItems(lineItems.map((item, i) => 
      i === index ? { ...item, discount: disc, total: (item.quantity * item.price) - disc } : item
    ));
  };

  const updatePrice = (index: number, price: number) => {
    setLineItems(lineItems.map((item, i) => 
      i === index ? { ...item, price: price, total: (item.quantity * price) - item.discount } : item
    ));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = lineItems.reduce((sum, item) => sum + (item.total * item.tax_percentage / 100), 0);
  const totalAmount = subtotal + taxAmount - discount;

  const handleShareWhatsApp = () => {
    if (!savedInvoiceData) return;
    
    const publicLink = `${window.location.origin}/public/invoice/${savedInvoiceData.id}`;
    
    if (!savedInvoiceData?.customer_phone) {
      alert('Customer phone number is missing. Cannot share via WhatsApp.');
      return;
    }

    const message = `*Invoice: ${savedInvoiceData.invoice_number}*
Hello ${savedInvoiceData.customer_name || 'Customer'},

Please find your invoice details below:
*Amount:* ${formatCurrency(savedInvoiceData.total_amount)}
*Status:* ${savedInvoiceData.payment_status?.toUpperCase() || 'N/A'}
*Date:* ${new Date(savedInvoiceData.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}

You can view and download your invoice here:
${publicLink}

Thank you for your business!`;

    window.open(formatWhatsAppLink(savedInvoiceData.customer_phone, message), '_blank');
  };

  const handleSave = async () => {
    if (lineItems.length === 0) return alert('Please add at least one item');

    setLoading(true);
    try {
      const now = new Date();
      const selectedDate = new Date(invoiceDate);
      
      // If the selected date is today, use the current precise time
      // Otherwise use the selected date at midnight
      let finalCreatedAt = invoiceDate;
      if (selectedDate.toDateString() === now.toDateString()) {
        finalCreatedAt = now.toISOString();
      } else {
        finalCreatedAt = new Date(selectedDate.setHours(0, 0, 0, 0)).toISOString();
      }

      const invoiceData = {
        customer_id: selectedCustomerId || null,
        items: lineItems,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discount,
        total_amount: totalAmount,
        payment_status: paymentStatus,
        payment_mode: paymentMode,
        cash_amount: paymentMode === 'both' ? Number(cashAmount) || 0 : undefined,
        upi_amount: paymentMode === 'both' ? Number(upiAmount) || 0 : undefined,
        created_at: finalCreatedAt,
        amount_paid: Number(amountPaid) || 0
      };

      let savedInvoice;
      if (id) {
        await supabaseService.updateInvoice(Number(id), invoiceData);
        savedInvoice = await supabaseService.getInvoice(Number(id));
      } else {
        savedInvoice = await supabaseService.createInvoice(invoiceData);
      }

      const fullInvoice = {
        ...savedInvoice,
        customer_name: customers.find(c => c.id === selectedCustomerId)?.name,
        customer_phone: customers.find(c => c.id === selectedCustomerId)?.phone,
        customer_address: customers.find(c => c.id === selectedCustomerId)?.address,
        customer_gstin: customers.find(c => c.id === selectedCustomerId)?.gst_number,
        amount_paid: amountPaid || 0,
        items: lineItems
      };

      setSavedInvoiceData(fullInvoice);
      
      // Generate and upload files (PDF and PNG) to Supabase Storage
      // We don't await this to reduce processing time for the user
      invoiceFileService.generateAndUploadFiles(fullInvoice, user!.id)
        .then(() => console.log('Files uploaded successfully'))
        .catch(fileError => console.error('Failed to generate/upload invoice files:', fileError));
      
      // Navigate to invoices list and open preview in the same tab
      navigate('/invoices', { state: { previewInvoiceId: fullInvoice.id } });
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Failed to save invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <Link to="/invoices" className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <ChevronLeft size={20} className="dark:text-white" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{id ? 'Edit Invoice' : 'Create Invoice'}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Fill details to generate invoice.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {id && (
            <button 
              onClick={() => generateInvoicePDF(savedInvoiceData!)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm"
            >
              <Download size={16} />
              PDF
            </button>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer & Items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer & Date Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative"
            >
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">Customer (Optional)</label>
                <button 
                  onClick={() => setIsQuickAddOpen(true)}
                  className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Plus size={12} />
                  Add New
                </button>
              </div>
              <div className="relative">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search customer..." 
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:text-white outline-none transition-all font-bold text-sm"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerResults(true);
                    }}
                    onFocus={() => setShowCustomerResults(true)}
                  />
                </div>
                <AnimatePresence>
                  {showCustomerResults && customerSearch && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 max-h-64 overflow-y-auto p-2"
                    >
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map(c => (
                          <button 
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomerId(c.id);
                              setCustomerSearch(c.name);
                              setShowCustomerResults(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors flex items-center justify-between group"
                          >
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{c.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{c.phone}</p>
                            </div>
                            <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400" />
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center">
                          <p className="text-sm text-slate-500 dark:text-slate-400 italic">No customers found.</p>
                          <button 
                            onClick={() => setIsQuickAddOpen(true)}
                            className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Add "{customerSearch}" as new customer?
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {selectedCustomer && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">
                      {selectedCustomer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300">{selectedCustomer.name}</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-500">{selectedCustomer.phone}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setSelectedCustomerId(''); setCustomerSearch(''); }} 
                    className="p-2 text-indigo-400 dark:text-indigo-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                  >
                    <X size={18} />
                  </button>
                </motion.div>
              )}
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <CalendarIcon size={14} className="text-slate-400" />
                <label className="text-[11px] font-bold text-slate-500 uppercase">Invoice Date</label>
              </div>
              <input 
                type="date" 
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none text-sm font-bold"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </motion.div>
          </div>

          {/* Quick Add Customer Modal */}
          <AnimatePresence>
            {isQuickAddOpen && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsQuickAddOpen(false)}
                  className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
                >
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Quick Add Customer</h3>
                  </div>
                  <form onSubmit={handleQuickAddCustomer} className="p-6 space-y-4 overflow-y-auto">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Name *</label>
                      <input 
                        required
                        type="text" 
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none dark:text-white"
                        value={newCustomer.name || ''}
                        onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Phone</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none dark:text-white"
                        value={newCustomer.phone || ''}
                        onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button 
                        type="button"
                        onClick={() => setIsQuickAddOpen(false)}
                        className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold"
                      >
                        Add
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Quick Add Product Modal */}
          <AnimatePresence>
            {isQuickProductAddOpen && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsQuickProductAddOpen(false)}
                  className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                  <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Quick Add Product</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">New Inventory Item</p>
                    </div>
                    <button onClick={() => setIsQuickProductAddOpen(false)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors">
                      <X size={24} className="text-slate-400" />
                    </button>
                  </div>
                  <form onSubmit={handleQuickAddProduct} className="p-8 space-y-8 bg-slate-50/50 dark:bg-slate-900/50 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Product Name *</label>
                        <input 
                          required
                          type="text" 
                          className="w-full px-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 dark:text-white font-bold transition-all"
                          value={newProduct.name || ''}
                          onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Category</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 dark:text-white font-bold transition-all"
                          value={newProduct.category || ''}
                          onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">SKU</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 dark:text-white font-bold transition-all"
                          value={newProduct.sku || ''}
                          onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tax (%)</label>
                        <div className="relative">
                          <Percent className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            type="number" 
                            className="w-full px-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 dark:text-white font-bold transition-all"
                            placeholder="0"
                            value={newProduct.tax_percentage || ''}
                            onChange={(e) => setNewProduct({...newProduct, tax_percentage: e.target.value === '' ? 0 : Number(e.target.value)})}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Selling Price *</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                          <input 
                            required
                            type="number" 
                            className="w-full pl-10 pr-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 dark:text-white font-bold transition-all"
                            placeholder="0"
                            value={newProduct.selling_price || ''}
                            onChange={(e) => setNewProduct({...newProduct, selling_price: e.target.value === '' ? 0 : Number(e.target.value)})}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Stock Qty</label>
                        <input 
                          type="number" 
                          className="w-full px-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 dark:text-white font-bold transition-all"
                          placeholder="0"
                          value={newProduct.stock_quantity || ''}
                          onChange={(e) => setNewProduct({...newProduct, stock_quantity: e.target.value === '' ? 0 : Number(e.target.value)})}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                      <button 
                        type="button"
                        onClick={() => setIsQuickProductAddOpen(false)}
                        className="px-8 py-4 text-slate-500 font-bold hover:text-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        className="px-12 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 dark:shadow-indigo-900/20 transition-all transform active:scale-95"
                      >
                        Add Product
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Item Selection */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Line Items</h3>
                <p className="text-[10px] font-bold text-slate-400 tracking-tight">Select products</p>
              </div>
              <button 
                onClick={() => setIsQuickProductAddOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-100 transition-all border border-indigo-100 dark:border-indigo-800"
              >
                <Plus size={14} />
                New Product
              </button>
            </div>
            <div className="relative mb-4">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                <input 
                  type="text" 
                  placeholder="Search products..." 
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:text-white transition-all font-bold text-sm"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProductResults(true);
                  }}
                  onFocus={() => setShowProductResults(true)}
                />
              </div>
              <AnimatePresence>
                {showProductResults && productSearch && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 max-h-72 overflow-y-auto p-2"
                  >
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map(p => (
                        <button 
                          key={p.id}
                          onClick={() => {
                            addLineItem(p);
                            setProductSearch('');
                            setShowProductResults(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors flex justify-between items-center group"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{p.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">SKU: {p.sku || 'N/A'} • Stock: {p.stock_quantity}</p>
                          </div>
                          <p className="font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(p.selling_price)}</p>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400 italic">No products found.</p>
                        <button 
                          onClick={() => setIsQuickProductAddOpen(true)}
                          className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Create "{productSearch}" as new product?
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="pb-2 text-[9px] font-black text-slate-400 uppercase tracking-tight">Item</th>
                    <th className="pb-2 text-[9px] font-black text-slate-400 uppercase tracking-tight text-center">Qty</th>
                    <th className="pb-2 text-[9px] font-black text-slate-400 uppercase tracking-tight text-right">Price</th>
                    <th className="pb-2 text-[9px] font-black text-slate-400 uppercase tracking-tight text-right">Disc</th>
                    <th className="pb-2 text-[9px] font-black text-slate-400 uppercase tracking-tight text-right">Total</th>
                    <th className="pb-2 text-[9px] font-black text-slate-400 uppercase tracking-tight text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  <AnimatePresence mode="popLayout">
                    {lineItems.length === 0 ? (
                      <motion.tr 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        key="empty"
                      >
                        <td colSpan={6} className="py-12 text-center">
                          <Box size={32} className="mx-auto text-slate-200 dark:text-slate-700 mb-2" />
                          <p className="text-[11px] text-slate-400 font-bold italic">No items added.</p>
                        </td>
                      </motion.tr>
                    ) : lineItems.map((item, index) => (
                      <motion.tr 
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        key={`${item.product_id}-${index}`} 
                        className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                      <td className="py-2">
                        <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate max-w-[120px]">{item.name}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Tax: {item.tax_percentage}%</p>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => updateQuantity(index, item.quantity - 1)} 
                            className="w-6 h-6 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white text-[11px] font-bold dark:text-white"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-black text-slate-900 dark:text-white text-[13px]">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(index, item.quantity + 1)} 
                            className="w-6 h-6 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white text-[11px] font-bold dark:text-white"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <div className="relative inline-block w-20">
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">₹</span>
                          <input 
                            type="number" 
                            className="w-full pl-4 pr-1 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-right font-bold text-[13px] dark:text-white focus:ring-2 focus:ring-indigo-500/20"
                            value={item.price || ''}
                            onChange={(e) => updatePrice(index, Number(e.target.value))}
                          />
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <div className="relative inline-block w-16">
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">₹</span>
                          <input 
                            type="number" 
                            className="w-full pl-4 pr-1 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-right font-bold text-[13px] text-rose-500 focus:ring-2 focus:ring-rose-500/20"
                            value={item.discount || ''}
                            onChange={(e) => updateDiscount(index, Number(e.target.value))}
                          />
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <p className="font-black text-slate-900 dark:text-white text-[13px]">{formatCurrency(item.total)}</p>
                      </td>
                      <td className="py-2 text-right">
                        <button 
                          onClick={() => removeLineItem(index)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Summary & Payment */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm sticky top-20">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4">Summary</h3>
            
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                <span>Subtotal</span>
                <span className="text-slate-900 dark:text-white">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Calculator size={12} />
                  <span>Tax</span>
                </div>
                <span className="text-slate-900 dark:text-white">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Tag size={12} />
                  <span>Discount</span>
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">₹</span>
                  <input 
                    type="number" 
                    className="w-24 pl-5 pr-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-right font-black focus:ring-4 focus:ring-indigo-500/10 outline-none dark:text-white transition-all text-xs"
                    placeholder="0"
                    value={discount || ''}
                    onChange={(e) => setDiscount(e.target.value === '' ? 0 : Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="text-xs font-black text-slate-900 dark:text-white uppercase">Grand Total</span>
                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            <div className="space-y-4 mb-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider ml-1">Payment</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'cash', label: 'Cash', icon: Banknote },
                    { id: 'upi', label: 'UPI', icon: Smartphone },
                    { id: 'both', label: 'Both', icon: Calculator }
                  ].map(mode => (
                    <button 
                      key={mode.id}
                      onClick={() => setPaymentMode(mode.id as any)}
                      className={cn(
                        "py-2 rounded-lg text-[9px] font-black uppercase tracking-tight border transition-all flex flex-col items-center justify-center gap-1",
                        paymentMode === mode.id 
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-lg" 
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
                      )}
                    >
                      <mode.icon size={12} />
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMode && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3 overflow-hidden"
                >
                  {paymentMode === 'both' ? (
                    <div className="grid grid-cols-1 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Cash</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">₹</span>
                          <input 
                            type="number" 
                            className="w-full pl-7 pr-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none dark:text-white font-bold text-xs"
                            value={cashAmount === 0 ? '0' : cashAmount}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setCashAmount(val);
                            }}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">UPI</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">₹</span>
                          <input 
                            type="number" 
                            className="w-full pl-7 pr-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none dark:text-white font-bold text-xs"
                            value={upiAmount === 0 ? '0' : upiAmount}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setUpiAmount(val);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Received</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-black text-sm">₹</span>
                        <input 
                          type="number" 
                          className="w-full pl-8 pr-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 outline-none font-black text-base text-indigo-600 dark:text-indigo-400 transition-all"
                          value={amountPaid === 0 ? '0' : amountPaid || ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setAmountPaid(val);
                          }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            <button 
              onClick={handleSave}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white py-3 rounded-xl font-black text-sm transition-all shadow-xl"
            >
              <Save size={18} />
              {loading ? 'Processing...' : id ? 'Update' : 'Generate'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
