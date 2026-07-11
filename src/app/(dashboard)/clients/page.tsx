'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';
import PageHeader from '../../../components/PageHeader';
import Modal from '../../../components/ui/Modal';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

interface ClientType {
  _id: string;
  clientType: 'BUSINESS' | 'INDIVIDUAL';
  clientName: string;
  businessName?: string;
  email?: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export default function ClientsPage() {
  const { showToast } = useToast();
  const [clients, setClients] = useState<ClientType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Modal states for delete confirmation
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientType | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch data
  const fetchClients = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (status) queryParams.append('status', status);
      queryParams.append('page', page.toString());
      queryParams.append('limit', '10');

      const response = await api.get(`/clients?${queryParams.toString()}`);
      if (response.data?.success) {
        setClients(response.data.data.clients || []);
        setTotalPages(response.data.data.pagination?.totalPages || 1);
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
    }, 400); // Debounce search changes

    return () => clearTimeout(delayDebounceFn);
  }, [search, status, page]);

  const handleDeleteClick = (client: ClientType) => {
    setClientToDelete(client);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!clientToDelete) return;
    setDeleting(true);
    try {
      const response = await api.delete(`/clients/${clientToDelete._id}`);
      if (response.data?.success || response.status === 200) {
        showToast('Client deleted successfully', 'success');
        setIsDeleteModalOpen(false);
        setClientToDelete(null);
        fetchClients();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete client.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Clients"
        subtitle="Manage information, billing references, and histories for your clients."
        actions={
          <Link href="/clients/new" className="px-4 py-2.5 rounded-xl text-sm font-semibold btn-primary flex items-center gap-2 shadow-lg shadow-indigo-500/10">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Client
          </Link>
        }
      />

      {/* Filters Area */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
            className="w-full pl-10 form-input text-sm"
          />
        </div>

        {/* Status Dropdown */}
        <div className="w-full md:w-48">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full form-input text-sm bg-slate-950"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Client Table / Grid */}
      {loading ? (
        <div className="glass-panel p-16 rounded-2xl flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : clients.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-300">No Clients Found</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm">
            Try adjusting your search criteria, filter configuration, or click Add Client to register a new client.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider bg-slate-900/30">
                    <th className="px-6 py-4">Client</th>
                    <th className="px-6 py-4">Company Name</th>
                    <th className="px-6 py-4">Contact Info</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300 text-sm">
                  {clients.map((client) => (
                    <tr key={client._id} className="hover:bg-slate-850/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            client.clientType === 'BUSINESS'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                          }`}>
                            {client.clientType === 'BUSINESS' ? 'B' : 'I'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-200">{client.clientName}</p>
                            <p className="text-[10px] text-slate-500">{client.clientType}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {client.businessName || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-slate-300">{client.email || '—'}</p>
                        <p className="text-xs text-slate-500">{client.phone || '—'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          client.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${client.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                          {client.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/clients/${client._id}`}
                            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          <Link
                            href={`/clients/${client._id}/edit`}
                            className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </Link>
                          <button
                            onClick={() => handleDeleteClick(client)}
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
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
            <div className="flex justify-between items-center px-2 py-4">
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Client Deletion"
        footer={
          <>
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 border border-slate-800 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg shadow-rose-900/10 transition-colors"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </>
        }
      >
        <p>Are you sure you want to delete <span className="font-semibold text-slate-100">{clientToDelete?.clientName}</span>?</p>
        <p className="mt-2 text-slate-500 text-xs">This action will soft-delete the client. You can restore them later or set status to inactive if you want to keep records.</p>
      </Modal>
    </div>
  );
}
