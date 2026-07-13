'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import PageHeader from '@/components/PageHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface ClientSnapshot {
  clientName: string;
  businessName?: string;
}

interface QuotationType {
  _id: string;
  documentNumber: string;
  clientSnapshot: ClientSnapshot;
  issueDate: string;
  validTill?: string;
  grandTotal: number;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
}

export default function QuotationsPage() {
  const { showToast } = useToast();
  const [quotations, setQuotations] = useState<QuotationType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('type', 'QUOTATION');
      if (search) queryParams.append('search', search);
      if (activeTab !== 'ALL') queryParams.append('status', activeTab);
      if (fromDate) queryParams.append('fromDate', fromDate);
      if (toDate) queryParams.append('toDate', toDate);
      queryParams.append('page', page.toString());
      queryParams.append('limit', '15');

      const response = await api.get(`/documents?${queryParams.toString()}`);
      if (response.data?.success) {
        setQuotations(response.data.data.documents || []);
        setTotalPages(response.data.data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to load quotations.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchQuotations();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, activeTab, fromDate, toDate, page]);

  const handleClearFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const hasActiveFilters = search !== '' || fromDate !== '' || toDate !== '';

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
      SENT: 'bg-blue-50 text-blue-700 border-blue-100',
      VIEWED: 'bg-purple-50 text-purple-700 border-purple-100',
      ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      REJECTED: 'bg-rose-50 text-rose-700 border-rose-100',
      EXPIRED: 'bg-amber-50 text-amber-705 border-amber-100',
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[status] || 'bg-slate-100'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 space-y-6 text-slate-800">
      {/* Page Header */}
      <PageHeader
        title="Quotation & Estimates"
        subtitle="Manage professional quotations, estimates, and sales proposals."
        actions={
          <Link
            href="/quotations/new"
            className="h-10 px-4 rounded-xl text-xs font-semibold btn-primary flex items-center gap-2 shadow-sm transition-all whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Quotation
          </Link>
        }
      />

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6 text-xs leading-none pb-0">
        {['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'].map((tab) => (
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
            {tab === 'ALL' ? 'All Quotations' : tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 w-full">
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
            placeholder="Search quotation number, client..."
            className="w-full pl-9 h-9 form-input text-xs text-slate-905 placeholder:text-slate-400 bg-transparent border-0 focus:ring-0"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs bg-white text-slate-900"
            />
            <span className="text-slate-500 font-medium">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs bg-white text-slate-900"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* List Container */}
      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 flex items-center justify-center min-h-[300px]">
          <LoadingSpinner size="md" />
        </div>
      ) : quotations.length === 0 ? (
        /* Redesigned Compact Empty State */
        <div className="bg-white p-10 rounded-xl border border-slate-200 text-center space-y-4 max-w-xl mx-auto my-4 flex flex-col justify-center items-center min-h-[280px]">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-805">No quotations found</h3>
            <p className="text-slate-450 text-xs max-w-sm leading-relaxed">
              Create professional quotations for your clients with itemized pricing and GST calculations.
            </p>
          </div>
          <Link
            href="/quotations/new"
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            Create Quotation
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card-panel rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                    <th className="px-6 py-3.5">Quotation Number</th>
                    <th className="px-6 py-3.5">Client</th>
                    <th className="px-6 py-3.5">Issue Date</th>
                    <th className="px-6 py-3.5">Valid Till</th>
                    <th className="px-6 py-3.5">Amount</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Created At</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {quotations.map((quotation) => (
                    <tr key={quotation._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900 font-mono">
                        {quotation.documentNumber}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-800">
                          {quotation.clientSnapshot.businessName || quotation.clientSnapshot.clientName}
                        </span>
                        {quotation.clientSnapshot.businessName && (
                          <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                            Attn: {quotation.clientSnapshot.clientName}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(quotation.issueDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {quotation.validTill ? (
                          new Date(quotation.validTill).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">
                        ₹{quotation.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(quotation.status)}
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {new Date(quotation.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/quotations/${quotation._id}`}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Quotation"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          {quotation.status === 'DRAFT' && (
                            <Link
                              href={`/quotations/${quotation._id}/edit`}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Quotation"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-2 py-2">
              <span className="text-xs text-slate-400">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
