import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Printer, Smartphone } from 'lucide-react';
import { generateInvoicePDF } from '../lib/pdf';
import { getInvoiceHTML } from '../lib/invoiceTemplates';
import { formatCurrency } from '../lib/utils';
import { motion } from 'motion/react';

export default function PublicInvoice() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scale, setScale] = useState(1);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await fetch(`/api/public/invoice/${id}`);
        if (!res.ok) throw new Error('Invoice not found');
        const data = await res.json();
        setInvoice(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id]);

  useEffect(() => {
    const updateScale = () => {
      const parentWidth = containerRef.current?.clientWidth || (window.innerWidth - 32);
      if (invoice) {
        const baseWidth = invoice.business?.invoice_theme === 'thermal' ? 280 : 794;
        
        if (parentWidth < baseWidth) {
          setScale(parentWidth / baseWidth);
        } else {
          setScale(1);
        }
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    // Extra check after potential layout shifts
    const timer = setTimeout(updateScale, 300);
    
    return () => {
      window.removeEventListener('resize', updateScale);
      clearTimeout(timer);
    };
  }, [invoice, loading]);

  const baseWidth = invoice?.business?.invoice_theme === 'thermal' ? 280 : 794;
  const baseHeight = invoice?.business?.invoice_theme === 'thermal' ? 600 : 1123; // Adjusted thermal height estimate

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading your invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl text-center border border-slate-200 dark:border-slate-800">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <Smartphone size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Invoice Not Found</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">The invoice you are looking for might have been deleted or the link is incorrect.</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const handleDownload = () => {
    generateInvoicePDF(invoice, 'download');
  };

  const handlePrint = () => {
    generateInvoicePDF(invoice, 'print');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              {invoice.business?.name?.charAt(0) || 'B'}
            </div>
            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-none">
              {invoice.business?.name || 'Business Invoice'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint}
              className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Print"
            >
              <Printer size={20} />
            </button>
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-0 sm:p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl shadow-none sm:shadow-2xl overflow-hidden border-0 sm:border border-slate-200 dark:border-slate-800"
        >
          {/* Quick Stats Banner */}
          <div className="bg-indigo-600 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-1">Invoice Amount</p>
              <h1 className="text-3xl font-black">{formatCurrency(invoice.total_amount)}</h1>
            </div>
            <div className="flex gap-4">
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl">
                <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-0.5">Status</p>
                <p className="font-bold capitalize">{invoice.payment_status}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl">
                <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-0.5">Number</p>
                <p className="font-bold">{invoice.invoice_number}</p>
              </div>
            </div>
          </div>

          {/* Rendered Invoice Template */}
          <div ref={containerRef} className="p-2 sm:p-8 overflow-hidden flex flex-col items-center min-h-[400px]">
            <div 
              style={{ 
                width: `${baseWidth * scale}px`,
                height: `auto`,
                minHeight: scale < 1 ? 'auto' : `${baseHeight}px`,
                overflow: 'hidden'
              }}
            >
              <div 
                className="bg-white text-slate-900 origin-top-left shadow-[0_10px_40px_rgba(0,0,0,0.1)]"
                style={{ 
                  width: `${baseWidth}px`,
                  transform: `scale(${scale})`,
                }}
                dangerouslySetInnerHTML={{ __html: getInvoiceHTML(invoice, invoice.business) }}
              />
            </div>
          </div>
        </motion.div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            This is a secure link for your invoice. Please contact <strong>{invoice.business?.name}</strong> if you have any questions.
          </p>
        </div>
      </div>
    </div>
  );
}
