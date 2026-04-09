import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Smartphone, Printer, Save, Instagram, Eye } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { Invoice } from '../types';
import { formatCurrency, numberToWords, cn, formatWhatsAppLink } from '../lib/utils';
import { generateInvoicePDF, generateInvoicePDFFromHTML } from '../lib/pdf';
import { supabaseService } from '../services/supabaseService';

import { getInvoiceHTML } from '../lib/invoiceTemplates';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  onGoToDashboard?: () => void;
}

export default function InvoicePreviewModal({ isOpen, onClose, invoice, onGoToDashboard }: InvoicePreviewModalProps) {
  const [business, setBusiness] = React.useState<any>(null);

  React.useEffect(() => {
    if (isOpen) {
      supabaseService.getBusiness().then(setBusiness);
    }
  }, [isOpen]);

  if (!invoice) return null;

  const handleShareWhatsApp = () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const businessId = invoice.business_id;
      
      if (!businessId) {
        throw new Error('Business ID missing');
      }

      // Construct the PNG URL (Predictable path used in invoiceFileService)
      const pngUrl = `${supabaseUrl}/storage/v1/object/public/invoices/${businessId}/Invoice_${invoice.invoice_number}.png`;
      
      const message = `*Invoice: ${invoice.invoice_number}*
Hello ${invoice.customer_name},

Please find your invoice details below:
*Amount:* ${formatCurrency(invoice.total_amount)}
*Status:* ${invoice.payment_status?.toUpperCase() || 'N/A'}
*Date:* ${new Date(invoice.created_at).toLocaleDateString()}

You can view your invoice image here:
${pngUrl}

Thank you for your business!`;
      
      window.open(formatWhatsAppLink(invoice.customer_phone, message), '_blank');
    } catch (error) {
      console.error('Error sharing on WhatsApp:', error);
      // Fallback to simple message if URL fails
      const message = `Dear ${invoice.customer_name}, your invoice ${invoice.invoice_number} for ${formatCurrency(invoice.total_amount)} has been generated.\nThank you for your business!`;
      window.open(formatWhatsAppLink(invoice.customer_phone, message), '_blank');
    }
  };

  const handleViewInvoice = async () => {
    try {
      if (invoice.pdf_url) {
        window.open(invoice.pdf_url, '_blank');
      } else {
        // Fallback: generate and open on client if backend hasn't finished yet
        await generateInvoicePDF(invoice, 'print');
      }
    } catch (error) {
      console.error('Error viewing invoice:', error);
      await generateInvoicePDF(invoice, 'print');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      await generateInvoicePDF(invoice, 'download');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
          >
            <div className="p-8 text-center max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Invoice Preview</h3>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              {/* Invoice Preview */}
              <div className="mb-8 flex justify-center overflow-hidden">
                <div 
                  id="invoice-preview-container"
                  className={cn(
                    "bg-white rounded-lg border border-slate-200 shadow-[0_10px_40px_rgba(0,0,0,0.1)] text-left relative origin-top",
                    business?.invoice_theme === 'thermal' ? "w-[280px]" : "w-[794px]"
                  )}
                  style={{
                    transform: business?.invoice_theme === 'thermal' ? 'scale(1)' : 'scale(0.45)',
                    height: business?.invoice_theme === 'thermal' ? 'auto' : '500px',
                    marginBottom: business?.invoice_theme === 'thermal' ? '0' : '-250px'
                  }}
                  dangerouslySetInnerHTML={{ __html: getInvoiceHTML(invoice, business) }}
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={handleDownloadPDF}
                    className="flex items-center justify-center gap-3 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
                    style={{ backgroundColor: business?.invoice_theme_color || '#4f46e5' }}
                  >
                    <Download size={20} />
                    Download PDF
                  </button>
                
                <button 
                  onClick={async () => await generateInvoicePDF(invoice, 'print')}
                  className="flex items-center justify-center gap-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white py-4 rounded-2xl font-bold transition-all"
                >
                  <Printer size={20} />
                  Print Invoice
                </button>

                <button 
                  onClick={handleShareWhatsApp}
                  className="flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20"
                >
                  <Smartphone size={20} />
                  Share via WhatsApp
                </button>

                <button 
                  onClick={handleViewInvoice}
                  className="flex items-center justify-center gap-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white py-4 rounded-2xl font-bold transition-all"
                >
                  <Eye size={20} />
                  View Invoice
                </button>
              </div>

              {onGoToDashboard && (
                <button 
                  onClick={onGoToDashboard}
                  className="mt-6 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Go to Dashboard
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
