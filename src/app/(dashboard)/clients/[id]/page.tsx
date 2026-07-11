'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../lib/api';
import { useToast } from '../../../../context/ToastContext';
import PageHeader from '../../../../components/PageHeader';
import Modal from '../../../../components/ui/Modal';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';

interface Address {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  country?: string;
  pincode?: string;
}

interface ClientDetail {
  _id: string;
  clientType: 'BUSINESS' | 'INDIVIDUAL';
  clientName: string;
  businessName?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  openingBalance: number;
  notes?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface ClientSummary {
  totalSales: number;
  outstanding: number;
  openingBalance: number;
}

export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { showToast } = useToast();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [summary, setSummary] = useState<ClientSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchClientDetails = async () => {
    setLoading(true);
    try {
      const [detailRes, summaryRes] = await Promise.all([
        api.get(`/clients/${id}`),
        api.get(`/clients/${id}/summary`),
      ]);

      if (detailRes.data?.success) {
        setClient(detailRes.data.data);
      }
      if (summaryRes.data?.success) {
        setSummary(summaryRes.data.data);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to retrieve client details.', 'error');
      router.push('/clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchClientDetails();
    }
  }, [id]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const response = await api.delete(`/clients/${id}`);
      if (response.data?.success || response.status === 200) {
        showToast('Client deleted successfully', 'success');
        setIsDeleteModalOpen(false);
        router.push('/clients');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to delete client.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel p-16 rounded-2xl flex items-center justify-center min-h-[300px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!client) return null;

  const renderAddress = (addr?: Address) => {
    if (!addr || (!addr.addressLine1 && !addr.city)) {
      return <p className="text-slate-500 text-sm">No address registered.</p>;
    }
    return (
      <div className="text-slate-300 text-sm space-y-0.5">
        <p>{addr.addressLine1}</p>
        {addr.addressLine2 && <p>{addr.addressLine2}</p>}
        <p>
          {addr.city && `${addr.city}, `}
          {addr.state && `${addr.state}`}
          {addr.pincode && ` - ${addr.pincode}`}
        </p>
        <p>{addr.country}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={client.clientName}
        subtitle={client.businessName ? `Company: ${client.businessName}` : 'Individual Customer'}
        actions={
          <div className="flex gap-2">
            <Link
              href="/clients"
              className="px-4 py-2 border border-slate-800 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
            >
              Back to List
            </Link>
            <Link
              href={`/clients/${client._id}/edit`}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Edit Client
            </Link>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Delete
            </button>
          </div>
        }
      />

      {/* Financial Ledger Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales</p>
          <p className="text-2xl font-bold text-slate-100 mt-2">
            ₹{summary?.totalSales?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Outstanding Dues</p>
          <p className="text-2xl font-bold text-amber-400 mt-2">
            ₹{summary?.outstanding?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Opening Balance</p>
          <p className="text-2xl font-bold text-slate-300 mt-2">
            ₹{summary?.openingBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic & Contact Info */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">Client Profile</h3>

          <div className="space-y-4">
            <div className="grid grid-cols-3 border-b border-slate-800/60 pb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase">Client Type</span>
              <span className="col-span-2 text-sm text-slate-200">{client.clientType}</span>
            </div>

            <div className="grid grid-cols-3 border-b border-slate-800/60 pb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase">Email</span>
              <span className="col-span-2 text-sm text-slate-200">{client.email || '—'}</span>
            </div>

            <div className="grid grid-cols-3 border-b border-slate-800/60 pb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase">Phone</span>
              <span className="col-span-2 text-sm text-slate-200">{client.phone || '—'}</span>
            </div>

            <div className="grid grid-cols-3 border-b border-slate-800/60 pb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase">GSTIN</span>
              <span className="col-span-2 text-sm text-slate-200 font-mono">{client.gstin || '—'}</span>
            </div>

            <div className="grid grid-cols-3 border-b border-slate-800/60 pb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase">PAN</span>
              <span className="col-span-2 text-sm text-slate-200 font-mono">{client.pan || '—'}</span>
            </div>

            <div className="grid grid-cols-3 pb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase">Status</span>
              <span className="col-span-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  client.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${client.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                  {client.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">Registered Addresses</h3>
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Billing Address</p>
              {renderAddress(client.billingAddress)}
            </div>
            <div className="border-t border-slate-800/60 pt-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Shipping Address</p>
              {renderAddress(client.shippingAddress)}
            </div>
          </div>
        </div>

        {/* Internal Notes */}
        {client.notes && (
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3 md:col-span-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">Internal Remarks</h3>
            <p className="text-slate-350 text-sm whitespace-pre-wrap leading-relaxed bg-slate-950/20 p-4 rounded-xl border border-slate-800/60">
              {client.notes}
            </p>
          </div>
        )}
      </div>

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
        <p>Are you sure you want to delete <span className="font-semibold text-slate-100">{client.clientName}</span>?</p>
        <p className="mt-2 text-slate-500 text-xs">This action will soft-delete the client. You can restore them later or set status to inactive if you want to keep records.</p>
      </Modal>
    </div>
  );
}
