import React, { useState, useEffect } from 'react';
import { Search, Plus, UserPlus, Phone, Mail, MapPin, History, X, Wallet, Calendar, CreditCard, CheckCircle2, Save, Edit, Trash2, FileText, AlertTriangle, Send } from 'lucide-react';
import { Customer } from '../types';
import { formatCurrency, cn, formatWhatsAppLink } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { supabaseService } from '../services/supabaseService';
import ConfirmModal from '../components/ConfirmModal';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<Customer | null>(null);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Customer | null>(null);
  const [customerPayments, setCustomerPayments] = useState<any[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<any[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'payments'>('overview');
  
  // Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [business, setBusiness] = useState<any>(null);

  // Payment Form State
  const [paymentData, setPaymentData] = useState({
    amount: '' as number | '',
    payment_mode: 'cash' as 'cash' | 'upi',
    payment_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', address: '', gst_number: '', notes: ''
  });

  useEffect(() => {
    fetchCustomers();
    fetchBusiness();

    // Listen for global data refresh events
    const handleRefresh = () => {
      fetchCustomers();
      fetchBusiness();
    };
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, []);

  const fetchBusiness = async () => {
    try {
      const data = await supabaseService.getBusiness();
      setBusiness(data);
    } catch (error) {
      console.error('Error fetching business:', error);
    }
  };

  const sendReminder = (customer: Customer) => {
    if (customer.outstanding_balance <= 0) {
      alert('This customer has no outstanding balance.');
      return;
    }

    const message = `*Payment Reminder*
Hello ${customer.name},

This is a friendly reminder from *${business?.business_name || 'your business'}* regarding your outstanding balance of *${formatCurrency(customer.outstanding_balance)}*.

Kindly clear the dues at your earliest convenience. If you have already made the payment, please ignore this message.

Thank you!`;

    window.open(formatWhatsAppLink(customer.phone, message), '_blank');
  };

  const fetchCustomers = async () => {
    if (customers.length === 0) setLoading(true);
    setFetchError(null);
    try {
      const data = await supabaseService.getCustomers();
      setCustomers(data);
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      setFetchError(error.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    setCustomerToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await supabaseService.deleteCustomer(customerToDelete);
      setIsDeleteModalOpen(false);
      setCustomerToDelete(null);
      fetchCustomers();
    } catch (error: any) {
      console.error('Delete error:', error);
      setDeleteError(error.response?.data?.error || 'Failed to delete customer. It might have linked records.');
      setIsDeleteModalOpen(false);
      setIsErrorModalOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supabaseService.createCustomer(formData as any);
      setIsModalOpen(false);
      setFormData({ name: '', phone: '', email: '', address: '', gst_number: '', notes: '' });
      fetchCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentData.amount || Number(paymentData.amount) <= 0) return alert('Please enter a valid amount');

    setPaymentLoading(true);
    try {
      await supabaseService.recordCustomerPayment({
        customer_id: selectedCustomerForPayment?.id || null,
        amount: Number(paymentData.amount),
        payment_mode: paymentData.payment_mode,
        payment_date: paymentData.payment_date,
        notes: paymentData.notes
      });
      setPaymentSuccess(true);
      fetchCustomers();
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const fetchCustomerHistory = async (customerId: number) => {
    setHistoryLoading(true);
    try {
      const [payments, invoices] = await Promise.all([
        supabaseService.getCustomerHistory(customerId),
        supabaseService.getCustomerInvoices(customerId)
      ]);
      setCustomerPayments(payments);
      setCustomerInvoices(invoices);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    (c.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
    (c.phone || '').includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">CRM & Customers</h2>
          <p className="text-slate-500 dark:text-slate-400">Manage your client relationships, history and balances.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
        >
          <UserPlus size={20} />
          Add Customer
        </button>
      </motion.div>

      {fetchError && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-4 rounded-xl flex items-center gap-3 text-rose-700 dark:text-rose-400">
          <AlertTriangle size={20} />
          <p className="flex-1">{fetchError}</p>
          <button 
            onClick={fetchCustomers}
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
        className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
          <input 
            type="text" 
            placeholder="Search customers by name or phone..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              key="loading"
              className="col-span-full py-10 text-center text-slate-500 dark:text-slate-400"
            >
              Loading customers...
            </motion.div>
          ) : filteredCustomers.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              key="empty"
              className="col-span-full py-10 text-center text-slate-500 dark:text-slate-400"
            >
              No customers found.
            </motion.div>
          ) : filteredCustomers.map((customer) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={customer.id}
              className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
            >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                {customer.name.charAt(0)}
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-500 uppercase font-bold tracking-wider">Balance</p>
                <p className={cn(
                  "text-lg font-bold",
                  customer.outstanding_balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                )}>
                  {formatCurrency(customer.outstanding_balance)}
                </p>
              </div>
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{customer.name}</h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <Phone size={16} className="text-slate-400 dark:text-slate-500" />
                <span>{customer.phone || 'No phone'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <Mail size={16} className="text-slate-400 dark:text-slate-500" />
                <span className="truncate">{customer.email || 'No email'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <MapPin size={16} className="text-slate-400 dark:text-slate-500" />
                <span className="truncate">{customer.address || 'No address'}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button 
                onClick={() => {
                  setSelectedCustomerForPayment(customer);
                  setIsPaymentModalOpen(true);
                  setPaymentSuccess(false);
                  setPaymentData({
                    amount: '',
                    payment_mode: 'cash',
                    payment_date: new Date().toISOString().split('T')[0],
                    notes: ''
                  });
                }}
                className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all"
                title="Pay In"
              >
                <Wallet size={18} />
              </button>
              <button 
                onClick={() => {
                  setSelectedCustomerForHistory(customer);
                  setIsHistoryModalOpen(true);
                  fetchCustomerHistory(customer.id);
                }}
                className="p-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                title="CRM Profile"
              >
                <History size={18} />
              </button>
              <button 
                onClick={() => sendReminder(customer)}
                className="p-2.5 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-all"
                title="Send Payment Reminder"
              >
                <Send size={18} />
              </button>
              <button 
                onClick={() => handleDelete(customer.id)}
                className="p-2.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all"
                title="Delete Customer"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </motion.div>
        ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add New Customer</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Customer Name *</label>
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
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">CRM Notes</label>
                  <textarea 
                    rows={2}
                    placeholder="Add special instructions, preferences, or relationship notes..."
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
                    Save Customer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !paymentLoading && setIsPaymentModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {!paymentSuccess ? (
                <div className="overflow-y-auto">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Record Payment</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedCustomerForPayment ? `Recording payment for ${selectedCustomerForPayment.name}` : 'General Payment'}
                      </p>
                    </div>
                    <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                      <X size={20} />
                    </button>
                  </div>
                  <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer (Optional)</label>
                      <select 
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white text-sm"
                        value={selectedCustomerForPayment?.id || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setSelectedCustomerForPayment(null);
                          } else {
                            const newCustomer = customers.find(c => c.id === Number(val));
                            if (newCustomer) setSelectedCustomerForPayment(newCustomer);
                          }
                        }}
                      >
                        <option value="">General / Walk-in</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {selectedCustomerForPayment && (
                      <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Outstanding Balance</span>
                          <span className="text-lg font-black text-rose-600">{formatCurrency(selectedCustomerForPayment.outstanding_balance)}</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount Received</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input 
                          required
                          type="number" 
                          placeholder="0.00"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white font-bold text-lg"
                          value={paymentData.amount ?? ''}
                          onChange={(e) => setPaymentData({...paymentData, amount: e.target.value === '' ? 0 : Number(e.target.value)})}
                        />
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
                        </select>
                      </div>
                    </div>

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
                        {paymentLoading ? 'Saving...' : 'Save Payment'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-6">
                    <CheckCircle2 size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Payment Recorded!</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-8">
                    The payment {selectedCustomerForPayment ? <>from <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedCustomerForPayment.name}</span></> : 'record'} has been successfully recorded.
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

      {/* CRM Profile Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && selectedCustomerForHistory && (
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
                  <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
                    {selectedCustomerForHistory.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">{selectedCustomerForHistory.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Phone size={12} /> {selectedCustomerForHistory.phone || 'No phone'}
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Calendar size={12} /> Joined {new Date(selectedCustomerForHistory.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X size={20} />
                </button>
              </div>

              {/* CRM Tabs */}
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
                  onClick={() => setActiveTab('invoices')}
                  className={cn(
                    "px-4 py-4 text-sm font-bold border-b-2 transition-all",
                    activeTab === 'invoices' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  Purchase History ({customerInvoices.length})
                </button>
                <button 
                  onClick={() => setActiveTab('payments')}
                  className={cn(
                    "px-4 py-4 text-sm font-bold border-b-2 transition-all",
                    activeTab === 'payments' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  Payment History ({customerPayments.length})
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
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-black tracking-widest mb-1">Total Purchases</p>
                            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                              {formatCurrency(customerInvoices.reduce((acc, curr) => acc + curr.total_amount, 0))}
                            </p>
                          </div>
                          <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-black tracking-widest mb-1">Total Paid</p>
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(customerPayments.reduce((acc, curr) => acc + curr.amount, 0))}
                            </p>
                          </div>
                          <div className="p-5 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                            <p className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-black tracking-widest mb-1">Outstanding</p>
                            <p className="text-2xl font-black text-rose-600">
                              {formatCurrency(selectedCustomerForHistory.outstanding_balance)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Contact Information</h4>
                            <div className="space-y-3">
                              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <Mail size={16} className="text-slate-400" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{selectedCustomerForHistory.email || 'No email provided'}</span>
                              </div>
                              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <MapPin size={16} className="text-slate-400" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{selectedCustomerForHistory.address || 'No address provided'}</span>
                              </div>
                              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <CreditCard size={16} className="text-slate-400" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">GST: {selectedCustomerForHistory.gst_number || 'Not registered'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">CRM Notes</h4>
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20 min-h-[120px]">
                              <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                                {selectedCustomerForHistory.notes || 'No notes added for this customer yet. Edit customer to add relationship notes.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'invoices' && (
                      <div className="space-y-4">
                        {customerInvoices.length === 0 ? (
                          <div className="py-20 text-center text-slate-500 dark:text-slate-400 italic">No purchase history found.</div>
                        ) : (
                          <div className="space-y-3">
                            {customerInvoices.map((invoice) => (
                              <div key={invoice.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md transition-all">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400">
                                    <FileText size={20} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 dark:text-white">{invoice.invoice_number}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                      {new Date(invoice.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-black text-slate-900 dark:text-white">{formatCurrency(invoice.total_amount)}</p>
                                  <span className={cn(
                                    "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                                    invoice.payment_status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                  )}>
                                    {invoice.payment_status}
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
                        {customerPayments.length === 0 ? (
                          <div className="py-20 text-center text-slate-500 dark:text-slate-400 italic">No payment records found.</div>
                        ) : (
                          <div className="space-y-3">
                            {customerPayments.map((payment) => (
                              <div key={payment.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md transition-all">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <CreditCard size={20} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(payment.amount)}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                      {new Date(payment.payment_date).toLocaleDateString()} • {payment.payment_mode.toUpperCase()}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {payment.invoice_number ? (
                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md border border-indigo-100 dark:border-indigo-800/50">
                                      {payment.invoice_number}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                                      General
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

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black hover:opacity-90 transition-opacity shadow-xl"
                >
                  Close Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This will not delete their invoices or payments, but the customer record will be permanently removed."
        confirmText="Delete Customer"
      />

      <ConfirmModal 
        isOpen={isErrorModalOpen}
        onClose={() => setIsErrorModalOpen(false)}
        onConfirm={() => setIsErrorModalOpen(false)}
        title="Cannot Delete"
        message={deleteError || "Failed to delete customer."}
        confirmText="OK"
        variant="warning"
      />
    </div>
  );
}
