'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/PageHeader';

export default function PaymentReceiptDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { showToast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const formatImageSrc = (src: string) => {
    if (!src) return '';
    if (src.startsWith('data:image/') || src.startsWith('http://') || src.startsWith('https://')) {
      return src;
    }
    return `data:image/png;base64,${src}`;
  };

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

  // Settings sidebars accordions
  const [expandedSection, setExpandedSection] = useState<string | null>('advanced');

  // Modals share
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareForm, setShareForm] = useState({
    recipientEmail: '',
    cc: '',
    subject: '',
    message: '',
  });

  const fetchReceiptDetails = async () => {
    try {
      const res = await api.get(`/payment-receipts/${id}`);
      if (res.data?.success) {
        setReceipt(res.data.data);

        setShareForm({
          recipientEmail: res.data.data.clientSnapshot?.email || '',
          cc: '',
          subject: `Payment Receipt ${res.data.data.receiptNumber} from ${res.data.data.businessSnapshot?.businessName || ''}`,
          message: `Dear Client,\n\nPlease find attached Payment Receipt ${res.data.data.receiptNumber} for your records.\n\nBest Regards,\n${res.data.data.businessSnapshot?.businessName || ''}`,
        });
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to fetch payment receipt details.', 'error');
      router.push('/payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchReceiptDetails();
    }
  }, [id]);

  const handlePrint = () => {
    if (!receipt) return;
    const originalTitle = document.title || window.document.title;
    const docTypeStr = 'PaymentReceipt';
    const cleanDocNum = receipt.receiptNumber.replace(/\s+/g, '-');
    const rawClient = receipt.clientSnapshot?.businessName || receipt.clientSnapshot?.clientName || 'Client';
    const cleanClient = rawClient.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
    
    window.document.title = `${docTypeStr}_${cleanDocNum}_${cleanClient}`;
    window.print();
    setTimeout(() => {
      window.document.title = originalTitle;
    }, 1000);
  };

  const handleCancelReceipt = async () => {
    if (!window.confirm(`Are you sure you want to cancel payment receipt ${receipt.receiptNumber}? Outstanding invoice balances will be restored.`)) return;
    try {
      const res = await api.patch(`/payment-receipts/${id}/status`, { status: 'CANCELLED' });
      if (res.data?.success) {
        showToast('Payment receipt marked as CANCELLED successfully!', 'success');
        setReceipt(res.data.data);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to cancel receipt.', 'error');
    }
  };

  const handleDeleteDraft = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete draft receipt ${receipt.receiptNumber}?`)) return;
    try {
      const res = await api.delete(`/payment-receipts/${id}`);
      if (res.data?.success) {
        showToast('Draft deleted successfully.', 'success');
        router.push('/payments');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete receipt.', 'error');
    }
  };

  const handleShare = () => {
    showToast(`Email receipt proposal sent to: ${shareForm.recipientEmail}`, 'success');
    setIsShareModalOpen(false);
  };

  if (loading) {
    return (
      <div className="card-panel p-16 rounded-xl flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!receipt) return null;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
      FINALIZED: 'bg-emerald-50 text-emerald-700 border-emerald-100 font-bold',
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
      {/* Breadcrumb menu bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {receipt.businessSnapshot?.businessName || 'TechBes'} / <Link href="/payments" className="hover:underline">PAYMENT RECEIPTS</Link> / {receipt.receiptNumber}
          </span>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-xl font-bold text-slate-900">{receipt.receiptNumber}</h1>
            {getStatusBadge(receipt.status)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href="/payments/new"
            className="px-4 py-2 border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-xl transition-all"
          >
            Record New Payment
          </Link>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-805 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {/* Actions toolbar */}
      <div className="flex flex-wrap gap-2.5 border-b border-slate-100 pb-6 print:hidden">
        <button
          onClick={handlePrint}
          className="px-4 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-705 transition-colors text-xs flex items-center gap-1.5"
        >
          Download Receipt PDF
        </button>
        <button
          onClick={() => setIsShareModalOpen(true)}
          className="px-4 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-705 transition-colors text-xs flex items-center gap-1.5"
        >
          Email / WhatsApp Share
        </button>

        {receipt.status === 'FINALIZED' && (
          <button
            onClick={handleCancelReceipt}
            className="px-4 py-2.5 border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold rounded-xl transition-colors text-xs"
          >
            Cancel / Void Receipt
          </button>
        )}

        {receipt.status === 'DRAFT' && (
          <button
            onClick={handleDeleteDraft}
            className="px-4 py-2.5 border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold rounded-xl transition-colors text-xs"
          >
            Delete Draft
          </button>
        )}
      </div>

      {/* Summary card */}
      <div className="card-panel p-5 rounded-2xl bg-white border border-slate-200 text-xs print:hidden">
        <h3 className="font-bold text-slate-900 pb-2 border-b border-slate-100 uppercase tracking-wider text-[10px]">
          Payment Receipt Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-slate-600">
          <div>
            <span className="block font-semibold text-slate-400">Received From:</span>
            <span className="font-bold text-slate-800">{receipt.clientSnapshot?.businessName || receipt.clientSnapshot?.clientName}</span>
          </div>
          <div>
            <span className="block font-semibold text-slate-400">Date:</span>
            <span>{new Date(receipt.receiptDate).toLocaleDateString('en-IN')}</span>
          </div>
          <div>
            <span className="block font-semibold text-slate-400">Total Received:</span>
            <span className="font-bold text-slate-900">₹{receipt.totals?.amountReceived?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div>
            <span className="block font-semibold text-slate-400">Client Advance:</span>
            <span className="font-bold text-emerald-600">₹{receipt.totals?.advancePayment?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* A4 preview grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
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
                {receipt.businessSnapshot?.logo ? (
                  <img
                    src={formatImageSrc(receipt.businessSnapshot.logo)}
                    alt="Logo"
                    className="invoice-doc-logo"
                  />
                ) : (
                  <div className="invoice-doc-logo-placeholder" />
                )}
                <div>
                  <h2 className="invoice-doc-company-name">{receipt.businessSnapshot?.businessName}</h2>
                  <div className="invoice-doc-company-detail">
                    {receipt.businessSnapshot?.address?.addressLine1 && <p>{receipt.businessSnapshot.address.addressLine1}</p>}
                    {receipt.businessSnapshot?.address?.addressLine2 && <p>{receipt.businessSnapshot.address.addressLine2}</p>}
                    <p>
                      {receipt.businessSnapshot?.address?.city}, {receipt.businessSnapshot?.address?.state} – {receipt.businessSnapshot?.address?.pincode}
                    </p>
                    {receipt.businessSnapshot?.gstin && <p><strong>GSTIN:</strong> {receipt.businessSnapshot.gstin}</p>}
                    {receipt.businessSnapshot?.pan && <p><strong>PAN:</strong> {receipt.businessSnapshot.pan}</p>}
                    <p>{receipt.businessSnapshot?.email} &nbsp;|&nbsp; {receipt.businessSnapshot?.phone}</p>
                  </div>
                </div>
              </div>

              <div className="invoice-doc-meta">
                <h1 className="invoice-doc-title">Payment Receipt</h1>
                <div className="invoice-doc-meta-grid">
                  <div className="invoice-doc-meta-row">
                    <span className="invoice-doc-meta-label">Receipt No</span>
                    <span className="invoice-doc-meta-value">{receipt.receiptNumber}</span>
                  </div>
                  <div className="invoice-doc-meta-row">
                    <span className="invoice-doc-meta-label">Receipt Date</span>
                    <span className="invoice-doc-meta-value">
                      {new Date(receipt.receiptDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="invoice-doc-meta-row">
                    <span className="invoice-doc-meta-label">Currency</span>
                    <span className="invoice-doc-meta-value">{receipt.currency}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Received From */}
            <div className="invoice-doc-section print-avoid-break">
              <div className="invoice-doc-parties">
                <div className="invoice-doc-party-box">
                  <p className="invoice-doc-section-label">Received From</p>
                  <p className="invoice-doc-party-name">{receipt.clientSnapshot?.clientName}</p>
                  <div className="invoice-doc-party-detail">
                    {receipt.clientSnapshot?.businessName && <p>{receipt.clientSnapshot.businessName}</p>}
                    <p>{receipt.clientSnapshot?.billingAddress?.addressLine1}</p>
                    <p>
                      {receipt.clientSnapshot?.billingAddress?.city}, {receipt.clientSnapshot?.billingAddress?.state} – {receipt.clientSnapshot?.billingAddress?.pincode}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Records Table */}
            <div className="invoice-doc-section">
              <p className="invoice-doc-section-label" style={{ marginBottom: 12 }}>Payment Breakdown</p>
              <div className="invoice-doc-table-wrap">
                <table className={`invoice-doc-table ${localSettings.design.tableStyle === 'Striped' ? 'striped' : ''}`}>
                  <thead>
                    <tr>
                      <th>Payment Method</th>
                      <th>Reference ID</th>
                      <th className="text-right">Amount Received</th>
                      <th className="text-right">TDS Withheld</th>
                      <th className="text-right">Charges</th>
                      <th className="text-right">Settleable Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.paymentRecords?.map((rec: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, textTransform: 'uppercase' }}>{rec.paymentMethod}</td>
                        <td style={{ fontFamily: 'monospace' }}>{rec.referenceId || '—'}</td>
                        <td style={{ textAlign: 'right' }}>₹{rec.amountReceived?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right' }}>₹{rec.tdsWithheld?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right' }}>₹{rec.transactionCharge?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{rec.settleableAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invoice Settlements */}
            {receipt.settlements?.length > 0 && (
              <div className="invoice-doc-section">
                <p className="invoice-doc-section-label" style={{ marginBottom: 12 }}>Invoice Settlements Allocations</p>
                <div className="invoice-doc-table-wrap">
                  <table className={`invoice-doc-table ${localSettings.design.tableStyle === 'Striped' ? 'striped' : ''}`}>
                    <thead>
                      <tr>
                        <th>Invoice Number</th>
                        <th className="text-right">Invoice Total</th>
                        <th className="text-right">Outstanding Before</th>
                        <th className="text-right">Settlement Amount</th>
                        <th className="text-right">Outstanding After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipt.settlements.map((s: any, idx: number) => (
                        <tr key={idx}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.invoiceNumberSnapshot}</td>
                          <td style={{ textAlign: 'right' }}>₹{s.invoiceTotalSnapshot?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right' }}>₹{s.outstandingBefore?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--invoice-accent, #10b981)' }}>₹{s.settlementAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right' }}>₹{s.outstandingAfter?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="invoice-doc-section totals-section print-avoid-break">
              <div className="invoice-doc-totals-grid">
                <div>
                  {receipt.notes && (
                    <div className="invoice-doc-notes-box">
                      <p className="invoice-doc-section-label" style={{ marginBottom: 8 }}>Remarks / Notes</p>
                      <p className="invoice-doc-terms-text">{receipt.notes}</p>
                    </div>
                  )}
                  {receipt.contactDetails?.email && (
                    <div className="invoice-doc-notes-box" style={{ marginTop: 12 }}>
                      <p className="invoice-doc-section-label" style={{ marginBottom: 8 }}>Contact details</p>
                      <p className="invoice-doc-terms-text">{receipt.contactDetails.email} | {receipt.contactDetails.phoneCountryCode} {receipt.contactDetails.phoneNumber}</p>
                    </div>
                  )}
                </div>

                <div className="invoice-doc-totals-panel">
                  <div className="invoice-doc-totals-rows">
                    <div className="invoice-doc-total-row">
                      <span>Gross Available pool</span>
                      <span>₹{receipt.totals?.availableForSettlement?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="invoice-doc-total-row">
                      <span>Allocated to Invoices</span>
                      <span>₹{receipt.totals?.allocatedToInvoices?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div className="invoice-doc-grand-total">
                    <span className="invoice-doc-grand-total-label">Advance / Unapplied balance</span>
                    <span className="invoice-doc-grand-total-value" style={{ color: 'var(--invoice-accent, #10b981)' }}>₹{receipt.totals?.advancePayment?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="invoice-doc-footer print-avoid-break">
              <div className="invoice-doc-footer-grid">
                <div />
                {receipt.signature?.signatureUrl && (
                  <div className="invoice-doc-signature">
                    <img src={formatImageSrc(receipt.signature.signatureUrl)} alt="Authorized Signature" />
                    <div className="invoice-doc-signature-line">
                      <p className="invoice-doc-signature-name">{receipt.signature.label || 'Authorized Signatory'}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="invoice-doc-page-footer">
                <span>{receipt.businessSnapshot?.website || 'www.techbes.com'}</span>
                <span className="page-number" />
              </div>
            </div>
          </div>
        </div>

        {/* Right side settings side panel */}
        <div className="xl:col-span-1 space-y-4 print:hidden">
          <div className="card-panel p-5 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-sm font-black text-slate-900 pb-2 border-b border-slate-100">
              Receipt Information
            </h3>

            <div className="space-y-2 text-xs">
              {/* Audit trail */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'audit' ? null : 'audit')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-805 font-bold border-b border-slate-200"
                >
                  <span>1. Audit Timeline</span>
                  <span>{expandedSection === 'audit' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'audit' && (
                  <div className="p-4 bg-white text-slate-605 max-h-48 overflow-y-auto space-y-2 leading-relaxed">
                    {(!receipt.auditTrail || receipt.auditTrail.length === 0) ? (
                      <p className="italic text-slate-400">No logs yet.</p>
                    ) : (
                      receipt.auditTrail.map((log: any, i: number) => (
                        <div key={i} className="border-b border-slate-100 pb-1.5 last:border-b-0 text-[10px]">
                          <p className="font-bold text-slate-900">{log.action}</p>
                          {log.description && <p className="text-slate-550">{log.description}</p>}
                          <p className="text-slate-450">{new Date(log.timestamp).toLocaleString('en-IN')}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Linked Documents */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'links' ? null : 'links')}
                  className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-2.5 flex items-center justify-between text-slate-805 font-bold border-b border-slate-200"
                >
                  <span>2. Settled Connections</span>
                  <span>{expandedSection === 'links' ? '−' : '+'}</span>
                </button>
                {expandedSection === 'links' && (
                  <div className="p-4 bg-white text-slate-605 space-y-2">
                    {(!receipt.linkedDocuments || receipt.linkedDocuments.length === 0) ? (
                      <p className="italic text-slate-400">No connections exist.</p>
                    ) : (
                      receipt.linkedDocuments.map((link: any, i: number) => (
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
          title="Share Payment Receipt"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Recipient Email</label>
              <input
                type="email"
                value={shareForm.recipientEmail}
                onChange={(e) => setShareForm({ ...shareForm, recipientEmail: e.target.value })}
                className="w-full form-input text-xs text-slate-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Subject</label>
              <input
                type="text"
                value={shareForm.subject}
                onChange={(e) => setShareForm({ ...shareForm, subject: e.target.value })}
                className="w-full form-input text-xs text-slate-900 bg-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-6 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-2 border border-slate-700 text-slate-400 hover:bg-slate-850 hover:text-white rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow"
              >
                Send Email Receipt
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


