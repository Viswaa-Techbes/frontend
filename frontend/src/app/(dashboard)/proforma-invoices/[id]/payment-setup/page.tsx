'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';

interface PaymentSetupPageProps {
  params: {
    id: string;
  };
}

export default function ProformaInvoicePaymentSetupPage({ params }: PaymentSetupPageProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const docId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Document details
  const [document, setDocument] = useState<any>(null);

  // Saved business credentials options
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [savedBankAccounts, setSavedBankAccounts] = useState<any[]>([]);
  const [savedUpis, setSavedUpis] = useState<any[]>([]);

  // Selected details for the document
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [selectedUpi, setSelectedUpi] = useState<any>(null);

  // Modal forms states
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [newBank, setNewBank] = useState({
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifsc: '',
    branchName: '',
    accountType: 'Current',
  });

  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [newUpi, setNewUpi] = useState({
    upiId: '',
    displayName: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch document
      const docRes = await api.get(`/documents/${docId}`);
      if (docRes.data?.success) {
        setDocument(docRes.data.data);
        setSelectedBank(docRes.data.data.bankDetails || null);
        setSelectedUpi(docRes.data.data.upiDetails || null);
      }

      // 2. Fetch business profile (includes saved credentials)
      const businessRes = await api.get('/business');
      if (businessRes.data?.success && businessRes.data.data?.business) {
        const profile = businessRes.data.data.business;
        setBusinessProfile(profile);
        setSavedBankAccounts(profile.bankAccounts || []);
        setSavedUpis(profile.upiIds || []);
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

  // Form handlers
  const handleAddNewBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newBank.accountNumber !== newBank.confirmAccountNumber) {
      showToast('Account numbers do not match.', 'error');
      return;
    }
    if (!newBank.accountHolderName || !newBank.bankName || !newBank.accountNumber || !newBank.ifsc) {
      showToast('Please fill all required banking fields.', 'error');
      return;
    }

    try {
      const updatedAccounts = [...savedBankAccounts, {
        accountHolderName: newBank.accountHolderName,
        bankName: newBank.bankName,
        accountNumber: newBank.accountNumber,
        ifsc: newBank.ifsc,
        branchName: newBank.branchName,
        accountType: newBank.accountType,
      }];

      // Save to business profile settings
      const response = await api.put('/business', {
        ...businessProfile,
        bankAccounts: updatedAccounts,
      });

      if (response.data?.success) {
        showToast('Bank details added to business profile!', 'success');
        setSavedBankAccounts(updatedAccounts);
        setSelectedBank(updatedAccounts[updatedAccounts.length - 1]);
        setIsBankModalOpen(false);
        setNewBank({
          accountHolderName: '',
          bankName: '',
          accountNumber: '',
          confirmAccountNumber: '',
          ifsc: '',
          branchName: '',
          accountType: 'Current',
        });
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save bank credentials.', 'error');
    }
  };

  const handleAddNewUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUpi.upiId || !newUpi.displayName) {
      showToast('Please fill all required UPI fields.', 'error');
      return;
    }

    try {
      const updatedUpis = [...savedUpis, {
        upiId: newUpi.upiId,
        displayName: newUpi.displayName,
      }];

      // Save to business profile settings
      const response = await api.put('/business', {
        ...businessProfile,
        upiIds: updatedUpis,
      });

      if (response.data?.success) {
        showToast('UPI ID saved to business profile!', 'success');
        setSavedUpis(updatedUpis);
        setSelectedUpi(updatedUpis[updatedUpis.length - 1]);
        setIsUpiModalOpen(false);
        setNewUpi({ upiId: '', displayName: '' });
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save UPI credentials.', 'error');
    }
  };

  // Continue to Step 3
  const handleSavePayments = async (skip: boolean) => {
    setSaving(true);
    try {
      const payload = {
        ...document,
        bankDetails: skip ? null : selectedBank,
        upiDetails: skip ? null : selectedUpi,
      };

      const response = await api.put(`/documents/${docId}`, payload);
      if (response.data?.success) {
        showToast(skip ? 'Skipped payment credentials.' : 'Payment setup saved successfully!', 'success');
        router.push(`/proforma-invoices/${docId}`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save payment setup.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const maskNumber = (num: string) => {
    if (!num) return '';
    if (num.length <= 4) return num;
    return '•••• •••• ' + num.slice(-4);
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
      {/* Header / Step Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">SALES & INVOICES / PROFORMA INVOICES</span>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            Add Bank & UPI Details
          </h1>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
            <span className="w-5 h-5 rounded-full border border-blue-200 text-blue-600 bg-blue-50 flex items-center justify-center text-[10px]">✓</span>
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
            <span className="w-5 h-5 rounded-full border border-slate-300 text-slate-455 flex items-center justify-center text-[10px]">3</span>
            <span>Customise & Share</span>
          </div>
        </div>
      </div>

      {/* Main card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Bank card */}
        <div className="card-panel p-6 sm:p-8 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Add Bank Account Details</h2>
              <p className="text-xs text-slate-400 mt-0.5">Record payment account information for this document.</p>
            </div>
            <button
              onClick={() => setIsBankModalOpen(true)}
              className="px-3 py-1.5 border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-lg text-xs transition-colors"
            >
              + Add Bank Account
            </button>
          </div>

          {/* List existing business bank accounts */}
          {savedBankAccounts.length === 0 ? (
            <div className="text-xs text-slate-400 border border-dashed border-slate-200 p-8 rounded-xl text-center py-10 bg-slate-50/50">
              No saved business bank accounts. Add details to present settlement choices to clients.
            </div>
          ) : (
            <div className="space-y-3">
              {savedBankAccounts.map((acct, index) => {
                const isSelected = selectedBank && selectedBank.accountNumber === acct.accountNumber;
                return (
                  <div
                    key={index}
                    onClick={() => setSelectedBank(acct)}
                    className={`p-4 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-blue-50/45 border-blue-500 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-350'
                    }`}
                  >
                    <input
                      type="radio"
                      checked={isSelected}
                      readOnly
                      className="text-blue-600 border-slate-300 w-4 h-4 mt-0.5 flex-shrink-0"
                    />
                    <div className="flex-1 space-y-1 text-slate-600">
                      <p className="font-bold text-slate-900 flex items-center justify-between">
                        <span>{acct.bankName} ({acct.accountType})</span>
                        {isSelected && <span className="text-[10px] font-extrabold uppercase text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">Selected</span>}
                      </p>
                      <p>Holder: <span className="font-semibold text-slate-800">{acct.accountHolderName}</span></p>
                      <p>A/C: <span className="font-mono font-bold text-slate-800">{maskNumber(acct.accountNumber)}</span></p>
                      <p>IFSC: <span className="font-mono text-slate-800 font-bold uppercase">{acct.ifsc}</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* UPI card */}
        <div className="card-panel p-6 sm:p-8 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Add UPI Details</h2>
              <p className="text-xs text-slate-400 mt-0.5">Allow direct mobile payments using VPA identifiers.</p>
            </div>
            <button
              onClick={() => setIsUpiModalOpen(true)}
              className="px-3 py-1.5 border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-lg text-xs transition-colors"
            >
              + Add UPI ID
            </button>
          </div>

          {/* List existing business UPI credentials */}
          {savedUpis.length === 0 ? (
            <div className="text-xs text-slate-400 border border-dashed border-slate-200 p-8 rounded-xl text-center py-10 bg-slate-50/50">
              No saved business UPI IDs. Add VPA to support seamless QR codes.
            </div>
          ) : (
            <div className="space-y-3">
              {savedUpis.map((upi, index) => {
                const isSelected = selectedUpi && selectedUpi.upiId === upi.upiId;
                return (
                  <div
                    key={index}
                    onClick={() => setSelectedUpi(upi)}
                    className={`p-4 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-blue-50/45 border-blue-500 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-350'
                    }`}
                  >
                    <input
                      type="radio"
                      checked={isSelected}
                      readOnly
                      className="text-blue-600 border-slate-300 w-4 h-4 mt-0.5 flex-shrink-0"
                    />
                    <div className="flex-1 space-y-1 text-slate-600">
                      <p className="font-bold text-slate-900 flex items-center justify-between">
                        <span>{upi.displayName}</span>
                        {isSelected && <span className="text-[10px] font-extrabold uppercase text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">Selected</span>}
                      </p>
                      <p>VPA ID: <span className="font-mono font-bold text-slate-800">{upi.upiId}</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Wizard actions buttons */}
      <div className="card-panel p-5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
        <Link
          href={`/proforma-invoices/${docId}/edit`}
          className="px-4 py-2 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-xs text-slate-700 transition-colors"
        >
          Go Back
        </Link>
        <div className="flex gap-3">
          <button
            onClick={() => handleSavePayments(true)}
            disabled={saving}
            className="px-4 py-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-bold transition-colors"
          >
            Skip & Continue
          </button>
          <button
            onClick={() => handleSavePayments(false)}
            disabled={saving || (!selectedBank && !selectedUpi)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-sm text-xs disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      </div>

      {/* Modal: New Bank Form */}
      {isBankModalOpen && (
        <Modal
          isOpen={isBankModalOpen}
          onClose={() => setIsBankModalOpen(false)}
          title="Add Business Bank Account"
        >
          <form onSubmit={handleAddNewBank} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Account Holder Name</label>
              <input
                type="text"
                required
                value={newBank.accountHolderName}
                onChange={(e) => setNewBank({ ...newBank, accountHolderName: e.target.value })}
                placeholder="Enterprise or personal owner name"
                className="w-full form-input text-xs text-slate-900 bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Bank Name</label>
                <input
                  type="text"
                  required
                  value={newBank.bankName}
                  onChange={(e) => setNewBank({ ...newBank, bankName: e.target.value })}
                  placeholder="HDFC Bank"
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">Account Type</label>
                <select
                  value={newBank.accountType}
                  onChange={(e) => setNewBank({ ...newBank, accountType: e.target.value })}
                  className="w-full form-input text-xs text-slate-900 bg-white"
                >
                  <option value="Current">Current Business Account</option>
                  <option value="Savings">Savings Account</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Account Number</label>
                <input
                  type="password"
                  required
                  value={newBank.accountNumber}
                  onChange={(e) => setNewBank({ ...newBank, accountNumber: e.target.value })}
                  placeholder="Enter Account Number"
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
                  placeholder="Re-enter Account Number"
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
                  placeholder="11-digit IFSC code"
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1">Branch Name</label>
                <input
                  type="text"
                  value={newBank.branchName}
                  onChange={(e) => setNewBank({ ...newBank, branchName: e.target.value })}
                  placeholder="Branch location"
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
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

      {/* Modal: New UPI Form */}
      {isUpiModalOpen && (
        <Modal
          isOpen={isUpiModalOpen}
          onClose={() => setIsUpiModalOpen(false)}
          title="Add UPI VPA"
        >
          <form onSubmit={handleAddNewUpi} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">UPI ID (VPA)</label>
              <input
                type="text"
                required
                value={newUpi.upiId}
                onChange={(e) => setNewUpi({ ...newUpi, upiId: e.target.value })}
                placeholder="yourcompany@okaxis"
                className="w-full form-input text-xs text-slate-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Display Name / Description</label>
              <input
                type="text"
                required
                value={newUpi.displayName}
                onChange={(e) => setNewUpi({ ...newUpi, displayName: e.target.value })}
                placeholder="UPI Payment Gateway"
                className="w-full form-input text-xs text-slate-900 bg-white"
              />
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
