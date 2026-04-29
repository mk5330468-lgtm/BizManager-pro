import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  TrendingUp, 
  Users, 
  Package, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  Wallet,
  Smartphone,
  Banknote,
  PlusCircle,
  ShoppingCart,
  FileText,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardStats } from '../types';
import { formatCurrency, formatWhatsAppLink } from '../lib/utils';
import { supabaseService } from '../services/supabaseService';
import GlobalSearch from '../components/GlobalSearch';

const StatCard = ({ title, value, icon: Icon, color, trend, onClick }: { title: string, value: string | number, icon: any, color: string, trend?: string, onClick?: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    onClick={onClick}
    className={cn(
      "bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm transition-all",
      onClick ? "cursor-pointer hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-900 active:scale-95" : "hover:shadow-md"
    )}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5 whitespace-nowrap uppercase tracking-wider">{title}</p>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{value}</h3>
        {trend && (
          <div className="flex items-center gap-1 mt-1">
            <span className={cn(
              "text-[10px] font-semibold px-1 py-0.5 rounded",
              trend.startsWith('+') ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-rose-600 bg-rose-50 dark:bg-rose-900/20"
            )}>
              {trend}
            </span>
          </div>
        )}
      </div>
      <div className={cn("p-2 rounded-lg", color)}>
        <Icon size={18} className="text-white" />
      </div>
    </div>
  </motion.div>
);

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [showTodayModal, setShowTodayModal] = useState(false);
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: stats, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => supabaseService.getDashboardStats(),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const error = queryError instanceof Error ? queryError.message : (queryError as any)?.message || null;

  useEffect(() => {
    const handleRefresh = () => {
      refetch();
    };
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, [refetch]);

  const handleSyncBalances = async () => {
    setIsSyncing(true);
    try {
      await supabaseService.syncAccounts();
      await refetch();
      alert('Balances synchronized successfully!');
    } catch (err: any) {
      console.error('Error syncing balances:', err);
      alert('Failed to sync balances: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading && !stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  const paymentIcons: Record<string, any> = {
    cash: Banknote,
    upi: Smartphone
  };

  const accountColors: Record<string, string> = {
    cash: 'bg-emerald-600',
    upi: 'bg-indigo-600'
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-4 rounded-xl flex flex-col gap-3 text-rose-700 dark:text-rose-400">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            <p className="flex-1">{error}</p>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('refresh-data'))}
              className="text-sm font-semibold underline hover:no-underline"
            >
              Try Again
            </button>
          </div>
          <div className="flex items-center gap-2 pl-8">
            <p className="text-xs opacity-80">Having trouble? Check your system status:</p>
            <Link 
              to="/diagnostics"
              className="text-xs font-bold underline hover:no-underline flex items-center gap-1"
            >
              Run Diagnostics <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      )}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Overview</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Welcome back! Quick summary of your business.</p>
        </div>
        
        <div className="flex-1 max-w-xs w-full">
          <GlobalSearch />
        </div>

        <Link 
          to="/invoices/new"
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
          title="New Invoice"
        >
          <PlusCircle size={18} />
          <span className="text-sm">New Invoice</span>
        </Link>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="space-y-2">
          <StatCard 
            title="Today" 
            value={formatCurrency(stats?.todaySales || 0)} 
            icon={TrendingUp} 
            color="bg-indigo-600" 
            onClick={() => setShowTodayModal(true)}
          />
          <div className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-900/30 flex justify-between items-center text-[10px]">
            <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">Pay-in:</span>
            <span className="font-black text-indigo-900 dark:text-indigo-200">{formatCurrency(stats?.todayCollections || 0)}</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <StatCard 
            title="Month" 
            value={formatCurrency(stats?.monthlySales || 0)} 
            icon={ArrowUpRight} 
            color="bg-emerald-600" 
            onClick={() => setShowMonthlyModal(true)}
          />
          <div className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-900/30 flex justify-between items-center text-[10px]">
            <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">Pay-in:</span>
            <span className="font-black text-emerald-900 dark:text-indigo-200">{formatCurrency(stats?.monthlyCollections || 0)}</span>
          </div>
        </div>

        <StatCard 
          title="Pending" 
          value={formatCurrency(stats?.pendingPayments || 0)} 
          icon={Users} 
          color="bg-amber-500" 
        />
        <StatCard 
          title="Low Stock" 
          value={stats?.lowStockCount || 0} 
          icon={AlertTriangle} 
          color="bg-rose-500" 
        />
      </div>

      {/* Today's Sales Modal */}
      <AnimatePresence>
        {showTodayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTodayModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Today's Summary</h3>
                    <p className="text-slate-500 dark:text-slate-400">Detailed breakdown for today</p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <TrendingUp size={24} />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 shadow-sm">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Invoices Generated</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{stats?.todayInvoicesCount || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30">
                      <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm mb-3">
                        <Banknote size={20} />
                      </div>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mb-1">Cash</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(stats?.todayCashReceived || 0)}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30">
                      <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm mb-3">
                        <Smartphone size={20} />
                      </div>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mb-1">Online (UPI)</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(stats?.todayOnlineReceived || 0)}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-slate-500 dark:text-slate-400 text-sm">Total Invoiced (Sales)</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(stats?.todaySales || 0)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-slate-500 dark:text-slate-400 text-sm">Total Received (Pay-in)</p>
                      <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(stats?.todayCollections || 0)}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowTodayModal(false)}
                  className="w-full mt-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold hover:opacity-90 transition-opacity"
                >
                  Close Summary
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Monthly Sale Modal */}
      <AnimatePresence>
        {showMonthlyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMonthlyModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Monthly Summary</h3>
                    <p className="text-slate-500 dark:text-slate-400">Detailed breakdown for this month</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <ArrowUpRight size={24} />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 shadow-sm">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Invoices Generated</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{stats?.monthlyInvoicesCount || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30">
                      <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm mb-3">
                        <Banknote size={20} />
                      </div>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mb-1">Cash</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(stats?.monthlyCashReceived || 0)}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30">
                      <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm mb-3">
                        <Smartphone size={20} />
                      </div>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mb-1">Online (UPI)</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(stats?.monthlyOnlineReceived || 0)}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-slate-500 dark:text-slate-400 text-sm">Total Invoiced (Sales)</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(stats?.monthlySales || 0)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-slate-500 dark:text-slate-400 text-sm">Total Received (Pay-in)</p>
                      <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(stats?.monthlyCollections || 0)}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowMonthlyModal(false)}
                  className="w-full mt-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold hover:opacity-90 transition-opacity"
                >
                  Close Summary
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Account Balances */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Accounts</h3>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleSyncBalances}
                disabled={isSyncing}
                title="Synchronize Balances"
                className={cn(
                  "p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-400 hover:text-indigo-600",
                  isSyncing && "animate-spin text-indigo-600"
                )}
              >
                <RefreshCw size={16} />
              </button>
              <Wallet size={18} className="text-slate-400" />
            </div>
          </div>
          <div className="space-y-2.5">
            {stats?.accounts.map(account => {
              const Icon = paymentIcons[account.name] || Wallet;
              const color = accountColors[account.name] || 'bg-slate-600';
              return (
                <motion.div 
                  key={account.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 transition-all hover:shadow-md"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-sm", color)}>
                        <Icon size={14} />
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white capitalize text-[13px]">{account.name === 'cash' ? 'Cash' : account.name.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-tight">Balance</p>
                      <p className={cn(
                        "text-base font-black leading-none",
                        account.balance >= 0 ? "text-slate-900 dark:text-white" : "text-rose-600"
                      )}>
                        {formatCurrency(account.balance)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Pending Payments List */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Pending</h3>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-700 uppercase tracking-tight">
              Outstanding
            </span>
          </div>
          <div className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {stats?.pendingCustomers && stats.pendingCustomers.length > 0 ? (
                stats.pendingCustomers.map((customer) => (
                  <motion.div 
                    key={customer.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-100 dark:hover:border-indigo-900 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                        {customer.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white text-[13px] truncate">{customer.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{customer.phone || 'No phone'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-tight">Due</p>
                        <p className="font-bold text-rose-600 dark:text-rose-400 text-[13px]">{formatCurrency(customer.outstanding_balance)}</p>
                      </div>
                      <button 
                        onClick={async () => {
                          let linkMessage = '';
                          try {
                            const invoices = await supabaseService.getCustomerInvoices(customer.id);
                            const pendingInvoices = invoices
                              .filter((inv: any) => inv.payment_status !== 'paid')
                              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                            
                            if (pendingInvoices.length > 0) {
                              const latestInvoice = pendingInvoices[0];
                              const publicLink = `${window.location.origin}/public/invoice/${latestInvoice.id}`;
                              linkMessage = `\n\nYou can view your latest invoice here:\n${publicLink}`;
                            }
                          } catch (error) {
                            console.error('Error fetching invoices for reminder:', error);
                          }

                          const message = `Dear ${customer.name}, your payment of ${formatCurrency(customer.outstanding_balance)} is pending with BizManager Pro.${linkMessage}\n\nWe request you to settle the balance via UPI or Cash at your earliest convenience.\nThank you for your continued business and support!`;
                          window.open(formatWhatsAppLink(customer.phone, message), '_blank');
                        }}
                        className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all shadow-sm"
                        title="Send Reminder"
                      >
                        <Smartphone size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-12 text-center text-slate-400 dark:text-slate-500 italic"
                >
                  No pending payments at the moment.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Remove the local PlusCircle component at the bottom

