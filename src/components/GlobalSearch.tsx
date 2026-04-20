import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Package, User, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabaseService } from '../services/supabaseService';
import { formatCurrency, cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ products: any[], customers: any[] }>({ products: [], customers: [] });
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2) {
        setLoading(true);
        try {
          const data = await supabaseService.search(query);
          setResults(data);
          setShowResults(true);
        } catch (error) {
          console.error('Search failed:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setResults({ products: [], customers: [] });
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (type: 'product' | 'customer', id: string | number) => {
    setShowResults(false);
    setQuery('');
    if (type === 'product') {
      navigate(`/products?edit=${id}`);
    } else {
      navigate(`/customers?id=${id}`);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          )}
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-10 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults({ products: [], customers: [] }); }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
          <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-3">
            {/* Products Section */}
            {results.products.length > 0 && (
              <div>
                <h4 className="px-2 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                  <Package size={10} /> Products
                </h4>
                <div className="space-y-0.5">
                  {results.products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelect('product', p.id)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Stock: {p.stock_quantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-black text-indigo-600">{formatCurrency(p.selling_price)}</span>
                        <ChevronRight size={12} className="text-slate-300 group-hover:text-indigo-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Customers Section */}
            {results.customers.length > 0 && (
              <div>
                <h4 className="px-2 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                  <User size={10} /> Customers
                </h4>
                <div className="space-y-0.5">
                  {results.customers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelect('customer', c.id)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{c.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{c.phone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[13px] font-black",
                          c.outstanding_balance > 0 ? "text-rose-600" : "text-emerald-600"
                        )}>
                          {formatCurrency(c.outstanding_balance)}
                        </span>
                        <ChevronRight size={12} className="text-slate-300 group-hover:text-indigo-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

              {results.products.length === 0 && results.customers.length === 0 && (
                <div className="py-8 text-center">
                  <Package className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">No results found for "{query}"</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
