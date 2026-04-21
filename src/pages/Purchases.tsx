import React, { useState, useEffect } from 'react';
import { Plus, Search, ShoppingBag, Calendar, CreditCard, X, Eye, FileText, List, Receipt, Trash2, ChevronLeft, Edit3, Box, Banknote, ChevronRight, ArrowLeft } from 'lucide-react';
import { Purchase, Product, Expense, Customer } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { supabaseService } from '../services/supabaseService';
import ConfirmModal from '../components/ConfirmModal';

export default function Purchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'records' | 'expenses'>('records');
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');

  // Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPurchaseDeleteModalOpen, setIsPurchaseDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<number | null>(null);
  const [purchaseToDelete, setPurchaseToDelete] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<number | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [newProductData, setNewProductData] = useState({
    name: '',
    category: '',
    purchase_price: 0,
    selling_price: 0,
    stock_quantity: 0,
    tax_percentage: 0,
    unit: 'pcs'
  });

  // Form State
  const [formData, setFormData] = useState({
    supplier_name: '',
    purchase_number: '',
    invoice_number: '',
    purchase_date: new Date().toISOString().split('T')[0],
    subtotal: 0,
    tax_amount: 0,
    discount_amount: 0,
    additional_charges: 0,
    total_amount: 0,
    amount_paid: 0,
    balance_due: 0,
    payment_status: 'unpaid' as 'paid' | 'unpaid' | 'partial',
    payment_mode: 'cash' as 'cash' | 'upi' | 'both',
    items: [] as { product_id: number, name: string, quantity: number, price: number, total: number }[]
  });

  const [expenseFormData, setExpenseFormData] = useState({
    category: '',
    description: '',
    amount: 0,
    payment_mode: 'cash' as 'cash' | 'upi' | 'both',
    expense_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const loadData = async () => {
      if (!purchases.length) setLoading(true);
      try {
        const [purchasesData, expensesData, productsData, customersData] = await Promise.all([
          supabaseService.getPurchases(),
          supabaseService.getExpenses(),
          supabaseService.getProducts(),
          supabaseService.getCustomers()
        ]);
        setPurchases(purchasesData);
        setExpenses(expensesData);
        setProducts(productsData);
        setCustomers(customersData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();

    // Listen for global data refresh events
    const handleRefresh = () => {
      loadData();
    };
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, []);

  useEffect(() => {
    if (isModalOpen && !formData.purchase_number) {
      supabaseService.getLastPurchaseNumber()
        .then(lastNum => {
          if (!lastNum) {
            setFormData(prev => ({ ...prev, purchase_number: '1' }));
            return;
          }

          const match = lastNum.match(/^(.*?)(\d+)$/);
          if (match) {
            const prefix = match[1];
            const num = parseInt(match[2], 10);
            const nextNum = (num + 1).toString().padStart(match[2].length, '0');
            setFormData(prev => ({ ...prev, purchase_number: `${prefix}${nextNum}` }));
          } else {
            setFormData(prev => ({ ...prev, purchase_number: `${lastNum}-1` }));
          }
        })
        .catch(err => {
          console.error('Failed to fetch last purchase number:', err);
          setFormData(prev => ({ ...prev, purchase_number: (purchases.length + 1).toString() }));
        });
    }
  }, [isModalOpen]);

  useEffect(() => {
    const subtotal = formData.items.reduce((acc, item) => acc + item.total, 0);
    const total = subtotal + formData.additional_charges - formData.discount_amount;
    const balance = Math.max(0, total - (formData.amount_paid || 0));
    const status = balance <= 0 ? 'paid' : ((formData.amount_paid || 0) > 0 ? 'partial' : 'unpaid');
    setFormData(prev => ({ ...prev, subtotal, total_amount: total, balance_due: balance, payment_status: status }));
  }, [formData.items, formData.additional_charges, formData.discount_amount, formData.amount_paid]);

  const fetchPurchases = async () => {
    try {
      const data = await supabaseService.getPurchases();
      setPurchases(data);
    } catch (error) {
      console.error('Error fetching purchases:', error);
    }
  };

  const fetchExpenses = async () => {
    try {
      const data = await supabaseService.getExpenses();
      setExpenses(data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await supabaseService.getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLoading) return;
    
    try {
      setSaveLoading(true);
      if (editingPurchaseId) {
        await supabaseService.updatePurchase(editingPurchaseId, formData);
      } else {
        await supabaseService.createPurchase(formData);
      }
      setIsModalOpen(false);
      setEditingPurchaseId(null);
      setFormData({
        supplier_name: '',
        purchase_number: '',
        invoice_number: '',
        purchase_date: new Date().toISOString().split('T')[0],
        subtotal: 0,
        tax_amount: 0,
        discount_amount: 0,
        additional_charges: 0,
        total_amount: 0,
        amount_paid: 0,
        balance_due: 0,
        payment_status: 'unpaid',
        payment_mode: 'cash',
        items: []
      });
      fetchPurchases();
    } catch (error) {
      console.error('Error saving purchase:', error);
      alert('Failed to save purchase');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseLoading) return;
    try {
      setExpenseLoading(true);
      await supabaseService.createExpense(expenseFormData);
      setIsExpenseModalOpen(false);
      setExpenseFormData({
        category: '',
        description: '',
        amount: 0,
        payment_mode: 'cash',
        expense_date: new Date().toISOString().split('T')[0]
      });
      fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Failed to save expense');
    } finally {
      setExpenseLoading(false);
    }
  };

  const handleNewProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (productLoading) return;
    try {
      setProductLoading(true);
      await supabaseService.createProduct(newProductData as any);
      setIsNewProductModalOpen(false);
      setNewProductData({
        name: '',
        category: '',
        purchase_price: 0,
        selling_price: 0,
        stock_quantity: 0,
        tax_percentage: 0,
        unit: 'pcs'
      });
      fetchProducts();
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Failed to add product');
    } finally {
      setProductLoading(false);
    }
  };

  const deleteExpense = (id: number) => {
    setExpenseToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setDeleteLoading(true);
    try {
      await supabaseService.deleteExpense(expenseToDelete);
      setIsDeleteModalOpen(false);
      setExpenseToDelete(null);
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeletePurchase = (id: number) => {
    setPurchaseToDelete(id);
    setIsPurchaseDeleteModalOpen(true);
  };

  const confirmDeletePurchase = async () => {
    if (!purchaseToDelete) return;
    setDeleteLoading(true);
    try {
      await supabaseService.deletePurchase(purchaseToDelete);
      setIsPurchaseDeleteModalOpen(false);
      setPurchaseToDelete(null);
      fetchPurchases();
    } catch (error) {
      console.error('Error deleting purchase:', error);
      alert('Failed to delete purchase');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEditPurchase = async (purchase: Purchase) => {
    try {
      const items = await supabaseService.getPurchaseItems(purchase.id);
      setEditingPurchaseId(purchase.id);
      setFormData({
        supplier_name: purchase.supplier_name,
        purchase_number: purchase.purchase_number || '',
        invoice_number: purchase.invoice_number || '',
        purchase_date: purchase.purchase_date.split('T')[0],
        subtotal: purchase.subtotal,
        tax_amount: purchase.tax_amount,
        discount_amount: purchase.discount_amount,
        additional_charges: purchase.additional_charges,
        total_amount: purchase.total_amount,
        amount_paid: purchase.total_amount - (purchase.balance_due || 0),
        balance_due: purchase.balance_due || 0,
        payment_status: purchase.payment_status,
        payment_mode: purchase.payment_mode as any,
        items: items.map((item: any) => ({
          product_id: item.product_id,
          name: item.products?.name || 'Unknown Product',
          quantity: item.quantity,
          price: item.price,
          total: item.total
        }))
      });
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error loading purchase details:', error);
      alert('Failed to load purchase details');
    }
  };

  const addItemRow = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: 0, quantity: 1 }]
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Purchases</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Track restocking and expenses.</p>
        </div>
        <button 
          onClick={() => {
            if (activeTab === 'records') {
              setEditingPurchaseId(null);
              setFormData({
                supplier_name: '',
                purchase_number: '',
                invoice_number: '',
                purchase_date: new Date().toISOString().split('T')[0],
                subtotal: 0,
                tax_amount: 0,
                discount_amount: 0,
                additional_charges: 0,
                total_amount: 0,
                amount_paid: 0,
                balance_due: 0,
                payment_status: 'unpaid',
                payment_mode: 'cash',
                items: []
              });
              setIsModalOpen(true);
            } else {
              setIsExpenseModalOpen(true);
            }
          }}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg text-sm"
        >
          <Plus size={18} />
          {activeTab === 'records' ? 'Purchase' : 'Expense'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit overflow-x-auto no-scrollbar scroll-smooth relative">
        <div className="flex min-w-max">
          <button 
            onClick={() => setActiveTab('records')}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold transition-all relative z-10 text-xs",
              activeTab === 'records' 
                ? "text-indigo-600" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            {activeTab === 'records' && (
              <motion.div 
                layoutId="activeTab"
                className="absolute inset-0 bg-white dark:bg-slate-900 rounded-lg shadow-sm"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-20 flex items-center gap-2">
              <List size={14} />
              Records
            </span>
          </button>
          <button 
            onClick={() => setActiveTab('expenses')}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold transition-all relative z-10 text-xs",
              activeTab === 'expenses' 
                ? "text-indigo-600" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            {activeTab === 'expenses' && (
              <motion.div 
                layoutId="activeTab"
                className="absolute inset-0 bg-white dark:bg-slate-900 rounded-lg shadow-sm"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-20 flex items-center gap-2">
              <Receipt size={14} />
              Expenses
            </span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1">
        <div className="flex gap-2 min-w-max">
          {[
            { id: 'all', label: 'All Purchases' },
            { id: 'paid', label: 'Paid' },
            { id: 'partial', label: 'Partial' },
            { id: 'unpaid', label: 'Pending' }
          ].map((status) => (
            <button
              key={status.id}
              onClick={() => setFilterStatus(status.id as any)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap",
                filterStatus === status.id
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700"
              )}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'records' ? (
          <motion.div 
            key="records"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-bottom border-slate-200 dark:border-slate-800">
                    <th className="px-3 sm:px-6 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">ID</th>
                    <th className="px-3 sm:px-6 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Supplier</th>
                    <th className="hidden md:table-cell px-3 sm:px-6 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="px-3 sm:px-6 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Paid</th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Due</th>
                    <th className="px-3 sm:px-6 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-3 sm:px-6 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr><td colSpan={8} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">Loading purchases...</td></tr>
                  ) : purchases.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">No purchase records found.</td></tr>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {purchases
                        .filter(p => filterStatus === 'all' || p.payment_status === filterStatus)
                        .map((purchase, index) => (
                        <motion.tr 
                          key={purchase.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: index * 0.03 }}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group text-xs font-bold"
                        >
                          <td className="px-3 sm:px-6 py-2">
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded-lg">
                              #{purchase.purchase_number || purchase.id}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-2">
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black text-slate-900 dark:text-white truncate max-w-[80px] sm:max-w-none">{purchase.supplier_name}</span>
                              <span className="md:hidden text-[9px] text-slate-500 font-bold">{formatDate(purchase.purchase_date)}</span>
                            </div>
                          </td>
                          <td className="hidden md:table-cell px-3 sm:px-6 py-2 text-[11px] text-slate-600 dark:text-slate-400">
                            {formatDate(purchase.purchase_date)}
                          </td>
                          <td className="px-3 sm:px-6 py-2">
                            <span className="text-[11px] font-black text-slate-900 dark:text-white">{formatCurrency(purchase.total_amount)}</span>
                          </td>
                          <td className="hidden sm:table-cell px-3 sm:px-6 py-2">
                            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(purchase.amount_paid || (purchase.total_amount - (purchase.balance_due || 0)))}
                            </span>
                          </td>
                          <td className="hidden sm:table-cell px-3 sm:px-6 py-2">
                            <span className={cn(
                              "text-[11px] font-black",
                              purchase.balance_due > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400"
                            )}>
                              {formatCurrency(purchase.balance_due)}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-2">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter",
                              purchase.payment_status === 'paid' 
                                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50" 
                                : purchase.payment_status === 'partial'
                                ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50"
                                : "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/50"
                            )}>
                              {purchase.payment_status}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-2 text-right">
                            <div className="flex items-center justify-end gap-1 sm:gap-2">
                              <button 
                                onClick={() => {
                                  setSelectedPurchase(purchase);
                                  setIsPreviewOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded transition-all"
                              >
                                <Eye size={14} />
                              </button>
                              <button 
                                onClick={() => handleEditPurchase(purchase)}
                                className="p-1 text-slate-400 hover:text-amber-600 hover:bg-white rounded transition-all"
                              >
                                <Edit3 size={14} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="expenses"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {loading ? (
              <div className="col-span-full py-20 text-center text-slate-500">Loading expenses...</div>
            ) : expenses.length === 0 ? (
              <div className="col-span-full py-20 text-center text-slate-500">No expenses found.</div>
            ) : (
              <AnimatePresence mode="popLayout">
                {expenses.map((expense, index) => (
                  <motion.div 
                    key={expense.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center text-rose-600">
                        <Receipt size={24} />
                      </div>
                      <button 
                        onClick={() => deleteExpense(expense.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</p>
                        <p className="font-bold text-slate-900 dark:text-white">{expense.category}</p>
                      </div>
                      {expense.description && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{expense.description}</p>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{formatDate(expense.expense_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</p>
                          <p className="text-lg font-black text-rose-600">{formatCurrency(expense.amount)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{expense.payment_mode}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header - Refined Style */}
              <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Record Purchase</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Inventory Restocking</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Purchase #</p>
                    <p className="text-sm font-black text-indigo-600">{formData.purchase_number}</p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors">
                    <X size={24} className="text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Details */}
                  <div className="lg:col-span-2 space-y-8">
                    {/* Supplier & Date Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Supplier / Party Name</label>
                        <div className="relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                          <input 
                            type="text"
                            placeholder="Search or enter supplier name"
                            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 dark:text-white font-bold transition-all"
                            value={formData.supplier_name}
                            onChange={(e) => setFormData({...formData, supplier_name: e.target.value})}
                          />
                        </div>
                        <button className="mt-2 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center gap-1 hover:underline">
                          <Plus size={12} /> ADD NEW PARTY
                        </button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Purchase Date</label>
                        <div className="relative group">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                          <input 
                            type="date" 
                            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 dark:text-white font-bold transition-all"
                            value={formData.purchase_date}
                            onChange={(e) => setFormData({...formData, purchase_date: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Items Section - Recipe 1 Inspired */}
                    <div className="bg-white dark:bg-slate-800 rounded-[32px] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Items ({formData.items.length})</span>
                        <button 
                          onClick={() => setIsItemSelectorOpen(true)}
                          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline"
                        >
                          + Add Items
                        </button>
                      </div>
                      
                      <div className="min-h-[200px]">
                        {formData.items.length === 0 ? (
                          <div className="py-20 text-center">
                            <Box size={40} className="mx-auto text-slate-200 dark:text-slate-700 mb-4" />
                            <p className="text-sm text-slate-400 font-medium">No items added to this purchase.</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-50 dark:divide-slate-700">
                            {formData.items.map((item, index) => (
                              <div key={index} className="px-6 py-4 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                <div className="flex-1">
                                  <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                    {item.quantity} Units @ {formatCurrency(item.price)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-6">
                                  <p className="font-black text-slate-900 dark:text-white">{formatCurrency(item.total)}</p>
                                  <button 
                                    onClick={() => {
                                      const newItems = formData.items.filter((_, i) => i !== index);
                                      setFormData({...formData, items: newItems});
                                    }}
                                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Summary & Payment */}
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[32px] border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-4">Summary</h4>
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-400 uppercase">Subtotal</span>
                          <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(formData.subtotal)}</span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase">Add. Charges</span>
                            <input 
                              type="number"
                              className="w-24 bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-lg text-right font-bold outline-none dark:text-white text-sm"
                            value={formData.additional_charges || ''}
                            onChange={(e) => setFormData({...formData, additional_charges: e.target.value === '' ? 0 : Number(e.target.value)})}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase">Discount</span>
                            <input 
                              type="number"
                              className="w-24 bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-lg text-right font-bold outline-none dark:text-white text-sm text-rose-500"
                            value={formData.discount_amount || ''}
                            onChange={(e) => setFormData({...formData, discount_amount: e.target.value === '' ? 0 : Number(e.target.value)})}
                            />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-black text-slate-900 dark:text-white uppercase">Total</span>
                            <span className="text-2xl font-black text-indigo-600">{formatCurrency(formData.total_amount)}</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase">Amount Paid</span>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setFormData({...formData, amount_paid: formData.total_amount})}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                              >
                                Pay Full
                              </button>
                              <input 
                                type="number"
                                className="w-32 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg text-right font-bold outline-none text-indigo-600 text-sm"
                                value={formData.amount_paid || ''}
                                onChange={(e) => setFormData({...formData, amount_paid: e.target.value === '' ? 0 : Number(e.target.value)})}
                              />
                            </div>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Balance Due</span>
                            <span className="font-bold text-rose-500">{formatCurrency(formData.balance_due)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[32px] border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-4">Payment</h4>
                      
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { id: 'unpaid', label: 'Unpaid / Credit', icon: CreditCard },
                          { id: 'cash', label: 'Cash Payment', icon: Banknote },
                          { id: 'upi', label: 'Online / UPI', icon: ShoppingBag }
                        ].map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => {
                              if (mode.id === 'unpaid') {
                                setFormData({...formData, amount_paid: 0});
                              } else {
                                setFormData({...formData, amount_paid: formData.total_amount, payment_mode: mode.id as any});
                              }
                            }}
                            className={cn(
                              "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                              (mode.id === 'unpaid' && formData.payment_status === 'unpaid') || 
                              (mode.id === 'cash' && formData.payment_status === 'paid' && formData.payment_mode === 'cash') ||
                              (mode.id === 'upi' && formData.payment_status === 'paid' && formData.payment_mode === 'upi')
                                ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" 
                                : "border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center",
                              (mode.id === 'unpaid' && formData.payment_status === 'unpaid') || 
                              (mode.id === 'cash' && formData.payment_status === 'paid' && formData.payment_mode === 'cash') ||
                              (mode.id === 'upi' && formData.payment_status === 'paid' && formData.payment_mode === 'upi')
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                            )}>
                              <mode.icon size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{mode.label}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {mode.id === 'unpaid' ? 'Pay Later' : 'Pay Now'}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>

                      {formData.payment_status !== 'paid' && (
                        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-800/50 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">Balance Due</span>
                          <span className="text-sm font-black text-rose-600 dark:text-rose-400">{formatCurrency(formData.balance_due)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-4">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-8 py-4 text-slate-500 font-bold hover:text-slate-700 transition-colors"
                >
                  Discard
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={!formData.supplier_name || formData.items.length === 0 || saveLoading}
                  className="px-12 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 dark:shadow-indigo-900/20 transition-all transform active:scale-95"
                >
                  {saveLoading ? 'Saving...' : 'Save Purchase'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Item Selector Modal */}
      <AnimatePresence>
        {isItemSelectorOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsItemSelectorOpen(false)}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Select Items</h3>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setIsNewProductModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all"
                  >
                    <Plus size={16} />
                    New Product
                  </button>
                  <button onClick={() => setIsItemSelectorOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search products..." 
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none dark:text-white text-sm"
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                {products
                  .filter(p => (p.name || '').toLowerCase().includes((productSearchTerm || '').toLowerCase()))
                  .map(product => {
                  const existing = formData.items.find(i => i.product_id === product.id);
                  return (
                    <div key={product.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{product.name}</p>
                        <p className="text-xs text-slate-500">Price: {formatCurrency(product.purchase_price)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {existing ? (
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => {
                                const newItems = formData.items.map(i => 
                                  i.product_id === product.id 
                                    ? { ...i, quantity: Math.max(0, i.quantity - 1), total: Math.max(0, i.quantity - 1) * i.price } 
                                    : i
                                ).filter(i => i.quantity > 0);
                                setFormData({...formData, items: newItems});
                              }}
                              className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold dark:text-white"
                            >
                              -
                            </button>
                            <span className="font-bold dark:text-white">{existing.quantity}</span>
                            <button 
                              onClick={() => {
                                const newItems = formData.items.map(i => 
                                  i.product_id === product.id 
                                    ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price } 
                                    : i
                                );
                                setFormData({...formData, items: newItems});
                              }}
                              className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold dark:text-white"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => {
                              setFormData({
                                ...formData,
                                items: [...formData.items, { 
                                  product_id: product.id, 
                                  name: product.name, 
                                  quantity: 1, 
                                  price: product.purchase_price, 
                                  total: product.purchase_price 
                                }]
                              });
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => setIsItemSelectorOpen(false)}
                  className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Expense Modal */}
      <AnimatePresence>
        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExpenseModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Record New Expense</h3>
                <button onClick={() => setIsExpenseModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleExpenseSubmit} className="p-6 space-y-4 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Category *</label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                    value={expenseFormData.category}
                    onChange={(e) => setExpenseFormData({...expenseFormData, category: e.target.value})}
                  >
                    <option value="">Select Category</option>
                    <option value="Rent">Rent</option>
                    <option value="Electricity">Electricity</option>
                    <option value="Water">Water</option>
                    <option value="Internet">Internet</option>
                    <option value="Salary">Salary</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Description</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                    value={expenseFormData.description}
                    onChange={(e) => setExpenseFormData({...expenseFormData, description: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Amount *</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none font-bold"
                      placeholder="0"
                      value={expenseFormData.amount || ''}
                      onChange={(e) => setExpenseFormData({...expenseFormData, amount: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Date</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      value={expenseFormData.expense_date}
                      onChange={(e) => setExpenseFormData({...expenseFormData, expense_date: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Payment Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['cash', 'upi'].map(mode => (
                      <button 
                        key={mode}
                        type="button"
                        onClick={() => setExpenseFormData({...expenseFormData, payment_mode: mode as any})}
                        className={cn(
                          "py-2 rounded-xl text-xs font-bold border transition-all",
                          expenseFormData.payment_mode === mode 
                            ? "bg-indigo-600 border-indigo-600 text-white" 
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                        )}
                      >
                        {mode.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsExpenseModalOpen(false)}
                    className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={expenseLoading}
                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 disabled:opacity-50"
                  >
                    {expenseLoading ? 'Saving...' : 'Save Expense'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isPreviewOpen && selectedPurchase && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPreviewOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 text-center overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Purchase Invoice</h3>
                  <button onClick={() => setIsPreviewOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <X size={20} className="text-slate-500" />
                  </button>
                </div>

                <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-left relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Supplier</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{selectedPurchase.supplier_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase">Purchase #</p>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{selectedPurchase.purchase_number || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase mb-1">Date</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{formatDate(selectedPurchase.purchase_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase mb-1">Status</p>
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-md",
                        selectedPurchase.payment_status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      )}>
                        {selectedPurchase.payment_status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-bold dark:text-white">{formatCurrency(selectedPurchase.subtotal)}</span>
                    </div>
                    {selectedPurchase.discount_amount > 0 && (
                      <div className="flex justify-between text-xs text-rose-500">
                        <span>Discount</span>
                        <span className="font-bold">-{formatCurrency(selectedPurchase.discount_amount)}</span>
                      </div>
                    )}
                    {selectedPurchase.additional_charges > 0 && (
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Add. Charges</span>
                        <span className="font-bold">+{formatCurrency(selectedPurchase.additional_charges)}</span>
                      </div>
                    )}
                    <div className="pt-2 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">Total Amount</span>
                      <span className="text-xl font-black text-indigo-600">{formatCurrency(selectedPurchase.total_amount)}</span>
                    </div>
                    {selectedPurchase.balance_due > 0 && (
                      <div className="flex justify-between text-xs text-rose-600 font-bold pt-1">
                        <span>Balance Due</span>
                        <span>{formatCurrency(selectedPurchase.balance_due)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => setIsPreviewOpen(false)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Product Modal */}
      <AnimatePresence>
        {isNewProductModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewProductModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add New Product</h3>
                <button onClick={() => setIsNewProductModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleNewProductSubmit} className="p-6 space-y-4 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Product Name *</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                    value={newProductData.name}
                    onChange={(e) => setNewProductData({...newProductData, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Category</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      value={newProductData.category}
                      onChange={(e) => setNewProductData({...newProductData, category: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Unit</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      value={newProductData.unit}
                      onChange={(e) => setNewProductData({...newProductData, unit: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Purchase Price *</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      placeholder="0"
                      value={newProductData.purchase_price || ''}
                      onChange={(e) => setNewProductData({...newProductData, purchase_price: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Selling Price *</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      placeholder="0"
                      value={newProductData.selling_price || ''}
                      onChange={(e) => setNewProductData({...newProductData, selling_price: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Stock Qty</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      placeholder="0"
                      value={newProductData.stock_quantity || ''}
                      onChange={(e) => setNewProductData({...newProductData, stock_quantity: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Tax (%)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      placeholder="0"
                      value={newProductData.tax_percentage || ''}
                      onChange={(e) => setNewProductData({...newProductData, tax_percentage: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsNewProductModalOpen(false)}
                    className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={productLoading}
                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 disabled:opacity-50"
                  >
                    {productLoading ? 'Saving...' : 'Save Product'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteExpense}
        loading={deleteLoading}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This will update your account balances."
        confirmText="Delete Expense"
      />

      <ConfirmModal 
        isOpen={isPurchaseDeleteModalOpen}
        onClose={() => setIsPurchaseDeleteModalOpen(false)}
        onConfirm={confirmDeletePurchase}
        loading={deleteLoading}
        title="Delete Purchase"
        message="Are you sure you want to delete this purchase? This will reverse stock updates and account balance changes."
        confirmText="Delete Purchase"
      />
    </div>
  );
}
