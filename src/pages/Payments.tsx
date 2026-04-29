import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  Search, 
  Filter, 
  Calendar, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft,
  Download,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { formatCurrency, formatDate } from '../lib/utils';
import { cn } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';

interface Payment {
  id: number;
  customer_id: number;
  invoice_id: number | null;
  amount: number;
  payment_mode: string;
  transaction_reference: string;
  payment_date: string;
  customer_name: string;
  invoice_number: string | null;
}

export default function Payments() {
  const queryClient = useQueryClient();
  
  const { data: payments = [], isLoading: loading, refetch: fetchPayments } = useQuery({
    queryKey: ['payments'],
    queryFn: () => supabaseService.getPayments(),
    staleTime: 1000 * 60 * 5,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('walkin');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<number | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editForm, setEditForm] = useState({
    amount: 0,
    payment_mode: 'cash',
    payment_date: '',
    transaction_reference: ''
  });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const handleRefresh = () => fetchPayments();
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, [fetchPayments]);

  const handleDelete = async (id: number) => {
    setPaymentToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!paymentToDelete) return;
    
    setActionLoading(true);
    try {
      await supabaseService.deletePayment(paymentToDelete);
      fetchPayments();
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      
      window.dispatchEvent(new CustomEvent('refresh-data'));
      setIsDeleteModalOpen(false);
      setPaymentToDelete(null);
    } catch (error) {
      console.error('Error deleting payment:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setEditForm({
      amount: payment.amount,
      payment_mode: payment.payment_mode,
      payment_date: payment.payment_date.split('T')[0],
      transaction_reference: payment.transaction_reference || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;

    setActionLoading(true);
    try {
      await supabaseService.updatePayment(editingPayment.id, editForm);
      setIsEditModalOpen(false);
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error) {
      console.error('Error updating payment:', error);
      alert('Failed to update payment');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = 
      p.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.invoice_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (p.transaction_reference?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterMode === 'all' || p.payment_mode === filterMode;
    
    const matchesCustomer = customerFilter === 'all' || 
      (customerFilter === 'walkin' && p.customer_name === 'General / Walk-in') ||
      (customerFilter === 'regular' && p.customer_name !== 'General / Walk-in');
    
    return matchesSearch && matchesFilter && matchesCustomer;
  });

  const totalReceived = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Payments</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs">Manage customer receipts</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl">
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Total Received</p>
            <p className="text-base font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(totalReceived)}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text"
            placeholder="Search payments..."
            className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white shadow-sm text-sm font-bold"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white shadow-sm text-xs font-bold"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
          >
            <option value="all">All Owners</option>
            <option value="walkin">Walk-in</option>
            <option value="regular">Regular</option>
          </select>
          <select 
            className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white shadow-sm text-xs font-bold"
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
          >
            <option value="all">All Modes</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
          </select>
        </div>
      </div>

      {/* Payments List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-bottom border-slate-200 dark:border-slate-800">
                <th className="px-3 sm:px-6 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-3 sm:px-6 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="hidden md:table-cell px-3 sm:px-6 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ref</th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mode</th>
                <th className="px-3 sm:px-6 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Amount</th>
                <th className="px-3 sm:px-6 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  <tr><td colSpan={6} className="py-12 text-center text-xs text-slate-500">Loading...</td></tr>
                ) : filteredPayments.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-xs text-slate-500">No payments found</td></tr>
                ) : (
                  filteredPayments.map((payment) => (
                    <motion.tr 
                      key={payment.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-3 sm:px-6 py-1.5 whitespace-nowrap">
                        <span className="text-[11px] font-bold text-slate-900 dark:text-white">{formatDate(payment.payment_date)}</span>
                      </td>
                      <td className="px-3 sm:px-6 py-1.5">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-slate-900 dark:text-white truncate max-w-[80px] sm:max-w-none block">{payment.customer_name}</span>
                          {payment.invoice_number && (
                            <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-black">#{payment.invoice_number}</span>
                          )}
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-3 sm:px-6 py-1.5">
                        <span className="text-[10px] text-slate-500 italic truncate max-w-[60px] block font-bold">
                          {payment.transaction_reference || 'N/A'}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-3 sm:px-6 py-1.5">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter",
                          payment.payment_mode === 'cash' 
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        )}>
                          {payment.payment_mode}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-1.5 text-right">
                        <span className="text-[11px] font-black text-slate-900 dark:text-white">{formatCurrency(payment.amount)}</span>
                      </td>
                      <td className="px-3 sm:px-6 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleEdit(payment)}
                            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded transition-colors"
                            title="Edit Payment"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDelete(payment.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-800 rounded transition-colors"
                            title="Delete Payment"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setPaymentToDelete(null);
        }}
        onConfirm={confirmDelete}
        loading={actionLoading}
        title="Delete Payment"
        message="Are you sure you want to delete this payment? This will affect customer balance and invoice status. This action cannot be undone."
        confirmText="Delete Payment"
      />

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Edit2 size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Edit Payment</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Update payment details for {editingPayment?.customer_name}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsEditModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleUpdate} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                      <input 
                        required
                        type="number" 
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white font-bold text-lg"
                        value={editForm.amount ?? ''}
                        onChange={(e) => setEditForm({...editForm, amount: e.target.value === '' ? 0 : Number(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payment Mode</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white"
                        value={editForm.payment_mode}
                        onChange={(e) => setEditForm({...editForm, payment_mode: e.target.value})}
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</label>
                      <input 
                        required
                        type="date" 
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white"
                        value={editForm.payment_date}
                        onChange={(e) => setEditForm({...editForm, payment_date: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reference / Notes</label>
                    <textarea 
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white resize-none"
                      placeholder="Transaction ID, check number, etc."
                      value={editForm.transaction_reference}
                      onChange={(e) => setEditForm({...editForm, transaction_reference: e.target.value})}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setIsEditModalOpen(false)}
                      className="flex-1 px-6 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={actionLoading}
                      className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {actionLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <CheckCircle2 size={20} />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
