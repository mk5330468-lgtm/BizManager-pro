import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Building2, Phone, Mail, MapPin, History, X, Wallet, Calendar, CreditCard, CheckCircle2, Save, Edit, Trash2, FileText, AlertTriangle, Send, PackageSearch, ChevronDown, ChevronUp } from 'lucide-react';
import { Supplier } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { supabaseService } from '../services/supabaseService';
import ConfirmModal from '../components/ConfirmModal';

export default function Suppliers() {
  const queryClient = useQueryClient();
  
  const { data: suppliers = [], isLoading: loading, refetch: fetchSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supabaseService.getSuppliers(),
    staleTime: 1000 * 10, // 10 seconds
  });

  const { data: business } = useQuery({
    queryKey: ['business'],
    queryFn: () => supabaseService.getBusiness(),
    staleTime: 1000 * 6 * 60,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<Supplier | null>(null);
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = useState<Supplier | null>(null);
  const [supplierPayments, setSupplierPayments] = useState<any[]>([]);
  const [supplierPurchases, setSupplierPurchases] = useState<any[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'purchases' | 'payments'>('overview');
  const [pendingPurchases, setPendingPurchases] = useState<any[]>([]);
  const [selectedPurchases, setSelectedPurchases] = useState<{[key: number]: number}>({});
  const [showPendingPurchases, setShowPendingPurchases] = useState(false);
  
  // Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

  // Payment Form State
  const [paymentData, setPaymentData] = useState({
    amount: '' as number | '',
    cash_amount: '' as number | '',
    upi_amount: '' as number | '',
    payment_mode: 'cash' as 'cash' | 'upi' | 'both',
    payment_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', address: '', gst_number: '', notes: ''
  });

  useEffect(() => {
    if (selectedSupplierForPayment && isPaymentModalOpen) {
      supabaseService.getSupplierPurchases(selectedSupplierForPayment.id)
        .then(purchases => {
          const pending = purchases.filter((p: any) => p.payment_status !== 'paid');
          setPendingPurchases(pending);
          setSelectedPurchases({});
        })
        .catch(err => console.error('Failed to fetch pending purchases:', err));
    } else {
      setPendingPurchases([]);
      setSelectedPurchases({});
    }
  }, [selectedSupplierForPayment, isPaymentModalOpen]);

  useEffect(() => {
    // Listen for global data refresh events
    const handleRefresh = () => {
      fetchSuppliers();
      if (selectedSupplierForHistory) {
        fetchSupplierHistory(selectedSupplierForHistory.id);
      }
      queryClient.invalidateQueries({ queryKey: ['business'] });
    };
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, [fetchSuppliers, queryClient]);

  const handleDelete = (id: number) => {
    setSupplierToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!supplierToDelete) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await supabaseService.deleteSupplier(supplierToDelete);
      setIsDeleteModalOpen(false);
      setSupplierToDelete(null);
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error: any) {
      console.error('Delete error:', error);
      setDeleteError(error.response?.data?.error || 'Failed to delete supplier. It might have linked records.');
      setIsDeleteModalOpen(false);
      setIsErrorModalOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supabaseService.createSupplier(formData as any);
      setIsModalOpen(false);
      setFormData({ name: '', phone: '', email: '', address: '', gst_number: '', notes: '' });
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error) {
      console.error('Error saving supplier:', error);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentData.amount || Number(paymentData.amount) <= 0) return alert('Please enter a valid amount');

    const totalAmount = Number(paymentData.amount);
    const settlements = Object.entries(selectedPurchases)
      .filter(([_, amt]: [string, any]) => (Number(amt) || 0) > 0)
      .map(([id, amt]) => ({
        purchase_id: Number(id),
        amount: amt
      }));

    const settledTotal = settlements.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
    if (settledTotal > totalAmount) {
      return alert(`Settled amount (${settledTotal}) cannot exceed total payment amount (${totalAmount})`);
    }

    setPaymentLoading(true);
    try {
      await supabaseService.recordSupplierPayment({
        supplier_id: selectedSupplierForPayment?.id || null,
        amount: totalAmount,
        cash_amount: paymentData.cash_amount || undefined,
        upi_amount: paymentData.upi_amount || undefined,
        payment_mode: paymentData.payment_mode,
        payment_date: paymentData.payment_date,
        notes: paymentData.notes,
        settlements: settlements.length > 0 ? settlements : undefined
      });
      setPaymentSuccess(true);
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const fetchSupplierHistory = async (supplierId: number) => {
    setHistoryLoading(true);
    try {
      const [payments, purchases] = await Promise.all([
        supabaseService.getSupplierHistory(supplierId),
        supabaseService.getSupplierPurchases(supplierId)
      ]);
      setSupplierPayments(payments);
      setSupplierPurchases(purchases);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    (s.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
    (s.phone || '').includes(searchTerm)
  );

  const currentSupplier = selectedSupplierForHistory 
    ? (suppliers.find(s => s.id === selectedSupplierForHistory.id) || selectedSupplierForHistory) 
    : null;

  return (
    <div className="space-y-4">
      {/* Header removed for merge */}


      {fetchError && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-4 rounded-xl flex items-center gap-3 text-rose-700 dark:text-rose-400">
          <AlertTriangle size={20} />
          <p className="flex-1">{fetchError}</p>
          <button 
            onClick={fetchSuppliers}
            className="text-sm font-semibold underline hover:no-underline"
          >
            Try Again
          </button>
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Search suppliers..." 
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold transition-all text-xs shrink-0"
        >
          <Building2 size={16} />
          Add
        </button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              key="loading"
              className="col-span-full py-8 text-center text-slate-500 dark:text-slate-400 text-xs"
            >
              Loading...
            </motion.div>
          ) : filteredSuppliers.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              key="empty"
              className="col-span-full py-8 text-center text-slate-500 dark:text-slate-400 text-xs"
            >
              No suppliers found.
            </motion.div>
          ) : filteredSuppliers.map((supplier) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={supplier.id}
              className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
            >
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase">
                {supplier.name.substring(0, 2)}
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-tight">Due Amount</p>
                <p className={cn(
                  "text-base font-black",
                  supplier.outstanding_balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                )}>
                  {formatCurrency(supplier.outstanding_balance)}
                </p>
              </div>
            </div>
            
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3 truncate">{supplier.name}</h3>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                <Phone size={14} className="text-slate-400" />
                <span>{supplier.phone || 'No phone'}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                <MapPin size={14} className="text-slate-400" />
                <span className="truncate">{supplier.address || 'No address'}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
              <button 
                onClick={() => {
                  setSelectedSupplierForPayment(supplier);
                  setIsPaymentModalOpen(true);
                  setPaymentSuccess(false);
                  setPaymentData({
                    amount: '',
                    cash_amount: '',
                    upi_amount: '',
                    payment_mode: 'cash',
                    payment_date: new Date().toISOString().split('T')[0],
                    notes: ''
                  });
                }}
                className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all flex items-center gap-1.5 px-3"
                title="Pay Out"
              >
                <Wallet size={16} />
                <span className="text-[10px] font-bold uppercase">Pay Out</span>
              </button>
              <button 
                onClick={() => {
                  setSelectedSupplierForHistory(supplier);
                  setIsHistoryModalOpen(true);
                  fetchSupplierHistory(supplier.id);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                title="History"
              >
                <History size={16} />
              </button>
              <button 
                onClick={() => handleDelete(supplier.id)}
                className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </motion.div>
        ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add New Supplier</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Supplier Name *</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Phone</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">GST Number</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      value={formData.gst_number || ''}
                      onChange={(e) => setFormData({...formData, gst_number: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Email</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Address</label>
                  <textarea 
                    rows={2}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none resize-none"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Notes</label>
                  <textarea 
                    rows={2}
                    placeholder="Add supplier notes..."
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none resize-none"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
                  >
                    Save Supplier
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal (Pay Out) */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !paymentLoading && setIsPaymentModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {!paymentSuccess ? (
                <div className="overflow-y-auto">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Record Pay Out</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedSupplierForPayment ? `Making payment to ${selectedSupplierForPayment.name}` : 'General Supplier Payment'}
                      </p>
                    </div>
                    <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                      <X size={20} />
                    </button>
                  </div>
                  <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Balance Due</span>
                        <span className="text-lg font-black text-rose-600">{formatCurrency(selectedSupplierForPayment?.outstanding_balance || 0)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                            type="date" 
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white text-sm"
                            value={paymentData.payment_date}
                            onChange={(e) => setPaymentData({...paymentData, payment_date: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mode</label>
                        <select 
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white text-sm"
                          value={paymentData.payment_mode}
                          onChange={(e) => setPaymentData({...paymentData, payment_mode: e.target.value as any})}
                        >
                          <option value="cash">Cash</option>
                          <option value="upi">UPI</option>
                          <option value="both">Both (Cash & UPI)</option>
                        </select>
                      </div>
                    </div>

                    {paymentData.payment_mode === 'both' ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cash Amount</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                            <input 
                              required
                              type="number" 
                              placeholder="0"
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white font-bold"
                              value={paymentData.cash_amount || ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? '' : Number(e.target.value);
                                const upi = Number(paymentData.upi_amount) || 0;
                                setPaymentData({
                                  ...paymentData, 
                                  cash_amount: val,
                                  amount: (Number(val) || 0) + upi
                                });
                              }}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">UPI Amount</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                            <input 
                              required
                              type="number" 
                              placeholder="0"
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white font-bold"
                              value={paymentData.upi_amount || ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? '' : Number(e.target.value);
                                const cash = Number(paymentData.cash_amount) || 0;
                                setPaymentData({
                                  ...paymentData, 
                                  upi_amount: val,
                                  amount: (Number(val) || 0) + cash
                                });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount Paid</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                          <input 
                            required
                            type="number" 
                            placeholder="0.00"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white font-bold text-lg"
                            value={paymentData.amount ?? ''}
                            onChange={(e) => setPaymentData({...paymentData, amount: e.target.value === '' ? '' : Number(e.target.value)})}
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Notes</label>
                      <textarea 
                        rows={2}
                        placeholder="Optional notes..."
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white text-sm resize-none"
                        value={paymentData.notes || ''}
                        onChange={(e) => setPaymentData({...paymentData, notes: e.target.value})}
                      />
                    </div>

                    {/* Pending Purchases Section */}
                    {selectedSupplierForPayment && pendingPurchases.length > 0 && (
                      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden mt-4">
                        <button
                          type="button"
                          onClick={() => setShowPendingPurchases(!showPendingPurchases)}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <FileText size={18} className="text-slate-400" />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Pending Purchases</span>
                            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-full">
                              {pendingPurchases.length}
                            </span>
                          </div>
                          {showPendingPurchases ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        <AnimatePresence>
                          {showPendingPurchases && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Settled: <span className="text-emerald-600 dark:text-emerald-400">₹{Object.values(selectedPurchases).reduce((a: number, b: number) => a + b, 0)}</span> / ₹{paymentData.amount || 0}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const total = Number(paymentData.amount) || 0;
                                      let remaining = total;
                                      const newSelected: {[key: number]: number} = {};
                                      
                                      pendingPurchases.forEach(p => {
                                        if (remaining <= 0) return;
                                        const due = Number(p.total_amount) - (Number(p.amount_paid) || 0);
                                        const settle = Math.min(remaining, due);
                                        newSelected[p.id] = settle;
                                        remaining -= settle;
                                      });
                                      setSelectedPurchases(newSelected);
                                    }}
                                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                  >
                                    Auto-Settle
                                  </button>
                                </div>

                                {pendingPurchases.map((purchase) => {
                                  const due = Number(purchase.total_amount) - (Number(purchase.amount_paid) || 0);
                                  const isSelected = selectedPurchases[purchase.id] !== undefined;
                                  
                                  return (
                                    <div 
                                      key={purchase.id}
                                      className={cn(
                                        "p-3 rounded-xl border transition-all cursor-pointer",
                                        isSelected 
                                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20" 
                                          : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                                      )}
                                      onClick={() => {
                                        if (isSelected) {
                                          const next = { ...selectedPurchases };
                                          delete next[purchase.id];
                                          setSelectedPurchases(next);
                                        } else {
                                          let currentSettled = 0;
                                          Object.values(selectedPurchases).forEach(v => { currentSettled += Number(v); });
                                          const remaining = Math.max(0, (Number(paymentData.amount) || 0) - currentSettled);
                                          if (remaining > 0) {
                                            setSelectedPurchases({
                                              ...selectedPurchases,
                                              [purchase.id]: Math.min(remaining, due)
                                            });
                                          }
                                        }
                                      }}
                                    >
                                      <div className="flex justify-between items-start mb-1">
                                        <div>
                                          <p className="text-xs font-bold text-slate-900 dark:text-white">Purchase #{purchase.purchase_number}</p>
                                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{new Date(purchase.purchase_date).toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-xs font-black text-rose-600">₹{due}</p>
                                          <p className="text-[10px] text-slate-400">Total: ₹{purchase.total_amount}</p>
                                        </div>
                                      </div>
                                      
                                      {isSelected && (
                                        <div className="mt-2 pt-2 border-t border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-2">
                                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Settling</span>
                                          <input 
                                            type="number"
                                            className="w-20 px-2 py-1 text-xs font-bold text-right bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded focus:outline-none"
                                            value={selectedPurchases[purchase.id]}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              const val = Math.min(due, Number(e.target.value) || 0);
                                              setSelectedPurchases({
                                                ...selectedPurchases,
                                                [purchase.id]: val
                                              });
                                            }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                      <button 
                        type="button"
                        onClick={() => setIsPaymentModalOpen(false)}
                        className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 font-bold transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={paymentLoading}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 flex items-center justify-center gap-2"
                      >
                        <Save size={18} />
                        {paymentLoading ? 'Saving...' : 'Record Pay Out'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-6">
                    <CheckCircle2 size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Pay Out Recorded!</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-8">
                    The payment to <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedSupplierForPayment?.name}</span> has been successfully recorded.
                  </p>
                  <button 
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
                  >
                    Done
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Supplier History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && currentSupplier && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 uppercase">
                    {currentSupplier.name.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">{currentSupplier.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Phone size={12} /> {currentSupplier.phone || 'No phone'}
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Calendar size={12} /> Supplier Since {new Date(currentSupplier.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X size={20} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-white dark:bg-slate-900">
                <button 
                  onClick={() => setActiveTab('overview')}
                  className={cn(
                    "px-4 py-4 text-sm font-bold border-b-2 transition-all",
                    activeTab === 'overview' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  Overview
                </button>
                <button 
                  onClick={() => setActiveTab('purchases')}
                  className={cn(
                    "px-4 py-4 text-sm font-bold border-b-2 transition-all",
                    activeTab === 'purchases' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  Purchase History ({supplierPurchases.length})
                </button>
                <button 
                  onClick={() => setActiveTab('payments')}
                  className={cn(
                    "px-4 py-4 text-sm font-bold border-b-2 transition-all",
                    activeTab === 'payments' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  Payment History ({supplierPayments.length})
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {historyLoading ? (
                  <div className="py-20 text-center text-slate-500 dark:text-slate-400">Loading profile data...</div>
                ) : (
                  <>
                    {activeTab === 'overview' && (
                      <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-5 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-black tracking-widest mb-1">Total Purchased</p>
                            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                              {formatCurrency(supplierPurchases.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0))}
                            </p>
                          </div>
                          <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-black tracking-widest mb-1">Total Paid Out</p>
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(supplierPayments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0))}
                            </p>
                          </div>
                          <div className="p-5 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                            <p className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-black tracking-widest mb-1">Balance Due</p>
                            <p className="text-2xl font-black text-rose-600">
                              {formatCurrency(currentSupplier.outstanding_balance)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Contact Information</h4>
                            <div className="space-y-3">
                              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <Mail size={16} className="text-slate-400" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{currentSupplier.email || 'No email provided'}</span>
                              </div>
                              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <MapPin size={16} className="text-slate-400" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{currentSupplier.address || 'No address provided'}</span>
                              </div>
                              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <CreditCard size={16} className="text-slate-400" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">GST: {currentSupplier.gst_number || 'Not registered'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Last Purchase</h4>
                            {supplierPurchases.length > 0 ? (
                              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Latest Order</span>
                                  <span className="text-xs font-black text-indigo-600">{new Date(supplierPurchases[0].purchase_date).toLocaleDateString()}</span>
                                </div>
                                <p className="text-lg font-black text-slate-900 dark:text-white mb-1">{formatCurrency(supplierPurchases[0].total_amount)}</p>
                                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                  <FileText size={10} /> Inv: {supplierPurchases[0].invoice_number || supplierPurchases[0].purchase_number}
                                </p>
                              </div>
                            ) : (
                              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-center min-h-[100px]">
                                <p className="text-xs text-slate-400 italic text-center">No purchases recorded yet</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'purchases' && (
                      <div className="space-y-4">
                        {supplierPurchases.length === 0 ? (
                          <div className="py-20 text-center text-slate-500 dark:text-slate-400 italic">No purchase history found.</div>
                        ) : (
                          <div className="space-y-3">
                            {supplierPurchases.map((purchase) => (
                              <div key={purchase.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md transition-all">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400">
                                    <PackageSearch size={20} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 dark:text-white">#{purchase.purchase_number}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                      {new Date(purchase.purchase_date).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-black text-slate-900 dark:text-white">{formatCurrency(purchase.total_amount)}</p>
                                  <span className={cn(
                                    "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                                    purchase.payment_status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                  )}>
                                    {purchase.payment_status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'payments' && (
                      <div className="space-y-4">
                        {supplierPayments.length === 0 ? (
                          <div className="py-20 text-center text-slate-500 dark:text-slate-400 italic">No payment records found.</div>
                        ) : (
                          <div className="space-y-3">
                            {supplierPayments.map((payment) => (
                              <div key={payment.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md transition-all">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <CreditCard size={20} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(payment.amount)}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                      {new Date(payment.payment_date).toLocaleDateString()} • {payment.payment_mode?.toUpperCase()}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {payment.purchase_id ? (
                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md border border-indigo-100 dark:border-indigo-800/50">
                                      Against Purchase
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                                      General Payout
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This action cannot be undone."
        loading={deleteLoading}
      />
    </div>
  );
}
