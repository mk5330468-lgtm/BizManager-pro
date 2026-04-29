import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, 
  Plus, 
  FileText, 
  Download, 
  Share2, 
  Printer,
  Eye,
  Smartphone,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit2,
  Trash2
} from 'lucide-react';
import { Invoice } from '../types';
import { formatCurrency, formatDate, cn, formatWhatsAppLink } from '../lib/utils';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { generateInvoicePDF } from '../lib/pdf';
import { getInvoiceHTML } from '../lib/invoiceTemplates';
import { supabaseService } from '../services/supabaseService';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../components/ConfirmModal';

export default function Invoices() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const { data: invoices = [], isLoading: loading, refetch: fetchInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => supabaseService.getInvoices(),
    staleTime: 1000 * 10, // 10 seconds
  });

  const { data: business, refetch: fetchBusiness } = useQuery({
    queryKey: ['business'],
    queryFn: () => supabaseService.getBusiness(),
    staleTime: 1000 * 6 * 60, // 1 hour
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'preview'>('list');
  const [previewScale, setPreviewScale] = useState(1);
  const previewContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewMode === 'preview' && selectedInvoice) {
      const calculateScale = () => {
        if (previewContainerRef.current) {
          const containerWidth = previewContainerRef.current.offsetWidth;
          const padding = window.innerWidth < 640 ? 32 : 64; // p-4 (16*2) or p-8 (32*2)
          const availableWidth = containerWidth - padding;
          const invoiceWidth = 800;
          const newScale = Math.min(1, availableWidth / invoiceWidth);
          setPreviewScale(newScale);
        }
      };

      calculateScale();
      window.addEventListener('resize', calculateScale);
      const timer = setTimeout(calculateScale, 100);
      
      return () => {
        window.removeEventListener('resize', calculateScale);
        clearTimeout(timer);
      };
    }
  }, [viewMode, selectedInvoice]);

  // Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const state = location.state as { previewInvoiceId?: number };
      if (state?.previewInvoiceId && invoices.length > 0) {
        const invoice = invoices.find(i => i.id === state.previewInvoiceId);
        if (invoice) {
          handleViewInvoice(invoice);
          // Clear state so it doesn't reopen on refresh
          navigate(location.pathname, { replace: true, state: {} });
        }
      }
    };
    init();

    const handleRefresh = () => {
      fetchInvoices();
      fetchBusiness();
    };
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, [invoices, fetchBusiness, fetchInvoices, location.pathname, navigate, location.state]);

  const handleDelete = (id: number) => {
    setInvoiceToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete) return;
    setDeleteLoading(true);
    try {
      await supabaseService.deleteInvoice(invoiceToDelete);
      setIsDeleteModalOpen(false);
      setInvoiceToDelete(null);
      
      // Invalidate all related queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Stock might have been reverted
      queryClient.invalidateQueries({ queryKey: ['customers'] }); // Balances might have changed
      
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error) {
      console.error('Error deleting invoice:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const shareOnWhatsApp = (invoice: Invoice) => {
    try {
      const publicLink = `${window.location.origin}/public/invoice/${invoice.id}`;
      
      if (!invoice.customer_phone) {
        alert('Customer phone number is missing. Cannot share via WhatsApp.');
        return;
      }

      const message = `*Invoice: ${invoice.invoice_number}*
Hello ${invoice.customer_name || 'Customer'},

Please find your invoice details below:
*Amount:* ${formatCurrency(invoice.total_amount)}
*Status:* ${invoice.payment_status?.toUpperCase() || 'N/A'}
*Date:* ${formatDate(invoice.created_at)}

You can view and download your invoice here:
${publicLink}

Thank you for your business!`;
      
      window.open(formatWhatsAppLink(invoice.customer_phone, message), '_blank');
    } catch (error) {
      console.error('Error sharing on WhatsApp:', error);
      // Fallback to simple message if URL fails
      const message = `Hello, here is your invoice ${invoice.invoice_number} for ${formatCurrency(invoice.total_amount)}. Status: ${invoice.payment_status}.`;
      window.open(formatWhatsAppLink(invoice.customer_phone, message), '_blank');
    }
  };

  const sendReminder = (invoice: Invoice) => {
    try {
      const publicLink = `${window.location.origin}/public/invoice/${invoice.id}`;
      
      if (!invoice.customer_phone) {
        alert('Customer phone number is missing. Cannot send reminder via WhatsApp.');
        return;
      }

      const message = `*Payment Reminder*
Hello ${invoice.customer_name || 'Customer'},

This is a gentle reminder regarding your invoice *${invoice.invoice_number}* for *${formatCurrency(invoice.total_amount)}*, which is currently *${invoice.payment_status?.toUpperCase()}*.

You can view the details and download it here:
${publicLink}

Kindly settle the balance at your earliest convenience.

Thank you!`;
      
      window.open(formatWhatsAppLink(invoice.customer_phone, message), '_blank');
    } catch (error) {
      console.error('Error sending reminder:', error);
      const message = `Payment Reminder: Your invoice ${invoice.invoice_number} for ${formatCurrency(invoice.total_amount)} is pending.`;
      window.open(formatWhatsAppLink(invoice.customer_phone, message), '_blank');
    }
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    if (!invoice.items || invoice.items.length === 0) {
      try {
        const items = await supabaseService.getInvoiceItems(invoice.id);
        invoice.items = items;
      } catch (error) {
        console.error("Failed to fetch items:", error);
      }
    }
    setSelectedInvoice(invoice);
    setViewMode('preview');
  };

  if (viewMode === 'preview' && selectedInvoice) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setViewMode('list')}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors"
          >
            <Plus className="rotate-45" size={20} />
            Back to Invoices
          </button>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => generateInvoicePDF(selectedInvoice, 'download')}
              className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition-all"
              title="Download PDF"
            >
              <Download size={16} />
            </button>
            <button 
              onClick={() => generateInvoicePDF(selectedInvoice, 'print')}
              className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 transition-all"
              title="Print"
            >
              <Printer size={16} />
            </button>
            <button 
              onClick={() => shareOnWhatsApp(selectedInvoice)}
              className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 transition-all"
              title="WhatsApp"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
          <div ref={previewContainerRef} className="p-4 sm:p-8 flex justify-center bg-slate-50 dark:bg-slate-950/50 overflow-hidden">
            <div 
              className="bg-white shadow-2xl origin-top transition-transform duration-300"
              style={{
                width: '800px',
                minHeight: '1122px',
                transform: `scale(${previewScale})`,
                marginBottom: `calc(1122px * (${previewScale} - 1))`
              }}
              dangerouslySetInnerHTML={{ 
                __html: getInvoiceHTML(selectedInvoice, business) 
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const filteredInvoices = invoices.filter(i => {
    const matchesSearch = (i.invoice_number || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
                         (i.customer_name || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const matchesStatus = statusFilter === 'all' || i.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      paid: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
      unpaid: "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800",
      partial: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
    }[status as 'paid' | 'unpaid' | 'partial'];

    const Icon = {
      paid: CheckCircle2,
      unpaid: AlertCircle,
      partial: Clock
    }[status as 'paid' | 'unpaid' | 'partial'];

    return (
      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border", styles)}>
        <Icon size={14} />
        <span className="capitalize">{status === 'unpaid' ? 'pending' : status}</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Invoices</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">View and manage sales records.</p>
        </div>
        <Link to="/invoices/new">
          <button className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-indigo-100 dark:shadow-indigo-900/20 text-sm" title="Create Invoice">
            <Plus size={18} />
            <span className="hidden sm:inline">New Invoice</span>
          </button>
        </Link>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search invoices..." 
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit overflow-x-auto no-scrollbar scroll-smooth relative">
            <div className="flex min-w-max">
              {[
                { id: 'all', label: 'All Invoices' },
                { id: 'paid', label: 'Paid' },
                { id: 'partial', label: 'Partial' },
                { id: 'unpaid', label: 'Pending' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold transition-all relative z-10 text-[10px] uppercase tracking-wider",
                    statusFilter === f.id 
                      ? "text-indigo-600" 
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  {statusFilter === f.id && (
                    <motion.div 
                      layoutId="invoiceFilter"
                      className="absolute inset-0 bg-white dark:bg-slate-900 rounded-lg shadow-sm"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-20 whitespace-nowrap">
                    {f.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-bottom border-slate-200 dark:border-slate-800">
                <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Invoice</th>
                <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="hidden md:table-cell px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</th>
                <th className="hidden lg:table-cell px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Paid</th>
                <th className="hidden sm:table-cell px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Due</th>
                <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-xs">Loading...</td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-xs">No invoices found.</td></tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredInvoices.map((invoice, index) => (
                    <motion.tr 
                      key={invoice.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] font-bold text-slate-900 dark:text-white">#{invoice.invoice_number}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate max-w-[80px] sm:max-w-none block">{invoice.customer_name || 'Walk-in'}</span>
                      </td>
                      <td className="hidden md:table-cell px-3 py-2.5">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">{formatDate(invoice.created_at)}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-tight">{formatCurrency(invoice.total_amount)}</span>
                      </td>
                      <td className="hidden lg:table-cell px-3 py-2.5">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">{formatCurrency(invoice.amount_paid || 0)}</span>
                      </td>
                      <td className="hidden sm:table-cell px-3 py-2.5">
                        <span className="text-rose-600 dark:text-rose-400 font-bold text-[11px]">{formatCurrency(Math.max(0, invoice.total_amount - (invoice.amount_paid || 0)))}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={invoice.payment_status} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => handleViewInvoice(invoice)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-all" title="View">
                            <Eye size={13} />
                          </button>
                          <button onClick={() => shareOnWhatsApp(invoice)} className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-md transition-all" title="Share">
                            <Share2 size={13} />
                          </button>
                          {invoice.payment_status !== 'paid' && (
                            <button onClick={() => sendReminder(invoice)} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-md transition-all" title="Send Reminder">
                              <Smartphone size={13} />
                            </button>
                          )}
                          <button onClick={() => generateInvoicePDF(invoice, 'download')} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-all" title="Download">
                            <Download size={13} />
                          </button>
                          <button onClick={() => navigate(`/invoices/edit/${invoice.id}`)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-all" title="Edit">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleDelete(invoice.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-md transition-all" title="Delete">
                            <Trash2 size={13} />
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
      </div>

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This will reverse stock changes and update customer balances."
        confirmText="Delete Invoice"
      />
    </div>
  );
}
