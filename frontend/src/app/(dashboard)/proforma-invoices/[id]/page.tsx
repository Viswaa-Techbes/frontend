'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/PageHeader';

interface ProformaInvoiceDetailsProps {
  params: {
    id: string;
  };
}

export default function ProformaInvoiceDetailsPage({ params }: ProformaInvoiceDetailsProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const docId = params.id;
  const printRef = useRef<HTMLDivElement>(null);

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
          subject: `Proforma Invoice ${doc.documentNumber} from ${doc.businessSnapshot?.businessName || ''}`,
          message: `Dear Client,\n\nPlease find attached Proforma Invoice ${doc.documentNumber} for your review. Let us know if you have any questions.\n\nBest Regards,\n${doc.businessSnapshot?.businessName || ''}`,
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

  // Delete document
  const handleDeleteDocument = async () => {
    if (!window.confirm(`Are you sure you want to delete proforma invoice ${document.documentNumber}?`)) return;
    try {
      const res = await api.delete(`/documents/${docId}`);
      if (res.data?.success) {
        showToast('Document deleted successfully.', 'success');
        router.push('/proforma-invoices');
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
        showToast('Document duplicated successfully.', 'success');
        router.push(`/proforma-invoices/${res.data.data._id}`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to duplicate document.', 'error');
    }
  };

  // Convert to Invoice
  const handleConvertToInvoice = async () => {
    if (!window.confirm(`Are you sure you want to convert proforma invoice ${document.documentNumber} to a Tax Invoice?`)) return;
    try {
      const res = await api.post(`/documents/${docId}/convert`, { targetType: 'INVOICE' });
      if (res.data?.success) {
        showToast(`Successfully converted to Invoice ${res.data.data.documentNumber}!`, 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to convert document.', 'error');
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

  // Download PDF simulation (fetches details from backend and triggers browser print layout formatted)
  const handleDownloadPdf = async () => {
    try {
      showToast('Preparing PDF download layout...', 'info');
      setTimeout(() => {
        window.print();
      }, 500);
    } catch (err: any) {
      showToast('Failed to trigger PDF generator.', 'error');
    }
  };

  // Share helper
  const handleShare = (channel: 'email' | 'whatsapp') => {
    if (channel === 'email') {
      showToast(`Email proposal sent to client: ${document?.clientSnapshot?.email || 'N/A'}`, 'success');
      setIsShareModalOpen(false);
    } else {
      const phone = document?.clientSnapshot?.phone || '';
      const text = encodeURIComponent(`Hi ${document?.clientSnapshot?.clientName || ''}, please review Proforma Invoice ${document?.documentNumber} for amount ₹${document?.grandTotal?.toLocaleString('en-IN')}`);
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
      SENT: 'bg-blue-50 text-blue-700 border-blue-100',
      VIEWED: 'bg-purple-50 text-purple-700 border-purple-100',
      ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      REJECTED: 'bg-rose-50 text-rose-700 border-rose-100',
      EXPIRED: 'bg-amber-50 text-amber-705 border-amber-100',
      CONVERTED: 'bg-slate-100 text-slate-600 border-slate-200 line-through',
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
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            SALES & INVOICES / <Link href="/proforma-invoices" className="hover:underline">PROFORMA INVOICES</Link> / {document.documentNumber}
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
            href="/proforma-invoices/new"
            className="px-4 py-2 border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-xl transition-all"
          >
            Create New Proforma
          </Link>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {/* Action Buttons row */}
      <div className="flex flex-wrap gap-2.5 border-b border-slate-100 pb-6 print:hidden">
        {document.status === 'DRAFT' && (
          <Link
            href={`/proforma-invoices/${document._id}/edit`}
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
          onClick={handleDownloadPdf}
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
          {document.status !== 'CONVERTED' && (
            <button
              onClick={handleConvertToInvoice}
              className="px-4 py-2.5 border border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-bold rounded-xl transition-colors text-xs"
            >
              Convert to Invoice
            </button>
          )}
          <button
            onClick={handleDuplicateDocument}
            className="px-3.5 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-700 transition-colors text-xs"
            title="Duplicate"
          >
            Duplicate
          </button>
          <button
            onClick={handleDeleteDocument}
            className="px-3.5 py-2.5 border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold rounded-xl transition-colors text-xs"
            title="Delete"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Collapsible Document Summary Block */}
      <div className="card-panel p-5 rounded-2xl bg-white border border-slate-200 text-xs print:hidden">
        <h3 className="font-bold text-slate-900 pb-2 border-b border-slate-100 uppercase tracking-wider text-[10px]">
          Proforma Invoice Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-slate-600">
          <div>
            <span className="block font-semibold text-slate-450">Client:</span>
            <span className="font-bold text-slate-800">{document.clientSnapshot?.businessName || document.clientSnapshot?.clientName}</span>
          </div>
          <div>
            <span className="block font-semibold text-slate-450">Dates:</span>
            <span>Issue: {new Date(document.issueDate).toLocaleDateString('en-IN')} | Due: {new Date(document.validTill).toLocaleDateString('en-IN')}</span>
          </div>
          <div>
            <span className="block font-semibold text-slate-450">Payment status:</span>
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

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Central PDF layout Preview Document */}
        <div className="xl:col-span-3 space-y-6">
          <div
            ref={printRef}
            className={`card-panel p-12 sm:p-16 rounded-2xl bg-white shadow-md border border-slate-250 min-h-[1100px] text-xs leading-relaxed max-w-4A mx-auto ${
              localSettings.design.tableStyle === 'Striped' ? 'print-striped' : ''
            }`}
            style={{ fontFamily: localSettings.design.fontFamily === 'Courier' ? 'Courier New, monospace' : 'inherit' }}
          >
            {/* Template Header layout mapping */}
            <div className={`flex justify-between items-start border-b border-slate-200 pb-8 ${
              localSettings.design.headerAlignment === 'Center' ? 'flex-col items-center text-center' : ''
            }`}>
              {/* Logo block */}
              {document.businessSnapshot?.logo && (
                <div className={`mb-4 ${
                  localSettings.design.logoPosition === 'Right' ? 'order-last' : 'order-first'
                }`}>
                  <img src={document.businessSnapshot.logo} alt="Logo" className="w-32 max-h-20 object-contain" />
                </div>
              )}

              {/* Billed By Details */}
              <div className="space-y-1 text-slate-600">
                <h2 className="text-lg font-black text-slate-900">{document.businessSnapshot?.businessName}</h2>
                <p>{document.businessSnapshot?.address?.addressLine1}</p>
                {document.businessSnapshot?.address?.addressLine2 && <p>{document.businessSnapshot.address.addressLine2}</p>}
                <p>{document.businessSnapshot?.address?.city}, {document.businessSnapshot?.address?.state} - {document.businessSnapshot?.address?.pincode}</p>
                {document.businessSnapshot?.gstin && <p><span className="font-bold text-slate-450 uppercase">GSTIN:</span> {document.businessSnapshot.gstin}</p>}
                {document.businessSnapshot?.pan && <p><span className="font-bold text-slate-450 uppercase">PAN:</span> {document.businessSnapshot.pan}</p>}
                <p className="text-slate-450">{document.businessSnapshot?.email} | {document.businessSnapshot?.phone}</p>
              </div>
            </div>

            {/* Title / Numbers Header info */}
            <div className="grid grid-cols-2 gap-8 border-b border-slate-200 py-6">
              <div>
                <h1 className="text-xl font-black text-slate-900">{document.title || 'Proforma Invoice'}</h1>
                {document.subtitle && <p className="text-xs text-slate-500 font-medium mt-1">{document.subtitle}</p>}

                <div className="mt-4 space-y-1 text-slate-600">
                  <p className="font-bold text-slate-900 uppercase text-[9px] tracking-wider mb-1">QUOTATION FOR</p>
                  <p className="font-bold text-slate-900">{document.clientSnapshot?.businessName || document.clientSnapshot?.clientName}</p>
                  <p>{document.clientSnapshot?.billingAddress?.addressLine1}</p>
                  <p>{document.clientSnapshot?.billingAddress?.city}, {document.clientSnapshot?.billingAddress?.state} - {document.clientSnapshot?.billingAddress?.pincode}</p>
                  {document.clientSnapshot?.gstin && <p><span className="font-bold text-slate-450 uppercase">GSTIN:</span> {document.clientSnapshot.gstin}</p>}
                </div>

                {document.shippingDetails?.addressLine1 && (
                  <div className="mt-4 space-y-1 text-slate-500">
                    <p className="font-bold text-slate-950 uppercase text-[9px] tracking-wider mb-1">SHIPPING DETAILS</p>
                    <p>{document.shippingDetails.addressLine1}</p>
                    <p>{document.shippingDetails.city}, {document.shippingDetails.state} - {document.shippingDetails.pincode}</p>
                  </div>
                )}
              </div>

              {/* Invoice properties numbers */}
              <div className="text-right space-y-1.5 text-slate-650">
                <p><span className="font-bold text-slate-900">Proforma No:</span> {document.documentNumber}</p>
                {document.poNumber && <p><span className="font-bold text-slate-900">PO Ref:</span> {document.poNumber}</p>}
                <p>
                  <span className="font-bold text-slate-900">Issue Date:</span>{' '}
                  {new Date(document.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
                <p>
                  <span className="font-bold text-slate-900">Due Date:</span>{' '}
                  {new Date(document.validTill).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
                {showPlaceOfSupply && document.gstConfiguration?.placeOfSupply?.state && (
                  <p><span className="font-bold text-slate-900">Place of Supply:</span> {document.gstConfiguration.placeOfSupply.state}</p>
                )}
                {/* Custom fields mapped */}
                {document.customFields?.map((field: any, index: number) => (
                  <p key={index}><span className="font-bold text-slate-900">{field.label}:</span> {field.value}</p>
                ))}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="py-6 overflow-hidden">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[9px] tracking-wider bg-slate-50/50">
                    <th className="px-4 py-2">Item Description</th>
                    {localSettings.advanced.hsnColumnView !== 'Hide' && <th className="px-3 py-2 w-24">HSN</th>}
                    {document.gstConfiguration?.gstEnabled && <th className="px-3 py-2 w-16">GST %</th>}
                    <th className="px-3 py-2 w-16 text-right">Qty</th>
                    <th className="px-3 py-2 w-24 text-right">Rate</th>
                    <th className="px-3 py-2 w-28 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {document.items?.map((item: any, i: number) => {
                    const isGroup = item.itemName && item.itemName.startsWith('[GROUP] ');
                    if (isGroup) {
                      return (
                        <tr key={i} className="bg-blue-50/20 font-bold border-y border-blue-100">
                          <td colSpan={6} className="px-4 py-2 text-slate-900 uppercase text-[10px] tracking-wider">
                            {item.itemName.substring(8)}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={i} className="hover:bg-slate-50/30">
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {localSettings.advanced.showOriginalItemImages && item.image && (
                              <img src={item.image} alt="item-thumb" className="w-8 h-8 rounded object-contain flex-shrink-0 border border-slate-100 bg-slate-50" />
                            )}
                            <div>
                              <p className="font-semibold text-slate-900">{item.itemName}</p>
                              {item.description && <p className="text-[10px] text-slate-450 mt-0.5 whitespace-pre-wrap">{item.description}</p>}
                            </div>
                          </div>
                        </td>
                        {localSettings.advanced.hsnColumnView !== 'Hide' && <td className="px-3 py-3 font-mono">{item.hsnSac || '—'}</td>}
                        {document.gstConfiguration?.gstEnabled && <td className="px-3 py-3">{item.gstRate || 0}%</td>}
                        <td className="px-3 py-3 text-right">
                          {item.quantity} {localSettings.advanced.unitDisplay === 'Separate column' ? (item.unit || 'PCS') : ''}
                        </td>
                        <td className="px-3 py-3 text-right">₹{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-900">
                          ₹{((item.quantity * item.rate) - (item.itemDiscountAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Calculations totals summaries card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-200 pt-6">
              {/* Left Column: terms, remarks, signatures */}
              <div className="space-y-4">
                {document.notes && (
                  <div>
                    <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Remarks / Notes</h4>
                    <p className="text-slate-600 text-[10px] whitespace-pre-wrap leading-relaxed">{document.notes}</p>
                  </div>
                )}
                {document.terms && (
                  <div>
                    <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Terms & Conditions</h4>
                    <p className="text-slate-600 text-[10px] whitespace-pre-wrap leading-relaxed">{document.terms}</p>
                  </div>
                )}

                {/* Bank Account snapshot details */}
                {document.bankDetails?.accountNumber && (
                  <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1.5 text-[10px] text-slate-600 max-w-sm">
                    <p className="font-bold text-[9px] text-slate-950 uppercase tracking-wider border-b border-slate-200 pb-1">Payment Settlement Details</p>
                    <p><span className="font-semibold">Bank:</span> {document.bankDetails.bankName}</p>
                    <p><span className="font-semibold">A/C Holder:</span> {document.bankDetails.accountHolderName}</p>
                    <p><span className="font-semibold">A/C Number:</span> <span className="font-mono text-slate-900 font-bold">{document.bankDetails.accountNumber}</span></p>
                    <p><span className="font-semibold">IFSC Code:</span> <span className="font-mono uppercase text-slate-900 font-bold">{document.bankDetails.ifsc}</span></p>
                    {document.bankDetails.branchName && <p><span className="font-semibold">Branch:</span> {document.bankDetails.branchName}</p>}
                  </div>
                )}
              </div>

              {/* Right Column: summary totals */}
              <div className="space-y-3.5 text-right text-slate-650 max-w-md ml-auto w-full">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-900">₹{document.subtotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {document.documentDiscountAmount > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Discount:</span>
                    <span>- ₹{document.documentDiscountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                {/* Tax Breakdown rows */}
                {document.gstConfiguration?.gstEnabled && (
                  <>
                    {document.cgstTotal > 0 && (
                      <div className="flex justify-between">
                        <span>CGST:</span>
                        <span>₹{document.cgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {document.sgstTotal > 0 && (
                      <div className="flex justify-between">
                        <span>SGST:</span>
                        <span>₹{document.sgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {document.igstTotal > 0 && (
                      <div className="flex justify-between">
                        <span>IGST:</span>
                        <span>₹{document.igstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </>
                )}

                {document.additionalChargesTotal > 0 && (
                  <div className="flex justify-between">
                    <span>Shipping & Charges:</span>
                    <span>₹{document.additionalChargesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                {document.roundOff !== 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Round-off:</span>
                    <span>₹{document.roundOff > 0 ? '+' : ''}{document.roundOff.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between border-t border-slate-200 pt-3 text-sm font-black text-slate-900">
                  <span>Total Amount Due:</span>
                  <span>₹{document.grandTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                {/* Total in words */}
                {document.grandTotalInWords && (
                  <p className="text-[10px] text-slate-450 italic pt-1">
                    Amount in Words: {document.grandTotalInWords}
                  </p>
                )}

                {/* Signature slot render */}
                {document.signature?.signatoryName && (
                  <div className="pt-8 flex flex-col items-end space-y-2">
                    {document.signature.signatureUrl && (
                      <img src={document.signature.signatureUrl} alt="Signature Watermark" className="h-10 object-contain pr-4" />
                    )}
                    <div className="text-center w-48 border-t border-slate-200 pt-1">
                      <p className="font-bold text-slate-900">{document.signature.signatoryName}</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Authorized Signatory</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Payment ledger history */}
          <div className="card-panel p-5 rounded-2xl bg-white border border-slate-200 text-xs print:hidden space-y-3">
            <h3 className="font-black text-slate-900 pb-2 border-b border-slate-100 uppercase tracking-wider text-[10px]">
              Payments History & Ledger
            </h3>
            {(!document.payments || document.payments.length === 0) ? (
              <p className="text-slate-400 text-xs italic">No payments recorded yet for this invoice.</p>
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
              Proforma Invoice Settings
            </h3>

            {/* Accordion List */}
            <div className="space-y-2 text-xs">
              {/* 1. Advanced Settings */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'advanced' ? null : 'advanced')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-800 font-bold border-b border-slate-200"
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
                      <span>Show SKU in Proforma Invoice</span>
                    </label>
                  </div>
                )}
              </div>

              {/* 2. Customize Invoice Design */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'design' ? null : 'design')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-800 font-bold border-b border-slate-200"
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

              {/* 3. Bank and UPI details status info */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'payments' ? null : 'payments')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-800 font-bold border-b border-slate-200"
                >
                  <span>3. Bank and UPI Details</span>
                  <span className="font-bold">{expandedSection === 'payments' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'payments' && (
                  <div className="p-4 space-y-2 bg-white text-slate-650">
                    <p>Status: <span className="font-bold text-emerald-600">{document.bankDetails?.accountNumber ? 'Enabled' : 'Not enabled'}</span></p>
                    <Link
                      href={`/proforma-invoices/${document._id}/payment-setup`}
                      className="text-xs text-blue-600 hover:text-blue-700 font-bold block"
                    >
                      Configure credential snapshots →
                    </Link>
                  </div>
                )}
              </div>

              {/* 4. Acceptance History */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'acceptance' ? null : 'acceptance')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-800 font-bold border-b border-slate-200"
                >
                  <span>4. Acceptance History</span>
                  <span className="font-bold">{expandedSection === 'acceptance' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'acceptance' && (
                  <div className="p-4 bg-white text-slate-600 max-h-48 overflow-y-auto space-y-2">
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
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-800 font-bold border-b border-slate-200"
                >
                  <span>5. Audit Trail</span>
                  <span className="font-bold">{expandedSection === 'audit' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'audit' && (
                  <div className="p-4 bg-white text-slate-600 max-h-48 overflow-y-auto space-y-2">
                    {(!document.auditTrail || document.auditTrail.length === 0) ? (
                      <p className="italic text-slate-400">No audit records found.</p>
                    ) : (
                      document.auditTrail.map((log: any, i: number) => (
                        <div key={i} className="border-b border-slate-100 pb-1.5 text-[10px]">
                          <p className="font-bold text-slate-900">{log.action}</p>
                          <p className="text-slate-550">{log.description}</p>
                          <p className="text-slate-450">By {log.userName} at {new Date(log.timestamp).toLocaleString('en-IN')}</p>
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
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-800 font-bold border-b border-slate-200"
                >
                  <span>6. Linked Documents</span>
                  <span className="font-bold">{expandedSection === 'links' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'links' && (
                  <div className="p-4 bg-white text-slate-600 space-y-2">
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
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-800 font-bold border-b border-slate-200"
                >
                  <span>7. Online Payment Options</span>
                  <span className="font-bold">{expandedSection === 'onlinePay' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'onlinePay' && (
                  <div className="p-4 bg-white text-slate-600 text-xs space-y-2">
                    <p className="italic">Online payment is not configured.</p>
                    <Link href="/settings" className="text-blue-600 hover:text-blue-700 font-bold">Configure Razorpay integrations →</Link>
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
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Internal Notes</label>
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
          title="Share Proforma Invoice"
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
                  Send Email Proposal
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
