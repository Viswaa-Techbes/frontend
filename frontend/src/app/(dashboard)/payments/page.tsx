'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface ReceiptType {
  _id: string;
  receiptNumber: string;
  clientSnapshot: { clientName: string; businessName?: string };
  receiptDate: string;
  paymentRecords: { paymentMethod: string; amountReceived: number }[];
  totals: {
    amountReceived: number;
    allocatedToInvoices: number;
    advancePayment: number;
  };
  status: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
  createdAt: string;
}

export default function PaymentReceiptsListPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [receipts, setReceipts] = useState<ReceiptType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (activeTab !== 'ALL') params.append('status', activeTab);
      params.append('page', page.toString());
      params.append('limit', '15');

      const res = await api.get(`/payment-receipts?${params.toString()}`);
      if (res.data?.success) {
        setReceipts(res.data.data.receipts || []);
        setTotalPages(res.data.data.pagination?.totalPages || 1);
        setTotalCount(res.data.data.pagination?.total || 0);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to retrieve payment receipts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchReceipts();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [search, activeTab, page]);

  const handleCancelReceipt = async (id: string, num: string) => {
    if (!window.confirm(`Are you sure you want to cancel payment receipt ${num}? This rolls back outstanding invoice settlements.`)) return;
    try {
      const res = await api.patch(`/payment-receipts/${id}/status`, { status: 'CANCELLED' });
      if (res.data?.success) {
        showToast(`Receipt ${num} cancelled and settlements restored.`, 'success');
        fetchReceipts();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to cancel receipt.', 'error');
    }
  };

  const handleDeleteDraft = async (id: string, num: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete draft receipt ${num}?`)) return;
    try {
      const res = await api.delete(`/payment-receipts/${id}`);
      if (res.data?.success) {
        showToast(`Draft receipt ${num} deleted.`, 'success');
        fetchReceipts();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete draft.', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
      FINALIZED: 'bg-emerald-50 text-emerald-700 border-emerald-100 font-bold',
      CANCELLED: 'bg-slate-200 text-slate-500 border-slate-350 line-through',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${styles[status] || 'bg-slate-100'}`}>
        {status}
      </span>
    );
  };

  // Derive metrics safely from loaded state
  const totalReceivedSum = receipts.reduce((sum, r) => sum + (r.status !== 'CANCELLED' ? (r.totals?.amountReceived || 0) : 0), 0);
  const unallocatedSum = receipts.reduce((sum, r) => sum + (r.status !== 'CANCELLED' ? (r.totals?.advancePayment || 0) : 0), 0);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 space-y-6 text-slate-800">
      
      {/* Redesigned Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Payment Receipts</h1>
          <p className="text-slate-500 text-xs mt-1">Record client payments and manage invoice settlements.</p>
        </div>
        <Link
          href="/payments/new"
          className="h-10 px-4 rounded-xl text-xs font-semibold btn-primary flex items-center gap-2 shadow-sm transition-all whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Record Payment
        </Link>
      </div>

      {/* Redesigned Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Received (Page)</span>
          <span className="text-lg font-black text-slate-900 mt-1">
            ₹{totalReceivedSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unallocated Advance (Page)</span>
          <span className="text-lg font-black text-blue-600 mt-1">
            ₹{unallocatedSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Receipts (Total)</span>
          <span className="text-lg font-black text-slate-900 mt-1">{totalCount}</span>
        </div>
      </div>

      {/* Redesigned Status Tabs Row */}
      <div className="border-b border-slate-200 flex gap-6 text-xs leading-none pb-0">
        {['ALL', 'DRAFT', 'FINALIZED', 'CANCELLED'].map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setPage(1);
            }}
            className={`pb-3.5 font-bold relative whitespace-nowrap transition-colors ${
              activeTab === tab ? 'text-blue-600 font-extrabold border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab === 'ALL' ? 'All Receipts' : tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Redesigned Compact Filter Toolbar */}
      <div className="flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by receipt number, client..."
            className="w-full pl-9 h-9 form-input text-xs text-slate-900 placeholder:text-slate-400 bg-transparent border-0 focus:ring-0"
          />
        </div>
      </div>

      {/* Main Content Grid */}
      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 flex items-center justify-center min-h-[300px]">
          <LoadingSpinner size="md" />
        </div>
      ) : receipts.length === 0 ? (
        /* Redesigned Compact Empty State */
        <div className="bg-white p-10 rounded-xl border border-slate-200 text-center space-y-4 max-w-xl mx-auto my-4 flex flex-col justify-center items-center min-h-[280px]">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-805">No payment receipts yet</h3>
            <p className="text-slate-450 text-xs max-w-sm leading-relaxed">
              Record your first client payment and allocate it against outstanding customer invoices.
            </p>
          </div>
          <Link
            href="/payments/new"
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            Record First Payment
          </Link>
        </div>
      ) : (
        /* Table Grid */
        <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                  <th className="px-5 py-3 w-32">Receipt Number</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3 w-28">Receipt Date</th>
                  <th className="px-5 py-3 w-32">Method</th>
                  <th className="px-5 py-3 w-36 text-right">Amount Received</th>
                  <th className="px-5 py-3 w-36 text-right">Allocated Amount</th>
                  <th className="px-5 py-3 w-36 text-right">Advance Amount</th>
                  <th className="px-5 py-3 w-24">Status</th>
                  <th className="px-5 py-3 w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                {receipts.map((receipt) => {
                  const methods = Array.from(new Set(receipt.paymentRecords?.map((r) => r.paymentMethod) || [])).join(', ');
                  return (
                    <tr key={receipt._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 font-semibold text-slate-900 font-mono">
                        {receipt.receiptNumber}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-slate-805 block">
                          {receipt.clientSnapshot?.businessName || receipt.clientSnapshot?.clientName}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {new Date(receipt.receiptDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-5 py-3 uppercase text-slate-450 font-mono text-[10px] truncate max-w-[120px]">
                        {methods || '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">
                        ₹{receipt.totals?.amountReceived?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-550">
                        ₹{receipt.totals?.allocatedToInvoices?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-550">
                        ₹{receipt.totals?.advancePayment?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3">
                        {getStatusBadge(receipt.status)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/payments/${receipt._id}`}
                            className="p-1.5 text-slate-400 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>

                          {receipt.status === 'FINALIZED' && (
                            <button
                              onClick={() => handleCancelReceipt(receipt._id, receipt.receiptNumber)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Cancel / Void Receipt"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                          )}

                          {receipt.status === 'DRAFT' && (
                            <button
                              onClick={() => handleDeleteDraft(receipt._id, receipt.receiptNumber)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Delete Draft"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-slate-350 bg-white hover:bg-slate-55 font-semibold rounded-lg text-slate-700 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <span className="text-slate-500">
                Page <span className="font-bold text-slate-905">{page}</span> of <span className="font-bold text-slate-905">{totalPages}</span>
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-slate-350 bg-white hover:bg-slate-55 font-semibold rounded-lg text-slate-700 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
