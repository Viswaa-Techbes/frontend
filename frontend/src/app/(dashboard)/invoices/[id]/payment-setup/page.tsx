'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';

interface BankAccount {
  _id: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branchName?: string;
  accountType: 'Savings' | 'Current';
  isDefault: boolean;
}

interface UpiDetails {
  _id: string;
  upiId: string;
  displayName: string;
  isDefault: boolean;
}

interface PaymentSetupPageProps {
  params: {
    id: string;
  };
}

export default function InvoicePaymentSetupPage({ params }: PaymentSetupPageProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const documentId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [document, setDocument] = useState<any>(null);

  // Lists of saved accounts in business profile
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [upiAccounts, setUpiAccounts] = useState<UpiDetails[]>([]);

  // Selected references
  const [selectedBankId, setSelectedBankId] = useState('');
  const [selectedUpiId, setSelectedUpiId] = useState('');
  const [showQrCode, setShowQrCode] = useState(true);

  // Inline forms modals toggles
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [newBank, setNewBank] = useState({
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifsc: '',
    branchName: '',
    accountType: 'Current',
    isDefault: false,
  });

  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [newUpi, setNewUpi] = useState({
    upiId: '',
    displayName: '',
    isDefault: false,
  });

  const loadData = async () => {
    try {
      // 1. Fetch document
      const docRes = await api.get(`/documents/${documentId}`);
      if (docRes.data?.success) {
        const doc = docRes.data.data;
        setDocument(doc);
        if (doc.bankDetails?.accountNumber) {
          // Attempt mapping if pre-existing is active
          setSelectedBankId('existing');
        }
        if (doc.upiDetails?.upiId) {
          setSelectedUpiId('existing');
        }
      }

      // 2. Fetch business accounts lists
      const bizRes = await api.get('/business');
      if (bizRes.data?.success && bizRes.data.data?.business) {
        const biz = bizRes.data.data.business;
        const banks = biz.bankAccounts || [];
        setBankAccounts(banks);
        const upis = biz.upiDetails || [];
        setUpiAccounts(upis);

        // Auto select defaults
        const defaultBank = banks.find((b: any) => b.isDefault);
        if (defaultBank && !selectedBankId) setSelectedBankId(defaultBank._id);

        const defaultUpi = upis.find((u: any) => u.isDefault);
        if (defaultUpi && !selectedUpiId) setSelectedUpiId(defaultUpi._id);
      }
    } catch (err: any) {
      showToast('Error loading payment credentials configuration data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [documentId]);

  // Create new Bank profile save
  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newBank.accountNumber !== newBank.confirmAccountNumber) {
      showToast('Account numbers do not match.', 'error');
      return;
    }
    try {
      const response = await api.post('/business/bank-accounts', {
        accountHolderName: newBank.accountHolderName,
        bankName: newBank.bankName,
        accountNumber: newBank.accountNumber,
        ifsc: newBank.ifsc,
        branchName: newBank.branchName,
        accountType: newBank.accountType,
        isDefault: newBank.isDefault,
      });

      if (response.data?.success) {
        showToast('Bank account registered successfully!', 'success');
        setIsBankModalOpen(false);
        setNewBank({
          accountHolderName: '',
          bankName: '',
          accountNumber: '',
          confirmAccountNumber: '',
          ifsc: '',
          branchName: '',
          accountType: 'Current',
          isDefault: false,
        });
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to register bank account.', 'error');
    }
  };

  // Create new UPI ID save
  const handleCreateUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUpi.upiId.includes('@')) {
      showToast('Invalid UPI ID structure.', 'error');
      return;
    }
    try {
      const response = await api.post('/business/upi', {
        upiId: newUpi.upiId,
        displayName: newUpi.displayName,
        isDefault: newUpi.isDefault,
      });

      if (response.data?.success) {
        showToast('UPI VPA details registered successfully!', 'success');
        setIsUpiModalOpen(false);
        setNewUpi({
          upiId: '',
          displayName: '',
          isDefault: false,
        });
        loadData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to register UPI.', 'error');
    }
  };

  // Submit and save configuration changes to Invoice
  const handleSaveSetup = async (skip = false) => {
    setSaving(true);
    try {
      let bankDetailsPayload = null;
      let upiDetailsPayload = null;

      if (!skip) {
        if (selectedBankId && selectedBankId !== 'existing') {
          const matched = bankAccounts.find((b) => b._id === selectedBankId);
          if (matched) {
            bankDetailsPayload = {
              bankName: matched.bankName,
              accountHolderName: matched.accountHolderName,
              accountNumber: matched.accountNumber,
              ifsc: matched.ifsc,
              branchName: matched.branchName,
              accountType: matched.accountType,
            };
          }
        } else if (selectedBankId === 'existing') {
          bankDetailsPayload = document.bankDetails;
        }

        if (selectedUpiId && selectedUpiId !== 'existing') {
          const matched = upiAccounts.find((u) => u._id === selectedUpiId);
          if (matched) {
            upiDetailsPayload = {
              upiId: matched.upiId,
              displayName: matched.displayName,
              showPaymentQr: showQrCode,
            };
          }
        } else if (selectedUpiId === 'existing') {
          upiDetailsPayload = {
            ...document.upiDetails,
            showPaymentQr: showQrCode,
          };
        }
      }

      // API trigger to patch payment config on the invoice
      const response = await api.put(`/documents/${documentId}`, {
        ...document,
        bankDetails: bankDetailsPayload,
        upiDetails: upiDetailsPayload,
      });

      if (response.data?.success) {
        showToast('Step 2 saved successfully!', 'success');
        router.push(`/invoices/${documentId}`);
      }
    } catch (err: any) {
      showToast('Error finalizing step 2 credentials.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card-panel p-16 rounded-xl flex items-center justify-center min-h-[400px] bg-white">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800 pb-16">
      {/* Breadcrumb / Top headers */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">SALES & INVOICES / INVOICES / {document?.documentNumber}</span>
          <h1 className="text-xl font-bold text-slate-900 mt-1">Add Bank & UPI Details</h1>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
            <span className="w-5 h-5 rounded-full border border-slate-350 text-slate-450 flex items-center justify-center text-[10px]">1</span>
            <span>Invoice Details</span>
          </div>
          <svg className="w-4 h-4 text-slate-350" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="flex items-center gap-1.5 font-bold text-blue-600">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
            <span>Bank & UPI Details</span>
          </div>
          <svg className="w-4 h-4 text-slate-350" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
            <span className="w-5 h-5 rounded-full border border-slate-300 text-slate-450 flex items-center justify-center text-[10px]">3</span>
            <span>Customise & Share</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* CARD 1: Bank Accounts */}
        <div className="card-panel p-6 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-start border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Add Bank Account Details</h3>
              <p className="text-[11px] text-slate-450">Record payment account information for this document.</p>
            </div>
            <button
              onClick={() => setIsBankModalOpen(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold"
            >
              + Add Bank Account
            </button>
          </div>

          {bankAccounts.length === 0 && !document?.bankDetails?.accountNumber ? (
            <div className="py-6 text-center text-slate-400 italic text-xs">
              No saved bank accounts found. Click "+ Add Bank Account" to configure.
            </div>
          ) : (
            <div className="space-y-3">
              {document?.bankDetails?.accountNumber && (
                <label className="flex items-start gap-3 p-3 border border-blue-200 bg-blue-50/20 rounded-xl cursor-pointer">
                  <input
                    type="radio"
                    name="bankSelect"
                    checked={selectedBankId === 'existing'}
                    onChange={() => setSelectedBankId('existing')}
                    className="mt-1 text-blue-600 border-slate-300 focus:ring-blue-500 w-4.5 h-4.5"
                  />
                  <div className="text-xs">
                    <span className="font-extrabold text-[8px] uppercase tracking-wider text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded block mb-1 w-fit">Currently Saved On Document</span>
                    <p className="font-bold text-slate-900">{document.bankDetails.bankName}</p>
                    <p className="text-slate-500">Account: {document.bankDetails.accountNumber} | Holder: {document.bankDetails.accountHolderName}</p>
                    <p className="text-slate-450">IFSC: {document.bankDetails.ifsc}</p>
                  </div>
                </label>
              )}

              {bankAccounts.map((bank) => (
                <label key={bank._id} className="flex items-start gap-3 p-3 border border-slate-200 hover:bg-slate-50/50 rounded-xl cursor-pointer">
                  <input
                    type="radio"
                    name="bankSelect"
                    checked={selectedBankId === bank._id}
                    onChange={() => setSelectedBankId(bank._id)}
                    className="mt-1 text-blue-600 border-slate-350 focus:ring-blue-500 w-4.5 h-4.5"
                  />
                  <div className="text-xs text-slate-650">
                    <p className="font-bold text-slate-900">{bank.bankName}</p>
                    <p className="text-slate-500">Account: {bank.accountNumber} | Holder: {bank.accountHolderName}</p>
                    <p className="text-slate-450">IFSC: {bank.ifsc} {bank.isDefault && <span className="text-xs font-bold text-blue-600">(Default)</span>}</p>
                  </div>
                </label>
              ))}

              <label className="flex items-center gap-2.5 p-3 border border-slate-200 hover:bg-slate-50/50 rounded-xl cursor-pointer">
                <input
                  type="radio"
                  name="bankSelect"
                  checked={selectedBankId === ''}
                  onChange={() => setSelectedBankId('')}
                  className="text-blue-600 border-slate-350 focus:ring-blue-500 w-4.5 h-4.5"
                />
                <span className="text-xs text-slate-500 font-bold">Do not display bank details on this invoice</span>
              </label>
            </div>
          )}
        </div>

        {/* CARD 2: UPI accounts */}
        <div className="card-panel p-6 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-start border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Add UPI Details</h3>
              <p className="text-[11px] text-slate-450">Collect payments using supported UPI payment details.</p>
            </div>
            <button
              onClick={() => setIsUpiModalOpen(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold"
            >
              + Add UPI ID
            </button>
          </div>

          {upiAccounts.length === 0 && !document?.upiDetails?.upiId ? (
            <div className="py-6 text-center text-slate-400 italic text-xs">
              No saved UPI credentials found. Click "+ Add UPI ID" to configure.
            </div>
          ) : (
            <div className="space-y-3">
              {document?.upiDetails?.upiId && (
                <label className="flex items-start gap-3 p-3 border border-blue-200 bg-blue-50/20 rounded-xl cursor-pointer">
                  <input
                    type="radio"
                    name="upiSelect"
                    checked={selectedUpiId === 'existing'}
                    onChange={() => setSelectedUpiId('existing')}
                    className="mt-1 text-blue-600 border-slate-300 focus:ring-blue-500 w-4.5 h-4.5"
                  />
                  <div className="text-xs">
                    <span className="font-extrabold text-[8px] uppercase tracking-wider text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded block mb-1 w-fit">Currently Saved On Document</span>
                    <p className="font-bold text-slate-900">{document.upiDetails.upiId}</p>
                    <p className="text-slate-500">Name: {document.upiDetails.displayName}</p>
                  </div>
                </label>
              )}

              {upiAccounts.map((upi) => (
                <label key={upi._id} className="flex items-start gap-3 p-3 border border-slate-200 hover:bg-slate-50/50 rounded-xl cursor-pointer">
                  <input
                    type="radio"
                    name="upiSelect"
                    checked={selectedUpiId === upi._id}
                    onChange={() => setSelectedUpiId(upi._id)}
                    className="mt-1 text-blue-600 border-slate-350 focus:ring-blue-500 w-4.5 h-4.5"
                  />
                  <div className="text-xs text-slate-650">
                    <p className="font-bold text-slate-900">{upi.upiId}</p>
                    <p className="text-slate-500">Display Name: {upi.displayName} {upi.isDefault && <span className="text-xs font-bold text-blue-600">(Default)</span>}</p>
                  </div>
                </label>
              ))}

              <label className="flex items-center gap-2.5 p-3 border border-slate-200 hover:bg-slate-50/50 rounded-xl cursor-pointer">
                <input
                  type="radio"
                  name="upiSelect"
                  checked={selectedUpiId === ''}
                  onChange={() => setSelectedUpiId('')}
                  className="text-blue-600 border-slate-350 focus:ring-blue-500 w-4.5 h-4.5"
                />
                <span className="text-xs text-slate-500 font-bold">Do not display UPI details on this invoice</span>
              </label>

              {selectedUpiId && (
                <div className="pt-3 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showQrCode}
                      onChange={(e) => setShowQrCode(e.target.checked)}
                      className="rounded text-blue-600 border-slate-300 w-4 h-4"
                    />
                    <span className="text-xs text-slate-700 font-semibold">Generate static UPI Payment QR Code on invoice PDF</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer wizard navigation triggers */}
      <div className="card-panel p-5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
        <button
          onClick={() => router.push(`/invoices/${documentId}/edit`)}
          className="px-4 py-2 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-xs text-slate-700 transition-colors"
        >
          Go Back
        </button>

        <div className="flex gap-3">
          <button
            onClick={() => handleSaveSetup(true)}
            className="px-4 py-2 text-slate-500 hover:text-slate-800 font-bold text-xs rounded-xl hover:bg-slate-100"
          >
            Skip & Continue
          </button>
          <button
            onClick={() => handleSaveSetup(false)}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      </div>

      {/* New Bank Modal */}
      {isBankModalOpen && (
        <Modal
          isOpen={isBankModalOpen}
          onClose={() => setIsBankModalOpen(false)}
          title="Add Bank Account Details"
        >
          <form onSubmit={handleCreateBank} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Bank Name</label>
              <input
                type="text"
                required
                value={newBank.bankName}
                onChange={(e) => setNewBank({ ...newBank, bankName: e.target.value })}
                placeholder="State Bank of India"
                className="w-full form-input text-xs text-slate-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Account Holder Name</label>
              <input
                type="text"
                required
                value={newBank.accountHolderName}
                onChange={(e) => setNewBank({ ...newBank, accountHolderName: e.target.value })}
                placeholder="Enter account holder name"
                className="w-full form-input text-xs text-slate-900 bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">Account Number</label>
                <input
                  type="password"
                  required
                  value={newBank.accountNumber}
                  onChange={(e) => setNewBank({ ...newBank, accountNumber: e.target.value })}
                  placeholder="A/C Number"
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Confirm Account Number</label>
                <input
                  type="text"
                  required
                  value={newBank.confirmAccountNumber}
                  onChange={(e) => setNewBank({ ...newBank, confirmAccountNumber: e.target.value })}
                  placeholder="Re-enter A/C Number"
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">IFSC Code</label>
                <input
                  type="text"
                  required
                  value={newBank.ifsc}
                  onChange={(e) => setNewBank({ ...newBank, ifsc: e.target.value.toUpperCase() })}
                  placeholder="SBIN0001234"
                  className="w-full form-input text-xs text-slate-900 bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Branch Name</label>
                <input
                  type="text"
                  value={newBank.branchName}
                  onChange={(e) => setNewBank({ ...newBank, branchName: e.target.value })}
                  placeholder="Connaught Place, Delhi"
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Account Type</label>
                <select
                  value={newBank.accountType}
                  onChange={(e) => setNewBank({ ...newBank, accountType: e.target.value as any })}
                  className="w-full form-input text-xs text-slate-900 bg-white"
                >
                  <option value="Savings">Savings</option>
                  <option value="Current">Current</option>
                </select>
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newBank.isDefault}
                    onChange={(e) => setNewBank({ ...newBank, isDefault: e.target.checked })}
                    className="rounded text-blue-600 border-slate-350 w-4 h-4 bg-white"
                  />
                  <span>Set as default</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsBankModalOpen(false)}
                className="px-4 py-2 border border-slate-700 text-slate-400 hover:bg-slate-850 hover:text-white rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow"
              >
                Save Bank Details
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* New UPI Modal */}
      {isUpiModalOpen && (
        <Modal
          isOpen={isUpiModalOpen}
          onClose={() => setIsUpiModalOpen(false)}
          title="Add UPI ID"
        >
          <form onSubmit={handleCreateUpi} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">UPI ID (VPA)</label>
              <input
                type="text"
                required
                value={newUpi.upiId}
                onChange={(e) => setNewUpi({ ...newUpi, upiId: e.target.value })}
                placeholder="name@okaxis"
                className="w-full form-input text-xs text-slate-900 bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">Payee Name (Display Name)</label>
              <input
                type="text"
                required
                value={newUpi.displayName}
                onChange={(e) => setNewUpi({ ...newUpi, displayName: e.target.value })}
                placeholder="Enter payee display name"
                className="w-full form-input text-xs text-slate-900 bg-white"
              />
            </div>

            <div className="flex items-center pt-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newUpi.isDefault}
                  onChange={(e) => setNewUpi({ ...newUpi, isDefault: e.target.checked })}
                  className="rounded text-blue-600 border-slate-350 w-4 h-4 bg-white"
                />
                <span>Set as default</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsUpiModalOpen(false)}
                className="px-4 py-2 border border-slate-700 text-slate-400 hover:bg-slate-850 hover:text-white rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow"
              >
                Save UPI ID
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
