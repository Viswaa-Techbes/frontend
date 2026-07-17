'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/PageHeader';

interface InvoiceDetailsProps {
  params: {
    id: string;
  };
}

export default function InvoiceDetailsPage({ params }: InvoiceDetailsProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const docId = params.id;
  const printRef = useRef<HTMLDivElement>(null);

  const formatImageSrc = (src: string) => {
    if (!src) return '';
    if (src.startsWith('data:image/') || src.startsWith('http://') || src.startsWith('https://')) {
      return src;
    }
    return `data:image/png;base64,${src}`;
  };

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Core Document Data
  const [document, setDocument] = useState<any>(null);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  
  // Settings panels accordions expanded states
  const [expandedSection, setExpandedSection] = useState<string | null>('advanced');

  // Actions Modals States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: 'Bank Transfer',
    referenceNumber: '',
    notes: '',
  });

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareForm, setShareForm] = useState({
    recipientEmail: '',
    cc: '',
    subject: '',
    message: '',
  });

  // Local customizations overrides that sync to db
  const [localSettings, setLocalSettings] = useState<any>({
    design: {
      templateId: 'Professional',
      primaryColor: '#2563eb',
      fontFamily: 'Inter',
      fontScale: 'Medium',
      headerAlignment: 'Left',
      logoPosition: 'Left',
      tableStyle: 'Standard',
      borderStyle: 'Horizontal',
    },
    advanced: {
      hsnColumnView: 'HSN/SAC',
      unitDisplay: 'Separate column',
      taxSummaryDisplay: 'Summary',
      hidePlaceOfSupply: false,
      showHSNSummary: false,
      showOriginalItemImages: false,
      showThumbnailColumn: false,
      showFullWidthDescription: false,
      hideGroupSubtotal: false,
      showSKU: false,
      showSerialNumbers: false,
      showBatchDetails: false,
    },
  });

  const loadData = async () => {
    try {
      const response = await api.get(`/documents/${docId}`);
      if (response.data?.success && response.data.data) {
        const doc = response.data.data;
        setDocument(doc);
        
        // Extract settings
        if (doc.settings) {
          setLocalSettings({
            design: { ...(localSettings.design), ...(doc.settings.design || {}) },
            advanced: { ...(localSettings.advanced), ...(doc.settings.advanced || {}) },
          });
        }

        // CC share subject
        setShareForm((prev) => ({
          ...prev,
          subject: `Tax Invoice ${doc.documentNumber} from ${doc.businessSnapshot?.businessName || ''}`,
          message: `Dear Client,\n\nPlease find attached Tax Invoice ${doc.documentNumber} for your review. Let us know if you have any questions.\n\nBest Regards,\n${doc.businessSnapshot?.businessName || ''}`,
        }));
      }

      const bizRes = await api.get('/business');
      if (bizRes.data?.success) {
        setBusinessProfile(bizRes.data.data.business);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to load details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [docId]);

  // Debounced/Triggered autosave settings helper
  const handleSaveSettings = async (updatedSettings: any) => {
    setSavingSettings(true);
    try {
      const res = await api.put(`/documents/${docId}/settings`, updatedSettings);
      if (res.data?.success) {
        // Refresh document from response
        setDocument(res.data.data);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to autosave settings.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateAdvancedSetting = (key: string, value: any) => {
    const updated = {
      ...localSettings,
      advanced: {
        ...localSettings.advanced,
        [key]: value,
      },
    };
    setLocalSettings(updated);
    handleSaveSettings(updated);
  };

  const handleUpdateDesignSetting = (key: string, value: any) => {
    const updated = {
      ...localSettings,
      design: {
        ...localSettings.design,
        [key]: value,
      },
    };
    setLocalSettings(updated);
    handleSaveSettings(updated);
  };

  // Status transitions
  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await api.patch(`/documents/${docId}/status`, { status: newStatus });
      if (res.data?.success) {
        showToast(`Document status marked as ${newStatus}!`, 'success');
        setDocument(res.data.data);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to change status.', 'error');
    }
  };

  // Compliance API triggers
  const handleGenerateEInvoice = async () => {
    try {
      showToast('Contacting GST IRP server...', 'info');
      await api.post(`/documents/${docId}/e-invoice`);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'E-Invoice generation failed.', 'error');
    }
  };

  const handleGenerateEWayBill = async () => {
    try {
      showToast('Initiating E-Way Bill generation...', 'info');
      await api.post(`/documents/${docId}/e-way-bill`);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'E-Way Bill generation failed.', 'error');
    }
  };

  // Delete draft
  const handleDeleteDocument = async () => {
    if (!window.confirm(`Are you sure you want to delete draft invoice ${document.documentNumber}?`)) return;
    try {
      const res = await api.delete(`/documents/${docId}`);
      if (res.data?.success) {
        showToast('Draft deleted successfully.', 'success');
        router.push('/invoices');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete document.', 'error');
    }
  };

  // Duplicate document
  const handleDuplicateDocument = async () => {
    try {
      const res = await api.post(`/documents/${docId}/duplicate`);
      if (res.data?.success) {
        showToast('Invoice duplicated successfully.', 'success');
        router.push(`/invoices/${res.data.data._id}`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to duplicate document.', 'error');
    }
  };

  // Record Payment Submit
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      showToast('Amount must be greater than 0.', 'error');
      return;
    }

    try {
      const res = await api.post(`/documents/${docId}/payments`, {
        amount: parseFloat(paymentForm.amount),
        paymentDate: paymentForm.paymentDate,
        paymentMode: paymentForm.paymentMode,
        referenceNumber: paymentForm.referenceNumber,
        notes: paymentForm.notes,
      });

      if (res.data?.success) {
        showToast('Payment recorded successfully!', 'success');
        setDocument(res.data.data);
        setIsPaymentModalOpen(false);
        setPaymentForm({
          amount: '',
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMode: 'Bank Transfer',
          referenceNumber: '',
          notes: '',
        });
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to record payment.', 'error');
    }
  };

  // Print helper
  const handlePrint = () => {
    window.print();
  };

  // Share helper
  const handleShare = (channel: 'email' | 'whatsapp') => {
    if (channel === 'email') {
      showToast(`Email invoice sent to client: ${document?.clientSnapshot?.email || 'N/A'}`, 'success');
      setIsShareModalOpen(false);
    } else {
      const phone = document?.clientSnapshot?.phone || '';
      const text = encodeURIComponent(`Hi ${document?.clientSnapshot?.clientName || ''}, please review Tax Invoice ${document?.documentNumber} for amount ₹${document?.grandTotal?.toLocaleString('en-IN')}`);
      window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${text}`, '_blank');
      showToast('WhatsApp share window opened.', 'success');
    }
  };

  // Helper: check profile completion fields remaining
  const getMissingFieldsCount = () => {
    if (!businessProfile) return 0;
    let count = 0;
    if (!businessProfile.businessName) count++;
    if (!businessProfile.email) count++;
    if (!businessProfile.phone) count++;
    if (!businessProfile.gstin) count++;
    if (!businessProfile.pan) count++;
    if (!businessProfile.address?.stateCode) count++;
    return count;
  };

  if (loading) {
    return (
      <div className="card-panel p-16 rounded-xl flex items-center justify-center min-h-[400px] bg-white">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!document) return null;

  const showPlaceOfSupply = !localSettings.advanced.hidePlaceOfSupply;
  const taxSummaryView = localSettings.advanced.taxSummaryDisplay; // 'Do not show' | 'Summary' | 'Detailed'

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
      ISSUED: 'bg-blue-50 text-blue-700 border-blue-100',
      SENT: 'bg-blue-50 text-blue-700 border-blue-100',
      VIEWED: 'bg-purple-50 text-purple-700 border-purple-100',
      ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      REJECTED: 'bg-rose-50 text-rose-700 border-rose-100',
      EXPIRED: 'bg-amber-50 text-amber-705 border-amber-100',
      CONVERTED: 'bg-slate-100 text-slate-600 border-slate-200 line-through',
      OVERDUE: 'bg-rose-100 text-rose-800 border-rose-200 font-bold',
      CANCELLED: 'bg-slate-200 text-slate-500 border-slate-350',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles[status] || 'bg-slate-100'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6 text-slate-800 pb-16">
      {/* Breadcrumb / Top menu bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">
            SALES & INVOICES / <Link href="/invoices" className="hover:underline">INVOICES</Link> / {document.documentNumber}
          </span>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-xl font-bold text-slate-900">{document.documentNumber}</h1>
            {getStatusBadge(document.status)}
            {savingSettings && (
              <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded animate-pulse">
                Saving...
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href="/invoices/new"
            className="px-4 py-2 border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-xl transition-all"
          >
            Create New Invoice
          </Link>
          <button
            onClick={handlePrint}
            className="px-4 py-2 border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-xl transition-all"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {/* Action Buttons row */}
      <div className="flex flex-wrap gap-2.5 border-b border-slate-100 pb-6 print:hidden">
        {document.status === 'DRAFT' && (
          <Link
            href={`/invoices/${document._id}/edit`}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm text-xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Document
          </Link>
        )}
        <button
          onClick={() => setIsPaymentModalOpen(true)}
          className="px-4 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-700 transition-colors text-xs flex items-center gap-1.5"
        >
          Record Payment
        </button>
        <button
          onClick={handleGenerateEInvoice}
          className="px-4 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-700 transition-colors text-xs"
        >
          Generate E-Invoice
        </button>
        <button
          onClick={handleGenerateEWayBill}
          className="px-4 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-700 transition-colors text-xs"
        >
          Generate EWB
        </button>
        <button
          onClick={handlePrint}
          className="px-4 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-700 transition-colors text-xs"
        >
          Download PDF
        </button>
        <button
          onClick={() => setIsShareModalOpen(true)}
          className="px-4 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-700 transition-colors text-xs flex items-center gap-1.5"
        >
          Email / WhatsApp
        </button>

        {/* More Actions Selector */}
        <div className="flex gap-2">
          {document.status === 'DRAFT' && (
            <button
              onClick={() => handleStatusChange('SENT')}
              className="px-3.5 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-700 transition-colors text-xs"
            >
              Mark Sent
            </button>
          )}
          {document.status === 'SENT' && (
            <>
              <button
                onClick={() => handleStatusChange('ACCEPTED')}
                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors text-xs"
              >
                Mark Accepted
              </button>
              <button
                onClick={() => handleStatusChange('REJECTED')}
                className="px-3.5 py-2.5 border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold rounded-xl transition-colors text-xs"
              >
                Mark Rejected
              </button>
            </>
          )}
          {document.status !== 'CANCELLED' && (
            <button
              onClick={() => handleStatusChange('CANCELLED')}
              className="px-3.5 py-2.5 border border-rose-250 text-rose-600 hover:bg-rose-50 font-bold rounded-xl transition-colors text-xs"
            >
              Cancel Invoice
            </button>
          )}
          <button
            onClick={handleDuplicateDocument}
            className="px-3.5 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-700 transition-colors text-xs"
            title="Duplicate"
          >
            Duplicate
          </button>
          {document.status === 'DRAFT' && (
            <button
              onClick={handleDeleteDocument}
              className="px-3.5 py-2.5 border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold rounded-xl transition-colors text-xs"
              title="Delete"
            >
              Delete Draft
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Document Summary Block */}
      <div className="card-panel p-5 rounded-2xl bg-white border border-slate-200 text-xs print:hidden">
        <h3 className="font-bold text-slate-900 pb-2 border-b border-slate-100 uppercase tracking-wider text-[10px]">
          Invoice Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-slate-650">
          <div>
            <span className="block font-semibold text-slate-450">Client:</span>
            <span className="font-bold text-slate-800">{document.clientSnapshot?.businessName || document.clientSnapshot?.clientName}</span>
          </div>
          <div>
            <span className="block font-semibold text-slate-450">Dates:</span>
            <span>Issue: {new Date(document.issueDate).toLocaleDateString('en-IN')} | Due: {new Date(document.validTill).toLocaleDateString('en-IN')}</span>
          </div>
          <div>
            <span className="block font-semibold text-slate-455">Payment status:</span>
            <span className="font-bold text-slate-800 uppercase bg-slate-100 px-2 py-0.5 rounded">
              {document.paymentStatus || 'UNPAID'}
            </span>
          </div>
          <div>
            <span className="block font-semibold text-slate-450">Balance due:</span>
            <span className="font-bold text-slate-900 text-sm">
              ₹{(document.balanceDue ?? document.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* View Journal Reference check */}
      <div className="card-panel p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 print:hidden flex items-center justify-between">
        <div>
          <span className="font-bold text-slate-700">Accounting Journal:</span>{' '}
          {document.journalReference ? (
            <span className="font-semibold text-slate-900">Configured: {document.journalReference}</span>
          ) : (
            <span>Accounting journal is not configured.</span>
          )}
        </div>
        {!document.journalReference && (
          <button
            onClick={() => showToast('Accounting journals ledger integration is not configured.', 'info')}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
          >
            Configure Journal Settings →
          </button>
        )}
      </div>

      {/* Batch Summary check if items contain batches */}
      {localSettings.advanced.showBatchDetails && (
        <div className="card-panel p-5 rounded-2xl bg-white border border-slate-200 text-xs print:hidden space-y-2">
          <h3 className="font-bold text-slate-900 pb-2 border-b border-slate-100 uppercase tracking-wider text-[10px]">
            Batch Summary Ledger
          </h3>
          <p className="italic text-slate-400">No active batches or serial lots mapped in current items.</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Central PDF layout Preview Document */}
        <div className="xl:col-span-3 space-y-6">
          <div
            ref={printRef}
            className={`invoice-print-shell printable-document invoice-doc card-panel rounded-xl bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] border border-slate-200 min-h-[1100px] max-w-[794px] mx-auto flex flex-col ${
              localSettings.design.tableStyle === 'Striped' ? 'striped' : ''
            }`}
            style={{
              fontFamily: localSettings.design.fontFamily === 'Courier' ? 'Courier New, monospace' : 'inherit',
              ...(localSettings.design.primaryColor ? { '--invoice-accent': localSettings.design.primaryColor } as React.CSSProperties : {}),
            }}
          >
            <div className="invoice-doc-accent-bar" />

            {/* Header */}
            <div className="invoice-doc-header print-avoid-break">
              <div className="invoice-doc-brand">
                {document.businessSnapshot?.logo ? (
                  <img
                    src={formatImageSrc(document.businessSnapshot.logo)}
                    alt="Logo"
                    className="invoice-doc-logo"
                  />
                ) : (
                  <div className="invoice-doc-logo-placeholder" />
                )}
                <div>
                  <h2 className="invoice-doc-company-name">{document.businessSnapshot?.businessName}</h2>
                  <div className="invoice-doc-company-detail">
                    {document.businessSnapshot?.address?.addressLine1 && <p>{document.businessSnapshot.address.addressLine1}</p>}
                    {document.businessSnapshot?.address?.addressLine2 && <p>{document.businessSnapshot.address.addressLine2}</p>}
                    <p>
                      {document.businessSnapshot?.address?.city}, {document.businessSnapshot?.address?.state} – {document.businessSnapshot?.address?.pincode}
                    </p>
                    {document.businessSnapshot?.gstin && <p><strong>GSTIN:</strong> {document.businessSnapshot.gstin}</p>}
                    {document.businessSnapshot?.pan && <p><strong>PAN:</strong> {document.businessSnapshot.pan}</p>}
                    <p>{document.businessSnapshot?.email} &nbsp;|&nbsp; {document.businessSnapshot?.phone}</p>
                  </div>
                </div>
              </div>

              <div className="invoice-doc-meta">
                <h1 className="invoice-doc-title">{document.title || 'Tax Invoice'}</h1>
                {document.subtitle && <p className="invoice-doc-subtitle">{document.subtitle}</p>}
                <div className="invoice-doc-meta-grid">
                  <div className="invoice-doc-meta-row">
                    <span className="invoice-doc-meta-label">Invoice No</span>
                    <span className="invoice-doc-meta-value">{document.documentNumber}</span>
                  </div>
                  {document.poNumber && (
                    <div className="invoice-doc-meta-row">
                      <span className="invoice-doc-meta-label">PO Ref</span>
                      <span className="invoice-doc-meta-value">{document.poNumber}</span>
                    </div>
                  )}
                  <div className="invoice-doc-meta-row">
                    <span className="invoice-doc-meta-label">Issue Date</span>
                    <span className="invoice-doc-meta-value">
                      {new Date(document.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="invoice-doc-meta-row">
                    <span className="invoice-doc-meta-label">Due Date</span>
                    <span className="invoice-doc-meta-value">
                      {new Date(document.validTill).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bill To / Invoice Details */}
            <div className="invoice-doc-section print-avoid-break">
              <div className="invoice-doc-parties">
                <div className="invoice-doc-party-box">
                  <p className="invoice-doc-section-label">Bill To</p>
                  <p className="invoice-doc-party-name">{document.clientSnapshot?.businessName || document.clientSnapshot?.clientName}</p>
                  <div className="invoice-doc-party-detail">
                    <p>{document.clientSnapshot?.billingAddress?.addressLine1}</p>
                    <p>
                      {document.clientSnapshot?.billingAddress?.city}, {document.clientSnapshot?.billingAddress?.state} – {document.clientSnapshot?.billingAddress?.pincode}
                    </p>
                    {document.clientSnapshot?.gstin && <p><strong>GSTIN:</strong> {document.clientSnapshot.gstin}</p>}
                  </div>

                  {document.shippingDetails?.addressLine1 && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--invoice-border)' }}>
                      <p className="invoice-doc-section-label" style={{ marginBottom: 6 }}>Ship To</p>
                      <div className="invoice-doc-party-detail">
                        <p>{document.shippingDetails.addressLine1}</p>
                        <p>{document.shippingDetails.city}, {document.shippingDetails.state} – {document.shippingDetails.pincode}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="invoice-doc-party-box invoice-doc-party-box--white">
                  <p className="invoice-doc-section-label">Invoice Details</p>
                  <div className="invoice-doc-detail-row">
                    <span className="invoice-doc-detail-label">Invoice No</span>
                    <span className="invoice-doc-detail-value">{document.documentNumber}</span>
                  </div>
                  {document.poNumber && (
                    <div className="invoice-doc-detail-row">
                      <span className="invoice-doc-detail-label">PO Ref</span>
                      <span className="invoice-doc-detail-value">{document.poNumber}</span>
                    </div>
                  )}
                  {showPlaceOfSupply && document.gstConfiguration?.placeOfSupply?.state && (
                    <div className="invoice-doc-detail-row">
                      <span className="invoice-doc-detail-label">Place of Supply</span>
                      <span className="invoice-doc-detail-value">{document.gstConfiguration.placeOfSupply.state}</span>
                    </div>
                  )}
                  {document.customFields?.map((field: any, index: number) => (
                    <div key={index} className="invoice-doc-detail-row">
                      <span className="invoice-doc-detail-label">{field.label}</span>
                      <span className="invoice-doc-detail-value">{field.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="invoice-doc-section">
              <div className="invoice-doc-table-wrap">
                <table className={`invoice-doc-table ${localSettings.design.tableStyle === 'Striped' ? 'striped' : ''}`}>
                  <thead>
                    <tr>
                      <th>Item Description</th>
                      {localSettings.advanced.hsnColumnView !== 'Hide' && <th>HSN/SAC</th>}
                      {document.gstConfiguration?.gstEnabled && <th>GST %</th>}
                      <th className="text-right">Qty</th>
                      <th className="text-right">Rate</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {document.items?.map((item: any, i: number) => {
                      const isGroup = item.itemName && item.itemName.startsWith('[GROUP] ');
                      if (isGroup) {
                        return (
                          <tr key={i} className="group-row">
                            <td colSpan={6}>{item.itemName.substring(8)}</td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={i}>
                          <td className="item-name">
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              {localSettings.advanced.showOriginalItemImages && item.image && (
                                <img
                                  src={formatImageSrc(item.image)}
                                  alt="item"
                                  style={{ width: 36, height: 36, objectFit: 'contain', border: '1px solid var(--invoice-border)', borderRadius: 4, flexShrink: 0 }}
                                />
                              )}
                              <div>
                                <span>{item.itemName}</span>
                                {item.description && (
                                  <p style={{ marginTop: 3, fontSize: 10, color: 'var(--invoice-muted)', fontWeight: 400, whiteSpace: 'pre-wrap' }}>{item.description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          {localSettings.advanced.hsnColumnView !== 'Hide' && (
                            <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.hsnSac || '—'}</td>
                          )}
                          {document.gstConfiguration?.gstEnabled && <td>{item.gstRate || 0}%</td>}
                          <td style={{ textAlign: 'right' }}>
                            {item.quantity} {localSettings.advanced.unitDisplay === 'Separate column' ? (item.unit || 'PCS') : ''}
                          </td>
                          <td style={{ textAlign: 'right' }}>₹{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="item-amount">
                            ₹{((item.quantity * item.rate) - (item.itemDiscountAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="invoice-doc-section totals-section print-avoid-break">
              <div className="invoice-doc-totals-grid">
                <div>
                  {document.notes && (
                    <div className="invoice-doc-notes-box">
                      <p className="invoice-doc-section-label" style={{ marginBottom: 8 }}>Remarks / Notes</p>
                      <p className="invoice-doc-terms-text">{document.notes}</p>
                    </div>
                  )}

                  {document.bankDetails?.accountNumber && (
                    <div className="invoice-doc-bank-box">
                      <p className="invoice-doc-section-label" style={{ marginBottom: 8, borderBottom: 'none', paddingBottom: 0 }}>Payment Details</p>
                      <p><strong>Bank:</strong> {document.bankDetails.bankName}</p>
                      <p><strong>A/C Holder:</strong> {document.bankDetails.accountHolderName}</p>
                      <p><strong>A/C Number:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{document.bankDetails.accountNumber}</span></p>
                      <p><strong>IFSC:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase' }}>{document.bankDetails.ifsc}</span></p>
                      {document.bankDetails.branchName && <p><strong>Branch:</strong> {document.bankDetails.branchName}</p>}
                    </div>
                  )}
                </div>

                <div className="invoice-doc-totals-panel">
                  <div className="invoice-doc-totals-rows">
                    <div className="invoice-doc-total-row">
                      <span>Subtotal</span>
                      <span>₹{document.subtotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {document.documentDiscountAmount > 0 && (
                      <div className="invoice-doc-total-row">
                        <span>Discount</span>
                        <span>− ₹{document.documentDiscountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {document.gstConfiguration?.gstEnabled && (
                      <>
                        {document.cgstTotal > 0 && (
                          <div className="invoice-doc-total-row">
                            <span>CGST</span>
                            <span>₹{document.cgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {document.sgstTotal > 0 && (
                          <div className="invoice-doc-total-row">
                            <span>SGST</span>
                            <span>₹{document.sgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {document.igstTotal > 0 && (
                          <div className="invoice-doc-total-row">
                            <span>IGST</span>
                            <span>₹{document.igstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </>
                    )}
                    {document.additionalChargesTotal > 0 && (
                      <div className="invoice-doc-total-row">
                        <span>Shipping &amp; Charges</span>
                        <span>₹{document.additionalChargesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {document.roundOff !== 0 && (
                      <div className="invoice-doc-total-row">
                        <span>Round-off</span>
                        <span>₹{document.roundOff > 0 ? '+' : ''}{document.roundOff.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  <div className="invoice-doc-grand-total">
                    <span className="invoice-doc-grand-total-label">Grand Total</span>
                    <span className="invoice-doc-grand-total-value">₹{document.grandTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="invoice-doc-footer print-avoid-break">
              <div className="invoice-doc-footer-grid">
                <div>
                  {document.grandTotalInWords && (
                    <div className="invoice-doc-words-box">
                      <p className="invoice-doc-words-label">Amount in Words</p>
                      <p className="invoice-doc-words-text">{document.grandTotalInWords}</p>
                    </div>
                  )}
                  {document.terms && (
                    <div>
                      <p className="invoice-doc-terms-title">Terms &amp; Conditions</p>
                      <p className="invoice-doc-terms-text">{document.terms}</p>
                    </div>
                  )}
                </div>

                {document.signature?.signatoryName && (
                  <div className="invoice-doc-signature">
                    {document.signature.signatureUrl && (
                      <img src={formatImageSrc(document.signature.signatureUrl)} alt="Signature" />
                    )}
                    <div className="invoice-doc-signature-line">
                      <p className="invoice-doc-signature-name">{document.signature.signatoryName}</p>
                      <p className="invoice-doc-signature-role">Authorized Signatory</p>
                    </div>
                  </div>
                )}
              </div>

              {document.footer && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--invoice-border)', textAlign: 'center', fontSize: 10, color: 'var(--invoice-muted)' }}>
                  {document.footer}
                </div>
              )}

              <div className="invoice-doc-page-footer">
                <span>{document.businessSnapshot?.website || 'www.techbes.com'}</span>
                <span className="page-number" />
              </div>
            </div>
          </div>

          {/* Payment ledger history */}
          <div className="card-panel p-5 rounded-2xl bg-white border border-slate-200 text-xs print:hidden space-y-3">
            <h3 className="font-black text-slate-900 pb-2 border-b border-slate-100 uppercase tracking-wider text-[10px]">
              Payments History & Ledger
            </h3>
            {(!document.payments || document.payments.length === 0) ? (
              <p className="text-slate-455 text-xs italic">No payments recorded yet for this invoice.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {document.payments.map((pay: any, index: number) => (
                  <div key={index} className="flex justify-between py-2.5 items-center">
                    <div>
                      <p className="font-bold text-slate-800">₹{pay.amount.toLocaleString('en-IN')} via {pay.paymentMode}</p>
                      {pay.referenceNumber && <p className="text-[10px] text-slate-400 font-mono">Ref: {pay.referenceNumber}</p>}
                      {pay.notes && <p className="text-[10px] text-slate-500 italic">Note: {pay.notes}</p>}
                    </div>
                    <span className="text-slate-500 font-medium">
                      {new Date(pay.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side: settings accordions panel */}
        <div className="xl:col-span-1 space-y-4 print:hidden">
          <div className="card-panel p-5 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-sm font-black text-slate-900 pb-2 border-b border-slate-100">
              Invoice Settings
            </h3>

            {/* Accordion List */}
            <div className="space-y-2 text-xs">
              {/* 1. Advanced Settings */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'advanced' ? null : 'advanced')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-805 font-bold border-b border-slate-200"
                >
                  <span>1. Advanced Settings</span>
                  <span className="font-bold">{expandedSection === 'advanced' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'advanced' && (
                  <div className="p-4 space-y-3.5 bg-white leading-relaxed text-slate-650">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">HSN Column View</label>
                      <select
                        value={localSettings.advanced.hsnColumnView}
                        onChange={(e) => handleUpdateAdvancedSetting('hsnColumnView', e.target.value)}
                        className="w-full form-input text-xs text-slate-900 bg-white"
                      >
                        <option value="Default">Default</option>
                        <option value="HSN Only">HSN Only</option>
                        <option value="SAC Only">SAC Only</option>
                        <option value="HSN/SAC">HSN/SAC</option>
                        <option value="Hide">Hide</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!localSettings.advanced.hidePlaceOfSupply}
                        onChange={(e) => handleUpdateAdvancedSetting('hidePlaceOfSupply', !e.target.checked)}
                        className="rounded text-blue-600 border-slate-350 w-4 h-4"
                      />
                      <span>Show Place/Country Of Supply</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={localSettings.advanced.showOriginalItemImages}
                        onChange={(e) => handleUpdateAdvancedSetting('showOriginalItemImages', e.target.checked)}
                        className="rounded text-blue-600 border-slate-350 w-4 h-4"
                      />
                      <span>Add original images in line items</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={localSettings.advanced.showFullWidthDescription}
                        onChange={(e) => handleUpdateAdvancedSetting('showFullWidthDescription', e.target.checked)}
                        className="rounded text-blue-600 border-slate-350 w-4 h-4"
                      />
                      <span>Show Description In Full Width</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={localSettings.advanced.showSKU}
                        onChange={(e) => handleUpdateAdvancedSetting('showSKU', e.target.checked)}
                        className="rounded text-blue-600 border-slate-350 w-4 h-4"
                      />
                      <span>Show SKU in Invoice</span>
                    </label>
                  </div>
                )}
              </div>

              {/* 2. Customize Invoice Design */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'design' ? null : 'design')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-805 font-bold border-b border-slate-200"
                >
                  <span>2. Customize Design</span>
                  <span className="font-bold">{expandedSection === 'design' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'design' && (
                  <div className="p-4 space-y-3 bg-white text-slate-650">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Select Template</label>
                      <select
                        value={localSettings.design.templateId}
                        onChange={(e) => handleUpdateDesignSetting('templateId', e.target.value)}
                        className="w-full form-input text-xs text-slate-900 bg-white"
                      >
                        <option value="Professional">Professional (Classic)</option>
                        <option value="Modern">Modern (Bold)</option>
                        <option value="Minimal">Minimal (Clean)</option>
                        <option value="Compact">Compact (Sleek)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Font Family</label>
                      <select
                        value={localSettings.design.fontFamily}
                        onChange={(e) => handleUpdateDesignSetting('fontFamily', e.target.value)}
                        className="w-full form-input text-xs text-slate-900 bg-white"
                      >
                        <option value="Inter">Inter (Sans Serif)</option>
                        <option value="Courier">Courier (Monospace)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Table Style</label>
                      <select
                        value={localSettings.design.tableStyle}
                        onChange={(e) => handleUpdateDesignSetting('tableStyle', e.target.value)}
                        className="w-full form-input text-xs text-slate-900 bg-white"
                      >
                        <option value="Standard">Standard Grid</option>
                        <option value="Striped">Zebra Striped Rows</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Invoice status info */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'payments' ? null : 'payments')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-805 font-bold border-b border-slate-200"
                >
                  <span>3. Invoice Status</span>
                  <span className="font-bold">{expandedSection === 'payments' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'payments' && (
                  <div className="p-4 space-y-2 bg-white text-slate-650">
                    <p>Status: <span className="font-bold text-emerald-600">{document.bankDetails?.accountNumber ? 'Enabled' : 'Not enabled'}</span></p>
                    <p className="text-[11px] text-slate-500">Bank and UPI details are handled directly while editing the invoice.</p>
                  </div>
                )}
              </div>

              {/* 4. Acceptance History */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'acceptance' ? null : 'acceptance')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-805 font-bold border-b border-slate-200"
                >
                  <span>4. Acceptance History</span>
                  <span className="font-bold">{expandedSection === 'acceptance' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'acceptance' && (
                  <div className="p-4 bg-white text-slate-605 max-h-48 overflow-y-auto space-y-2">
                    {(!document.acceptanceHistory || document.acceptanceHistory.length === 0) ? (
                      <p className="italic text-slate-400">No client acceptance records found.</p>
                    ) : (
                      document.acceptanceHistory.map((hist: any, i: number) => (
                        <div key={i} className="border-b border-slate-100 pb-1.5 text-[10px]">
                          <p className="font-bold text-slate-900">Status: {hist.status}</p>
                          <p className="text-slate-450">{new Date(hist.timestamp).toLocaleString('en-IN')}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 5. Audit Trail */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'audit' ? null : 'audit')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-805 font-bold border-b border-slate-200"
                >
                  <span>5. Audit Trail</span>
                  <span className="font-bold">{expandedSection === 'audit' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'audit' && (
                  <div className="p-4 bg-white text-slate-605 max-h-48 overflow-y-auto space-y-2">
                    {(!document.auditTrail || document.auditTrail.length === 0) ? (
                      <p className="italic text-slate-400">No audit records found.</p>
                    ) : (
                      document.auditTrail.map((log: any, i: number) => (
                        <div key={i} className="border-b border-slate-100 pb-1.5 text-[10px]">
                          <p className="font-bold text-slate-900">{log.action}</p>
                          <p className="text-slate-550">{log.description}</p>
                          <p className="text-slate-455">By {log.userName} at {new Date(log.timestamp).toLocaleString('en-IN')}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 6. Linked Documents */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'links' ? null : 'links')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-805 font-bold border-b border-slate-200"
                >
                  <span>6. Linked Documents</span>
                  <span className="font-bold">{expandedSection === 'links' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'links' && (
                  <div className="p-4 bg-white text-slate-605 space-y-2">
                    {(!document.linkedDocuments || document.linkedDocuments.length === 0) ? (
                      <p className="italic text-slate-400">No connections exist.</p>
                    ) : (
                      document.linkedDocuments.map((link: any, i: number) => (
                        <div key={i} className="text-xs">
                          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[9px] block">{link.relationType}</span>
                          <span className="font-bold text-slate-900">{link.documentType} {link.documentNumber}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 7. Online Payment Options */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'onlinePay' ? null : 'onlinePay')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-850 font-bold border-b border-slate-200"
                >
                  <span>7. Online Payment Options</span>
                  <span className="font-bold">{expandedSection === 'onlinePay' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'onlinePay' && (
                  <div className="p-4 bg-white text-slate-650 text-xs space-y-2">
                    <p className="italic">Online payment is not configured.</p>
                    <Link href="/settings" className="text-blue-600 hover:text-blue-700 font-bold">Configure Razorpay integrations →</Link>
                  </div>
                )}
              </div>

              {/* 8. Approval History */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'approval' ? null : 'approval')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-850 font-bold border-b border-slate-200"
                >
                  <span>8. Approval History</span>
                  <span className="font-bold">{expandedSection === 'approval' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'approval' && (
                  <div className="p-4 bg-white text-slate-655 space-y-1.5">
                    <p className="italic text-slate-400">Approval workflow is not enabled.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Business Profile Status Ready check */}
            <div className="pt-4 border-t border-slate-100 text-xs">
              <span className="block font-bold text-slate-450 uppercase text-[9px] tracking-wider mb-2">Business Profile Status</span>
              {getMissingFieldsCount() === 0 ? (
                <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[10px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Your Business Profile Is Ready</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-600 font-bold text-[10px]">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>Incomplete ({getMissingFieldsCount()} fields missing)</span>
                  </div>
                  <Link
                    href="/settings"
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline block"
                  >
                    Complete profile setup now →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Ledger Modal */}
      {isPaymentModalOpen && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title="Record Payment Logs"
        >
          <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Amount Paid (₹)</label>
              <input
                type="number"
                required
                min={0.01}
                step="any"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                placeholder="₹ Amount"
                className="w-full form-input text-xs text-slate-900 bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Payment Date</label>
                <input
                  type="date"
                  required
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">Payment Mode</label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                  className="w-full form-input text-xs text-slate-900 bg-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI VPA</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Credit/Debit Card</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Reference Number / Transaction ID</label>
              <input
                type="text"
                value={paymentForm.referenceNumber}
                onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                placeholder="TXN12345678"
                className="w-full form-input text-xs text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">Internal Notes</label>
              <textarea
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                placeholder="Payment received check reference..."
                rows={2}
                className="w-full form-input text-xs text-slate-900 bg-white resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 border border-slate-700 text-slate-400 hover:bg-slate-850 hover:text-white rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow"
              >
                Record Payment Log
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Share proposal modal */}
      {isShareModalOpen && (
        <Modal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          title="Share Tax Invoice"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Recipient Email</label>
              <input
                type="email"
                value={shareForm.recipientEmail}
                onChange={(e) => setShareForm({ ...shareForm, recipientEmail: e.target.value })}
                placeholder={document?.clientSnapshot?.email || 'client@company.com'}
                className="w-full form-input text-xs text-slate-900 bg-white"
              />
            </div>

            <div className="flex justify-between pt-6 border-t border-slate-850">
              <button
                onClick={() => handleShare('whatsapp')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow"
              >
                Share on WhatsApp
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-400 hover:bg-slate-850 hover:text-white rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleShare('email')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow animate-pulse"
                >
                  Send Email Invoice
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
