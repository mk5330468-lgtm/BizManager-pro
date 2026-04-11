import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Database, 
  Server, 
  FileText, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { supabaseService } from '../services/supabaseService';
import { invoiceFileService } from '../services/invoiceFileService';

const StatusCard = ({ title, status, details, icon: Icon }: { title: string, status: 'success' | 'error' | 'loading' | 'warning', details?: string, icon: any }) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
    <div className="flex items-start justify-between mb-4">
      <div className={`p-3 rounded-xl ${
        status === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
        status === 'error' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
        status === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 animate-pulse'
      }`}>
        <Icon size={24} />
      </div>
      {status === 'success' ? <CheckCircle2 className="text-emerald-500" size={20} /> :
       status === 'error' ? <XCircle className="text-rose-500" size={20} /> :
       status === 'warning' ? <AlertTriangle className="text-amber-500" size={20} /> :
       <RefreshCw className="text-slate-400 animate-spin" size={20} />}
    </div>
    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{details || 'Checking status...'}</p>
  </div>
);

export default function Diagnostics() {
  const { user } = useAuth();
  const [clientStatus, setClientStatus] = useState<'success' | 'error' | 'loading'>('loading');
  const [serverStatus, setServerStatus] = useState<'success' | 'error' | 'loading'>('loading');
  const [storageStatus, setStorageStatus] = useState<'success' | 'error' | 'loading' | 'warning'>('loading');
  const [clientDetails, setClientDetails] = useState('');
  const [serverDetails, setServerDetails] = useState('');
  const [storageDetails, setStorageDetails] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [testDetails, setTestDetails] = useState('');

  const runDiagnostics = async () => {
    setClientStatus('loading');
    setServerStatus('loading');
    setStorageStatus('loading');

    // 1. Check Client-side Supabase
    try {
      const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
      if (error) throw error;
      setClientStatus('success');
      setClientDetails('Client-side connection to Supabase is active and authenticated.');
    } catch (err: any) {
      setClientStatus('error');
      setClientDetails(`Client connection failed: ${err.message}`);
    }

    // 2. Check Server-side Supabase
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      if (data.status === 'ok') {
        setServerStatus('success');
        let details = 'Server is running and connected to Supabase service role.';
        if (data.bucketStatus === 'exists') {
          details += ' Invoices bucket is confirmed by server.';
        } else if (data.bucketStatus === 'missing') {
          details += ' Invoices bucket is missing, but server will create it on next upload.';
        }
        setServerDetails(details);
      } else {
        throw new Error(data.message || 'Server health check returned non-ok status');
      }
    } catch (err: any) {
      setServerStatus('error');
      setServerDetails(`Server connection failed: ${err.message}. Check if SUPABASE_SERVICE_ROLE_KEY is set in Secrets.`);
    }

    // 3. Check Storage Bucket
    try {
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      if (bucketError) throw bucketError;
      
      const invoiceBucket = buckets.find(b => b.name === 'invoices');
      if (invoiceBucket) {
        if (invoiceBucket.public) {
          setStorageStatus('success');
          setStorageDetails('Invoices bucket exists and is public. Uploads should be accessible.');
        } else {
          setStorageStatus('warning');
          setStorageDetails('Invoices bucket exists but is NOT public. PDF links will be broken.');
        }
      } else {
        setStorageStatus('error');
        setStorageDetails('Invoices bucket does not exist. Server will attempt to create it on next upload.');
      }
    } catch (err: any) {
      setStorageStatus('error');
      setStorageDetails(`Storage check failed: ${err.message}`);
    }
  };

  const [storageFiles, setStorageFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const fetchStorageFiles = async () => {
    if (!user) return;
    setLoadingFiles(true);
    try {
      // List files in the business's folder
      const files = await supabaseService.listStorage('invoices', user.id);
      setStorageFiles(files || []);
    } catch (err) {
      console.error('Error listing storage files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const runDirectTest = async () => {
    setTestStatus('running');
    setTestDetails('Running direct backend-to-Supabase storage test...');
    try {
      const result = await supabaseService.testStorageDirect();
      setTestStatus('success');
      setTestDetails(`Direct test successful! ${result.message}`);
      runDiagnostics(); // Refresh status
    } catch (err: any) {
      setTestStatus('error');
      setTestDetails(`Direct test failed: ${err.message}`);
    }
  };

  useEffect(() => {
    runDiagnostics();
    fetchStorageFiles();
  }, [user]);

  const runUploadTest = async () => {
    if (!user) return;
    setTestStatus('running');
    setTestDetails('Generating test PDF and uploading...');

    try {
      // Create a dummy invoice for testing
      const dummyInvoice: any = {
        id: 'test-' + Date.now(),
        invoice_number: 'TEST-' + Math.floor(Math.random() * 1000),
        created_at: new Date().toISOString(),
        total_amount: 100,
        subtotal: 100,
        tax_amount: 0,
        amount_paid: 0,
        payment_status: 'pending',
        payment_mode: 'cash',
        items: [{ name: 'Test Item', quantity: 1, price: 100, total: 100 }],
        customer_name: 'Test Customer',
        business_id: user.id
      };

      const result = await invoiceFileService.generateAndUploadFiles(dummyInvoice, user.id);
      setTestStatus('success');
      setTestDetails(`Test successful! PDF generated (${result.pdfSize || 'unknown'} bytes) and uploaded to: ${result.pdfUrl}`);
    } catch (err: any) {
      setTestStatus('error');
      setTestDetails(`Test failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">System Diagnostics</h2>
          <p className="text-slate-500 dark:text-slate-400">Verify your connection and storage settings.</p>
        </div>
        <button 
          onClick={runDiagnostics}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20"
        >
          <RefreshCw size={18} className={clientStatus === 'loading' ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCard 
          title="Client Connection" 
          status={clientStatus} 
          details={clientDetails}
          icon={Database}
        />
        <StatusCard 
          title="Server Connection" 
          status={serverStatus} 
          details={serverDetails}
          icon={Server}
        />
        <StatusCard 
          title="Storage Bucket" 
          status={storageStatus} 
          details={storageDetails}
          icon={FileText}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Database size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Database Schema</h3>
            <p className="text-slate-500 dark:text-slate-400">If you see "table missing" errors, you need to run this SQL in your Supabase SQL Editor.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <pre className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-xs overflow-x-auto max-h-64 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
{`-- 1. Run this in Supabase SQL Editor
-- This creates the essential tables for the app

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  business_name TEXT NOT NULL,
  owner_name TEXT,
  email TEXT,
  phone TEXT UNIQUE,
  address TEXT,
  invoice_theme TEXT DEFAULT 'gst',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  outstanding_balance DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  purchase_price DECIMAL NOT NULL,
  selling_price DECIMAL NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  low_stock_alert INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  total_amount DECIMAL NOT NULL,
  payment_status TEXT CHECK(payment_status IN ('paid', 'unpaid', 'partial')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invoice_id BIGINT REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  payment_mode TEXT,
  payment_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  balance DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`}
            </pre>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(`-- Run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS profiles ( id UUID PRIMARY KEY, business_name TEXT NOT NULL, owner_name TEXT, email TEXT, phone TEXT UNIQUE, address TEXT, invoice_theme TEXT DEFAULT 'gst', created_at TIMESTAMPTZ DEFAULT NOW() );
CREATE TABLE IF NOT EXISTS customers ( id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, name TEXT NOT NULL, outstanding_balance DECIMAL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW() );
CREATE TABLE IF NOT EXISTS products ( id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, name TEXT NOT NULL, purchase_price DECIMAL NOT NULL, selling_price DECIMAL NOT NULL, stock_quantity INTEGER DEFAULT 0, low_stock_alert INTEGER DEFAULT 5, created_at TIMESTAMPTZ DEFAULT NOW() );
CREATE TABLE IF NOT EXISTS invoices ( id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, invoice_number TEXT NOT NULL, customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE, total_amount DECIMAL NOT NULL, payment_status TEXT CHECK(payment_status IN ('paid', 'unpaid', 'partial')), created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(business_id, invoice_number) );
CREATE TABLE IF NOT EXISTS payments ( id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, invoice_id BIGINT REFERENCES invoices(id) ON DELETE CASCADE, amount DECIMAL NOT NULL, payment_mode TEXT, payment_date TIMESTAMPTZ DEFAULT NOW() );
CREATE TABLE IF NOT EXISTS accounts ( id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, name TEXT NOT NULL, balance DECIMAL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW() );`);
                alert('SQL copied to clipboard!');
              }}
              className="absolute top-2 right-2 p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors text-xs font-bold"
            >
              Copy SQL
            </button>
          </div>
          <p className="text-xs text-slate-500">
            <b>Note:</b> For the full schema including RLS policies and triggers, refer to the <code>supabase-schema.sql</code> file in the project root.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <RefreshCw size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Upload Test</h3>
            <p className="text-slate-500 dark:text-slate-400">Trigger a manual PDF generation and upload to verify the full flow.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={runUploadTest}
              disabled={testStatus === 'running'}
              className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {testStatus === 'running' ? <RefreshCw size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
              {testStatus === 'running' ? 'Running Test...' : 'Run Full Flow Test'}
            </button>

            <button 
              onClick={runDirectTest}
              disabled={testStatus === 'running'}
              className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {testStatus === 'running' ? <RefreshCw size={20} className="animate-spin" /> : <Server size={20} />}
              Backend Direct Test
            </button>
          </div>

          {testStatus !== 'idle' && (
            <div className={`p-4 rounded-2xl border ${
              testStatus === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/10 dark:border-emerald-900/20 dark:text-emerald-400' :
              testStatus === 'error' ? 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-900/10 dark:border-rose-900/20 dark:text-rose-400' :
              'bg-slate-50 border-slate-100 text-slate-700 dark:bg-slate-800/50 dark:border-slate-800 dark:text-slate-300'
            }`}>
              <div className="flex items-start gap-3">
                {testStatus === 'success' ? <CheckCircle2 size={20} className="mt-0.5" /> :
                 testStatus === 'error' ? <XCircle size={20} className="mt-0.5" /> :
                 <RefreshCw size={20} className="mt-0.5 animate-spin" />}
                <div className="flex-1 min-w-0">
                  <p className="font-bold mb-1">{testStatus === 'success' ? 'Test Passed' : testStatus === 'error' ? 'Test Failed' : 'Running...'}</p>
                  <p className="text-sm break-all">{testDetails}</p>
                  {testStatus === 'success' && testDetails.includes('http') && (
                    <a 
                      href={testDetails.split(': ')[1]} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      View Generated PDF <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Storage Explorer</h3>
              <p className="text-slate-500 dark:text-slate-400">Files currently stored in your business folder.</p>
            </div>
          </div>
          <button 
            onClick={fetchStorageFiles}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <RefreshCw size={20} className={loadingFiles ? 'animate-spin' : ''} />
          </button>
        </div>

        {loadingFiles ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="animate-spin text-slate-400" size={32} />
          </div>
        ) : storageFiles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {storageFiles.map((file, idx) => (
              <div key={idx} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                  <FileText size={20} className="text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.metadata?.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
            <FileText className="mx-auto text-slate-300 mb-3" size={48} />
            <p className="text-slate-500">No files found in your storage folder.</p>
          </div>
        )}
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-6 rounded-2xl">
        <div className="flex gap-4">
          <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0" size={24} />
          <div>
            <h4 className="font-bold text-amber-900 dark:text-amber-300 mb-1">Troubleshooting Tips</h4>
            <ul className="text-sm text-amber-800 dark:text-amber-400 space-y-2 list-disc ml-4">
              <li>Ensure <b>SUPABASE_SERVICE_ROLE_KEY</b> is added to your project secrets.</li>
              <li>Verify that the <b>invoices</b> bucket exists in your Supabase Storage and is set to <b>Public</b>.</li>
              <li>If PDFs are blank, try increasing the rendering delay in <code>src/lib/pdf.ts</code>.</li>
              <li>Check the browser console (if possible) for <code>html2canvas</code> errors.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
