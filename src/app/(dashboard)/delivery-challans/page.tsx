'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import PageHeader from '@/components/PageHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface DeliveryChallanType {
  _id: string;
  documentNumber: string;
  clientSnapshot: { clientName: string; businessName?: string };
  issueDate: string;
  grandTotal: number;
  status: 'DRAFT' | 'ISSUED' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  linkedDocuments?: { documentNumber: string; documentType: string }[];
  createdAt: string;
}

export default function DeliveryChallansListPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [challans, setChallans] = useState<DeliveryChallanType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchChallans = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('documentType', 'DELIVERY_CHALLAN');
      if (search) params.append('search', search);
      if (activeTab !== 'ALL') params.append('status', activeTab);
      params.append('page', page.toString());
      params.append('limit', '15');

      const res = await api.get(`/documents?${params.toString()}`);
      if (res.data?.success) {
        setChallans(res.data.data.documents || []);
        setTotalPages(res.data.data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to retrieve delivery challans.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchChallans();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [search, activeTab, page]);

  const handleDeleteDraft = async (id: string, num: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete draft delivery challan ${num}?`)) return;
    try {
      const res = await api.delete(`/documents/${id}`);
      if (res.data?.success) {
        showToast(`Draft delivery challan ${num} deleted successfully.`, 'success');
        fetchChallans();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete draft.', 'error');
    }
  };

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
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${styles[status] || 'bg-slate-100'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6 text-slate-800">
      <PageHeader
        title="Delivery Challans"
        subtitle="Manage dispatch notes and delivery confirmation receipts for goods movement."
        actions={
          <Link
            href="/delivery-challans/new"
            className="px-4 py-2.5 rounded-xl text-sm font-semibold btn-primary flex items-center gap-2 shadow-sm"
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Delivery Challan
          </Link>
        }
      />

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6 text-sm overflow-x-auto scrollbar-none">
        {['ALL', 'DRAFT', 'ISSUED', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED'].map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setPage(1);
            }}
            className={`pb-3 font-semibold relative whitespace-nowrap transition-colors ${
              activeTab === tab ? 'text-slate-900 font-bold border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab === 'ALL' ? 'All Challans' : tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="card-panel p-4 rounded-xl bg-white shadow-sm border border-slate-200">
        <div className="relative max-w-md w-full">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
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
            placeholder="Search by Challan number, client..."
            className="w-full pl-9 form-input text-xs text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="card-panel p-16 rounded-xl flex items-center justify-center">
          <LoadingSpinner size="md" />
        </div>
      ) : challans.length === 0 ? (
        <div className="card-panel p-16 rounded-xl flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-700">No Delivery Challans found</h3>
          <p className="text-slate-450 text-xs mt-1 max-w-sm">
            Generate and track confirmed dispatch challans, convert them directly to Tax Invoices, and monitor goods movements.
          </p>
          <Link
            href="/delivery-challans/new"
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            Create Your First Delivery Challan
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card-panel rounded-xl overflow-hidden bg-white shadow-sm border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="px-6 py-3.5">Challan Number</th>
                    <th className="px-6 py-3.5">Client</th>
                    <th className="px-6 py-3.5">Challan Date</th>
                    <th className="px-6 py-3.5 text-right">Value Total</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Linked Docs</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {challans.map((challan) => {
                    const linked = challan.linkedDocuments?.map((ld) => ld.documentNumber).join(', ') || 'None';
                    return (
                      <tr key={challan._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-905 font-mono">
                          {challan.documentNumber}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-800 block">
                            {challan.clientSnapshot?.businessName || challan.clientSnapshot?.clientName}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(challan.issueDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                          ₹{challan.grandTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(challan.status)}
                        </td>
                        <td className="px-6 py-4 text-slate-450 font-mono text-[10px]">
                          {linked}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/delivery-challans/${challan._id}`}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Link>

                            {challan.status === 'DRAFT' && (
                              <>
                                <Link
                                  href={`/delivery-challans/${challan._id}/edit`}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="Edit Challan"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </Link>

                                <button
                                  onClick={() => handleDeleteDraft(challan._id, challan.documentNumber)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="Delete Draft"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border border-slate-350 bg-white hover:bg-slate-50 font-semibold rounded-lg text-slate-705 disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <span className="text-slate-500">
                  Page <span className="font-bold text-slate-900">{page}</span> of <span className="font-bold text-slate-900">{totalPages}</span>
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border border-slate-350 bg-white hover:bg-slate-50 font-semibold rounded-lg text-slate-705 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
