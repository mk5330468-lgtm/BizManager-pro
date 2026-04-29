import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Building2, Search, Plus, UserPlus } from 'lucide-react';
import { cn } from '../lib/utils';
import Customers from './Customers';
import Suppliers from './Suppliers';

export default function People() {
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Customers & Sellers</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your business relationships in one place.</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('customers')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all relative",
            activeTab === 'customers' 
              ? "text-indigo-600" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          {activeTab === 'customers' && (
            <motion.div 
              layoutId="peopleTab"
              className="absolute inset-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <Users size={18} />
            Customers
          </span>
        </button>
        <button 
          onClick={() => setActiveTab('suppliers')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all relative",
            activeTab === 'suppliers' 
              ? "text-indigo-600" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          {activeTab === 'suppliers' && (
            <motion.div 
              layoutId="peopleTab"
              className="absolute inset-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <Building2 size={18} />
            Suppliers (Parties)
          </span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'customers' ? <Customers /> : <Suppliers />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
