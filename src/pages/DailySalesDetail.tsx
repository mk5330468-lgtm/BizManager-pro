import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Calendar, 
  Search,
  Download,
  CreditCard,
  User,
  Filter
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabaseService } from '../services/supabaseService';

export default function DailySalesDetail() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'payment' | 'invoice'>('all');
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

  const { data: rawData = [], isLoading: loading } = useQuery({
    queryKey: ['reports', 'transactions', month],
    queryFn: () => supabaseService.getDetailedTransactionsReport(month),
    staleTime: 1000 * 60 * 5,
  });

  const data = Array.isArray(rawData) ? rawData : [];

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchParams({ month: e.target.value });
  };

  const filteredData = data.filter(item => {
    const matchesSearch = (item.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.reference || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalAmount = filteredData.reduce((acc, item) => acc + item.amount, 0);

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229);
    doc.text('Daily Sales Detailed Report', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Report Period: ${month}`, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 35);
    
    const tableData = filteredData.map(tx => [
      formatDate(tx.date),
      tx.type.toUpperCase(),
      tx.customer_name,
      tx.reference,
      tx.amount.toFixed(2),
      tx.status.toUpperCase()
    ]);
    
    autoTable(doc, {
      startY: 50,
      head: [['Date', 'Type', 'Customer', 'Reference', 'Amount (INR)', 'Status/Mode']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9 },
      columnStyles: {
        4: { halign: 'right' }
      }
    });
    
    doc.save(`Daily_Sales_Detail_${month}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ArrowLeft size={24} className="text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Daily Sales Breakdown</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Detailed Transaction Ledger</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 shadow-sm">
            <Calendar size={18} className="text-slate-400" />
            <input 
              type="month" 
              value={month}
              onChange={handleMonthChange}
              className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none w-32"
            />
          </div>
          <button 
            onClick={exportToPDF}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
          >
            <Download size={20} />
            <span className="hidden sm:inline">Export PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Amount</p>
          <h4 className="text-2xl font-black text-indigo-600">{formatCurrency(totalAmount)}</h4>
        </div>
        
        <div className="md:col-span-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by customer or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-1">
          {(['all', 'payment', 'invoice'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={cn(
                "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all",
                typeFilter === type 
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg" 
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700">
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ref / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Loading transactions...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="bg-slate-100 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="text-slate-400" size={32} />
                    </div>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">No matching sales recorded</p>
                  </td>
                </tr>
              ) : (
                (() => {
                  const grouped = filteredData.reduce((acc: any, tx: any) => {
                    const date = formatDate(tx.date);
                    if (!acc[date]) acc[date] = [];
                    acc[date].push(tx);
                    return acc;
                  }, {});

                  return Object.entries(grouped).map(([date, transactions]: [string, any]) => (
                    <React.Fragment key={date}>
                      <tr className="bg-slate-50/30 dark:bg-slate-800/20">
                        <td colSpan={5} className="px-6 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {date}
                        </td>
                      </tr>
                      {transactions.map((tx: any, i: number) => (
                        <motion.tr 
                          key={`${tx.type}-${tx.id}-${i}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group border-none"
                        >
                          <td className="px-6 py-4 text-[10px] font-bold text-slate-500">
                            {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-[9px] font-black uppercase px-2 py-0.5 rounded-md",
                              tx.type === 'invoice' 
                                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            )}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-black text-[10px]">
                                {tx.customer_name?.charAt(0)}
                              </div>
                              <span className="font-bold text-slate-900 dark:text-white text-sm">{tx.customer_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-black text-slate-900 dark:text-white">{formatCurrency(tx.amount)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-mono text-slate-400">{tx.reference}</span>
                              <span className={cn(
                                "text-[9px] font-black uppercase",
                                tx.status === 'paid' || tx.status === 'cash' || tx.status === 'upi'
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                              )}>
                                {tx.status}
                              </span>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </React.Fragment>
                  ));
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
