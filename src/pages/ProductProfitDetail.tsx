import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  Search,
  Download
} from 'lucide-react';
import { formatCurrency, formatDate, cn, safeJson } from '../lib/utils';
import { motion } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabaseService } from '../services/supabaseService';

interface DetailedProfit {
  date: string;
  product_name: string;
  quantity: number;
  selling_price_after_discount: number;
  purchase_price: number;
  profit_per_unit: number;
  total_profit: number;
}

export default function ProductProfitDetail() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DetailedProfit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchParams({ month: e.target.value });
  };

  useEffect(() => {
    setLoading(true);
    supabaseService.getDetailedProductProfit(month)
      .then(data => {
        if (Array.isArray(data)) {
          setData(data);
        } else {
          console.error("Unexpected data format:", data);
          setData([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [month]);

  const filteredData = data.filter(item => 
    (item.product_name || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  const totalProfit = filteredData.reduce((acc, item) => acc + item.total_profit, 0);

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text('Per Product Profit Detail', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Report Period: ${month}`, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 35);
    
    // Stats Summary
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Total Profit: INR ${totalProfit.toLocaleString()}`, 14, 45);
    doc.text(`Total Items Sold: ${filteredData.reduce((acc, item) => acc + item.quantity, 0)}`, 14, 52);
    
    // Table
    const tableData = filteredData.map(item => [
      formatDate(item.date),
      item.product_name,
      item.quantity,
      item.selling_price_after_discount.toFixed(2),
      item.purchase_price.toFixed(2),
      item.profit_per_unit.toFixed(2),
      item.total_profit.toFixed(2)
    ]);
    
    autoTable(doc, {
      startY: 60,
      head: [['Date', 'Product', 'Qty', 'Selling Price', 'Purchase Price', 'Profit/Unit', 'Total Profit']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8 },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' }
      }
    });
    
    doc.save(`Product_Profit_Detail_${month}.pdf`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Per Product Profit Detail</h2>
            <p className="text-slate-500 dark:text-slate-400">Detailed breakdown for {month}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 shadow-sm">
            <Calendar size={18} className="text-slate-400" />
            <input 
              type="month" 
              value={month}
              onChange={handleMonthChange}
              className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
            />
          </div>
          <button 
            onClick={exportToPDF}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
          >
            <Download size={20} />
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Profit (Filtered)</p>
          <h4 className="text-2xl font-black text-emerald-600">{formatCurrency(totalProfit)}</h4>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Items Sold</p>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white">
            {filteredData.reduce((acc, item) => acc + item.quantity, 0)}
          </h4>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Product</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Qty</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Price (After Disc)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Purchase Price</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Profit (Unit)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                    Loading detailed profit report...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                    No data found for this period.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      {item.product_name}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-600 dark:text-slate-400">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      {formatCurrency(item.selling_price_after_discount)}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">
                      {formatCurrency(item.purchase_price)}
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "flex items-center gap-1 font-bold",
                        item.profit_per_unit >= 0 ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {item.profit_per_unit >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {formatCurrency(item.profit_per_unit)}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-900 dark:text-white">
                      {formatCurrency(item.total_profit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
