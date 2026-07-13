'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import PageHeader from '@/components/PageHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface SalesOrderType {
  _id: string;
  documentNumber: string;
  clientSnapshot: { clientName: string; businessName?: string };
  issueDate: string;
  grandTotal: number;
  status: 'DRAFT' | 'ISSUED' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  poNumber?: string;
  linkedDocuments?: { documentNumber: string; documentType: string }[];
  createdAt: string;
}

export default function SalesOrdersListPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<SalesOrderType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('documentType', 'SALES_ORDER');
      if (search) params.append('search', search);
      if (activeTab !== 'ALL') params.append('status', activeTab);
      params.append('page', page.toString());
      params.append('limit', '15');

      const res = await api.get(`/documents?${params.toString()}`);
      if (res.data?.success) {
        setOrders(res.data.data.documents || []);
        setTotalPages(res.data.data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to retrieve sales orders.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchOrders();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [search, activeTab, page]);

  const handleDeleteDraft = async (id: string, num: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete draft sales order ${num}?`)) return;
    try {
      const res = await api.delete(`/documents/${id}`);
      if (res.data?.success) {
        showToast(`Draft sales order ${num} deleted successfully.`, 'success');
        fetchOrders();
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
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 space-y-6 text-slate-800">
      <PageHeader
        title="Sales Orders"
        subtitle="Manage client purchase confirmations and order processing workflows."
        actions={
          <Link
            href="/sales-orders/new"
            className="h-10 px-4 rounded-xl text-xs font-semibold btn-primary flex items-center gap-2 shadow-sm transition-all whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Order
          </Link>
        }
      />

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6 text-xs leading-none pb-0">
        {['ALL', 'DRAFT', 'ISSUED', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED'].map((tab) => (
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
            {tab === 'ALL' ? 'All Orders' : tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Filter Toolbar */}
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
            placeholder="Search by Sales Order number, client, PO ref..."
            className="w-full pl-9 h-9 form-input text-xs text-slate-905 placeholder:text-slate-400 bg-transparent border-0 focus:ring-0"
          />
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 flex items-center justify-center min-h-[300px]">
          <LoadingSpinner size="md" />
        </div>
      ) : orders.length === 0 ? (
        /* Redesigned Compact Empty State */
        <div className="bg-white p-10 rounded-xl border border-slate-200 text-center space-y-4 max-w-xl mx-auto my-4 flex flex-col justify-center items-center min-h-[280px]">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-805">No Sales Orders found</h3>
            <p className="text-slate-450 text-xs max-w-sm leading-relaxed">
              Generate and track confirmed purchase orders, and convert them directly to Tax Invoices.
            </p>
          </div>
          <Link
            href="/sales-orders/new"
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            Create Order
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card-panel rounded-xl overflow-hidden bg-white shadow-sm border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="px-6 py-3.5">Order Number</th>
                    <th className="px-6 py-3.5">Client</th>
                    <th className="px-6 py-3.5">Order Date</th>
                    <th className="px-6 py-3.5">PO Number</th>
                    <th className="px-6 py-3.5 text-right">Total Amount</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Linked Docs</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {orders.map((order) => {
                    const linked = order.linkedDocuments?.map((ld) => ld.documentNumber).join(', ') || 'None';
                    return (
                      <tr key={order._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-905 font-mono">
                          {order.documentNumber}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-800 block">
                            {order.clientSnapshot?.businessName || order.clientSnapshot?.clientName}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(order.issueDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 text-slate-550 font-mono">
                          {order.poNumber || '—'}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                          ₹{order.grandTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(order.status)}
                        </td>
                        <td className="px-6 py-4 text-slate-450 font-mono text-[10px]">
                          {linked}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/sales-orders/${order._id}`}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Link>

                            {order.status === 'DRAFT' && (
                              <>
                                <Link
                                  href={`/sales-orders/${order._id}/edit`}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="Edit Order"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </Link>

                                <button
                                  onClick={() => handleDeleteDraft(order._id, order.documentNumber)}
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
