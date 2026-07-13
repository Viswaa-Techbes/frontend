'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

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

  // Delete/status modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

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

  const handleToggleStatus = async () => {
    if (!client) return;
    setUpdatingStatus(true);
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
        setIsStatusModalOpen(false);
        fetchClientDetails();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update client status.', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="card-panel p-16 rounded-xl flex items-center justify-center min-h-[300px]">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!client) return null;

  const renderAddress = (addr?: Address) => {
    if (!addr || (!addr.addressLine1 && !addr.city)) {
      return <p className="text-slate-400 text-xs">No address registered.</p>;
    }
    return (
      <div className="text-slate-600 text-xs space-y-0.5 font-sans">
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
    <div className="space-y-6 text-slate-800">
      {/* Header */}
      <PageHeader
        title={client.clientType === 'BUSINESS' ? (client.businessName || client.clientName) : client.clientName}
        subtitle={client.clientType === 'BUSINESS' ? `Contact: ${client.clientName}` : 'Individual Customer'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/clients"
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              Back to List
            </Link>
            <Link
              href={`/clients/${client._id}/edit`}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              Edit Client
            </Link>
            <button
              onClick={() => setIsStatusModalOpen(true)}
              className={`px-4 py-2 border rounded-xl text-xs font-semibold transition-colors ${
                client.status === 'ACTIVE'
                  ? 'border-amber-200 text-amber-600 hover:bg-amber-50'
                  : 'border-emerald-250 text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              {client.status === 'ACTIVE' ? 'Mark Inactive' : 'Mark Active'}
            </button>
            <Link
              href={`/quotations/new?clientId=${client._id}`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
            >
              Create Quotation
            </Link>
          </div>
        }
      />

      {/* Financial Ledger Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-panel p-5 rounded-xl bg-white">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Sales</p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            ₹{summary?.totalSales?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
        <div className="card-panel p-5 rounded-xl bg-white">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Outstanding Dues</p>
          <p className="text-xl font-bold text-brand-accent mt-1">
            ₹{summary?.outstanding?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
        <div className="card-panel p-5 rounded-xl bg-white">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Opening Balance</p>
          <p className="text-xl font-bold text-slate-700 mt-1">
            ₹{summary?.openingBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic & Contact Info */}
        <div className="card-panel p-6 rounded-xl space-y-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Client Profile</h3>

          <div className="space-y-3.5 text-xs text-slate-700">
            <div className="grid grid-cols-3 border-b border-slate-100 pb-2.5">
              <span className="font-semibold text-slate-500">Client Type</span>
              <span className="col-span-2 font-medium text-slate-900">
                {client.clientType === 'BUSINESS' ? 'Business Entity' : 'Individual'}
              </span>
            </div>

            <div className="grid grid-cols-3 border-b border-slate-100 pb-2.5">
              <span className="font-semibold text-slate-500">Email</span>
              <span className="col-span-2 text-slate-900">{client.email || '—'}</span>
            </div>

            <div className="grid grid-cols-3 border-b border-slate-100 pb-2.5">
              <span className="font-semibold text-slate-500">Phone</span>
              <span className="col-span-2 text-slate-900">{client.phone || '—'}</span>
            </div>

            <div className="grid grid-cols-3 border-b border-slate-100 pb-2.5">
              <span className="font-semibold text-slate-500">GSTIN</span>
              <span className="col-span-2 text-slate-900 font-mono">{client.gstin || '—'}</span>
            </div>

            <div className="grid grid-cols-3 border-b border-slate-100 pb-2.5">
              <span className="font-semibold text-slate-500">PAN</span>
              <span className="col-span-2 text-slate-900 font-mono">{client.pan || '—'}</span>
            </div>

            <div className="grid grid-cols-3 pb-1">
              <span className="font-semibold text-slate-500">Status</span>
              <span className="col-span-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                  client.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  <span className={`w-1 h-1 rounded-full ${client.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {client.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="card-panel p-6 rounded-xl space-y-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Registered Addresses</h3>
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Billing Address</p>
              {renderAddress(client.billingAddress)}
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Shipping Address</p>
              {renderAddress(client.shippingAddress)}
            </div>
          </div>
        </div>

        {/* Internal Notes */}
        {client.notes && (
          <div className="card-panel p-6 rounded-xl space-y-3 md:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Internal Remarks</h3>
            <p className="text-slate-600 text-xs whitespace-pre-wrap leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
              {client.notes}
            </p>
          </div>
        )}
      </div>

      {/* Toggle Status Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={client.status === 'ACTIVE' ? 'Mark Client as Inactive' : 'Mark Client as Active'}
        footer={
          <>
            <button
              onClick={() => setIsStatusModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-55 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleToggleStatus}
              disabled={updatingStatus}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm text-white transition-colors ${
                client.status === 'ACTIVE'
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {updatingStatus ? 'Updating...' : client.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </button>
          </>
        }
      >
        <p className="text-xs text-slate-650">
          Are you sure you want to mark <span className="font-bold text-slate-900">{client.clientName}</span> as{' '}
          <span className="font-bold text-slate-900">{client.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}</span>?
        </p>
        <p className="mt-2 text-slate-500 text-[10px]">
          Inactive clients will not appear in search listings during quotation or document generation until re-activated.
        </p>
      </Modal>
    </div>
  );
}
