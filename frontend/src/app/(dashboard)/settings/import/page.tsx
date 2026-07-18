'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import PageHeader from '@/components/PageHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const IMPORT_TYPES = [
  { value: 'CLIENT', label: 'Clients / Prospects' },
  { value: 'ITEM', label: 'Item Master' },
  { value: 'QUOTATION', label: 'Quotations & Estimates' },
  { value: 'PROFORMA_INVOICE', label: 'Proforma Invoices' },
  { value: 'INVOICE', label: 'Invoices' },
  { value: 'PAYMENT_RECEIPT', label: 'Payment Receipts' },
  { value: 'SALES_ORDER', label: 'Sales Orders' },
  { value: 'DELIVERY_CHALLAN', label: 'Delivery Challans' },
  { value: 'CREDIT_NOTE', label: 'Credit Notes' }
];

const FIELDS_BY_TYPE: Record<string, { key: string; label: string; required?: boolean }[]> = {
  CLIENT: [
    { key: 'clientName', label: 'Client Name', required: true },
    { key: 'companyName', label: 'Company / Business Name' },
    { key: 'email', label: 'Email Address' },
    { key: 'phone', label: 'Phone Number' },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'addressLine1', label: 'Billing Address' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'pincode', label: 'Pincode' },
    { key: 'country', label: 'Country' }
  ],
  ITEM: [
    { key: 'itemName', label: 'Item Name', required: true },
    { key: 'sku', label: 'SKU' },
    { key: 'description', label: 'Description' },
    { key: 'hsnSac', label: 'HSN / SAC Code' },
    { key: 'gstRate', label: 'GST Rate (%)' },
    { key: 'rate', label: 'Selling Price (Rate)', required: true },
    { key: 'category', label: 'Category' }
  ],
  PAYMENT_RECEIPT: [
    { key: 'documentNumber', label: 'Receipt Number', required: true },
    { key: 'clientName', label: 'Client Name', required: true },
    { key: 'issueDate', label: 'Payment Date', required: true },
    { key: 'grandTotal', label: 'Payment Amount', required: true },
    { key: 'paymentMethod', label: 'Payment Method (CASH, UPI, etc.)' },
    { key: 'referenceNumber', label: 'Linked Invoice Number' },
    { key: 'notes', label: 'Notes' }
  ],
  CREDIT_NOTE: [
    { key: 'documentNumber', label: 'Credit Note Number', required: true },
    { key: 'clientName', label: 'Client Name', required: true },
    { key: 'issueDate', label: 'Credit Note Date', required: true },
    { key: 'linkedInvoiceNumber', label: 'Linked Invoice Number' },
    { key: 'reason', label: 'Reason (Product Return, etc.)' },
    { key: 'itemName', label: 'Item Name / Description', required: true },
    { key: 'description', label: 'Item Long Details' },
    { key: 'hsnSac', label: 'HSN / SAC Code' },
    { key: 'gstRate', label: 'GST Rate (%)' },
    { key: 'quantity', label: 'Quantity', required: true },
    { key: 'rate', label: 'Unit Rate / Price', required: true },
    { key: 'grandTotal', label: 'Credit Amount' }
  ],
  DOCUMENT: [
    { key: 'documentNumber', label: 'Document Number', required: true },
    { key: 'clientName', label: 'Client Name', required: true },
    { key: 'issueDate', label: 'Issue Date', required: true },
    { key: 'validTill', label: 'Due Date / Valid Till' },
    { key: 'poNumber', label: 'PO Reference Number' },
    { key: 'itemName', label: 'Item Name / Description', required: true },
    { key: 'description', label: 'Item Long Details' },
    { key: 'hsnSac', label: 'HSN / SAC Code' },
    { key: 'gstRate', label: 'GST Rate (%)' },
    { key: 'quantity', label: 'Quantity', required: true },
    { key: 'rate', label: 'Unit Rate / Price', required: true },
    { key: 'grandTotal', label: 'Document Grand Total' }
  ]
};

export default function DataImportPage() {
  const { showToast } = useToast();
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState(1);
  const [importType, setImportType] = useState('AUTO-DETECT');
  const [file, setFile] = useState<File | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Upload/Preview states
  const [uploadData, setUploadData] = useState<any | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Column Mapping states
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Validation states
  const [validationResults, setValidationResults] = useState<any | null>(null);
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [clientResolutions, setClientResolutions] = useState<Record<string, string>>({});
  const [autoCreateClients, setAutoCreateClients] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Confirmation/Execution states
  const [duplicatePolicy, setDuplicatePolicy] = useState('SKIP');
  const [calculatePolicy, setCalculatePolicy] = useState('SYSTEM');
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/imports/history');
      if (res.data?.success) {
        setHistory(res.data.data);
      }
    } catch (err) {
      showToast('Failed to load import history.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
        showToast('Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file.', 'error');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      showToast('Please select a file first.', 'error');
      return;
    }

    setLoadingPreview(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (sheetName) {
        formData.append('sheetName', sheetName);
      }

      const res = await api.post('/imports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        const data = res.data.data;
        setUploadData(data);
        setSheetName(data.currentSheet);
        
        // Auto-detect importType if AUTO-DETECT is chosen
        let detectedType = importType;
        if (importType === 'AUTO-DETECT') {
          // Infer type from headers
          const headersStr = data.headers.map((h: string) => h.toLowerCase()).join(' ');
          if (headersStr.includes('receipt') || headersStr.includes('payment method')) {
            detectedType = 'PAYMENT_RECEIPT';
          } else if (headersStr.includes('credit note') || headersStr.includes('credit amount')) {
            detectedType = 'CREDIT_NOTE';
          } else if (headersStr.includes('quotation') || headersStr.includes('estimate')) {
            detectedType = 'QUOTATION';
          } else if (headersStr.includes('proforma')) {
            detectedType = 'PROFORMA_INVOICE';
          } else if (headersStr.includes('sales order') || headersStr.includes('order number')) {
            detectedType = 'SALES_ORDER';
          } else if (headersStr.includes('delivery challan') || headersStr.includes('challan no')) {
            detectedType = 'DELIVERY_CHALLAN';
          } else if (headersStr.includes('client name') || headersStr.includes('gstin') || headersStr.includes('email')) {
            if (headersStr.includes('invoice') || headersStr.includes('bill no')) {
              detectedType = 'INVOICE';
            } else {
              detectedType = 'CLIENT';
            }
          } else if (headersStr.includes('sku') || headersStr.includes('item name') || headersStr.includes('selling price')) {
            detectedType = 'ITEM';
          } else {
            detectedType = 'INVOICE'; // fallback default
          }
          setImportType(detectedType);
          showToast(`Likely type auto-detected as: ${detectedType}`, 'success');
        }

        // Initialize column mappings from auto-detected ones
        const initialMapping: Record<string, string> = {};
        const fields = FIELDS_BY_TYPE[detectedType] || FIELDS_BY_TYPE.DOCUMENT;
        fields.forEach(f => {
          if (data.autoMapping && data.autoMapping[f.key]) {
            initialMapping[f.key] = data.autoMapping[f.key];
          } else {
            initialMapping[f.key] = '';
          }
        });
        setColumnMapping(initialMapping);
        setStep(3);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to upload/parse file.', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleValidate = async () => {
    setLoadingValidation(true);
    try {
      const res = await api.post('/imports/validate', {
        importType,
        rows: uploadData.fullRows,
        columnMapping,
        clientResolutions
      });
      if (res.data?.success) {
        setValidationResults(res.data.data);
        setStep(5);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Validation failed.', 'error');
    } finally {
      setLoadingValidation(false);
    }
  };

  const handleConfirmImport = async () => {
    setImporting(true);
    try {
      const res = await api.post('/imports/confirm', {
        importType,
        rows: uploadData.fullRows,
        columnMapping,
        duplicatePolicy,
        calculatePolicy,
        clientResolutions,
        autoCreateClients
      });
      if (res.data?.success) {
        setImportSummary(res.data.data);
        setStep(8);
        fetchHistory();
        router.refresh();
        showToast('Historical data imported successfully!', 'success');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Import execution failed.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = (type: string) => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/imports/template/${type}?token=${localStorage.getItem('techbes_token')}`, '_blank');
  };

  const resetWizard = () => {
    setStep(1);
    setFile(null);
    setUploadData(null);
    setColumnMapping({});
    setValidationResults(null);
    setClientResolutions({});
    setImportSummary(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <PageHeader
        title="Historical Data Migration & Import"
        subtitle="Securely upload Excel or CSV exports to restore clients, invoices, and payments."
        actions={
          step > 1 && (
            <button
              onClick={resetWizard}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm"
            >
              Reset / Start New
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar steps */}
        <div className="card-panel p-5 rounded-xl bg-white space-y-4 h-fit border border-slate-100 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Import Steps</h3>
          <div className="space-y-3">
            {[
              'Select Record Type',
              'Upload Excel / CSV',
              'Preview File Sheets',
              'Map Columns',
              'Validate Data Integrity',
              'Review Matches / Conflicts',
              'Import Configuration',
              'Completion Summary'
            ].map((name, i) => {
              const num = i + 1;
              let status = 'text-slate-400';
              if (step === num) {
                status = 'text-blue-600 font-semibold bg-blue-50/50 rounded-lg p-2 -mx-2';
              } else if (step > num) {
                status = 'text-slate-800 font-medium';
              }
              return (
                <div key={name} className={`flex items-center gap-3 text-xs ${status}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center border font-mono ${
                    step === num ? 'border-blue-600 bg-blue-600 text-white' : step > num ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-400'
                  }`}>
                    {step > num ? '✓' : num}
                  </span>
                  <span>{name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Body */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* STEP 1: SELECT IMPORT RECORD TYPE */}
          {step === 1 && (
            <div className="card-panel p-6 rounded-xl bg-white space-y-6 border border-slate-100 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-800">Step 1: Select Import Record Type</h2>
                <p className="text-xs text-slate-500">Choose what kind of records are contained in your Excel or CSV spreadsheet file.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`p-4 rounded-xl border-2 flex flex-col justify-between cursor-pointer transition-all duration-150 ${
                  importType === 'AUTO-DETECT' ? 'border-blue-600 bg-blue-50/20' : 'border-slate-100 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="importType"
                    value="AUTO-DETECT"
                    checked={importType === 'AUTO-DETECT'}
                    onChange={() => setImportType('AUTO-DETECT')}
                    className="sr-only"
                  />
                  <span className="text-xs font-bold text-slate-800">Auto-Detect Record Type</span>
                  <span className="text-[11px] text-slate-400 mt-2">Automatically inspects header labels in the file sheet to decide.</span>
                </label>

                {IMPORT_TYPES.map(t => (
                  <label key={t.value} className={`p-4 rounded-xl border-2 flex flex-col justify-between cursor-pointer transition-all duration-150 ${
                    importType === t.value ? 'border-blue-600 bg-blue-50/20' : 'border-slate-100 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="importType"
                      value={t.value}
                      checked={importType === t.value}
                      onChange={() => setImportType(t.value)}
                      className="sr-only"
                    />
                    <span className="text-xs font-bold text-slate-800">{t.label}</span>
                    <span className="text-[11px] text-slate-400 mt-2">Import template file structure manually.</span>
                  </label>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <div className="space-y-1">
                  <span className="block text-xs font-bold text-slate-700">Need template spreadsheets?</span>
                  <p className="text-[10px] text-slate-400">Download predefined formats structure for reference.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleDownloadTemplate('CLIENT')}
                    className="px-2.5 py-1.5 border border-slate-200 hover:border-slate-400 rounded-lg text-[10px] font-semibold text-slate-600 bg-white"
                  >
                    Clients Template
                  </button>
                  <button
                    onClick={() => handleDownloadTemplate('ITEM')}
                    className="px-2.5 py-1.5 border border-slate-200 hover:border-slate-400 rounded-lg text-[10px] font-semibold text-slate-600 bg-white"
                  >
                    Items Template
                  </button>
                  <button
                    onClick={() => handleDownloadTemplate('INVOICE')}
                    className="px-2.5 py-1.5 border border-slate-200 hover:border-slate-400 rounded-lg text-[10px] font-semibold text-slate-600 bg-white"
                  >
                    Invoices Template
                  </button>
                  <button
                    onClick={() => handleDownloadTemplate('PAYMENT_RECEIPT')}
                    className="px-2.5 py-1.5 border border-slate-200 hover:border-slate-400 rounded-lg text-[10px] font-semibold text-slate-600 bg-white"
                  >
                    Payments Template
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
                >
                  Continue to Upload
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: UPLOAD FILE */}
          {step === 2 && (
            <div className="card-panel p-6 rounded-xl bg-white space-y-6 border border-slate-100 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-800">Step 2: Upload Excel / CSV file</h2>
                <p className="text-xs text-slate-500">Please choose a file containing your billing history data (.xlsx, .xls, .csv).</p>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-4 hover:border-blue-400 transition-colors">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center shadow-inner">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-700">Select file to parse</span>
                  <p className="text-[10px] text-slate-400 mt-1">Excel (.xlsx, .xls) or CSV up to 10MB.</p>
                </div>
                <div>
                  <label className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 cursor-pointer shadow-sm">
                    Choose File
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
                {file && (
                  <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
                    <span className="text-xs font-semibold text-blue-700 font-mono">{file.name}</span>
                    <span className="text-[9px] text-blue-400 font-mono">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-655 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || loadingPreview}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {loadingPreview ? 'Uploading & Parsing...' : 'Parse and Preview'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW FILE */}
          {step === 3 && uploadData && (
            <div className="card-panel p-6 rounded-xl bg-white space-y-6 border border-slate-100 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-slate-800">Step 3: Preview File Sheets</h2>
                  <p className="text-xs text-slate-500 font-mono">File: {uploadData.originalFileName} | Rows: {uploadData.totalRows}</p>
                </div>

                {uploadData.sheetNames && uploadData.sheetNames.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-650 font-semibold">Sheet:</label>
                    <select
                      value={sheetName}
                      onChange={(e) => {
                        setSheetName(e.target.value);
                        setTimeout(() => handleUpload(), 100);
                      }}
                      className="form-input text-xs py-1.5 pr-8 bg-white"
                    >
                      {uploadData.sheetNames.map((s: string) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <span className="block text-xs font-bold text-slate-700">Previewing First 20 Rows</span>
                <div className="overflow-x-auto border border-slate-100 rounded-xl shadow-inner max-h-[300px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-mono text-[10px] border-b border-slate-100">
                        {uploadData.headers.map((h: string) => (
                          <th key={h} className="p-3 font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uploadData.previewRows.map((row: any, i: number) => (
                        <tr key={i} className="border-b border-slate-100 text-[11px] hover:bg-slate-50/50">
                          {uploadData.headers.map((h: string) => (
                            <td key={h} className="p-3 text-slate-700 max-w-[200px] truncate">{row[h] !== undefined ? String(row[h]) : ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-650 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
                >
                  Map Headers
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: COLUMN MAPPING */}
          {step === 4 && uploadData && (
            <div className="card-panel p-6 rounded-xl bg-white space-y-6 border border-slate-100 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-800">Step 4: Map Excel Headers to TechBes Fields</h2>
                <p className="text-xs text-slate-500">Ensure the correct sheet column matches the correct database model fields below.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
                {(FIELDS_BY_TYPE[importType] || FIELDS_BY_TYPE.DOCUMENT).map(f => (
                  <div key={f.key} className="p-4 border border-slate-100 rounded-xl bg-slate-50/30 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-700">
                        {f.label} {f.required && <span className="text-rose-500">*</span>}
                      </span>
                      <span className="block text-[10px] font-mono text-slate-400">Database: {f.key}</span>
                    </div>

                    <select
                      value={columnMapping[f.key] || ''}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="form-input text-xs w-48 bg-white pr-8 text-slate-700"
                    >
                      <option value="">-- Ignored / Not Mapped --</option>
                      {uploadData.headers.map((h: string) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setStep(3)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-655 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleValidate}
                  disabled={loadingValidation}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-2 shadow-sm"
                >
                  {loadingValidation ? 'Validating...' : 'Validate Import File'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5 & 6: VALIDATION & ERROR REVIEW */}
          {step === 5 && validationResults && (
            <div className="card-panel p-6 rounded-xl bg-white space-y-6 border border-slate-100 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-800">Step 5 & 6: Validation Results & Review</h2>
                <p className="text-xs text-slate-500">Check warnings and match conflicts before finalizing database writes.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div onClick={() => setStatusFilter('ALL')} className={`p-4 rounded-xl border text-center cursor-pointer transition-all ${statusFilter === 'ALL' ? 'border-slate-800 bg-slate-50/50' : 'border-slate-100'}`}>
                  <span className="block text-xl font-bold text-slate-800">{validationResults.valid.length + validationResults.warnings.length + validationResults.errors.length + validationResults.duplicates.length}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Rows</span>
                </div>
                <div onClick={() => setStatusFilter('VALID')} className={`p-4 rounded-xl border text-center cursor-pointer transition-all ${statusFilter === 'VALID' ? 'border-emerald-600 bg-emerald-50/20' : 'border-slate-100'}`}>
                  <span className="block text-xl font-bold text-emerald-600">{validationResults.valid.length}</span>
                  <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Valid</span>
                </div>
                <div onClick={() => setStatusFilter('WARNING')} className={`p-4 rounded-xl border text-center cursor-pointer transition-all ${statusFilter === 'WARNING' ? 'border-amber-600 bg-amber-50/20' : 'border-slate-100'}`}>
                  <span className="block text-xl font-bold text-amber-600">{validationResults.warnings.length}</span>
                  <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Warnings</span>
                </div>
                <div onClick={() => setStatusFilter('ERROR')} className={`p-4 rounded-xl border text-center cursor-pointer transition-all ${statusFilter === 'ERROR' ? 'border-rose-600 bg-rose-50/20' : 'border-slate-100'}`}>
                  <span className="block text-xl font-bold text-rose-600">{validationResults.errors.length}</span>
                  <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Errors / Conflicts</span>
                </div>
              </div>

              {validationResults.errors.some((e: any) => e.status === 'CLIENT_MATCH_CONFLICT') && (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-amber-800">Resolve Client Match Conflicts</h4>
                  <p className="text-[11px] text-amber-700">Some documents reference clients not found in your system, or have multiple matches.</p>
                  
                  <div className="flex items-center gap-3 py-1">
                    <input
                      type="checkbox"
                      id="autoCreateBox"
                      checked={autoCreateClients}
                      onChange={(e) => setAutoCreateClients(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <label htmlFor="autoCreateBox" className="text-xs font-semibold text-slate-700 cursor-pointer">
                      Create New Clients Automatically (Default)
                    </label>
                  </div>

                  <div className="space-y-2.5 max-h-[200px] overflow-y-auto pt-2 border-t border-amber-100">
                    {validationResults.errors.filter((e: any) => e.status === 'CLIENT_MATCH_CONFLICT').map((e: any) => (
                      <div key={e.documentNumber || e.rowNumber} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs p-2 bg-white/60 rounded-lg">
                        <span className="font-semibold text-slate-700 font-mono">
                          Doc: {e.documentNumber || `Row ${e.rowNumber}`} | Client name: {e.clientName || e.data?.clientName}
                        </span>

                        {e.matchedClients && e.matchedClients.length > 0 ? (
                          <select
                            value={clientResolutions[e.documentNumber || e.rowNumber] || ''}
                            onChange={(eVal) => setClientResolutions(prev => ({ ...prev, [e.documentNumber || e.rowNumber]: eVal.target.value }))}
                            className="form-input py-1 text-[11px] pr-8 bg-white border-amber-300 w-52"
                          >
                            <option value="">-- Match conflict resolution --</option>
                            {e.matchedClients.map((c: any) => (
                              <option key={c._id} value={c._id}>
                                Link: {c.clientName} ({c.gstin || 'No GSTIN'})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500 uppercase">Will auto-create client</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <span className="block text-xs font-bold text-slate-700">Detailed Validation Messages</span>
                <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-[300px] text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-mono text-[10px] border-b border-slate-100">
                        <th className="p-3 font-semibold">Row</th>
                        <th className="p-3 font-semibold">Document / Client</th>
                        <th className="p-3 font-semibold">Status Code</th>
                        <th className="p-3 font-semibold">Details / Messages</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...validationResults.errors.map((e: any) => ({ ...e, type: 'ERROR' })),
                        ...validationResults.duplicates.map((e: any) => ({ ...e, type: 'DUPLICATE' })),
                        ...validationResults.warnings.map((e: any) => ({ ...e, type: 'WARNING' })),
                        ...validationResults.valid.map((e: any) => ({ ...e, type: 'VALID' }))
                      ]
                        .filter(r => {
                          if (statusFilter === 'ALL') return true;
                          return r.type === statusFilter;
                        })
                        .map((r, i) => {
                          let labelClass = 'text-emerald-700 bg-emerald-50 border-emerald-100';
                          if (r.type === 'WARNING') labelClass = 'text-amber-700 bg-amber-50 border-amber-100';
                          if (r.type === 'ERROR') labelClass = 'text-rose-700 bg-rose-50 border-rose-100';
                          if (r.type === 'DUPLICATE') labelClass = 'text-slate-700 bg-slate-50 border-slate-100';

                          return (
                            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="p-3 font-mono text-slate-500 font-semibold">{r.rowNumber}</td>
                              <td className="p-3 font-semibold text-slate-700 truncate max-w-[200px]">
                                {r.documentNumber || r.data?.clientName || r.clientName || 'N/A'}
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 border rounded-md text-[10px] font-bold ${labelClass}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="p-3 text-slate-650">{r.message || 'Row matches requirements.'}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setStep(4)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-650 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(7)}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
                >
                  Configure and Finalize
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: IMPORT CONFIGURATION */}
          {step === 7 && validationResults && (
            <div className="card-panel p-6 rounded-xl bg-white space-y-6 border border-slate-100 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-800">Step 7: Finalize Import Policies</h2>
                <p className="text-xs text-slate-500">Configure duplicate handling and calculation checking rules before final import writes.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Duplicate Policy */}
                <div className="card-panel p-5 rounded-xl border border-slate-100 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Duplicate Handling Strategy</h3>
                  <p className="text-[11px] text-slate-400">Specify how we resolve document or client numbers matching existing records.</p>
                  
                  <div className="space-y-2 pt-2">
                    <label className="flex items-center gap-3 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="dupPolicy"
                        value="SKIP"
                        checked={duplicatePolicy === 'SKIP'}
                        onChange={() => setDuplicatePolicy('SKIP')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Skip Existing Duplicates (Recommended - Default)</span>
                    </label>

                    <label className="flex items-center gap-3 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="dupPolicy"
                        value="OVERWRITE"
                        checked={duplicatePolicy === 'OVERWRITE'}
                        onChange={() => setDuplicatePolicy('OVERWRITE')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Overwrite / Replace Existing records</span>
                    </label>
                  </div>
                </div>

                {/* Calculation Verification Policy */}
                <div className="card-panel p-5 rounded-xl border border-slate-100 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Calculation mismatch Policy</h3>
                  <p className="text-[11px] text-slate-400">Specify what total values to preserve if the sheet totals conflict with the billing engine.</p>
                  
                  <div className="space-y-2 pt-2">
                    <label className="flex items-center gap-3 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="calcPolicy"
                        value="SYSTEM"
                        checked={calculatePolicy === 'SYSTEM'}
                        onChange={() => setCalculatePolicy('SYSTEM')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Use System Calculated Totals (Recommended)</span>
                    </label>

                    <label className="flex items-center gap-3 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="calcPolicy"
                        value="EXCEL"
                        checked={calculatePolicy === 'EXCEL'}
                        onChange={() => setCalculatePolicy('EXCEL')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Use Sheet Specified Grand Totals</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
                <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div className="space-y-0.5 text-xs text-emerald-800">
                  <span className="font-bold">Migration Integrity Checks Enabled</span>
                  <p className="text-[11px] text-emerald-700">All imported records are permanently verified and scoped using business authentication. Active sequence counters will advance automatically.</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setStep(5)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-650 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={importing}
                  className="px-6 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-2 shadow-sm shadow-blue-200"
                >
                  {importing ? 'Executing Database Import...' : 'Import to Database'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 8: IMPORT SUMMARY */}
          {step === 8 && importSummary && (
            <div className="card-panel p-6 rounded-xl bg-white space-y-6 border border-slate-100 shadow-sm">
              <div className="text-center space-y-3 py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Historical Import Execution Completed</h2>
                  <p className="text-xs text-slate-500">Your historical data has been successfully mapped, verified, and written to MongoDB.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 text-center">
                  <span className="block text-lg font-bold text-slate-800">{importSummary.imported}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Created Records</span>
                </div>
                <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 text-center">
                  <span className="block text-lg font-bold text-slate-800">{importSummary.duplicates}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Duplicates Skipped</span>
                </div>
                <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 text-center">
                  <span className="block text-lg font-bold text-slate-800">{importSummary.skipped}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Skipped Rows</span>
                </div>
                <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 text-center">
                  <span className="block text-lg font-bold text-slate-800">{importSummary.errors}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Errors Omitted</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-6 border-t border-slate-100">
                <button
                  onClick={resetWizard}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-750 hover:bg-slate-50"
                >
                  Start New Import
                </button>
                <Link
                  href={
                    importType === 'ITEM' ? '/inventory' :
                    importType === 'CLIENT' ? '/clients' :
                    importType === 'PROFORMA_INVOICE' ? '/proforma-invoices' :
                    importType === 'DELIVERY_CHALLAN' ? '/delivery-challans' :
                    importType === 'CREDIT_NOTE' ? '/credit-notes' :
                    importType === 'PAYMENT_RECEIPT' ? '/payment-receipts' :
                    importType === 'QUOTATION' ? '/quotations' :
                    importType === 'SALES_ORDER' ? '/sales-orders' :
                    '/invoices'
                  }
                  className="px-6 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
                >
                  View Imported Records
                </Link>
              </div>
            </div>
          )}

          {/* IMPORT HISTORY LOG CARD */}
          {step === 1 && (
            <div className="card-panel p-6 rounded-xl bg-white space-y-4 border border-slate-100 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Historical Import Log</h3>
              
              {loadingHistory ? (
                <div className="flex justify-center p-8">
                  <LoadingSpinner size="sm" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No historical import jobs have been run yet.</p>
              ) : (
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-mono text-[9px] border-b border-slate-100">
                        <th className="p-3 font-semibold">Date</th>
                        <th className="p-3 font-semibold">FileName</th>
                        <th className="p-3 font-semibold">Type</th>
                        <th className="p-3 font-semibold">Total Rows</th>
                        <th className="p-3 font-semibold">Imported</th>
                        <th className="p-3 font-semibold">Duplicates</th>
                        <th className="p-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="p-3 text-slate-500 font-mono">{new Date(h.createdAt).toLocaleDateString()}</td>
                          <td className="p-3 font-semibold text-slate-700">{h.originalFileName}</td>
                          <td className="p-3 font-semibold text-slate-700">{h.importType}</td>
                          <td className="p-3 font-mono">{h.totalRows}</td>
                          <td className="p-3 font-mono text-emerald-700 font-semibold">{h.importedRecords}</td>
                          <td className="p-3 font-mono text-amber-700 font-semibold">{h.duplicateRecords}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                              h.status === 'COMPLETED' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-amber-700 bg-amber-50 border-amber-100'
                            }`}>
                              {h.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
