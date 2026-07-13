'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import PageHeader from '@/components/PageHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface ClientSnapshot {
  clientName: string;
  businessName?: string;
}

interface InvoiceType {
  _id: string;
  documentNumber: string;
  clientSnapshot: ClientSnapshot;
  issueDate: string;
  validTill?: string; // due date
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  status: 'DRAFT' | 'ISSUED' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED' | 'OVERDUE' | 'CANCELLED';
  createdAt: string;
}

export default function InvoicesPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('type', 'INVOICE');
      if (search) queryParams.append('search', search);
      
      // Handle status tab vs filter dropdown
      if (activeTab !== 'ALL') {
        queryParams.append('status', activeTab);
      } else if (invoiceStatusFilter) {
        queryParams.append('status', invoiceStatusFilter);
      }

      if (paymentStatusFilter) queryParams.append('paymentStatus', paymentStatusFilter);
      if (fromDate) queryParams.append('fromDate', fromDate);
      if (toDate) queryParams.append('toDate', toDate);
      queryParams.append('page', page.toString());
      queryParams.append('limit', '15');

      const response = await api.get(`/documents?${queryParams.toString()}`);
      if (response.data?.success) {
        // Filter by paymentStatus client-side if backend does not filter it directly
        let list = response.data.data.documents || [];
        if (paymentStatusFilter) {
          list = list.filter((item: any) => item.paymentStatus === paymentStatusFilter);
        }
        setInvoices(list);
        setTotalPages(response.data.data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to load invoices.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchInvoices();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, activeTab, fromDate, toDate, invoiceStatusFilter, paymentStatusFilter, page]);

  const handleClearFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setInvoiceStatusFilter('');
    setPaymentStatusFilter('');
    setPage(1);
  };

  const handleDeleteDraft = async (id: string, num: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete draft invoice ${num}?`)) return;
    try {
      const response = await api.delete(`/documents/${id}`);
      if (response.data?.success) {
        showToast(`Draft invoice ${num} deleted successfully.`, 'success');
        fetchInvoices();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete invoice.', 'error');
    }
  };

  const handleCancelInvoice = async (id: string, num: string) => {
    if (!window.confirm(`Are you sure you want to cancel invoice ${num}? This action is permanent and voides the document.`)) return;
    try {
      const response = await api.patch(`/documents/${id}/status`, { status: 'CANCELLED' });
      if (response.data?.success) {
        showToast(`Invoice ${num} marked as CANCELLED.`, 'success');
        fetchInvoices();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to cancel invoice.', 'error');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const response = await api.post(`/documents/${id}/duplicate`);
      if (response.data?.success) {
        showToast('Document duplicated successfully.', 'success');
        router.push(`/invoices/${response.data.data._id}`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to duplicate document.', 'error');
    }
  };

  const hasActiveFilters = search !== '' || fromDate !== '' || toDate !== '' || invoiceStatusFilter !== '' || paymentStatusFilter !== '';

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
      ISSUED: 'bg-blue-50 text-blue-700 border-blue-100',
      SENT: 'bg-blue-50 text-blue-700 border-blue-100',
      VIEWED: 'bg-purple-50 text-purple-700 border-purple-100',
      ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      REJECTED: 'bg-rose-50 text-rose-700 border-rose-100',
      EXPIRED: 'bg-amber-50 text-amber-705 border-amber-100',
      CONVERTED: 'bg-slate-100 text-slate-500 border-slate-200 line-through',
      OVERDUE: 'bg-rose-100 text-rose-800 border-rose-200 font-bold',
      CANCELLED: 'bg-slate-150 text-slate-500 border-slate-300 font-medium',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${styles[status] || 'bg-slate-100'}`}>
        {status}
      </span>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      UNPAID: 'bg-rose-50 text-rose-700 border-rose-100',
      PARTIALLY_PAID: 'bg-amber-50 text-amber-700 border-amber-100',
      PAID: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${styles[status] || 'bg-slate-100'}`}>
        {status?.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 space-y-6 text-slate-800">
      {/* Page Header */}
      <PageHeader
        title="Invoices"
        subtitle="Create, manage, track, and collect payments for customer invoices."
        actions={
          <Link
            href="/invoices/new"
            className="h-10 px-4 rounded-xl text-xs font-semibold btn-primary flex items-center gap-2 shadow-sm transition-all whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Invoice
          </Link>
        }
      />

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6 text-xs leading-none pb-0">
        {['ALL', 'DRAFT', 'ISSUED', 'SENT', 'OVERDUE', 'CANCELLED'].map((tab) => (
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
            {tab === 'ALL' ? 'All Invoices' : tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Toolbar Filters */}
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
            placeholder="Search by invoice number, client..."
            className="w-full pl-9 h-9 form-input text-xs text-slate-905 placeholder:text-slate-400 bg-transparent border-0 focus:ring-0"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end text-xs">
          <div>
            <select
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs bg-white text-slate-905"
            >
              <option value="">All Payments</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
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

      {/* Invoices List table */}
      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 flex items-center justify-center min-h-[300px]">
          <LoadingSpinner size="md" />
        </div>
      ) : invoices.length === 0 ? (
        /* Redesigned Compact Empty State */
        <div className="bg-white p-10 rounded-xl border border-slate-200 text-center space-y-4 max-w-xl mx-auto my-4 flex flex-col justify-center items-center min-h-[280px]">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-805">No invoices found</h3>
            <p className="text-slate-450 text-xs max-w-sm leading-relaxed">
              Issue Tax Invoices, track client payments, calculate GST splits, and generate professional PDFs.
            </p>
          </div>
          <Link
            href="/invoices/new"
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            Create Invoice
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card-panel rounded-xl overflow-hidden bg-white shadow-sm border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                    <th className="px-6 py-3.5">Invoice No</th>
                    <th className="px-6 py-3.5">Client</th>
                    <th className="px-6 py-3.5">Invoice Date</th>
                    <th className="px-6 py-3.5">Due Date</th>
                    <th className="px-6 py-3.5">Total</th>
                    <th className="px-6 py-3.5">Amount Paid</th>
                    <th className="px-6 py-3.5">Balance Due</th>
                    <th className="px-6 py-3.5">Payment</th>
                    <th className="px-6 py-3.5">Invoice Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {invoices.map((invoice) => (
                    <tr key={invoice._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900 font-mono">
                        {invoice.documentNumber}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-800 block">
                          {invoice.clientSnapshot?.businessName || invoice.clientSnapshot?.clientName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(invoice.issueDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {invoice.validTill ? (
                          new Date(invoice.validTill).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        ₹{invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        ₹{invoice.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        ₹{invoice.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        {getPaymentStatusBadge(invoice.paymentStatus)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(invoice.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/invoices/${invoice._id}`}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View / Customize"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          {invoice.status === 'DRAFT' && (
                            <Link
                              href={`/invoices/${invoice._id}/edit`}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Draft"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </Link>
                          )}
                          <button
                            onClick={() => handleDuplicate(invoice._id)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Duplicate"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                          </button>
                          
                          {invoice.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleCancelInvoice(invoice._id, invoice.documentNumber)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Cancel / Void Invoice"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                          )}

                          {invoice.status === 'DRAFT' ? (
                            <button
                              onClick={() => handleDeleteDraft(invoice._id, invoice.documentNumber)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Delete Draft"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          ) : (
                            <div className="w-8 h-8 flex-shrink-0" /> // empty spacer placeholder to match layout
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border border-slate-350 bg-white hover:bg-slate-50 font-semibold rounded-lg text-slate-700 disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <span className="text-slate-500">
                  Page <span className="font-bold text-slate-900">{page}</span> of <span className="font-bold text-slate-900">{totalPages}</span>
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border border-slate-350 bg-white hover:bg-slate-50 font-semibold rounded-lg text-slate-700 disabled:opacity-50 transition-colors"
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
