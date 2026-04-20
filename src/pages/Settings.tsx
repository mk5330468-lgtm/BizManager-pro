import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  FileText, 
  Palette, 
  ShieldCheck, 
  Save, 
  Upload, 
  Globe, 
  Phone, 
  Mail, 
  MapPin,
  CheckCircle2,
  AlertCircle,
  Instagram,
  Plus,
  X,
  Database,
  CloudUpload,
  CloudDownload,
  Download,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { supabaseService } from '../services/supabaseService';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';

import { toast } from 'react-hot-toast';

type Tab = 'profile' | 'invoice' | 'subscription' | 'backup';

export default function Settings() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'profile');
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [business, setBusiness] = useState({
    id: '' as string | number,
    username: '',
    business_name: '',
    owner_name: '',
    email: '',
    phone: '',
    address: '',
    gstin: '',
    logo_url: '',
    esign_url: '',
    invoice_terms: 'No Return, No Exchange',
    invoice_theme_color: '#4f46e5',
    invoice_theme: 'gst' as 'gst' | 'modern' | 'thermal',
    instagram_id: ''
  });

  useEffect(() => {
    if (user) {
      supabaseService.getBusiness()
        .then(data => {
          if (data) {
            // If email is missing in business profile, use login email
            if (!data.email && user.email) {
              data.email = user.email;
            }
            setBusiness(data);
          } else if (user.email) {
            // New business profile, pre-fill email
            setBusiness(prev => ({ ...prev, email: user.email || '' }));
          }
        })
        .catch(err => console.error('Error fetching business:', err));
    }
  }, [user, searchParams]);


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'esign_url') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBusiness({ ...business, [field]: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };


  const handleCloudSync = async () => {
    try {
      setLoading(true);
      await supabaseService.cloudSync();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Cloud sync error:', error);
      alert('Cloud sync failed. Please check your Supabase configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloudRestore = async () => {
    setIsRestoreModalOpen(true);
  };

  const confirmCloudRestore = async () => {
    try {
      setLoading(true);
      await supabaseService.cloudRestore();
      setIsRestoreModalOpen(false);
      alert('Data restored successfully from cloud!');
      window.location.reload();
    } catch (error) {
      console.error('Cloud restore error:', error);
      alert(error instanceof Error ? error.message : 'Cloud restore failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      setLoading(true);
      const data = await supabaseService.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bizmanager_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export backup');
    } finally {
      setLoading(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImportFile(file);
    setIsImportModalOpen(true);
  };

  const confirmImportBackup = async () => {
    if (!pendingImportFile) return;
    try {
      setLoading(true);
      const text = await pendingImportFile.text();
      const data = JSON.parse(text);
      await supabaseService.importBackup(data);
      setIsImportModalOpen(false);
      alert('Backup restored successfully! The application will now reload.');
      window.location.reload();
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to restore backup. Please ensure the file is a valid BizManager backup.');
    } finally {
      setLoading(false);
      setPendingImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      await supabaseService.deleteAccount();
      toast.success('Account deleted successfully');
      setIsDeleteModalOpen(false);
      // Wait for toast to show before redirecting/logout
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
    } catch (error: any) {
      console.error('Delete account error:', error);
      toast.error(error.message || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      await supabaseService.updateBusiness(business);
      setSuccess(true);
      // Dispatch event to refresh sidebar and other components
      window.dispatchEvent(new CustomEvent('refresh-data'));
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating business:', error);
      alert('Failed to update business profile');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Business Profile', icon: Building2 },
    { id: 'invoice', label: 'Invoice Settings', icon: FileText },
    { id: 'subscription', label: 'Subscription', icon: ShieldCheck },
    { id: 'backup', label: 'Backup & Restore', icon: Database },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Settings</h2>
        <p className="text-slate-500 dark:text-slate-400">Manage your business profile and application preferences.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
                activeTab === tab.id 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20" 
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <tab.icon size={20} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-8">
              <AnimatePresence mode="wait">
                {activeTab === 'profile' && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >

                    <div className="flex items-center gap-4 mb-8">
                      <label className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 group cursor-pointer hover:border-indigo-500 transition-all overflow-hidden">
                        {business.logo_url ? (
                          <img src={business.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                        ) : (
                          <Upload className="text-slate-400 group-hover:text-indigo-500" size={24} />
                        )}
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'logo_url')}
                        />
                      </label>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">Business Logo</h4>
                        <p className="text-xs text-slate-500">Upload from local file (PNG, JPG)</p>
                        <div className="mt-2 flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Or paste Logo URL"
                            className="text-xs w-full px-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                            value={business.logo_url ?? ''}
                            onChange={(e) => setBusiness({...business, logo_url: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Business Name</label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            required
                            type="text" 
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
                            value={business.business_name ?? ''}
                            onChange={(e) => setBusiness({...business, business_name: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Owner Name</label>
                        <input 
                          required
                          type="text" 
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
                          value={business.owner_name ?? ''}
                          onChange={(e) => setBusiness({...business, owner_name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            required
                            type="email" 
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
                            value={business.email ?? ''}
                            onChange={(e) => setBusiness({...business, email: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            required
                            type="text" 
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
                            value={business.phone ?? ''}
                            onChange={(e) => setBusiness({...business, phone: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2 space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">GSTIN / Tax ID</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
                          value={business.gstin ?? ''}
                          onChange={(e) => setBusiness({...business, gstin: e.target.value})}
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Business Address</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-4 text-slate-400" size={18} />
                          <textarea 
                            rows={3}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white resize-none"
                            value={business.address ?? ''}
                            onChange={(e) => setBusiness({...business, address: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                  </motion.div>
                )}

                {activeTab === 'invoice' && (
                  <motion.div
                    key="invoice"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Palette size={18} className="text-indigo-600" />
                        Theme & Appearance
                      </h4>
                      
                      <div className="space-y-4">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Invoice Theme Style</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                          {[
                            { 
                              id: 'gst', 
                              label: 'Standard GST', 
                              desc: 'Detailed, GST-ready',
                              preview: (
                                <div className="w-full aspect-[3/4] bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm group-hover:shadow-md transition-all">
                                  <img 
                                    src="https://resources.tallysolutions.com/wp-content/uploads/2021/02/tax-invoice.jpg" 
                                    alt="Standard GST" 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )
                            },
                            { 
                              id: 'modern', 
                              label: 'Modern Minimal', 
                              desc: 'Clean, elegant',
                              preview: (
                                <div className="w-full aspect-[3/4] bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm group-hover:shadow-md transition-all">
                                  <img 
                                    src="https://marketplace.canva.com/EAE92Pl9bfg/6/0/1131w/canva-black-and-gray-minimal-freelancer-invoice-wPpAXSlmfF4.jpg" 
                                    alt="Modern Minimal" 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )
                            },
                            { 
                              id: 'thermal', 
                              label: 'Thermal Receipt', 
                              desc: 'Narrow, for POS',
                              preview: (
                                <div className="w-full aspect-[3/4] bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm group-hover:shadow-md transition-all flex items-center justify-center p-2">
                                  <img 
                                    src="https://sleekbill.in/images/thermal-print-58mm.png" 
                                    alt="Thermal Receipt" 
                                    className="h-full w-auto object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )
                            }
                          ].map((theme) => (
                            <button
                              key={theme.id}
                              type="button"
                              onClick={() => setBusiness({...business, invoice_theme: theme.id as any})}
                              className={cn(
                                "group p-4 rounded-3xl border-2 text-left transition-all flex flex-col gap-4",
                                business.invoice_theme === theme.id 
                                  ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10" 
                                  : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                              )}
                            >
                              <div className="relative">
                                {theme.preview}
                                {business.invoice_theme === theme.id && (
                                  <div className="absolute top-2 right-2 bg-indigo-600 text-white p-1 rounded-full shadow-lg">
                                    <CheckCircle2 size={12} />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className={cn("font-bold text-sm", business.invoice_theme === theme.id ? "text-indigo-600" : "text-slate-900 dark:text-white")}>
                                  {theme.label}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1">{theme.desc}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div 
                          className="w-12 h-12 rounded-xl border-2 border-white dark:border-slate-800 shadow-lg"
                          style={{ backgroundColor: business.invoice_theme_color }}
                        />
                        <div className="flex-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Invoice Accent Color</label>
                          <input 
                            type="color" 
                            className="w-full h-10 bg-transparent border-none outline-none cursor-pointer"
                            value={business.invoice_theme_color ?? ''}
                            onChange={(e) => setBusiness({...business, invoice_theme_color: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                          <Instagram size={14} className="text-pink-600" />
                          Instagram ID (for QR Code)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">@</span>
                          <input 
                            type="text" 
                            placeholder="username"
                            className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
                            value={business.instagram_id ?? ''}
                            onChange={(e) => setBusiness({...business, instagram_id: e.target.value})}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500">This will generate a QR code on your invoices for customers to follow you.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <ShieldCheck size={18} className="text-indigo-600" />
                        Custom Terms & E-Sign
                      </h4>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice Terms (e.g., No Return No Exchange)</label>
                          <textarea 
                            rows={3}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white resize-none"
                            value={business.invoice_terms ?? ''}
                            onChange={(e) => setBusiness({...business, invoice_terms: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">E-Signature (Text-based)</label>
                          <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 space-y-2">
                              <input 
                                type="text" 
                                placeholder="Type your name for signature"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
                                value={(() => {
                                  try {
                                    const data = JSON.parse(business.esign_url || '{}');
                                    return data.text || '';
                                  } catch (e) {
                                    return business.esign_url || '';
                                  }
                                })()}
                                onChange={(e) => {
                                  let currentData = { text: '', font: 'Dancing Script' };
                                  try {
                                    currentData = JSON.parse(business.esign_url || '{}');
                                    if (typeof currentData !== 'object') throw new Error();
                                  } catch (err) {
                                    currentData = { text: business.esign_url || '', font: 'Dancing Script' };
                                  }
                                  setBusiness({...business, esign_url: JSON.stringify({ ...currentData, text: e.target.value })});
                                }}
                              />
                              <p className="text-[10px] text-slate-500">Type the name you want to appear as your signature.</p>
                            </div>
                            <div className="w-full sm:w-48 space-y-2">
                              <select 
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
                                value={(() => {
                                  try {
                                    const data = JSON.parse(business.esign_url || '{}');
                                    return data.font || 'Dancing Script';
                                  } catch (e) {
                                    return 'Dancing Script';
                                  }
                                })()}
                                onChange={(e) => {
                                  let currentData = { text: '', font: 'Dancing Script' };
                                  try {
                                    currentData = JSON.parse(business.esign_url || '{}');
                                    if (typeof currentData !== 'object') throw new Error();
                                  } catch (err) {
                                    currentData = { text: business.esign_url || '', font: 'Dancing Script' };
                                  }
                                  setBusiness({...business, esign_url: JSON.stringify({ ...currentData, font: e.target.value })});
                                }}
                              >
                                <option value="Dancing Script">Dancing Script</option>
                                <option value="Pacifico">Pacifico</option>
                                <option value="Great Vibes">Great Vibes</option>
                                <option value="Alex Brush">Alex Brush</option>
                                <option value="Satisfy">Satisfy</option>
                                <option value="Homemade Apple">Homemade Apple</option>
                                <option value="Yellowtail">Yellowtail</option>
                              </select>
                              <p className="text-[10px] text-slate-500">Choose a signature style.</p>
                            </div>
                          </div>
                          
                          {/* Signature Preview */}
                          <div className="mt-4 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center min-h-[100px]">
                            {(() => {
                              try {
                                const data = JSON.parse(business.esign_url || '{}');
                                if (!data.text) return <span className="text-slate-400 text-sm italic">Signature Preview</span>;
                                return (
                                  <span style={{ fontFamily: data.font || 'Dancing Script', fontSize: '32px', color: business.invoice_theme_color || '#4f46e5' }}>
                                    {data.text}
                                  </span>
                                );
                              } catch (e) {
                                if (business.esign_url && business.esign_url.startsWith('http')) {
                                  return <img src={business.esign_url} alt="Signature" className="max-h-16 object-contain" />;
                                }
                                return <span className="text-slate-400 text-sm italic">Signature Preview</span>;
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'backup' && (
                  <motion.div
                    key="backup"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 p-6 rounded-2xl flex gap-4 items-start">
                      <CloudUpload className="text-indigo-600 dark:text-indigo-400 shrink-0" size={24} />
                      <div>
                        <h4 className="font-bold text-indigo-900 dark:text-indigo-200 mb-1">Automatic Cloud Sync Active</h4>
                        <p className="text-sm text-indigo-700 dark:text-indigo-300">
                          Your data is automatically backed up to the cloud on every change. This ensures your business records are safe and accessible even if you lose access to this device.
                        </p>
                      </div>
                    </div>

                    <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 text-center">
                      <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto">
                        <Database size={40} />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-900 dark:text-white">Cloud Storage Backup</h4>
                        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2">
                          Your database state is synced to Supabase Storage. This is the recommended way to keep your data safe.
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                          type="button"
                          onClick={handleCloudSync}
                          disabled={loading}
                          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 disabled:opacity-50"
                        >
                          <RefreshCw size={20} className={cn(loading && "animate-spin")} />
                          {loading ? 'Syncing...' : 'Sync to Cloud Now'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCloudRestore}
                          disabled={loading}
                          className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 px-8 py-4 rounded-2xl font-bold transition-all hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50"
                        >
                          <CloudDownload size={20} />
                          {loading ? 'Restoring...' : 'Restore from Cloud'}
                        </button>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Manual Backup Options (Local)</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-4">
                          <div className="flex items-center gap-3">
                            <Download className="text-slate-400" size={20} />
                            <h4 className="font-bold text-slate-900 dark:text-white">Export JSON</h4>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Download a local copy of your data for offline use.</p>
                          <button
                            type="button"
                            onClick={handleExportBackup}
                            disabled={loading}
                            className="text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:underline disabled:opacity-50"
                          >
                            Download Local File
                          </button>
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-4">
                          <div className="flex items-center gap-3">
                            <Upload className="text-slate-400" size={20} />
                            <h4 className="font-bold text-slate-900 dark:text-white">Restore from File</h4>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Restore your database from a local JSON backup file.</p>
                          <label className="text-emerald-600 dark:text-emerald-400 font-bold text-sm hover:underline cursor-pointer">
                            Upload & Restore
                            <input 
                              type="file" 
                              accept=".json" 
                              className="hidden" 
                              onChange={handleImportBackup}
                              disabled={loading}
                            />
                          </label>
                        </div>
                      </div>

                      <div className="mt-8 p-6 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 rounded-2xl">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                          <div>
                            <h4 className="font-bold text-rose-900 dark:text-rose-200">Danger Zone</h4>
                            <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">Permanently delete your account and all associated business data.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsDeleteModalOpen(true)}
                            className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-rose-100 dark:shadow-rose-900/20"
                          >
                            Delete Account
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'subscription' && (
                  <motion.div
                    key="subscription"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="text-center py-12"
                  >
                    <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto mb-6">
                      <ShieldCheck size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Free Plan</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto">
                      You are currently on the free plan. Upgrade to unlock advanced reports, multi-user access, and priority support.
                    </p>
                    <button 
                      type="button"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
                    >
                      Upgrade to Pro
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AnimatePresence>
                  {success && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm"
                    >
                      <CheckCircle2 size={18} />
                      Settings saved successfully!
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 disabled:opacity-50"
              >
                <Save size={20} />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal 
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        onConfirm={confirmCloudRestore}
        loading={loading}
        title="Restore from Cloud"
        message="Are you sure you want to restore from cloud? This will overwrite your current local data. This action cannot be undone."
        confirmText="Restore Now"
      />

      <ConfirmModal 
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setPendingImportFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
        onConfirm={confirmImportBackup}
        loading={loading}
        title="Import Backup"
        message="Warning: This will overwrite your current data for this business profile. Are you sure you want to proceed?"
        confirmText="Import & Overwrite"
      />

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteAccount}
        loading={loading}
        title="Permanently Delete Account?"
        message="This action is irreversible. All your invoices, products, customers, and business settings will be permanently removed from our servers. Are you absolutely certain?"
        confirmText="Yes, Delete Everything"
        variant="danger"
      />
    </div>
  );
}
