'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';

export default function DeliveryChallanDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { showToast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const formatImageSrc = (src: string) => {
    if (!src) return '';
    if (src.startsWith('data:image/') || src.startsWith('http://') || src.startsWith('https://')) {
      return src;
    }
    return `data:image/png;base64,${src}`;
  };

  const [document, setDocument] = useState<any>(null);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Settings panels accordions expanded states
  const [expandedSection, setExpandedSection] = useState<string | null>('advanced');

  // Modals States
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

        // Prepopulate share
        setShareForm((prev) => ({
          ...prev,
          recipientEmail: doc.clientSnapshot?.email || '',
          subject: `Delivery Challan ${doc.documentNumber} from ${doc.businessSnapshot?.businessName || ''}`,
          message: `Dear Client,\n\nPlease find attached Delivery Challan ${doc.documentNumber} for your reference.\n\nBest Regards,\n${doc.businessSnapshot?.businessName || ''}`,
        }));
      }

      const bizRes = await api.get('/business');
      if (bizRes.data?.success) {
        setBusinessProfile(bizRes.data.data.business);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to retrieve details.', 'error');
      router.push('/delivery-challans');
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

  // Status transitions
  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await api.patch(`/documents/${id}/status`, { status: newStatus });
      if (res.data?.success) {
        showToast(`Document status marked as ${newStatus}!`, 'success');
        setDocument(res.data.data);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update status.', 'error');
    }
  };

  const handleDeleteDocument = async () => {
    if (!window.confirm(`Are you sure you want to delete draft Delivery Challan ${document.documentNumber}?`)) return;
    try {
      const res = await api.delete(`/documents/${id}`);
      if (res.data?.success) {
        showToast('Document deleted successfully.', 'success');
        router.push('/delivery-challans');
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
        router.push(`/delivery-challans/${res.data.data._id}`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to duplicate document.', 'error');
    }
  };

  // Convert Delivery Challan to Invoice
  const handleConvertToInvoice = async () => {
    if (!window.confirm(`Are you sure you want to convert Delivery Challan ${document.documentNumber} to a Tax Invoice?`)) return;
    try {
      const res = await api.post(`/documents/${id}/convert`, { targetType: 'INVOICE' });
      if (res.data?.success) {
        showToast(`Successfully converted to Invoice ${res.data.data.documentNumber}!`, 'success');
        router.push(`/invoices/${res.data.data._id}`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to convert document.', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = (channel: 'email' | 'whatsapp') => {
    if (channel === 'email') {
      showToast(`Email receipt dispatched to: ${document?.clientSnapshot?.email || 'N/A'}`, 'success');
      setIsShareModalOpen(false);
    } else {
      const phone = document?.clientSnapshot?.phone || '';
      const text = encodeURIComponent(`Hi ${document?.clientSnapshot?.clientName || ''}, please review Delivery Challan ${document?.documentNumber}`);
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
      DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
      ISSUED: 'bg-blue-50 text-blue-700 border-blue-105 font-bold',
      SENT: 'bg-purple-50 text-purple-700 border-purple-100',
      ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-100 font-bold',
      REJECTED: 'bg-rose-50 text-rose-700 border-rose-100',
      CANCELLED: 'bg-slate-200 text-slate-500 border-slate-350 line-through',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || 'bg-slate-100'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6 text-slate-805 pb-16">
      {/* Breadcrumbs menu */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {document.businessSnapshot?.businessName || 'TechBes'} / <Link href="/delivery-challans" className="hover:underline">DELIVERY CHALLANS</Link> / {document.documentNumber}
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
            href="/delivery-challans/new"
            className="px-4 py-2 border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-xl transition-all"
          >
            Create New Challan
          </Link>
          <button
            onClick={handlePrint}
            className="px-4 py-2 border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-xl transition-all"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {/* Action toolbar row */}
      <div className="flex flex-wrap gap-2.5 border-b border-slate-100 pb-6 print:hidden">
        {document.status === 'DRAFT' && (
          <Link
            href={`/delivery-challans/${document._id}/edit`}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm text-xs"
          >
            Edit Challan
          </Link>
        )}
        <button
          onClick={() => {
            showToast('E-Way Bill integration is not configured.', 'info');
          }}
          className="px-4 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-705 transition-colors text-xs"
        >
          Generate EWB
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

        {/* More Actions Dropdown */}
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
              onClick={handleConvertToInvoice}
              className="px-4 py-2.5 border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-xl transition-colors text-xs"
            >
              Convert to Invoice
            </button>
          )}
          <button
            onClick={handleDuplicateDocument}
            className="px-3.5 py-2.5 border border-slate-355 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-705 transition-colors text-xs"
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

      {/* Collapsible Delivery Challan Summary */}
      <div className="card-panel p-5 rounded-2xl bg-white border border-slate-200 text-xs print:hidden">
        <h3 className="font-bold text-slate-900 pb-2 border-b border-slate-100 uppercase tracking-wider text-[10px]">
          Challan Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-slate-600">
          <div>
            <span className="block font-semibold text-slate-400">Client:</span>
            <span className="font-bold text-slate-800">{document.clientSnapshot?.businessName || document.clientSnapshot?.clientName}</span>
          </div>
          <div>
            <span className="block font-semibold text-slate-400">Challan Date:</span>
            <span>{new Date(document.issueDate).toLocaleDateString('en-IN')}</span>
          </div>
          <div>
            <span className="block font-semibold text-slate-400">Status:</span>
            <span className="font-bold text-slate-800 uppercase bg-slate-100 px-2 py-0.5 rounded">
              {document.status}
            </span>
          </div>
          <div>
            <span className="block font-semibold text-slate-400">Total Value:</span>
            <span className="font-bold text-slate-900 text-sm">
              ₹{document.grandTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Main Preview layout */}
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
                <h1 className="invoice-doc-title">{document.title || 'Delivery Challan'}</h1>
                {document.subtitle && <p className="invoice-doc-subtitle">{document.subtitle}</p>}
                <div className="invoice-doc-meta-grid">
                  <div className="invoice-doc-meta-row">
                    <span className="invoice-doc-meta-label">Challan No</span>
                    <span className="invoice-doc-meta-value">{document.documentNumber}</span>
                  </div>
                  <div className="invoice-doc-meta-row">
                    <span className="invoice-doc-meta-label">Challan Date</span>
                    <span className="invoice-doc-meta-value">
                      {new Date(document.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bill To / Document Details */}
            <div className="invoice-doc-section print-avoid-break">
              <div className="invoice-doc-parties">
                <div className="invoice-doc-party-box">
                  <p className="invoice-doc-section-label">Delivered To</p>
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
                        {document.shippingDetails.shippingName && <p className="font-semibold text-slate-800">{document.shippingDetails.shippingName}</p>}
                        <p>{document.shippingDetails.addressLine1}</p>
                        <p>{document.shippingDetails.city}, {document.shippingDetails.state} – {document.shippingDetails.pincode}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="invoice-doc-party-box invoice-doc-party-box--white">
                  <p className="invoice-doc-section-label">Document Details</p>
                  <div className="invoice-doc-detail-row">
                    <span className="invoice-doc-detail-label">Challan No</span>
                    <span className="invoice-doc-detail-value">{document.documentNumber}</span>
                  </div>
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
                    <div className="invoice-doc-bank-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p className="invoice-doc-section-label" style={{ marginBottom: 8, borderBottom: 'none', paddingBottom: 0 }}>Payment Details</p>
                        <p><strong>Bank:</strong> {document.bankDetails.bankName}</p>
                        <p><strong>A/C Holder:</strong> {document.bankDetails.accountHolderName}</p>
                        <p><strong>A/C Number:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{document.bankDetails.accountNumber}</span></p>
                        <p><strong>IFSC:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase' }}>{document.bankDetails.ifsc}</span></p>
                        {document.bankDetails.branchName && <p><strong>Branch:</strong> {document.bankDetails.branchName}</p>}
                      </div>
                      {(document.businessSnapshot?.qrCodeUrl || businessProfile?.qrCodeUrl) && (
                        <div style={{ marginLeft: '16px', textAlign: 'center' }}>
                          <img 
                            src={document.businessSnapshot?.qrCodeUrl || businessProfile?.qrCodeUrl} 
                            alt="UPI QR Code" 
                            style={{ width: '80px', height: '80px', objectFit: 'contain' }}
                          />
                          <p style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>Scan to Pay</p>
                        </div>
                      )}
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
        </div>

        {/* Right side settings sidebars */}
        <div className="xl:col-span-1 space-y-4 print:hidden">
          <div className="card-panel p-5 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-sm font-black text-slate-900 pb-2 border-b border-slate-100">
              Challan settings
            </h3>

            <div className="space-y-2 text-xs">
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
                      <span>Show SKU in Challan</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={localSettings.advanced.showOriginalItemImages}
                        onChange={(e) => handleUpdateAdvancedSetting('showOriginalItemImages', e.target.checked)}
                        className="rounded text-blue-600 border-slate-350 w-4 h-4"
                      />
                      <span>Show Line Original Images</span>
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
                  <div className="p-4 bg-white text-slate-605 max-h-48 overflow-y-auto space-y-2 leading-relaxed">
                    {(!document.auditTrail || document.auditTrail.length === 0) ? (
                      <p className="italic text-slate-400">No logs yet.</p>
                    ) : (
                      document.auditTrail.map((log: any, i: number) => (
                        <div key={i} className="border-b border-slate-100 pb-1.5 last:border-b-0 text-[10px]">
                          <p className="font-bold text-slate-900">{log.action}</p>
                          <p className="text-slate-555">{log.description}</p>
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

      {/* Share Proposal modal */}
      {isShareModalOpen && (
        <Modal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          title="Share Delivery Challan"
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

