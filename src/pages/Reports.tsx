import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  BarChart3, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Calendar,
  Download,
  X,
  FileText,
  User,
  CreditCard,
  ChevronRight,
  TrendingDown,
  ExternalLink,
  List
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabaseService } from '../services/supabaseService';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

export default function Reports() {
  const queryClient = useQueryClient();
  const [reportMonth, setReportMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const { data: salesData = { current: [], previous: [], prevMonthLabel: '' }, isLoading: salesLoading } = useQuery({
    queryKey: ['reports', 'sales', reportMonth],
    queryFn: () => supabaseService.getSalesReport(reportMonth),
    staleTime: 1000 * 60, // 1 minute
  });

  const { data: reportStats = { perProductProfit: [], monthlySaleReport: [], topCategory: 'N/A' }, isLoading: statsLoading } = useQuery({
    queryKey: ['reports', 'stats', reportMonth],
    queryFn: () => supabaseService.getStatsReport(reportMonth),
    staleTime: 1000 * 60, // 1 minute
  });

  const { data: detailedProfit = [], isLoading: profitLoading } = useQuery({
    queryKey: ['reports', 'profit', reportMonth],
    queryFn: () => supabaseService.getDetailedProductProfit(reportMonth),
    staleTime: 1000 * 60, // 1 minute
  });

  const { data: detailedTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['reports', 'transactions', reportMonth],
    queryFn: () => supabaseService.getDetailedTransactionsReport(reportMonth),
    staleTime: 1000 * 60, // 1 minute
  });

  const { data: dashboardStats, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => supabaseService.getDashboardStats(),
    staleTime: 1000 * 60, // 1 minute
  });

  const { data: yearlyStats = [] } = useQuery({
    queryKey: ['reports', 'yearlyStats'],
    queryFn: () => supabaseService.getYearlyStats(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: querySummary } = useQuery({
    queryKey: ['reports', 'summary', reportMonth],
    queryFn: () => supabaseService.getMonthlySummary(reportMonth),
    staleTime: 1000 * 60, // 1 minute
  });

  const loading = salesLoading || statsLoading || profitLoading || transactionsLoading || dashboardLoading;
  
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [manualSummary, setManualSummary] = useState({
    sales_cash: 0, sales_upi: 0,
    goods_cash: 0, goods_upi: 0,
    expenses_cash: 0, expenses_upi: 0
  });
  const [monthInvoices, setMonthInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Helper to get all days in a month
  const getDaysInMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month, 0);
    return date.getDate();
  };

  // Helper to fill missing days for the chart
  const getChartData = () => {
    if (!reportMonth) return [];
    
    const daysInMonth = getDaysInMonth(reportMonth);
    const currentMap = new Map(salesData.current.map(d => [d.date, d.total]));
    const previousMap = new Map(salesData.previous.map(d => {
      // Get the day part to match with current month day
      const day = d.date.split('-')[2];
      return [day, d.total];
    }));
    
    const fullData = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const dayStr = String(i).padStart(2, '0');
      const dateStr = `${reportMonth}-${dayStr}`;
      const currentVal = (currentMap.get(dateStr) as number) || 0;
      const prevVal = (previousMap.get(dayStr) as number) || 0;
      
      let growth = 0;
      if (prevVal > 0) {
        growth = ((currentVal - prevVal) / prevVal) * 100;
      } else if (currentVal > 0) {
        growth = 100;
      }

      fullData.push({
        day: i,
        date: dateStr,
        total: currentVal,
        previousTotal: prevVal,
        growth: growth
      });
    }
    return fullData;
  };

  useEffect(() => {
    // Listen for global data refresh events
    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    };
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, [queryClient]);

  const handleMonthClick = async (month: string) => {
    setSelectedMonth(month);
    setLoadingInvoices(true);
    try {
      const data = await supabaseService.getMonthlyInvoices(month);
      setMonthInvoices(data || []);
    } catch (error) {
      console.error('Failed to fetch monthly invoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text('Business Sales Report', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Report Period: ${reportMonth}`, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 35);
    
    // Daily Sales Breakdown Table
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Daily Sales Breakdown', 14, 45);
    
    const tableData = detailedTransactions.map(tx => [
      formatDate(tx.date),
      tx.customer_name,
      tx.reference,
      tx.amount.toFixed(2),
      tx.status
    ]);
    
    autoTable(doc, {
      startY: 50,
      head: [['Date', 'Customer', 'Reference', 'Amount (INR)', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9 },
      columnStyles: {
        3: { halign: 'right' }
      }
    });
    
    // Summary
    const finalY = (doc as any).lastAutoTable.finalY || 50;
    const totalSales = detailedTransactions.reduce((acc, tx) => acc + tx.amount, 0);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Monthly Collections: INR ${totalSales.toLocaleString()}`, 14, finalY + 15);
    
    // Per Product Profit Table
    let currentY = finalY + 30;
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Per Product Profit Breakdown', 14, currentY);
    
    const profitTableData = detailedProfit.map(p => [
      formatDate(p.date),
      p.product_name,
      p.quantity,
      p.selling_price_after_discount.toFixed(2),
      p.purchase_price.toFixed(2),
      p.profit_per_unit.toFixed(2),
      p.total_profit.toFixed(2)
    ]);
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Date', 'Product', 'Qty', 'Sell Price', 'Buy Price', 'Unit Profit', 'Total Profit']],
      body: profitTableData,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] }, // Emerald-500
      styles: { fontSize: 8 },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' }
      }
    });

    const finalProfitY = (doc as any).lastAutoTable.finalY || currentY + 20;
    const totalProfit = detailedProfit.reduce((acc, p) => acc + p.total_profit, 0);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Monthly Profit: INR ${totalProfit.toLocaleString()}`, 14, finalProfitY + 15);
    
    doc.save(`Sales_Report_${reportMonth}.pdf`);
  };

  return (
    <div className="space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Reports</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Analyze performance trends.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link 
            to={`/reports/daily-sales?month=${reportMonth}`}
            className="flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl font-bold transition-all shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-sm"
          >
            <List size={18} />
            Ledger
          </Link>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-sm">
            <Calendar size={16} className="text-slate-400" />
            <input 
              type="month" 
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-28"
            />
          </div>
          <button 
            onClick={exportToPDF}
            className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-md shadow-indigo-100 dark:shadow-indigo-900/20 text-sm"
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Summary Card (Handwritten Style) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1 bg-[#fffdf0] dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white underline decoration-indigo-500 decoration-2 underline-offset-4">Monthly Summary</h3>
            <button 
              onClick={() => setIsSummaryModalOpen(true)}
              className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              Manual
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/50 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Total Invoiced</span>
              <span className="text-base font-black text-slate-900 dark:text-white">
                {formatCurrency(reportStats.monthlySaleReport?.find((m: any) => m.month === reportMonth)?.total || 0)}
              </span>
            </div>

            <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/50 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Collections</span>
              <span className="text-base font-black text-indigo-600">
                {formatCurrency((querySummary?.sales?.cash || 0) + (querySummary?.sales?.upi || 0))}
              </span>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[240px]">
                <thead>
                  <tr>
                    <th className="py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                    <th className="py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Cash</th>
                    <th className="py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">UPI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td className="py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">Sales</td>
                    <td className="py-1.5 text-[11px] font-black text-slate-900 dark:text-white text-right">{formatCurrency(querySummary?.sales?.cash || 0)}</td>
                    <td className="py-1.5 text-[11px] font-black text-slate-900 dark:text-white text-right">{formatCurrency(querySummary?.sales?.upi || 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">Goods</td>
                    <td className="py-1.5 text-[11px] font-black text-rose-600 text-right">-{formatCurrency(querySummary?.goods?.cash || 0)}</td>
                    <td className="py-1.5 text-[11px] font-black text-rose-600 text-right">-{formatCurrency(querySummary?.goods?.upi || 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">Costs</td>
                    <td className="py-1.5 text-[11px] font-black text-rose-600 text-right">-{formatCurrency(querySummary?.expenses?.cash || 0)}</td>
                    <td className="py-1.5 text-[11px] font-black text-rose-600 text-right">-{formatCurrency(querySummary?.expenses?.upi || 0)}</td>
                  </tr>
                  <tr className="bg-indigo-50/50 dark:bg-indigo-900/20">
                    <td className="py-1.5 text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase">Net</td>
                    <td className="py-1.5 text-[11px] font-black text-indigo-600 dark:text-indigo-400 text-right">{formatCurrency(querySummary?.stillHave?.cash || 0)}</td>
                    <td className="py-1.5 text-[11px] font-black text-indigo-600 dark:text-indigo-400 text-right">{formatCurrency(querySummary?.stillHave?.upi || 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* Sales Trend Chart (Simplified) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Sales Trend ({reportMonth})</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Comparing performance</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
              <Calendar size={12} />
              <span>VS Prev</span>
            </div>
          </div>
          
          <div className="h-48 w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getChartData()}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                    tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 dark:bg-slate-800 p-4 rounded-2xl shadow-2xl border border-slate-700 text-white min-w-[180px]">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{formatDate(data.date)}</p>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center gap-4">
                                <span className="text-xs text-slate-400">Current:</span>
                                <span className="text-sm font-black">{formatCurrency(data.total)}</span>
                              </div>
                              <div className="flex justify-between items-center gap-4">
                                <span className="text-xs text-slate-400">Previous:</span>
                                <span className="text-sm font-bold text-slate-500">{formatCurrency(data.previousTotal)}</span>
                              </div>
                              <div className="pt-2 border-t border-slate-700 flex justify-between items-center">
                                <span className="text-xs text-slate-400">Growth:</span>
                                <div className={cn(
                                  "flex items-center gap-1 text-xs font-black",
                                  data.growth >= 0 ? "text-emerald-400" : "text-rose-400"
                                )}>
                                  {data.growth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                  {data.growth.toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="previousTotal" 
                    stroke="#94a3b8" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={1} 
                    fill="url(#colorPrev)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#4f46e5" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorTotal)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 flex items-center justify-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Current</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300 border border-dashed border-slate-400" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Previous</span>
            </div>
          </div>
        </motion.div>

        {/* Key Metrics */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profits (Top 5)</p>
              <Link 
                to={`/reports/product-profit?month=${reportMonth}`}
                className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                <ExternalLink size={12} />
              </Link>
            </div>
            <div className="space-y-2">
              {loading ? (
                <p className="text-xs text-slate-400">Loading...</p>
              ) : !Array.isArray(reportStats.perProductProfit) || reportStats.perProductProfit.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic">No data</p>
              ) : reportStats.perProductProfit.map((p: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{p.name}</span>
                  <span className="font-black text-emerald-600">{formatCurrency(p.profit)}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Top Category</p>
            <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">{reportStats.topCategory}</h4>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Balances</p>
            <div className="space-y-2">
              {loading ? (
                <p className="text-xs text-slate-400">Loading...</p>
              ) : !dashboardStats?.accounts || dashboardStats.accounts.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic">No accounts</p>
              ) : dashboardStats.accounts.map((acc: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      acc.type === 'cash' ? "bg-emerald-500" : "bg-indigo-500"
                    )} />
                    <span className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">{acc.name}</span>
                  </div>
                  <span className="font-black text-slate-900 dark:text-white">{formatCurrency(acc.balance)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Recent Months</p>
            <div className="space-y-1.5">
              {loading ? (
                <p className="text-xs text-slate-400">Loading...</p>
              ) : !Array.isArray(reportStats.monthlySaleReport) || reportStats.monthlySaleReport.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic">No data</p>
              ) : reportStats.monthlySaleReport.map((m: any, i: number) => (
                <button 
                  key={i} 
                  onClick={() => handleMonthClick(m.month)}
                  className="w-full flex justify-between items-center p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group"
                >
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 uppercase tracking-tighter">{m.month}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-black text-slate-900 dark:text-white">{formatCurrency(m.total)}</span>
                    <ChevronRight size={12} className="text-slate-300" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Yearly Performance Chart */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Yearly Overview</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">12-month trend</p>
          </div>
          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600">
            <TrendingUp size={16} />
          </div>
        </div>
        
        <div className="h-48 w-full">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                  dy={10}
                  tickFormatter={(value) => {
                    const [year, month] = value.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1);
                    return date.toLocaleString('default', { month: 'short' });
                  }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                  tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
                />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const [year, month] = data.month.split('-');
                      const date = new Date(parseInt(year), parseInt(month) - 1);
                      return (
                        <div className="bg-slate-900 dark:bg-slate-800 p-4 rounded-2xl shadow-2xl border border-slate-700 text-white min-w-[150px]">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                            {date.toLocaleString('default', { month: 'long', year: 'numeric' })}
                          </p>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center gap-4">
                              <span className="text-xs text-slate-400">Total Sales:</span>
                              <span className="text-sm font-black text-indigo-400">{formatCurrency(data.total)}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4">
                              <span className="text-xs text-slate-400">Total Collection:</span>
                              <span className="text-sm font-black text-emerald-400">{formatCurrency(data.collection)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="total" 
                  name="Total Sales"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                  fill="#4f46e5"
                />
                <Bar 
                  dataKey="collection" 
                  name="Total Collection"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                  fill="#10b981"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      {/* Monthly Invoices Popup */}
      <AnimatePresence>
        {selectedMonth && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMonth(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-indigo-600 dark:bg-indigo-900 text-white shrink-0">
                <div>
                  <h3 className="text-xl font-black">Sales for {selectedMonth}</h3>
                  <p className="text-xs text-indigo-100 font-medium">Detailed customer sales report</p>
                </div>
                <button onClick={() => setSelectedMonth(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingInvoices ? (
                  <div className="py-20 text-center">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Fetching sales details...</p>
                  </div>
                ) : monthInvoices.length === 0 ? (
                  <div className="py-20 text-center">
                    <FileText size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-500 font-medium">No sales found for this month.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {monthInvoices.map((invoice: any) => (
                      <div key={invoice.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group hover:border-indigo-200 dark:hover:border-indigo-900 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <User size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{invoice.customer_name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase">
                              <span>{invoice.invoice_number}</span>
                              <span>•</span>
                              <span>{formatDate(invoice.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(invoice.total_amount)}</p>
                          <div className="flex items-center justify-end gap-1 text-[10px] font-bold uppercase">
                            <CreditCard size={10} className="text-slate-400" />
                            <span className={cn(
                              invoice.payment_status === 'paid' ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {invoice.payment_status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Monthly Sales</span>
                  <span className="text-2xl font-black text-indigo-600">
                    {formatCurrency(monthInvoices.reduce((acc, inv) => acc + inv.total_amount, 0))}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Summary Modal */}
      <AnimatePresence>
        {isSummaryModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSummaryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Manual Summary Entry</h3>
                <button onClick={() => setIsSummaryModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto">
                <p className="text-xs text-slate-500 font-medium">Use this to manually input summary data from your physical records.</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sale In (Cash)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={manualSummary.sales_cash ?? ''}
                      onChange={(e) => setManualSummary({...manualSummary, sales_cash: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sale In (UPI)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={manualSummary.sales_upi ?? ''}
                      onChange={(e) => setManualSummary({...manualSummary, sales_upi: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Goods (Cash)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={manualSummary.goods_cash ?? ''}
                      onChange={(e) => setManualSummary({...manualSummary, goods_cash: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Goods (UPI)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={manualSummary.goods_upi ?? ''}
                      onChange={(e) => setManualSummary({...manualSummary, goods_upi: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expenses (Cash)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={manualSummary.expenses_cash ?? ''}
                      onChange={(e) => setManualSummary({...manualSummary, expenses_cash: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expenses (UPI)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={manualSummary.expenses_upi ?? ''}
                      onChange={(e) => setManualSummary({...manualSummary, expenses_upi: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setMonthlySummary({
                      sales: { cash: manualSummary.sales_cash, upi: manualSummary.sales_upi },
                      goods: { cash: manualSummary.goods_cash, upi: manualSummary.goods_upi },
                      expenses: { cash: manualSummary.expenses_cash, upi: manualSummary.expenses_upi },
                      stillHave: { 
                        cash: manualSummary.sales_cash - manualSummary.goods_cash - manualSummary.expenses_cash,
                        upi: manualSummary.sales_upi - manualSummary.goods_upi - manualSummary.expenses_upi
                      }
                    });
                    setIsSummaryModalOpen(false);
                  }}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 dark:shadow-indigo-900/20"
                >
                  Apply Manual Summary
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Call to Action for Detailed Ledger */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
      >
        <div className="p-8 flex flex-col sm:flex-row items-center justify-between gap-6 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-900/10 dark:to-slate-900">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-[2rem] shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-center text-indigo-600">
              <FileText size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Daily Sales Ledger</h3>
              <p className="text-sm text-slate-500 font-medium max-w-xs">View every transaction, customer payments, and invoices in a detailed day-by-day breakdown.</p>
            </div>
          </div>
          <Link 
            to={`/reports/daily-sales?month=${reportMonth}`}
            className="group flex items-center gap-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-8 py-4 rounded-[2rem] font-black transition-all shadow-2xl hover:scale-105 active:scale-95"
          >
            Open Detailed Breakdown
            <ExternalLink size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
