import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  AlertCircle,
  Filter,
  MoreVertical
} from 'lucide-react';
import { Product } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { supabaseService } from '../services/supabaseService';
import { X } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [filterOption, setFilterOption] = useState<'az' | 'za' | 'low' | 'zero' | 'none'>('none');

  // Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    sku: '',
    purchase_price: 0,
    selling_price: 0,
    stock_quantity: 0,
    low_stock_alert: 5,
    tax_percentage: 0
  });

  useEffect(() => {
    fetchProducts();

    // Listen for global data refresh events
    const handleRefresh = () => {
      fetchProducts();
    };
    window.addEventListener('refresh-data', handleRefresh);
    return () => window.removeEventListener('refresh-data', handleRefresh);
  }, []);

  const fetchProducts = async () => {
    if (products.length === 0) setLoading(true);
    try {
      const data = await supabaseService.getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await supabaseService.updateProduct(editingProduct.id, formData);
      } else {
        await supabaseService.createProduct(formData as any);
      }
      
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({
        name: '', category: '', sku: '', purchase_price: 0, selling_price: 0, stock_quantity: 0, low_stock_alert: 5, tax_percentage: 0
      });
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      sku: product.sku,
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      stock_quantity: product.stock_quantity,
      low_stock_alert: product.low_stock_alert,
      tax_percentage: product.tax_percentage
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    setProductToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setDeleteLoading(true);
    try {
      await supabaseService.deleteProduct(productToDelete);
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredProducts = products
    .filter(p => 
      (p.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
      (p.sku || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (p.category || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    )
    .filter(p => {
      if (filterOption === 'low') return p.stock_quantity <= p.low_stock_alert && p.stock_quantity > 0;
      if (filterOption === 'zero') return p.stock_quantity <= 0;
      return true;
    })
    .sort((a, b) => {
      if (filterOption === 'az') return a.name.localeCompare(b.name);
      if (filterOption === 'za') return b.name.localeCompare(a.name);
      return 0;
    });

  return (
    <div className="space-y-4">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Products & Inventory</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manage stock and pricing.</p>
        </div>
        <button 
          onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
          className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-indigo-100 dark:shadow-indigo-900/20 text-sm"
        >
          <Plus size={18} />
          Add Product
        </button>
      </motion.div>

      {/* Filters & Search */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Search products..." 
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select 
            className="bg-transparent border-none focus:ring-0 text-slate-600 dark:text-slate-400 font-bold text-xs cursor-pointer outline-none"
            value={filterOption}
            onChange={(e) => setFilterOption(e.target.value as any)}
          >
            <option value="none">All Products</option>
            <option value="az">A-Z Sort</option>
            <option value="za">Z-A Sort</option>
            <option value="low">Low Stock</option>
            <option value="zero">Zero Stock</option>
          </select>
        </div>
      </motion.div>

      {/* Product Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-bottom border-slate-200 dark:border-slate-800">
                <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Product</th>
                <th className="hidden sm:table-cell px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stock</th>
                <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Price</th>
                <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key="loading"
                  >
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-xs">Loading...</td>
                  </motion.tr>
                ) : filteredProducts.length === 0 ? (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key="empty"
                  >
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-xs">No products found.</td>
                  </motion.tr>
                ) : filteredProducts.map((product) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    key={product.id} 
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate max-w-[100px] sm:max-w-none">{product.name}</span>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400">SKU: {product.sku || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-3 py-2.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                      {product.category || 'None'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <span className={cn(
                        "text-[11px] font-black",
                        product.stock_quantity <= product.low_stock_alert ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"
                      )}>
                        {product.stock_quantity}
                      </span>
                      {product.stock_quantity <= product.low_stock_alert && (
                        <AlertCircle size={10} className="text-rose-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-slate-900 dark:text-white">{formatCurrency(product.selling_price)}</span>
                      <span className="hidden sm:inline text-[9px] text-slate-500 dark:text-slate-400">Cost: {formatCurrency(product.purchase_price)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => handleEdit(product)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-all">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(product.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-md transition-all">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Product Name *</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Category</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      value={formData.category || ''}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">SKU</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      value={formData.sku || ''}
                      onChange={(e) => setFormData({...formData, sku: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Tax Percentage (%)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      placeholder="0"
                      value={formData.tax_percentage || ''}
                      onChange={(e) => setFormData({...formData, tax_percentage: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Purchase Price *</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      placeholder="0"
                      value={formData.purchase_price || ''}
                      onChange={(e) => setFormData({...formData, purchase_price: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Selling Price *</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      placeholder="0"
                      value={formData.selling_price || ''}
                      onChange={(e) => setFormData({...formData, selling_price: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Stock Quantity</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      placeholder="0"
                      value={formData.stock_quantity || ''}
                      onChange={(e) => setFormData({...formData, stock_quantity: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Low Stock Alert</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none"
                      placeholder="0"
                      value={formData.low_stock_alert || ''}
                      onChange={(e) => setFormData({...formData, low_stock_alert: e.target.value === '' ? 0 : Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
                  >
                    {editingProduct ? 'Update Product' : 'Save Product'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone and may affect existing reports."
        confirmText="Delete Product"
      />
    </div>
  );
}
