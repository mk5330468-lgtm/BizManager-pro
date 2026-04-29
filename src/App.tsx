import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  ShoppingCart, 
  FileText, 
  BarChart3, 
  Settings as SettingsIcon,
  Menu,
  X,
  LogOut,
  PlusCircle,
  ShieldCheck,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Building2,
  Plus,
  Wallet,
  Calendar,
  Save,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import { supabaseService } from './services/supabaseService';

import { Toaster } from 'react-hot-toast';
import ShaderBackground from './components/ShaderBackground';

// Pages
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Invoices from './pages/Invoices';
import CreateInvoice from './pages/CreateInvoice';
import Purchases from './pages/Purchases';
import Reports from './pages/Reports';
import People from './pages/People';
import Payments from './pages/Payments';
import ProductProfitDetail from './pages/ProductProfitDetail';
import DailySalesDetail from './pages/DailySalesDetail';
import Settings from './pages/Settings';
import Diagnostics from './pages/Diagnostics';
import PublicInvoice from './pages/PublicInvoice';
import Login from './pages/Login';

const SidebarItem = ({ icon: Icon, label, to, active, onClick }: { icon: any, label: string, to: string, active: boolean, onClick?: () => void, key?: string }) => (
  <Link to={to} onClick={onClick}>
    <div className={cn(
      "flex items-center gap-2 px-2.5 py-2 rounded-md transition-all duration-200 group",
      active 
        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-indigo-900/20" 
        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
    )}>
      <Icon size={16} className={cn(active ? "text-white" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />
      <span className="font-medium text-[13px]">{label}</span>
    </div>
  </Link>
);

const Sidebar = ({ isOpen, toggle, logout, business }: { isOpen: boolean, toggle: () => void, logout: () => Promise<void>, business: any }) => {
  const location = useLocation();
  const { user } = useAuth();
  
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
    { icon: Package, label: 'Products', to: '/products' },
    { icon: Users, label: 'Customers & Sellers', to: '/people' },
    { icon: ShoppingCart, label: 'Purchases', to: '/purchases' },
    { icon: FileText, label: 'Invoices', to: '/invoices' },
    { icon: Wallet, label: 'Pay In', to: '/payments' },
    { icon: BarChart3, label: 'Reports', to: '/reports' },
    { icon: SettingsIcon, label: 'Settings', to: '/settings' },
  ];

  const handleItemClick = () => {
    toggle();
  };

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={toggle}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40 xl:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : -200 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[200px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 flex flex-col",
          !isOpen && "pointer-events-none"
        )}
      >
        <div className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
              <BarChart3 className="text-white" size={14} />
            </div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">BizManager <span className="text-indigo-600">Pro</span></h1>
          </div>
          <button onClick={toggle} className="xl:hidden text-slate-500 dark:text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 px-2 py-0.5 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => (
            <SidebarItem 
              key={item.to} 
              {...item} 
              active={location.pathname === item.to} 
              onClick={handleItemClick}
            />
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
              {business?.logo_url ? (
                <img src={business.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                business?.business_name?.charAt(0) || 'B'
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{business?.business_name || 'My Business'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{business?.owner_name || 'Business Profile'}</p>
            </div>
          </div>
          
          <button 
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </motion.aside>
    </>
  );
};

function AppContent() {
  const queryClient = useQueryClient();
  const { user, loading, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPayInModalOpen, setIsPayInModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentData, setPaymentData] = useState({
    customer_id: '',
    amount: '' as number | '',
    cash_amount: '' as number | '',
    upi_amount: '' as number | '',
    payment_mode: '' as 'cash' | 'upi' | 'both' | '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<{[key: number]: number}>({});
  const [showPendingInvoices, setShowPendingInvoices] = useState(true);
  const [business, setBusiness] = useState<any>(null);

  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [dbStatus, setDbStatus] = useState<{ status: string, message?: string } | null>(null);

  useEffect(() => {
    // Check system health on load
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.status !== 'ok') {
          setDbStatus({ status: 'error', message: data.message });
        } else {
          // Check for missing tables
          const missing = Object.entries(data.tables || {})
            .filter(([_, status]) => status === 'missing' || String(status).includes('error'))
            .map(([name]) => name);
          
          if (missing.length > 0) {
            setDbStatus({ 
              status: 'warning', 
              message: `Database issues detected. Missing or inaccessible tables: ${missing.join(', ')}.` 
            });
          }
        }
      })
      .catch(err => console.error('Health check failed:', err));
  }, []);

  // Check for public routes first
  const isPublicRoute = location.pathname.startsWith('/public/');

  useEffect(() => {
    const fetchBusiness = () => {
      if (user) {
        supabaseService.getBusiness()
          .then(setBusiness)
          .catch(err => console.error('Failed to fetch business:', err));
      }
    };

    const fetchCustomers = () => {
      if (user) {
        supabaseService.getCustomers()
          .then(setCustomers)
          .catch(err => {
            console.error('Failed to fetch customers in App:', err);
            // If we have a common failure, maybe suggest diagnostics
            if (err.message?.includes('Business ID required')) {
               console.warn('Retrying customer fetch in 2s due to missing business ID...');
               setTimeout(fetchCustomers, 2000);
            }
          });
      }
    };

    fetchBusiness();
    fetchCustomers();

    const handleRefresh = () => {
      fetchBusiness();
      fetchCustomers();
      queryClient.invalidateQueries();
    };

    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, [user]);

  useEffect(() => {
    if (paymentData.customer_id && isPayInModalOpen) {
      supabaseService.getCustomerInvoices(Number(paymentData.customer_id))
        .then(invoices => {
          const pending = invoices.filter((i: any) => i.payment_status !== 'paid');
          setPendingInvoices(pending);
          setSelectedInvoices({});
        })
        .catch(err => console.error('Failed to fetch pending invoices:', err));
    } else {
      setPendingInvoices([]);
      setSelectedInvoices({});
    }
  }, [paymentData.customer_id, isPayInModalOpen]);

  useEffect(() => {
    if (user) {
      const isNewUser = localStorage.getItem('is_new_user');
      if (isNewUser === 'true') {
        localStorage.removeItem('is_new_user');
        navigate('/settings');
      }
    }
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/public/invoice/:id" element={<PublicInvoice />} />
      </Routes>
    );
  }

  if (!user) {
    return <Login />;
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentData.amount || Number(paymentData.amount) <= 0) return alert('Please enter a valid amount');

    const totalAmount = Number(paymentData.amount);
    const settlements = Object.entries(selectedInvoices)
      .filter(([_, amt]: [string, any]) => (Number(amt) || 0) > 0)
      .map(([id, amt]) => ({
        invoice_id: Number(id),
        amount: amt
      }));

    const settledTotal = settlements.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
    if (settledTotal > totalAmount) {
      return alert(`Settled amount (${settledTotal}) cannot exceed total payment amount (${totalAmount})`);
    }

    setPaymentLoading(true);
    try {
      await supabaseService.recordCustomerPayment({
        customer_id: paymentData.customer_id || null,
        amount: totalAmount,
        cash_amount: paymentData.payment_mode === 'both' ? Number(paymentData.cash_amount) : undefined,
        upi_amount: paymentData.payment_mode === 'both' ? Number(paymentData.upi_amount) : undefined,
        payment_mode: paymentData.payment_mode,
        payment_date: paymentData.payment_date,
        notes: paymentData.notes,
        settlements: settlements.length > 0 ? settlements : undefined
      });
      setPaymentSuccess(true);
      // Refresh local customers list for the dropdown
      supabaseService.getCustomers()
        .then(setCustomers)
        .catch(err => console.error('Failed to refresh customers:', err));
      
      // Invalidate all related queries to ensure consistency across the app
      queryClient.invalidateQueries();
      
      setTimeout(() => {
        setIsPayInModalOpen(false);
        setPaymentSuccess(false);
        // Dispatch event to refresh data in other components without full reload
        window.dispatchEvent(new CustomEvent('refresh-data'));
      }, 1500);
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950/50 dark:backdrop-blur-[2px] font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 relative overflow-hidden">
      <ShaderBackground className="hidden dark:block" />
      <Sidebar isOpen={isSidebarOpen} toggle={toggleSidebar} logout={logout} business={business} />
      
      {dbStatus && (
        <div className={`fixed bottom-4 right-4 z-[9999] max-w-sm p-4 rounded-2xl shadow-2xl border flex items-start gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 ${
          dbStatus.status === 'error' ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-amber-50 border-amber-100 text-amber-800'
        }`}>
          <div className={`p-2 rounded-xl ${dbStatus.status === 'error' ? 'bg-rose-100' : 'bg-amber-100'}`}>
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm mb-1">{dbStatus.status === 'error' ? 'System Error' : 'Setup Required'}</h4>
            <p className="text-xs opacity-90 leading-relaxed mb-3 truncate hover:whitespace-normal">{dbStatus.message}</p>
            <Link 
              to="/diagnostics" 
              className={`text-xs font-bold py-1.5 px-3 rounded-lg inline-block transition-colors ${
                dbStatus.status === 'error' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              Go to Diagnostics
            </Link>
          </div>
          <button onClick={() => setDbStatus(null)} className="opacity-50 hover:opacity-100 shrink-0">
            <X size={16} />
          </button>
        </div>
      )}
      
      <main className={cn(
        "flex-1 flex flex-col min-w-0 transition-all duration-200 ease-out relative z-10",
        isSidebarOpen ? "xl:ml-[200px]" : "xl:ml-0"
      )}>
        {/* Header */}
        <header className="h-10 bg-white dark:bg-slate-900/80 dark:backdrop-blur-md border-b border-slate-200 dark:border-slate-800/50 flex items-center justify-between px-2.5 lg:px-4 sticky top-0 z-30 transition-colors duration-300">
          <button onClick={toggleSidebar} className="xl:hidden p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <Menu size={18} />
          </button>
          
          <div className="flex-1 flex items-center px-1.5">
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={toggleTheme}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <button 
              onClick={() => {
                setPaymentSuccess(false);
                setPaymentData({
                  customer_id: '',
                  amount: '',
                  cash_amount: '',
                  upi_amount: '',
                  payment_mode: '',
                  payment_date: new Date().toISOString().split('T')[0],
                  notes: ''
                });
                setIsPayInModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-medium transition-all shadow-md shadow-emerald-100 dark:shadow-emerald-900/20 text-xs"
            >
              <Wallet size={14} />
              <span className="hidden sm:inline">Pay In</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-2.5 lg:p-4 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/people" element={<People />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/new" element={<CreateInvoice />} />
              <Route path="/invoices/edit/:id" element={<CreateInvoice />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/product-profit" element={<ProductProfitDetail />} />
              <Route path="/reports/daily-sales" element={<DailySalesDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </main>

      {/* Global Pay In Modal */}
      <AnimatePresence>
        {isPayInModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !paymentLoading && setIsPayInModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col"
            >
              {!paymentSuccess ? (
                <div className="p-8 overflow-y-auto">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Record Payment</h3>
                      <p className="text-slate-500 dark:text-slate-400">Record money coming in</p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <Wallet size={24} />
                    </div>
                  </div>

                  <form onSubmit={handlePaymentSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer (Optional)</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white"
                        value={paymentData.customer_id}
                        onChange={(e) => setPaymentData({...paymentData, customer_id: e.target.value})}
                      >
                        <option value="">General / Walk-in</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name} (₹{c.outstanding_balance})</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white text-sm"
                          value={paymentData.payment_date}
                          onChange={(e) => setPaymentData({...paymentData, payment_date: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mode</label>
                        <select 
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white text-sm"
                          value={paymentData.payment_mode}
                          onChange={(e) => setPaymentData({...paymentData, payment_mode: e.target.value as any})}
                        >
                          <option value="">Select Mode</option>
                          <option value="cash">Cash</option>
                          <option value="upi">UPI</option>
                          <option value="both">Cash & UPI Both</option>
                        </select>
                      </div>
                    </div>

                    {paymentData.payment_mode && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-4 overflow-hidden"
                      >
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
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount Received</label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                              <input 
                                required
                                type="number" 
                                placeholder="0"
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white font-bold text-lg"
                                value={paymentData.amount || ''}
                                onChange={(e) => setPaymentData({...paymentData, amount: e.target.value === '' ? '' : Number(e.target.value)})}
                              />
                            </div>
                          </div>
                        )}
                      </motion.div>
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

                    {/* Pending Invoices Section */}
                    {paymentData.customer_id && pendingInvoices.length > 0 && (
                      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setShowPendingInvoices(!showPendingInvoices)}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <FileText size={18} className="text-slate-400" />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Pending Invoices</span>
                            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-full">
                              {pendingInvoices.length}
                            </span>
                          </div>
                          {showPendingInvoices ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        <AnimatePresence>
                          {showPendingInvoices && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto bg-white dark:bg-slate-900">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Settled: <span className="text-emerald-600 dark:text-emerald-400">₹{Object.values(selectedInvoices).reduce((a: number, b: any) => a + (Number(b) || 0), 0)}</span> / ₹{paymentData.amount || 0}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const total = Number(paymentData.amount) || 0;
                                      let remaining = total;
                                      const newSelected: {[key: number]: number} = {};
                                      
                                      pendingInvoices.forEach(inv => {
                                        if (remaining <= 0) return;
                                        const due = inv.total_amount - (inv.amount_paid || 0);
                                        const settle = Math.min(remaining, due);
                                        newSelected[inv.id] = settle;
                                        remaining -= settle;
                                      });
                                      setSelectedInvoices(newSelected);
                                    }}
                                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                  >
                                    Auto-Settle
                                  </button>
                                </div>

                                {pendingInvoices.map((inv) => {
                                  const due = inv.total_amount - (inv.amount_paid || 0);
                                  const isSelected = selectedInvoices[inv.id] !== undefined;
                                  
                                  return (
                                    <div 
                                      key={inv.id}
                                      className={cn(
                                        "p-3 rounded-xl border transition-all",
                                        isSelected 
                                          ? "border-indigo-200 bg-indigo-50/30 dark:border-indigo-900/50 dark:bg-indigo-900/10" 
                                          : "border-slate-100 dark:border-slate-800"
                                      )}
                                    >
                                      <div className="flex items-start gap-3">
                                        <input 
                                          type="checkbox"
                                          className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              const total = Number(paymentData.amount) || 0;
                                              const currentSettled = Object.entries(selectedInvoices)
                                                .filter(([id]) => Number(id) !== inv.id)
                                                .reduce((sum: number, [_, amt]: [string, any]) => sum + (Number(amt) || 0), 0);
                                              const remaining = Math.max(0, total - currentSettled);
                                              const settle = Math.min(remaining, due);
                                              setSelectedInvoices({...selectedInvoices, [inv.id]: settle});
                                            } else {
                                              const newSelected = {...selectedInvoices};
                                              delete newSelected[inv.id];
                                              setSelectedInvoices(newSelected);
                                            }
                                          }}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold text-slate-900 dark:text-white">#{inv.invoice_number}</span>
                                            <span className="text-xs font-bold text-slate-900 dark:text-white">₹{inv.total_amount}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{new Date(inv.created_at).toLocaleDateString()}</span>
                                            <span className="text-[10px] font-bold text-rose-500">₹{due} Pending</span>
                                          </div>
                                          
                                          {isSelected && (
                                            <div className="mt-2 flex items-center gap-2">
                                              <span className="text-[10px] font-bold text-slate-400 uppercase">Settling:</span>
                                              <input 
                                                type="number"
                                                className="flex-1 px-2 py-1 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                value={selectedInvoices[inv.id]}
                                                max={due}
                                                onChange={(e) => {
                                                  const val = Math.min(due, Math.max(0, Number(e.target.value)));
                                                  setSelectedInvoices({...selectedInvoices, [inv.id]: val});
                                                }}
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setIsPayInModalOpen(false)}
                        className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={paymentLoading}
                        className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20 flex items-center justify-center gap-2"
                      >
                        {paymentLoading ? 'Saving...' : 'Save Payment'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-6">
                    <ShieldCheck size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Payment Recorded!</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-8">
                    The payment has been successfully recorded.
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10,   // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <Toaster position="top-right" />
          <AppContent />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}
