'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Address {
  addressLine1?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
}

interface ClientType {
  _id: string;
  clientType: 'BUSINESS' | 'INDIVIDUAL';
  clientName: string;
  businessName?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
  billingAddress?: Address;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export default function ClientsPage() {
  const { showToast } = useToast();
  const [clients, setClients] = useState<ClientType[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [stateFilter, setStateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Bulk actions states
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [deleteReport, setDeleteReport] = useState<{ deletedCount: number; failures: any[] } | null>(null);

  // Fetch clients
  const fetchClients = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      queryParams.append('status', activeTab);
      if (stateFilter) queryParams.append('state', stateFilter);
      queryParams.append('page', page.toString());
      queryParams.append('limit', '15');

      const response = await api.get(`/clients?${queryParams.toString()}`);
      if (response.data?.success) {
        setClients(response.data.data.clients || []);
        setTotalPages(response.data.data.pagination?.totalPages || 1);
        setSelectedClientIds([]); // clear selection when data changes
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to load clients list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchClients();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, activeTab, stateFilter, page]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClientIds(clients.map(c => c._id));
    } else {
      setSelectedClientIds([]);
    }
  };

  const handleSelectClient = (clientId: string, checked: boolean) => {
    if (checked) {
      setSelectedClientIds(prev => [...prev, clientId]);
    } else {
      setSelectedClientIds(prev => prev.filter(id => id !== clientId));
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleteLoading(true);
    try {
      const response = await api.post('/clients/bulk-delete', { ids: selectedClientIds });
      if (response.data?.success) {
        const { deletedCount, failures } = response.data.data;
        if (failures && failures.length > 0) {
          setDeleteReport({ deletedCount, failures });
          showToast(`Bulk delete processed. Deleted: ${deletedCount}, Failed: ${failures.length}`, 'warning');
        } else {
          showToast(`Successfully deleted ${deletedCount} client(s).`, 'success');
          setIsDeleteModalOpen(false);
          setSelectedClientIds([]);
        }
        fetchClients();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete selected clients.', 'error');
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  // Toggle client status (Active <-> Inactive)
  const handleToggleStatus = async (client: ClientType) => {
    setActionLoadingId(client._id);
    const newStatus = client.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const response = await api.put(`/clients/${client._id}`, {
        clientName: client.clientName,
        clientType: client.clientType,
        status: newStatus,
      });

      if (response.data?.success) {
        showToast(
          `Client marked as ${newStatus === 'ACTIVE' ? 'Active' : 'Inactive'} successfully.`, 
          'success'
        );
        fetchClients();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update client status.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setStateFilter('');
    setPage(1);
  };

  const hasActiveFilters = search !== '' || stateFilter !== '';

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 space-y-6 text-slate-800">
      {/* Header */}
      <PageHeader
        title="Clients & Prospects"
        subtitle="Manage billing details, references, and contact records."
        actions={
          <Link 
            href="/clients/new" 
            className="h-10 px-4 rounded-xl text-xs font-semibold btn-primary flex items-center gap-2 shadow-sm transition-all whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Client
          </Link>
        }
      />

      {/* Client Status Tabs */}
      <div className="border-b border-slate-200 flex gap-6 text-xs leading-none pb-0">
        <button
          onClick={() => {
            setActiveTab('ACTIVE');
            setPage(1);
          }}
          className={`pb-3.5 font-bold relative transition-colors ${
            activeTab === 'ACTIVE' ? 'text-blue-600 font-extrabold border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Active Clients
        </button>
        <button
          onClick={() => {
            setActiveTab('INACTIVE');
            setPage(1);
          }}
          className={`pb-3.5 font-bold relative transition-colors ${
            activeTab === 'INACTIVE' ? 'text-blue-600 font-extrabold border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Inactive Clients
        </button>
      </div>

      {/* Selected Items Action Bar */}
      {selectedClientIds.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-center justify-between gap-3 animate-fadeIn text-xs text-indigo-900 font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{selectedClientIds.length} client{selectedClientIds.length > 1 ? 's' : ''} selected</span>
          </div>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Selected
          </button>
        </div>
      )}

      {/* Client Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
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
            placeholder="Search name, company, email, phone..."
            className="w-full pl-9 h-9 form-input text-xs text-slate-905 placeholder:text-slate-400 bg-transparent border-0 focus:ring-0"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <input
            type="text"
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by State"
            className="h-9 px-3 rounded-lg border border-slate-200 text-xs w-full sm:w-36 text-slate-900 placeholder:text-slate-400"
          />

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors whitespace-nowrap"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 flex items-center justify-center min-h-[300px]">
          <LoadingSpinner size="md" />
        </div>
      ) : clients.length === 0 ? (
        /* Redesigned Compact Empty State */
        <div className="bg-white p-10 rounded-xl border border-slate-200 text-center space-y-4 max-w-xl mx-auto my-4 flex flex-col justify-center items-center min-h-[280px]">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-805">No clients found</h3>
            <p className="text-slate-450 text-xs max-w-sm leading-relaxed">
              Add your first client to start creating quotations and sales documents.
            </p>
          </div>
          <Link
            href="/clients/new"
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            Add Client
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card-panel rounded-xl overflow-hidden">
            <div className="overflow-x-auto font-sans">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                    <th className="px-6 py-3.5 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={clients.length > 0 && selectedClientIds.length === clients.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="px-6 py-3.5">Client / Business</th>
                    <th className="px-6 py-3.5">Contact Person</th>
                    <th className="px-6 py-3.5">Phone</th>
                    <th className="px-6 py-3.5">Email</th>
                    <th className="px-6 py-3.5">GSTIN</th>
                    <th className="px-6 py-3.5">State</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Created At</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {clients.map((client) => (
                    <tr key={client._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={selectedClientIds.includes(client._id)}
                          onChange={(e) => handleSelectClient(client._id, e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {client.clientType === 'BUSINESS' ? (
                          <span>{client.businessName || client.clientName}</span>
                        ) : (
                          <span>{client.clientName}</span>
                        )}
                        <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                          {client.clientType === 'BUSINESS' ? 'Business Entity' : 'Individual / Person'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-650">
                        {client.clientType === 'BUSINESS' ? client.clientName : '—'}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">
                        {client.phone || '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {client.email || '—'}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-500">
                        {client.gstin || '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {client.billingAddress?.state || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                          client.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${client.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-450'}`} />
                          {client.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {new Date(client.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/clients/${client._id}`}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Client Details"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          <Link
                            href={`/clients/${client._id}/edit`}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Client"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </Link>
                          <button
                            onClick={() => handleToggleStatus(client)}
                            disabled={actionLoadingId === client._id}
                            className={`p-1.5 rounded-lg transition-colors ${
                              client.status === 'ACTIVE'
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={client.status === 'ACTIVE' ? 'Mark Inactive' : 'Mark Active'}
                          >
                            {actionLoadingId === client._id ? (
                              <svg className="animate-spin h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : client.status === 'ACTIVE' ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </button>
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
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!bulkDeleteLoading) {
            setIsDeleteModalOpen(false);
            setDeleteReport(null);
          }
        }}
        title={deleteReport ? "Bulk Delete Results" : "Confirm Bulk Delete"}
        footer={
          deleteReport ? (
            <button
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeleteReport(null);
                setSelectedClientIds([]);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Close
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                disabled={bulkDeleteLoading}
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={bulkDeleteLoading}
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {bulkDeleteLoading && (
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Confirm Delete
              </button>
            </div>
          )
        }
      >
        {deleteReport ? (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-100">
              Successfully deleted {deleteReport.deletedCount} client(s).
            </div>
            {deleteReport.failures.length > 0 && (
              <div className="space-y-2">
                <span className="block text-xs font-bold text-rose-700">Failed Deletions ({deleteReport.failures.length}):</span>
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-100 rounded-lg p-2 bg-slate-50/50">
                  {deleteReport.failures.map((f, index) => (
                    <div key={index} className="text-xs p-2 bg-white border border-rose-100 rounded-md text-slate-700 flex flex-col gap-1">
                      <span className="font-bold text-slate-900">{f.name || 'Unknown Client'}</span>
                      <span className="text-rose-600 font-medium">{f.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Are you sure you want to delete the <strong>{selectedClientIds.length}</strong> selected client(s)?
            </p>
            <p className="text-[11px] text-rose-500 font-medium bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
              WARNING: This action is permanent and cannot be undone. Any clients with linked invoices or documents will not be deleted to preserve database integrity.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
