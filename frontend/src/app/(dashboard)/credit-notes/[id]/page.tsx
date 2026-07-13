'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';

interface InvoiceToSettle {
  _id: string;
  documentNumber: string;
  issueDate: string;
  grandTotal: number;
  balanceDue: number;
  allocatedAmount?: number;
}

export default function CreditNoteDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { showToast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [document, setDocument] = useState<any>(null);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Settlements States
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [eligibleInvoices, setEligibleInvoices] = useState<InvoiceToSettle[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [settling, setSettling] = useState(false);

  // Settings panels accordions expanded states
  const [expandedSection, setExpandedSection] = useState<string | null>('advanced');

  // Share States
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareForm, setShareForm] = useState({
    recipientEmail: '',
    cc: '',
    subject: '',
    message: '',
  });

  // Local settings synced to db document settings
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
      unitDisplayMode: 'Separate column',
      hidePlaceOfSupply: false,
      showSku: false,
      showSummarizedQuantity: false,
      showTotalInWords: true,
      showOriginalItemImages: false,
    },
  });

  const fetchDocumentDetails = async () => {
    try {
      const response = await api.get(`/documents/${id}`);
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

        // Prepopulate share form
        setShareForm((prev) => ({
          ...prev,
          recipientEmail: doc.clientSnapshot?.email || '',
          subject: `Credit Note ${doc.documentNumber} from ${doc.businessSnapshot?.businessName || ''}`,
          message: `Dear Client,\n\nPlease find attached Credit Note ${doc.documentNumber} for your records.\n\nBest Regards,\n${doc.businessSnapshot?.businessName || ''}`,
        }));
      }

      const bizRes = await api.get('/business');
      if (bizRes.data?.success) {
        setBusinessProfile(bizRes.data.data.business);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to retrieve details.', 'error');
      router.push('/credit-notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDocumentDetails();
    }
  }, [id]);

  const handleSaveSettings = async (updatedSettings: any) => {
    setSavingSettings(true);
    try {
      const res = await api.put(`/documents/${id}/settings`, updatedSettings);
      if (res.data?.success) {
        setDocument(res.data.data);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save settings changes.', 'error');
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

  // Settle Modal actions
  const handleOpenSettleModal = async () => {
    try {
      const res = await api.get(`/documents/eligible-invoices?clientId=${document.clientId}`);
      if (res.data?.success) {
        setEligibleInvoices(res.data.data || []);
        setAllocations({});
        setIsSettleModalOpen(true);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to fetch eligible invoices.', 'error');
    }
  };

  const handleAllocationChange = (invId: string, value: number) => {
    setAllocations({
      ...allocations,
      [invId]: value,
    });
  };

  const handleSubmitSettlement = async () => {
    const activeAllocations = Object.entries(allocations)
      .map(([invoiceId, amount]) => ({ invoiceId, amount }))
      .filter((a) => a.amount > 0);

    if (activeAllocations.length === 0) {
      showToast('Please enter an amount to settle.', 'warning');
      return;
    }

    const totalToApply = activeAllocations.reduce((sum, a) => sum + a.amount, 0);
    const available = document.availableCreditAmount ?? document.grandTotal;

    if (totalToApply > available) {
      showToast(`Total applied (₹${totalToApply}) exceeds available credit of (₹${available}).`, 'warning');
      return;
    }

    setSettling(true);
    try {
      const res = await api.post(`/documents/${id}/settle-credit`, {
        settlements: activeAllocations
      });
      if (res.data?.success) {
        showToast('Credit settled successfully!', 'success');
        setDocument(res.data.data);
        setIsSettleModalOpen(false);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to apply settlement.', 'error');
    } finally {
      setSettling(false);
    }
  };

  // Status transitions
  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await api.patch(`/documents/${id}/status`, { status: newStatus });
      if (res.data?.success) {
        showToast(`Credit Note status marked as ${newStatus}!`, 'success');
        setDocument(res.data.data);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update status.', 'error');
    }
  };

  const handleDeleteDocument = async () => {
    if (!window.confirm(`Are you sure you want to delete draft Credit Note ${document.documentNumber}?`)) return;
    try {
      const res = await api.delete(`/documents/${id}`);
      if (res.data?.success) {
        showToast('Document deleted successfully.', 'success');
        router.push('/credit-notes');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete document.', 'error');
    }
  };

  const handleDuplicateDocument = async () => {
    try {
      const res = await api.post(`/documents/${id}/duplicate`);
      if (res.data?.success) {
        showToast('Document duplicated successfully.', 'success');
        router.push(`/credit-notes/${res.data.data._id}`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to duplicate document.', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = (channel: 'email' | 'whatsapp') => {
    if (channel === 'email') {
      showToast(`Email proposal sent to: ${document?.clientSnapshot?.email || 'N/A'}`, 'success');
      setIsShareModalOpen(false);
    } else {
      const phone = document?.clientSnapshot?.phone || '';
      const text = encodeURIComponent(`Hello ${document?.clientSnapshot?.clientName || ''}, please view your Credit Note ${document?.documentNumber}`);
      window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${text}`, '_blank');
      showToast('WhatsApp share window opened.', 'success');
    }
  };

  if (loading) {
    return (
      <div className="card-panel p-16 rounded-xl flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!document) return null;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-705 border-slate-200',
      ISSUED: 'bg-blue-50 text-blue-700 border-blue-105 font-bold',
      PARTIALLY_SETTLED: 'bg-yellow-50 text-yellow-800 border-yellow-200 font-medium',
      SETTLED: 'bg-emerald-50 text-emerald-700 border-emerald-100 font-bold',
      CANCELLED: 'bg-slate-205 text-slate-500 border-slate-350 line-through',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || 'bg-slate-100'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      PRODUCT_RETURN: 'Product Return',
      DISCOUNT_OFFERED: 'Discount Offered',
      FAULT_OR_DEFECT: 'Fault/Defect in service / product',
      ADVANCE_PAID: 'Advance Paid',
      OTHER: 'Other',
    };
    return labels[reason] || reason;
  };

  return (
    <div className="space-y-6 text-slate-805 pb-16">
      {/* Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {document.businessSnapshot?.businessName || 'TechBes'} / <Link href="/credit-notes" className="hover:underline">CREDIT NOTES</Link> / {document.documentNumber}
          </span>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-xl font-bold text-slate-909">{document.documentNumber}</h1>
            {getStatusBadge(document.status)}
            {savingSettings && (
              <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded animate-pulse">
                Saving Settings...
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href="/credit-notes/new"
            className="px-4 py-2 border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-xl transition-all"
          >
            Create New Credit Note
          </Link>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {/* Action toolbar */}
      <div className="flex flex-wrap gap-2.5 border-b border-slate-100 pb-6 print:hidden">
        {document.status === 'DRAFT' && (
          <Link
            href={`/credit-notes/${document._id}/edit`}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm text-xs"
          >
            Edit Credit Note
          </Link>
        )}
        <button
          onClick={() => {
            showToast('E-Invoice integration is not configured.', 'info');
          }}
          className="px-4 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-705 transition-colors text-xs"
        >
          Generate E-Invoice
        </button>
        <button
          onClick={handlePrint}
          className="px-4 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-705 transition-colors text-xs"
        >
          Download PDF
        </button>
        <button
          onClick={() => setIsShareModalOpen(true)}
          className="px-4 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-705 transition-colors text-xs flex items-center gap-1.5"
        >
          Email / WhatsApp
        </button>

        {/* Dynamic Settlements Actions */}
        {(document.status === 'ISSUED' || document.status === 'PARTIALLY_SETTLED') && (
          <button
            onClick={handleOpenSettleModal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors text-xs flex items-center gap-1.5 shadow-sm"
          >
            Settle Credit
          </button>
        )}

        {/* More dropdown options */}
        <div className="flex gap-2">
          {document.status === 'DRAFT' && (
            <button
              onClick={() => handleStatusChange('ISSUED')}
              className="px-3.5 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-705 transition-colors text-xs"
            >
              Mark Issued
            </button>
          )}
          {document.status !== 'CANCELLED' && (
            <button
              onClick={() => handleStatusChange('CANCELLED')}
              className="px-3.5 py-2.5 border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold rounded-xl transition-colors text-xs"
            >
              Cancel Credit Note
            </button>
          )}
          <button
            onClick={handleDuplicateDocument}
            className="px-3.5 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-705 transition-colors text-xs"
          >
            Duplicate
          </button>
          {document.status === 'DRAFT' && (
            <button
              onClick={handleDeleteDocument}
              className="px-3.5 py-2.5 border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold rounded-xl transition-colors text-xs"
            >
              Delete Draft
            </button>
          )}
        </div>
      </div>

      {/* Credit Note Summary */}
      <div className="card-panel p-5 rounded-2xl bg-white border border-slate-200 text-xs print:hidden">
        <h3 className="font-bold text-slate-900 pb-2 border-b border-slate-100 uppercase tracking-wider text-[10px]">
          Credit Note Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-3 text-slate-650">
          <div>
            <span className="block font-semibold text-slate-400">Client:</span>
            <span className="font-bold text-slate-800">{document.clientSnapshot?.businessName || document.clientSnapshot?.clientName}</span>
          </div>
          <div>
            <span className="block font-semibold text-slate-400">CN Date:</span>
            <span>{new Date(document.issueDate).toLocaleDateString('en-IN')}</span>
          </div>
          <div>
            <span className="block font-semibold text-slate-400">Reason:</span>
            <span className="font-medium text-slate-800">{getReasonLabel(document.reason)}</span>
          </div>
          <div>
            <span className="block font-semibold text-slate-400">Total Value:</span>
            <span className="font-bold text-slate-900">
              ₹{document.grandTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="block font-semibold text-slate-400">Available Credit:</span>
            <span className="font-black text-blue-600">
              ₹{document.availableCreditAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* A4 Screen preview content */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        <div className="xl:col-span-3 space-y-6">
          <div
            ref={printRef}
            className="card-panel p-12 sm:p-16 rounded-2xl bg-white shadow-md border border-slate-250 min-h-[1100px] text-xs leading-relaxed max-w-4A mx-auto"
          >
            {/* Header Billed By */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-8">
              {document.businessSnapshot?.logo && (
                <div className="mb-4">
                  <img src={document.businessSnapshot.logo} alt="Logo" className="w-32 max-h-20 object-contain" />
                </div>
              )}

              <div className="space-y-1 text-slate-600">
                <h2 className="text-lg font-black text-slate-909">{document.businessSnapshot?.businessName}</h2>
                <p>{document.businessSnapshot?.address?.addressLine1}</p>
                <p>{document.businessSnapshot?.address?.city}, {document.businessSnapshot?.address?.state} - {document.businessSnapshot?.address?.pincode}</p>
                {document.businessSnapshot?.gstin && <p><span className="font-bold text-slate-400 uppercase">GSTIN:</span> {document.businessSnapshot.gstin}</p>}
                <p className="text-slate-400">{document.businessSnapshot?.email} | {document.businessSnapshot?.phone}</p>
              </div>
            </div>

            {/* Document numbers details */}
            <div className="grid grid-cols-2 gap-8 border-b border-slate-200 py-6">
              <div>
                <h1 className="text-xl font-black text-slate-900">{document.title || 'Credit Note'}</h1>
                {document.subtitle && <p className="text-xs text-slate-500 font-medium mt-1">{document.subtitle}</p>}

                <div className="mt-4 space-y-1 text-slate-600 font-medium">
                  <p className="font-bold text-slate-900 uppercase text-[9px] tracking-wider mb-1">ISSUED TO</p>
                  <p className="font-bold text-slate-900">{document.clientSnapshot?.businessName || document.clientSnapshot?.clientName}</p>
                  <p>{document.clientSnapshot?.billingAddress?.addressLine1}</p>
                  <p>{document.clientSnapshot?.billingAddress?.city}, {document.clientSnapshot?.billingAddress?.state} - {document.clientSnapshot?.billingAddress?.pincode}</p>
                  {document.clientSnapshot?.gstin && <p><span className="font-bold text-slate-400 uppercase">GSTIN:</span> {document.clientSnapshot.gstin}</p>}
                </div>
              </div>

              <div className="text-right space-y-1 text-slate-600">
                <p><span className="font-bold text-slate-909">Credit Note No:</span> {document.documentNumber}</p>
                <p>
                  <span className="font-bold text-slate-909">CN Date:</span>{' '}
                  {new Date(document.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
                <p><span className="font-bold text-slate-900 font-sans">Reason:</span> {getReasonLabel(document.reason)}</p>
                {document.linkedInvoiceSnapshot?.documentNumber && (
                  <p><span className="font-bold text-slate-900 font-sans">Linked Invoice:</span> {document.linkedInvoiceSnapshot.documentNumber}</p>
                )}
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
                  {document.items?.map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/30">
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {localSettings.advanced.showOriginalItemImages && item.image && (
                            <img src={item.image} alt="item-thumb" className="w-8 h-8 rounded object-contain flex-shrink-0 border border-slate-105 bg-slate-50" />
                          )}
                          <div>
                            <p className="font-semibold text-slate-900">{item.itemName}</p>
                            {item.description && <p className="text-[10px] text-slate-450 mt-0.5 whitespace-pre-wrap">{item.description}</p>}
                          </div>
                        </div>
                      </td>
                      {localSettings.advanced.hsnColumnView !== 'Hide' && <td className="px-3 py-3 font-mono">{item.hsnSac || '—'}</td>}
                      {document.gstConfiguration?.gstEnabled && <td className="px-3 py-3">{item.gstRate || 0}%</td>}
                      <td className="px-3 py-3 text-right">{item.quantity} {item.unit || 'PCS'}</td>
                      <td className="px-3 py-3 text-right">₹{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-900">
                        ₹{(item.quantity * item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-200 pt-6">
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
              </div>

              <div className="space-y-3.5 text-right text-slate-600 max-w-md ml-auto w-full">
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
                <div className="flex justify-between border-t border-slate-205 pt-3 text-sm font-black text-slate-900">
                  <span>Grand Total (INR):</span>
                  <span>₹{document.grandTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                {document.signature?.signatureUrl && (
                  <div className="pt-8 flex flex-col items-end space-y-2">
                    <img src={document.signature.signatureUrl} alt="Signature" className="h-10 object-contain pr-4" />
                    <div className="text-center w-48 border-t border-slate-202 pt-1">
                      <p className="font-bold text-slate-900">{document.signature.label || 'Authorised Signatory'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Right settings sidebar */}
        <div className="xl:col-span-1 space-y-4 print:hidden">
          <div className="card-panel p-5 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-sm font-black text-slate-909 pb-2 border-b border-slate-100">
              Challan settings
            </h3>

            <div className="space-y-2 text-xs text-slate-650">
              {/* Advanced Settings */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'advanced' ? null : 'advanced')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-805 font-bold border-b border-slate-200"
                >
                  <span>1. Advanced Options</span>
                  <span>{expandedSection === 'advanced' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'advanced' && (
                  <div className="p-4 space-y-3 bg-white text-slate-600">
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
                        checked={localSettings.advanced.showSku}
                        onChange={(e) => handleUpdateAdvancedSetting('showSku', e.target.checked)}
                        className="rounded text-blue-600 border-slate-350 w-4 h-4"
                      />
                      <span>Show SKU in Credit Note</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Design Customizations */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'design' ? null : 'design')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-805 font-bold border-b border-slate-200"
                >
                  <span>2. Design Styles</span>
                  <span>{expandedSection === 'design' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'design' && (
                  <div className="p-4 space-y-3 bg-white text-slate-600">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Select Design Template</label>
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
                  </div>
                )}
              </div>

              {/* Audit trail */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'audit' ? null : 'audit')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-805 font-bold border-b border-slate-200"
                >
                  <span>3. Audit Trail</span>
                  <span>{expandedSection === 'audit' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'audit' && (
                  <div className="p-4 bg-white text-slate-600 max-h-48 overflow-y-auto space-y-2 leading-relaxed">
                    {(!document.auditTrail || document.auditTrail.length === 0) ? (
                      <p className="italic text-slate-400">No logs registered.</p>
                    ) : (
                      document.auditTrail.map((log: any, i: number) => (
                        <div key={i} className="border-b border-slate-100 pb-1.5 last:border-b-0 text-[10px]">
                          <p className="font-bold text-slate-900">{log.action}</p>
                          <p className="text-slate-550">{log.description}</p>
                          <p className="text-slate-450">{new Date(log.timestamp).toLocaleString('en-IN')}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Connected documents links */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'links' ? null : 'links')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-805 font-bold border-b border-slate-200"
                >
                  <span>4. Linked Connections</span>
                  <span>{expandedSection === 'links' ? '−' : '+'}</span>
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
            </div>
          </div>
        </div>

      </div>

      {/* Settle Credit modal overlay */}
      {isSettleModalOpen && (
        <Modal
          isOpen={isSettleModalOpen}
          onClose={() => setIsSettleModalOpen(false)}
          title={`Apply Credit: ${document.documentNumber}`}
        >
          <div className="space-y-4 text-xs text-slate-700">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="block text-slate-405 font-semibold">Total Credit Value:</span>
                <span className="text-sm font-bold text-slate-900">₹{document.grandTotal}</span>
              </div>
              <div>
                <span className="block text-slate-400 font-semibold">Available Credit:</span>
                <span className="text-sm font-bold text-blue-600">₹{document.availableCreditAmount ?? document.grandTotal}</span>
              </div>
            </div>

            <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wider">Eligible Unpaid Customer Invoices</span>

            {eligibleInvoices.length === 0 ? (
              <p className="text-slate-450 italic py-2">No eligible unpaid invoices found for this client.</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {eligibleInvoices.map((inv) => {
                  const maxApply = Math.min(inv.balanceDue, document.availableCreditAmount ?? document.grandTotal);
                  return (
                    <div key={inv._id} className="flex justify-between items-center bg-white p-3 border border-slate-200 rounded-xl shadow-xs">
                      <div>
                        <p className="font-bold font-mono text-slate-900">{inv.documentNumber}</p>
                        <p className="text-slate-500 text-[10px]">Due Balance: ₹{inv.balanceDue}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">Credit to Apply:</span>
                        <input
                          type="number"
                          max={maxApply}
                          value={allocations[inv._id] || ''}
                          onChange={(e) => handleAllocationChange(inv._id, parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-24 form-input text-xs text-right bg-white text-slate-900"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSettleModalOpen(false)}
                className="px-4 py-2 border border-slate-350 text-slate-705 font-bold hover:bg-slate-50 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitSettlement}
                disabled={settling}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow disabled:opacity-50"
              >
                {settling ? 'Applying...' : 'Apply Settlements'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Share Proposal Modal */}
      {isShareModalOpen && (
        <Modal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          title="Share Credit Note"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">Recipient Email</label>
              <input
                type="email"
                value={shareForm.recipientEmail}
                onChange={(e) => setShareForm({ ...shareForm, recipientEmail: e.target.value })}
                className="w-full form-input text-xs text-slate-900 bg-white"
              />
            </div>

            <div className="flex justify-between pt-6 border-t border-slate-800">
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
                  className="px-4 py-2 border border-slate-700 text-slate-450 hover:bg-slate-850 hover:text-white rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleShare('email')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow"
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
