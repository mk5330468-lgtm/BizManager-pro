import React, { useState, useEffect } from 'react';
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
  ExternalLink
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
  const [salesData, setSalesData] = useState<{ current: any[], previous: any[], prevMonthLabel: string }>({ current: [], previous: [], prevMonthLabel: '' });
  const [yearlyStats, setYearlyStats] = useState<any[]>([]);
  const [reportStats, setReportStats] = useState({
    perProductProfit: [] as any[],
    monthlySaleReport: [] as any[],
    topCategory: 'N/A'
  });
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [monthInvoices, setMonthInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [reportMonth, setReportMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [detailedTransactions, setDetailedTransactions] = useState<any[]>([]);
  const [detailedProfit, setDetailedProfit] = useState<any[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<any>(null);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [manualSummary, setManualSummary] = useState({
    sales_cash: 0, sales_upi: 0,
    goods_cash: 0, goods_upi: 0,
    expenses_cash: 0, expenses_upi: 0
  });

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
    const fetchData = () => {
      if (!salesData) setLoading(true);
      Promise.all([
        supabaseService.getSalesReport(reportMonth),
        supabaseService.getStatsReport(reportMonth),
        supabaseService.getDetailedTransactionsReport(reportMonth),
        supabaseService.getDetailedProductProfit(reportMonth),
        supabaseService.getMonthlySummary(reportMonth),
        supabaseService.getDashboardStats(),
        supabaseService.getYearlyStats()
      ]).then(([sales, stats, detailed, profit, summary, dStats, yStats]) => {
        setSalesData(sales);
        setReportStats(stats);
        setDetailedTransactions(detailed);
        setDetailedProfit(profit);
        setMonthlySummary(summary);
        setDashboardStats(dStats);
        setYearlyStats(yStats);
        setLoading(false);
      }).catch(err => {
        console.error('Error fetching report data:', err);
        setLoading(false);
      });
    };

    fetchData();

    // Listen for global data refresh events
    const handleRefresh = () => {
      fetchData();
    };
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, [reportMonth]);

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
    <div className="space-y-8">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Business Reports</h2>
          <p className="text-slate-500 dark:text-slate-400">Analyze your sales performance and trends.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 shadow-sm">
            <Calendar size={18} className="text-slate-400" />
            <input 
              type="month" 
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
            />
          </div>
          <button 
            onClick={exportToPDF}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
          >
            <Download size={20} />
            Export Report
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Monthly Summary Card (Handwritten Style) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1 bg-[#fffdf0] dark:bg-slate-900/50 p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-slate-900 dark:text-white underline decoration-indigo-500 decoration-4 underline-offset-4">Monthly Summary</h3>
            <button 
              onClick={() => setIsSummaryModalOpen(true)}
              className="text-[10px] font-bold uppercase text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              Manual Entry
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b-2 border-slate-100 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Invoiced</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">
                {formatCurrency(reportStats.monthlySaleReport?.find((m: any) => m.month === reportMonth)?.total || 0)}
              </span>
            </div>

            <div className="flex justify-between items-center pb-2 border-b-2 border-slate-100 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Collections</span>
              <span className="text-xl font-black text-indigo-600">
                {formatCurrency((monthlySummary?.sales?.cash || 0) + (monthlySummary?.sales?.upi || 0))}
              </span>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[300px]">
                <thead>
                  <tr>
                    <th className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                    <th className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Cash</th>
                    <th className="py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">UPI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td className="py-3 text-sm font-bold text-slate-700 dark:text-slate-300">Sale In</td>
                    <td className="py-3 text-sm font-black text-slate-900 dark:text-white text-right">{formatCurrency(monthlySummary?.sales?.cash || 0)}</td>
                    <td className="py-3 text-sm font-black text-slate-900 dark:text-white text-right">{formatCurrency(monthlySummary?.sales?.upi || 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm font-bold text-slate-700 dark:text-slate-300">Goods</td>
                    <td className="py-3 text-sm font-black text-rose-600 text-right">-{formatCurrency(monthlySummary?.goods?.cash || 0)}</td>
                    <td className="py-3 text-sm font-black text-rose-600 text-right">-{formatCurrency(monthlySummary?.goods?.upi || 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm font-bold text-slate-700 dark:text-slate-300">Expenses</td>
                    <td className="py-3 text-sm font-black text-rose-600 text-right">-{formatCurrency(monthlySummary?.expenses?.cash || 0)}</td>
                    <td className="py-3 text-sm font-black text-rose-600 text-right">-{formatCurrency(monthlySummary?.expenses?.upi || 0)}</td>
                  </tr>
                  <tr className="bg-indigo-50/50 dark:bg-indigo-900/20">
                    <td className="py-3 text-sm font-black text-indigo-600 dark:text-indigo-400">Still Have</td>
                    <td className="py-3 text-sm font-black text-indigo-600 dark:text-indigo-400 text-right">{formatCurrency(monthlySummary?.stillHave?.cash || 0)}</td>
                    <td className="py-3 text-sm font-black text-indigo-600 dark:text-indigo-400 text-right">{formatCurrency(monthlySummary?.stillHave?.upi || 0)}</td>
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
          className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sales Trend ({reportMonth})</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Comparing with {salesData.prevMonthLabel || 'previous month'}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
              <Calendar size={14} />
              <span>Monthly Comparison</span>
            </div>
          </div>
          
          <div className="h-72 w-full">
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
          <div className="mt-6 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-600" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current Month</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-300 border border-dashed border-slate-400" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Previous Month</span>
            </div>
          </div>
        </motion.div>

        {/* Key Metrics */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-6"
        >
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Per Product Profit (Top 5)</p>
              <Link 
                to={`/reports/product-profit?month=${reportMonth}`}
                className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                <ExternalLink size={14} />
              </Link>
            </div>
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : !Array.isArray(reportStats.perProductProfit) || reportStats.perProductProfit.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No sales data yet</p>
              ) : reportStats.perProductProfit.map((p: any, i: number) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{p.name}</span>
                  <span className="text-sm font-bold text-emerald-600">{formatCurrency(p.profit)}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-1">Top Category</p>
            <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{reportStats.topCategory}</h4>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Most listed category</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-3">Account Balances</p>
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : !dashboardStats?.accounts || dashboardStats.accounts.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No accounts found</p>
              ) : dashboardStats.accounts.map((acc: any, i: number) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      acc.type === 'cash' ? "bg-emerald-500" : "bg-indigo-500"
                    )} />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">{acc.name}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(acc.balance)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-3">Monthly Sale Report</p>
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : !Array.isArray(reportStats.monthlySaleReport) || reportStats.monthlySaleReport.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No sales data yet</p>
              ) : reportStats.monthlySaleReport.map((m: any, i: number) => (
                <button 
                  key={i} 
                  onClick={() => handleMonthClick(m.month)}
                  className="w-full flex justify-between items-center p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group"
                >
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{m.month}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-indigo-600">{formatCurrency(m.total)}</span>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400" />
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
        className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Yearly Performance (Last 12 Months)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Monthly sales trend over the past year</p>
          </div>
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
            <TrendingUp size={20} />
          </div>
        </div>
        
        <div className="h-72 w-full">
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

      {/* Detailed Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Daily Sales Breakdown</h3>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-500">Payments (Pay In)</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reference</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status/Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <AnimatePresence>
                {detailedTransactions.length === 0 ? (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                      No transactions found for this month.
                    </td>
                  </motion.tr>
                ) : (
                  (() => {
                    const grouped = detailedTransactions.reduce((acc: any, tx: any) => {
                      const date = formatDate(tx.date);
                      if (!acc[date]) acc[date] = [];
                      acc[date].push(tx);
                      return acc;
                    }, {});

                    return Object.entries(grouped).map(([date, transactions]: [string, any]) => (
                      <React.Fragment key={date}>
                        <motion.tr 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="bg-slate-50/50 dark:bg-slate-800/30"
                        >
                          <td colSpan={6} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-y border-slate-100 dark:border-slate-800">
                            {date}
                          </td>
                        </motion.tr>
                        {transactions.map((tx: any, i: number) => {
                          return (
                            <motion.tr 
                              key={`${tx.type}-${tx.id}-${i}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                            >
                              <td className="px-6 py-4 font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap text-xs">
                                {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                                  {tx.type}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                {tx.customer_name}
                              </td>
                              <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                                {tx.reference}
                              </td>
                              <td className="px-6 py-4 font-black text-slate-900 dark:text-white">
                                {formatCurrency(tx.amount)}
                              </td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "text-[10px] font-bold uppercase",
                                  tx.status === 'paid' || tx.status === 'cash' || tx.status === 'upi'
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                )}>
                                  {tx.status}
                                </span>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </React.Fragment>
                    ));
                  })()
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
