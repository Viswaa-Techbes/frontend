'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/PageHeader';

interface ClientType {
  _id: string;
  clientName: string;
  businessName?: string;
  email?: string;
  phone?: string;
  billingAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
}

interface InvoiceType {
  _id: string;
  documentNumber: string;
  issueDate: string;
  validTill: string;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  settlementAmount?: number;
}

interface PaymentRecordType {
  id: string;
  paymentMethod: string;
  paymentAccountId: string;
  paymentAccountSnapshot?: any;
  paymentLedgerId?: string;
  amountReceived: number;
  tdsPercentage: number;
  tdsWithheld: number;
  transactionCharge: number;
  referenceId?: string;
  notes?: string;
}

export default function NewPaymentReceiptPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [activeStep, setActiveStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  // Business profile currency overrides
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  // Step 1: Select Client Form
  const [receiptNumber, setReceiptNumber] = useState('Auto-generated');
  const [selectedClient, setSelectedClient] = useState<ClientType | null>(null);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().substring(0, 10));
  const [currency, setCurrency] = useState('INR');
  const [numberFormat, setNumberFormat] = useState('en-IN');

  // Client search states
  const [clients, setClients] = useState<ClientType[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Step 2: Payment Records List
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecordType[]>([]);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  // Record modal inputs
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [depositedTo, setDepositedTo] = useState('');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [tdsPercentage, setTdsPercentage] = useState<number>(0);
  const [tdsWithheld, setTdsWithheld] = useState<number>(0);
  const [transactionCharge, setTransactionCharge] = useState<number>(0);
  const [referenceId, setReferenceId] = useState('');
  const [recordNotes, setRecordNotes] = useState('');
  const [showRefInput, setShowRefInput] = useState(false);
  const [showNotesInput, setShowNotesInput] = useState(false);

  // Step 3: Settle Invoices List
  const [invoices, setInvoices] = useState<InvoiceType[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Optional extra sections
  const [showNotesSection, setShowNotesSection] = useState(false);
  const [notesText, setNotesText] = useState('');

  const [showContactSection, setShowContactSection] = useState(false);
  const [contactDetails, setContactDetails] = useState({
    email: '',
    phoneCountryCode: '+91',
    phoneNumber: '',
  });

  const [showAdditionalInfoSection, setShowAdditionalInfoSection] = useState(false);
  const [customFields, setCustomFields] = useState<{ label: string; value: string }[]>([]);

  const [showSignatureSection, setShowSignatureSection] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState('');
  const [signatureLabel, setSignatureLabel] = useState('Authorised Signatory');
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [attachments, setAttachments] = useState<{ name: string; url: string; mimeType: string; size: number }[]>([]);

  // Fetch init configuration (next receipt number, business details)
  const loadInitData = async () => {
    try {
      const numRes = await api.get('/payment-receipts/next-number');
      if (numRes.data?.success) {
        setReceiptNumber(numRes.data.data);
      }

      const bizRes = await api.get('/business');
      if (bizRes.data?.success) {
        const biz = bizRes.data.data.business;
        setBusinessProfile(biz);
        setBankAccounts(biz.bankAccounts || []);
        if (biz.bankAccounts?.length > 0) {
          setDepositedTo(biz.bankAccounts[0]._id);
        }
        setContactDetails({
          email: biz.email || '',
          phoneCountryCode: '+91',
          phoneNumber: biz.phone || '',
        });
      }

      const clientsRes = await api.get('/clients?limit=100');
      if (clientsRes.data?.success) {
        setClients(clientsRes.data.data.clients || []);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to initialize details.', 'error');
    }
  };

  useEffect(() => {
    loadInitData();
  }, []);

  // Search clients callback
  useEffect(() => {
    if (clientSearch.trim().length > 0) {
      const filtered = clients.filter((c) =>
        c.clientName.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.businessName?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.email?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.phone?.includes(clientSearch)
      );
      setClients(filtered);
    } else {
      api.get('/clients?limit=100').then((res) => {
        if (res.data?.success) {
          setClients(res.data.data.clients || []);
        }
      });
    }
  }, [clientSearch]);

  // Load unpaid invoices when client is selected
  useEffect(() => {
    if (selectedClient) {
      setLoadingInvoices(true);
      api.get(`/payment-receipts/unpaid-invoices?clientId=${selectedClient._id}`)
        .then((res) => {
          if (res.data?.success) {
            setInvoices(
              (res.data.data || []).map((inv: any) => ({
                ...inv,
                settlementAmount: 0,
              }))
            );
          }
        })
        .catch((err) => {
          showToast('Failed to load eligible unpaid client invoices.', 'error');
        })
        .finally(() => {
          setLoadingInvoices(false);
        });
    } else {
      setInvoices([]);
    }
  }, [selectedClient]);

  // Calculation helpers
  const handleAmountChange = (val: number) => {
    setAmountReceived(val);
    const derivedTds = val * (tdsPercentage / 100);
    setTdsWithheld(derivedTds);
  };

  const handleTdsPercentageChange = (val: number) => {
    setTdsPercentage(val);
    const derivedTds = amountReceived * (val / 100);
    setTdsWithheld(derivedTds);
  };

  const handleTdsWithheldChange = (val: number) => {
    setTdsWithheld(val);
    if (amountReceived > 0) {
      const pct = (val / amountReceived) * 100;
      setTdsPercentage(pct);
    }
  };

  // Add/Save record trigger
  const handleSavePaymentRecord = () => {
    if (amountReceived <= 0) {
      showToast('Amount received must be greater than zero.', 'warning');
      return;
    }

    const selectedAcc = bankAccounts.find((a) => a._id === depositedTo);

    const record: PaymentRecordType = {
      id: editingRecordId || Math.random().toString(36).substring(7),
      paymentMethod,
      paymentAccountId: depositedTo,
      paymentAccountSnapshot: selectedAcc || { bankName: 'Cash Account' },
      amountReceived,
      tdsPercentage,
      tdsWithheld,
      transactionCharge,
      referenceId: referenceId || undefined,
      notes: recordNotes || undefined,
    };

    if (editingRecordId) {
      setPaymentRecords(paymentRecords.map((r) => (r.id === editingRecordId ? record : r)));
    } else {
      setPaymentRecords([...paymentRecords, record]);
    }

    // Reset fields
    setEditingRecordId(null);
    setAmountReceived(0);
    setTdsPercentage(0);
    setTdsWithheld(0);
    setTransactionCharge(0);
    setReferenceId('');
    setRecordNotes('');
    setIsRecordModalOpen(false);
    showToast('Payment record added to table.', 'success');
  };

  const handleDeleteRecord = (id: string) => {
    setPaymentRecords(paymentRecords.filter((r) => r.id !== id));
  };

  const handleEditRecord = (rec: PaymentRecordType) => {
    setEditingRecordId(rec.id);
    setPaymentMethod(rec.paymentMethod);
    setDepositedTo(rec.paymentAccountId);
    setAmountReceived(rec.amountReceived);
    setTdsPercentage(rec.tdsPercentage);
    setTdsWithheld(rec.tdsWithheld);
    setTransactionCharge(rec.transactionCharge);
    setReferenceId(rec.referenceId || '');
    setRecordNotes(rec.notes || '');
    setShowRefInput(!!rec.referenceId);
    setShowNotesInput(!!rec.notes);
    setIsRecordModalOpen(true);
  };

  // Derived Totals
  const totalAmountReceived = paymentRecords.reduce((sum, r) => sum + r.amountReceived, 0);
  const totalTdsWithheld = paymentRecords.reduce((sum, r) => sum + r.tdsWithheld, 0);
  const totalTransactionCharges = paymentRecords.reduce((sum, r) => sum + r.transactionCharge, 0);
  const totalAvailableForSettlement = totalAmountReceived + totalTdsWithheld;

  const totalAllocated = invoices.reduce((sum, inv) => sum + (inv.settlementAmount || 0), 0);
  const remainingAdvance = Math.max(0, totalAvailableForSettlement - totalAllocated);

  // Auto Allocate logic (oldest due first)
  const handleAutoAllocate = () => {
    let pool = totalAvailableForSettlement;
    const sorted = [...invoices].sort((a, b) => {
      const aDue = new Date(a.validTill || a.issueDate).getTime();
      const bDue = new Date(b.validTill || b.issueDate).getTime();
      return aDue - bDue;
    });

    const updated = invoices.map((inv) => {
      const isTarget = sorted.find((s) => s._id === inv._id);
      if (pool <= 0) {
        return { ...inv, settlementAmount: 0 };
      }
      const maxAlloc = Math.min(pool, inv.balanceDue);
      pool -= maxAlloc;
      return { ...inv, settlementAmount: maxAlloc };
    });

    setInvoices(updated);
    showToast('Auto-allocated available balance across outstanding invoices.', 'info');
  };

  // Manual allocation input helper
  const handleSettlementChange = (id: string, value: number) => {
    const inv = invoices.find((i) => i._id === id);
    if (!inv) return;

    if (value > inv.balanceDue) {
      showToast(`Cannot allocate more than invoice outstanding balance of ₹${inv.balanceDue.toLocaleString('en-IN')}`, 'warning');
      return;
    }

    const currentAllocatedWithoutThis = invoices
      .filter((i) => i._id !== id)
      .reduce((sum, i) => sum + (i.settlementAmount || 0), 0);

    if (currentAllocatedWithoutThis + value > totalAvailableForSettlement) {
      showToast('Allocation exceeds total available amount for settlement.', 'warning');
      return;
    }

    setInvoices(
      invoices.map((i) => (i._id === id ? { ...i, settlementAmount: value } : i))
    );
  };

  // Signature canvas handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureUrl('');
  };

  const useCanvasSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureUrl(dataUrl);
    showToast('Signature captured successfully.', 'success');
  };

  // Document attachments file handler
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (attachments.length >= 3) {
      showToast('Maximum 3 attachments are allowed per document.', 'error');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      showToast('Attachment file size must be less than 3MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachments([
        ...attachments,
        {
          name: file.name,
          url: reader.result as string,
          mimeType: file.type,
          size: file.size,
        },
      ]);
      showToast('File uploaded successfully.', 'success');
    };
    reader.readAsDataURL(file);
  };

  // Master Save Submit Form
  const handleSubmitReceipt = async (targetStatus: 'DRAFT' | 'FINALIZED', andCreateNew = false) => {
    if (!selectedClient) {
      showToast('Please select a client.', 'warning');
      return;
    }
    if (paymentRecords.length === 0) {
      showToast('At least one payment record entry is required.', 'warning');
      return;
    }

    setLoading(true);

    const payload = {
      receiptNumber,
      clientId: selectedClient._id,
      receiptDate,
      currency,
      numberFormat,
      status: targetStatus,
      paymentRecords: paymentRecords.map((r) => ({
        paymentMethod: r.paymentMethod,
        paymentAccountId: r.paymentAccountId,
        amountReceived: r.amountReceived,
        tdsPercentage: r.tdsPercentage,
        tdsWithheld: r.tdsWithheld,
        transactionCharge: r.transactionCharge,
        referenceId: r.referenceId,
        notes: r.notes,
      })),
      settlements: invoices
        .filter((inv) => (inv.settlementAmount || 0) > 0)
        .map((inv) => ({
          invoiceId: inv._id,
          settlementAmount: inv.settlementAmount,
        })),
      notes: showNotesSection ? notesText : undefined,
      contactDetails: showContactSection ? contactDetails : undefined,
      additionalInfo: showAdditionalInfoSection ? { customFields } : undefined,
      signature: showSignatureSection ? { signatureUrl, label: signatureLabel } : undefined,
      attachments: attachments.map((a) => ({
        name: a.name,
        url: a.url,
        mimeType: a.mimeType,
        size: a.size,
      })),
    };

    try {
      const res = await api.post('/payment-receipts', payload);
      if (res.data?.success) {
        showToast(
          targetStatus === 'DRAFT'
            ? 'Payment receipt draft saved successfully!'
            : 'Payment receipt finalized and saved!',
          'success'
        );

        if (andCreateNew) {
          // Reset editor state
          setSelectedClient(null);
          setPaymentRecords([]);
          setInvoices([]);
          setNotesText('');
          setSignatureUrl('');
          setAttachments([]);
          setCustomFields([]);
          setActiveStep(1);
          loadInitData();
        } else {
          router.push(`/payments/${res.data.data._id}`);
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save receipt.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-800 pb-16">
      <div className="border-b border-slate-200 pb-4">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          Dashboard / <Link href="/payments" className="hover:underline">Payment Receipts</Link> / New Receipt
        </span>
        <h1 className="text-xl font-bold text-slate-900 mt-1">New Payment Receipt</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Accordions step panel */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Step 1: Select Client */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
            <button
              onClick={() => setActiveStep(1)}
              className={`w-full px-5 py-4 flex items-center justify-between font-bold text-left text-xs uppercase tracking-wider transition-colors ${
                activeStep === 1 ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>1. Select Client & Receipt Details</span>
              <span>{activeStep === 1 ? '▼' : '▶'}</span>
            </button>
            {activeStep === 1 && (
              <div className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Receipt Number *</label>
                    <input
                      type="text"
                      value={receiptNumber}
                      disabled
                      className="w-full form-input bg-slate-50 text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Receipt Date *</label>
                    <input
                      type="date"
                      value={receiptDate}
                      onChange={(e) => setReceiptDate(e.target.value)}
                      className="w-full form-input text-slate-905 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Currency *</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full form-input text-slate-905 bg-white"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Received From *</label>
                  {selectedClient ? (
                    <div className="p-4 border border-blue-200 bg-blue-50/20 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-900">{selectedClient.clientName}</p>
                        {selectedClient.businessName && <p className="text-slate-500">{selectedClient.businessName}</p>}
                        <p className="text-slate-400 mt-1">{selectedClient.email} | {selectedClient.phone}</p>
                      </div>
                      <button
                        onClick={() => setSelectedClient(null)}
                        className="text-xs text-rose-600 font-bold hover:underline"
                      >
                        Change Client
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={clientSearch}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setShowClientDropdown(true);
                        }}
                        onFocus={() => setShowClientDropdown(true)}
                        placeholder="Search by client name, email, or phone..."
                        className="w-full form-input bg-white text-slate-905"
                      />
                      {showClientDropdown && clients.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                          {clients.map((c) => (
                            <button
                              key={c._id}
                              type="button"
                              onClick={() => {
                                setSelectedClient(c);
                                setShowClientDropdown(false);
                                setClientSearch('');
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-slate-50 text-slate-800 border-b border-slate-100 last:border-0"
                            >
                              <p className="font-bold">{c.clientName}</p>
                              {c.businessName && <p className="text-slate-500 text-[10px]">{c.businessName}</p>}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      if (!selectedClient) {
                        showToast('Please select a client to continue.', 'warning');
                        return;
                      }
                      setActiveStep(2);
                    }}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all"
                  >
                    Continue to Payment Records
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Add Payment Records */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
            <button
              disabled={!selectedClient}
              onClick={() => setActiveStep(2)}
              className={`w-full px-5 py-4 flex items-center justify-between font-bold text-left text-xs uppercase tracking-wider transition-colors ${
                activeStep === 2 ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-50'
              }`}
            >
              <span>2. Add Payment Records</span>
              <span>{activeStep === 2 ? '▼' : '▶'}</span>
            </button>
            {activeStep === 2 && (
              <div className="p-6 space-y-4 text-xs">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 text-xs">Payment Entries</h3>
                  <button
                    onClick={() => {
                      setEditingRecordId(null);
                      setIsRecordModalOpen(true);
                    }}
                    className="px-4 py-2 border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-xl"
                  >
                    + Add Entry
                  </button>
                </div>

                {paymentRecords.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400">
                    No payment records added yet. Add at least one entry to proceed.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <th className="px-4 py-2">Account / Method</th>
                          <th className="px-4 py-2 text-right">Amount Received</th>
                          <th className="px-4 py-2 text-right">TDS Withheld</th>
                          <th className="px-4 py-2 text-right">Charges</th>
                          <th className="px-4 py-2 text-right">Settleable Amount</th>
                          <th className="px-4 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paymentRecords.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-800">{r.paymentAccountSnapshot?.bankName || 'Cash Account'}</p>
                              <span className="font-mono text-[9px] uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{r.paymentMethod}</span>
                            </td>
                            <td className="px-4 py-3 text-right">₹{r.amountReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-right text-rose-600">₹{r.tdsWithheld.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({r.tdsPercentage.toFixed(1)}%)</td>
                            <td className="px-4 py-3 text-right text-slate-500">₹{r.transactionCharge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">₹{(r.amountReceived + r.tdsWithheld).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => handleEditRecord(r)}
                                  className="text-blue-600 hover:underline font-bold"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteRecord(r.id)}
                                  className="text-rose-600 hover:underline font-bold"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Subtotals info */}
                {paymentRecords.length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-right max-w-sm ml-auto text-[11px] text-slate-600">
                    <div className="flex justify-between">
                      <span>Total Amount Received:</span>
                      <span className="font-bold text-slate-900">₹{totalAmountReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-rose-600">
                      <span>Total TDS Applied:</span>
                      <span>+ ₹{totalTdsWithheld.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Transaction Charges:</span>
                      <span>- ₹{totalTransactionCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                      <span>Total Available for Settlement:</span>
                      <span>₹{totalAvailableForSettlement.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      if (paymentRecords.length === 0) {
                        showToast('Please add at least one payment record.', 'warning');
                        return;
                      }
                      setActiveStep(3);
                    }}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all"
                  >
                    Continue to Invoice Settlement
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Settle Unpaid Invoices */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
            <button
              disabled={paymentRecords.length === 0}
              onClick={() => setActiveStep(3)}
              className={`w-full px-5 py-4 flex items-center justify-between font-bold text-left text-xs uppercase tracking-wider transition-colors ${
                activeStep === 3 ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-50'
              }`}
            >
              <span>3. Settle Unpaid Invoices</span>
              <span>{activeStep === 3 ? '▼' : '▶'}</span>
            </button>
            {activeStep === 3 && (
              <div className="p-6 space-y-4 text-xs">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs">Outstanding Invoices</h3>
                    <p className="text-[10px] text-slate-400">Allocate payments from the available pool of ₹{totalAvailableForSettlement.toLocaleString('en-IN')}</p>
                  </div>
                  {invoices.length > 0 && (
                    <button
                      onClick={handleAutoAllocate}
                      className="px-4 py-2 bg-slate-805 hover:bg-slate-900 text-white font-bold rounded-xl"
                    >
                      Auto Allocate (FIFO)
                    </button>
                  )}
                </div>

                {loadingInvoices ? (
                  <div className="flex justify-center p-8">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-250 p-4 rounded-xl text-amber-800 space-y-1">
                    <p className="font-bold">No unpaid invoices found</p>
                    <p>There are no unpaid invoices against this client. This payment will be recorded as advance payment.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <th className="px-4 py-2">Invoice Number</th>
                          <th className="px-4 py-2 text-right">Invoice Total</th>
                          <th className="px-4 py-2 text-right w-40">Amount Received</th>
                          <th className="px-4 py-2 text-right">Remaining Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoices.map((inv) => (
                          <tr key={inv._id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-900 font-mono">{inv.documentNumber}</p>
                              <span className="text-[10px] text-slate-450">Issue: {new Date(inv.issueDate).toLocaleDateString('en-IN')}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">₹{inv.grandTotal.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end items-center gap-1.5">
                                <span className="text-slate-400">₹</span>
                                <input
                                  type="number"
                                  value={inv.settlementAmount || ''}
                                  onChange={(e) => handleSettlementChange(inv._id, parseFloat(e.target.value) || 0)}
                                  placeholder="0.00"
                                  className="w-28 text-right form-input text-xs"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-amber-600 font-bold">
                              ₹{Math.max(0, inv.balanceDue - (inv.settlementAmount || 0)).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Settle Summaries */}
                <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-right max-w-sm ml-auto text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span>Available Pool:</span>
                    <span className="font-bold text-slate-900">₹{totalAvailableForSettlement.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>Allocated to Invoices:</span>
                    <span>₹{totalAllocated.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-emerald-600">
                    <span>Remaining client advance:</span>
                    <span>₹{remainingAdvance.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Optional Sections Menu Bar */}
          <div className="card-panel p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => setShowNotesSection(!showNotesSection)}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                showNotesSection ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-350 text-slate-700'
              }`}
            >
              {showNotesSection ? '✓ Notes Added' : '+ Add Notes'}
            </button>
            <button
              onClick={() => setShowContactSection(!showContactSection)}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                showContactSection ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-350 text-slate-700'
              }`}
            >
              {showContactSection ? '✓ Contact Added' : '+ Add Contact Details'}
            </button>
            <button
              onClick={() => setShowAdditionalInfoSection(!showAdditionalInfoSection)}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                showAdditionalInfoSection ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-350 text-slate-700'
              }`}
            >
              {showAdditionalInfoSection ? '✓ Custom Fields Added' : '+ Add Additional Info'}
            </button>
            <button
              onClick={() => setShowSignatureSection(!showSignatureSection)}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                showSignatureSection ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-355 text-slate-700'
              }`}
            >
              {showSignatureSection ? '✓ Signature Added' : '+ Add Signature'}
            </button>
          </div>

          {/* Optional sections forms */}
          {showNotesSection && (
            <div className="card-panel p-6 rounded-xl bg-white border border-slate-200 space-y-2 text-xs">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Additional Notes</h3>
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="Add terms, remarks, or specific instructions here..."
                rows={3}
                className="w-full form-input text-xs bg-white text-slate-900"
              />
            </div>
          )}

          {showContactSection && (
            <div className="card-panel p-6 rounded-xl bg-white border border-slate-200 space-y-3 text-xs">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Your Contact Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={contactDetails.email}
                    onChange={(e) => setContactDetails({ ...contactDetails, email: e.target.value })}
                    className="w-full form-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Phone Number</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={contactDetails.phoneCountryCode}
                      onChange={(e) => setContactDetails({ ...contactDetails, phoneCountryCode: e.target.value })}
                      className="w-16 form-input text-xs text-center"
                    />
                    <input
                      type="text"
                      value={contactDetails.phoneNumber}
                      onChange={(e) => setContactDetails({ ...contactDetails, phoneNumber: e.target.value })}
                      className="w-full form-input text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {showAdditionalInfoSection && (
            <div className="card-panel p-6 rounded-xl bg-white border border-slate-200 space-y-3 text-xs">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Additional Info</h3>
              <div className="space-y-2">
                {customFields.map((f, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <input
                      type="text"
                      value={f.label}
                      onChange={(e) => {
                        const updated = [...customFields];
                        updated[i].label = e.target.value;
                        setCustomFields(updated);
                      }}
                      placeholder="Label (e.g. Salesperson)"
                      className="w-1/3 form-input text-xs"
                    />
                    <input
                      type="text"
                      value={f.value}
                      onChange={(e) => {
                        const updated = [...customFields];
                        updated[i].value = e.target.value;
                        setCustomFields(updated);
                      }}
                      placeholder="Value"
                      className="w-1/2 form-input text-xs"
                    />
                    <button
                      onClick={() => setCustomFields(customFields.filter((_, idx) => idx !== i))}
                      className="text-rose-600 font-bold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setCustomFields([...customFields, { label: '', value: '' }])}
                  className="text-blue-600 font-bold hover:underline"
                >
                  + Add Custom Field
                </button>
              </div>
            </div>
          )}

          {showSignatureSection && (
            <div className="card-panel p-6 rounded-xl bg-white border border-slate-200 space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Authorized Signature</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-2">Draw Signature Canvas</label>
                  <div className="border border-slate-300 rounded-xl bg-slate-50 overflow-hidden relative">
                    <canvas
                      ref={signatureCanvasRef}
                      width={300}
                      height={120}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      className="w-full cursor-crosshair bg-slate-50"
                    />
                    <div className="absolute bottom-2 right-2 flex gap-2">
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-350 text-[10px] font-bold rounded shadow-sm text-slate-705"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={useCanvasSignature}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded shadow-sm"
                      >
                        Use Signature
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Signature Preview</label>
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 h-24 flex items-center justify-center">
                      {signatureUrl ? (
                        <img src={signatureUrl} alt="Signature preview" className="max-h-full object-contain" />
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">No signature captured</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Signature Label</label>
                    <input
                      type="text"
                      value={signatureLabel}
                      onChange={(e) => setSignatureLabel(e.target.value)}
                      className="w-full form-input text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Master Actions footer bar */}
          <div className="flex justify-between items-center border-t border-slate-200 pt-6">
            <button
              onClick={() => handleSubmitReceipt('DRAFT')}
              disabled={loading}
              className="px-5 py-2.5 border border-slate-355 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-705 transition-colors disabled:opacity-50 text-xs"
            >
              Save as Draft
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => handleSubmitReceipt('FINALIZED', true)}
                disabled={loading}
                className="px-5 py-2.5 border border-slate-355 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-705 transition-colors disabled:opacity-50 text-xs"
              >
                Save & Create New
              </button>
              <button
                onClick={() => handleSubmitReceipt('FINALIZED')}
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-sm disabled:opacity-50 text-xs"
              >
                {loading ? <LoadingSpinner size="xs" /> : 'Finalize & Continue'}
              </button>
            </div>
          </div>

        </div>

        {/* Right side help widget */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card-panel p-5 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-4 text-xs">
            <h3 className="font-bold text-slate-900 pb-2 border-b border-slate-100">Quick Totals Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Entries:</span>
                <span className="font-bold text-slate-800">{paymentRecords.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pool Available:</span>
                <span className="font-bold text-slate-800">₹{totalAvailableForSettlement.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-blue-600">
                <span>Allocated Invoices:</span>
                <span>₹{totalAllocated.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-600 border-t border-slate-100 pt-2">
                <span>Client Advance:</span>
                <span>₹{remainingAdvance.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Record payment received modal */}
      {isRecordModalOpen && (
        <Modal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          title={editingRecordId ? 'Edit Payment Record' : 'Record Payment Received'}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full form-input text-xs"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CARD">Card</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="IMPS">IMPS</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Deposited To *</label>
                {paymentMethod === 'CASH' ? (
                  <select
                    value={depositedTo}
                    onChange={(e) => setDepositedTo(e.target.value)}
                    className="w-full form-input text-xs"
                  >
                    <option value="CASH_ACC">Cash Account</option>
                  </select>
                ) : bankAccounts.length === 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-rose-600 font-bold">No payment account configured.</p>
                    <Link
                      href="/settings"
                      className="text-[10px] font-bold text-blue-600 hover:underline block"
                    >
                      Configure Payment Account
                    </Link>
                  </div>
                ) : (
                  <select
                    value={depositedTo}
                    onChange={(e) => setDepositedTo(e.target.value)}
                    className="w-full form-input text-xs"
                  >
                    {bankAccounts.map((acc) => (
                      <option key={acc._id} value={acc._id}>
                        {acc.bankName} - xx{acc.accountNumber?.slice(-4) || 'xxxx'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Amount Received *</label>
                <input
                  type="number"
                  value={amountReceived || ''}
                  onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full form-input text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">TDS Percentage (%)</label>
                <input
                  type="number"
                  value={tdsPercentage || ''}
                  onChange={(e) => handleTdsPercentageChange(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 2"
                  className="w-full form-input text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">TDS Withheld (₹)</label>
                <input
                  type="number"
                  value={tdsWithheld || ''}
                  onChange={(e) => handleTdsWithheldChange(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full form-input text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Transaction Charge (₹)</label>
                <input
                  type="number"
                  value={transactionCharge || ''}
                  onChange={(e) => setTransactionCharge(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full form-input text-xs"
                />
              </div>

              <div className="flex flex-col justify-end gap-2 pb-1.5">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRefInput(!showRefInput)}
                    className="text-blue-600 hover:underline font-bold text-[10px]"
                  >
                    {showRefInput ? 'Remove Reference' : '+ Add Reference ID'}
                  </button>
                  <button
                    onClick={() => setShowNotesInput(!showNotesInput)}
                    className="text-blue-600 hover:underline font-bold text-[10px]"
                  >
                    {showNotesInput ? 'Remove Notes' : '+ Add Notes'}
                  </button>
                </div>
              </div>
            </div>

            {showRefInput && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reference ID (UTR, Txn ID, etc.)</label>
                <input
                  type="text"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  placeholder="UTR/Txn Reference"
                  className="w-full form-input text-xs"
                />
              </div>
            )}

            {showNotesInput && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Record Notes</label>
                <input
                  type="text"
                  value={recordNotes}
                  onChange={(e) => setRecordNotes(e.target.value)}
                  placeholder="Particular entry notes"
                  className="w-full form-input text-xs"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="px-4 py-2 border border-slate-350 text-slate-705 font-bold hover:bg-slate-50 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePaymentRecord}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow"
              >
                Save & Continue
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
