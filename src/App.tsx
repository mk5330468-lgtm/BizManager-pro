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
  Building2,
  Plus,
  Wallet,
  Calendar,
  Save,
  CheckCircle2
} from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import { supabaseService } from './services/supabaseService';

// Pages
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Invoices from './pages/Invoices';
import CreateInvoice from './pages/CreateInvoice';
import Purchases from './pages/Purchases';
import Reports from './pages/Reports';
import Payments from './pages/Payments';
import ProductProfitDetail from './pages/ProductProfitDetail';
import Settings from './pages/Settings';
import Diagnostics from './pages/Diagnostics';
import PublicInvoice from './pages/PublicInvoice';
import Login from './pages/Login';

const SidebarItem = ({ icon: Icon, label, to, active, onClick }: { icon: any, label: string, to: string, active: boolean, onClick?: () => void, key?: string }) => (
  <Link to={to} onClick={onClick}>
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
      active 
        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20" 
        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
    )}>
      <Icon size={20} className={cn(active ? "text-white" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />
      <span className="font-medium">{label}</span>
    </div>
  </Link>
);

const Sidebar = ({ isOpen, toggle, logout, business }: { isOpen: boolean, toggle: () => void, logout: () => Promise<void>, business: any }) => {
  const location = useLocation();
  const { user } = useAuth();
  
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
    { icon: Package, label: 'Products', to: '/products' },
    { icon: Users, label: 'Customers', to: '/customers' },
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
            className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : -300 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[280px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 flex flex-col",
          !isOpen && "pointer-events-none"
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
              <BarChart3 className="text-white" size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">BizManager <span className="text-indigo-600">Pro</span></h1>
          </div>
          <button onClick={toggle} className="lg:hidden text-slate-500 dark:text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
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
  const { user, loading, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPayInModalOpen, setIsPayInModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentData, setPaymentData] = useState({
    customer_id: '',
    amount: '' as number | '',
    payment_mode: 'cash' as 'cash' | 'upi',
    payment_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [business, setBusiness] = useState<any>(null);

  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

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
          .catch(err => console.error('Failed to fetch customers in App:', err));
      }
    };

    fetchBusiness();
    fetchCustomers();

    const handleRefresh = () => {
      fetchBusiness();
      fetchCustomers();
    };

    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, [user]);

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

    setPaymentLoading(true);
    try {
      await supabaseService.recordCustomerPayment({
        customer_id: paymentData.customer_id || null,
        amount: Number(paymentData.amount),
        payment_mode: paymentData.payment_mode,
        payment_date: paymentData.payment_date,
        notes: paymentData.notes
      });
      setPaymentSuccess(true);
      // Refresh local customers list for the dropdown
      supabaseService.getCustomers()
        .then(setCustomers)
        .catch(err => console.error('Failed to refresh customers:', err));
      
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
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Sidebar isOpen={isSidebarOpen} toggle={toggleSidebar} logout={logout} business={business} />
      
      <main className={cn(
        "flex-1 flex flex-col min-w-0 transition-all duration-200 ease-out",
        isSidebarOpen ? "lg:ml-[280px]" : "lg:ml-0"
      )}>
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30 transition-colors duration-300">
          <button onClick={toggleSidebar} className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <Menu size={24} />
          </button>
          
          <div className="flex-1 flex items-center px-4">
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            <button 
              onClick={() => {
                setPaymentSuccess(false);
                setPaymentData({
                  customer_id: '',
                  amount: '',
                  payment_mode: 'cash',
                  payment_date: new Date().toISOString().split('T')[0],
                  notes: ''
                });
                setIsPayInModalOpen(true);
              }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-md shadow-emerald-100 dark:shadow-emerald-900/20"
            >
              <Wallet size={18} />
              <span className="hidden sm:inline">Pay In</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Routes location={location}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/purchases" element={<Purchases />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/invoices/new" element={<CreateInvoice />} />
                  <Route path="/invoices/edit/:id" element={<CreateInvoice />} />
                  <Route path="/payments" element={<Payments />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/reports/product-profit" element={<ProductProfitDetail />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
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
                        value={paymentData.notes}
                        onChange={(e) => setPaymentData({...paymentData, notes: e.target.value})}
                      />
                    </div>

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

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}
