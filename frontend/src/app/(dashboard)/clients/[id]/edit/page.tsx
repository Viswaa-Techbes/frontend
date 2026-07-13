'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import PageHeader from '@/components/PageHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { INDIAN_STATES } from '@/lib/constants';

interface AddressState {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  stateCode: string;
  country: string;
  pincode: string;
}

const initialAddress = (): AddressState => ({
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  stateCode: '',
  country: 'India',
  pincode: '',
});

export default function EditClientPage() {
  const router = useRouter();
  const { id } = useParams();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [clientType, setClientType] = useState<'BUSINESS' | 'INDIVIDUAL'>('BUSINESS');
  const [clientName, setClientName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [openingBalance, setOpeningBalance] = useState(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Address states
  const [billingAddress, setBillingAddress] = useState<AddressState>(initialAddress());
  const [shippingAddress, setShippingAddress] = useState<AddressState>(initialAddress());
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Field errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const response = await api.get(`/clients/${id}`);
        if (response.data?.success) {
          const client = response.data.data;
          setClientType(client.clientType);
          setClientName(client.clientName || '');
          setBusinessName(client.businessName || '');
          setEmail(client.email || '');
          setPhone(client.phone || '');
          setGstin(client.gstin || '');
          setPan(client.pan || '');
          setOpeningBalance(client.openingBalance || 0);
          setNotes(client.notes || '');
          setStatus(client.status || 'ACTIVE');

          let hasBilling = false;
          if (client.billingAddress) {
            hasBilling = true;
            setBillingAddress({
              addressLine1: client.billingAddress.addressLine1 || '',
              addressLine2: client.billingAddress.addressLine2 || '',
              city: client.billingAddress.city || '',
              state: client.billingAddress.state || '',
              stateCode: client.billingAddress.stateCode || '',
              country: client.billingAddress.country || 'India',
              pincode: client.billingAddress.pincode || '',
            });
          }

          if (client.shippingAddress) {
            setShippingAddress({
              addressLine1: client.shippingAddress.addressLine1 || '',
              addressLine2: client.shippingAddress.addressLine2 || '',
              city: client.shippingAddress.city || '',
              state: client.shippingAddress.state || '',
              stateCode: client.shippingAddress.stateCode || '',
              country: client.shippingAddress.country || 'India',
              pincode: client.shippingAddress.pincode || '',
            });
          }
          
          if (client.billingAddress && client.shippingAddress) {
            // Check if shipping matches billing
            const isSame = 
              client.billingAddress.addressLine1 === client.shippingAddress.addressLine1 &&
              client.billingAddress.city === client.shippingAddress.city &&
              client.billingAddress.state === client.shippingAddress.state &&
              client.billingAddress.pincode === client.shippingAddress.pincode;
            setSameAsBilling(isSame);
          }
        }
      } catch (err: any) {
        showToast(err.response?.data?.message || 'Failed to load client details.', 'error');
        router.push('/clients');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchClient();
    }
  }, [id]);

  const handleStateChange = (type: 'billing' | 'shipping', stateName: string) => {
    const selected = INDIAN_STATES.find(s => s.name === stateName);
    const update = {
      state: stateName,
      stateCode: selected ? selected.stateCode : '',
    };

    if (type === 'billing') {
      setBillingAddress(prev => ({ ...prev, ...update }));
      if (sameAsBilling) {
        setShippingAddress(prev => ({ ...prev, ...update }));
      }
    } else {
      setShippingAddress(prev => ({ ...prev, ...update }));
    }
  };

  const handleAddressFieldChange = (type: 'billing' | 'shipping', field: keyof AddressState, value: string) => {
    if (type === 'billing') {
      setBillingAddress(prev => {
        const next = { ...prev, [field]: value };
        if (sameAsBilling) {
          setShippingAddress(next);
        }
        return next;
      });
    } else {
      setShippingAddress(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleCopyAddressToggle = (checked: boolean) => {
    setSameAsBilling(checked);
    if (checked) {
      setShippingAddress({ ...billingAddress });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!clientName.trim()) {
      newErrors.clientName = 'Client Name / Contact Person is required';
    }
    if (clientType === 'BUSINESS' && !businessName.trim()) {
      newErrors.businessName = 'Business/Company Name is required for Business entity';
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = 'Please provide a valid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      showToast('Please correct form validation errors.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        clientType,
        clientName: clientName.trim(),
        businessName: clientType === 'BUSINESS' ? businessName.trim() : undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        gstin: gstin.trim() || undefined,
        pan: pan.trim() || undefined,
        billingAddress,
        shippingAddress,
        openingBalance,
        notes: notes.trim() || undefined,
        status,
      };

      const response = await api.put(`/clients/${id}`, payload);
      if (response.data?.success) {
        showToast('Client profile updated successfully!', 'success');
        router.push(`/clients/${id}`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update client profile.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="card-panel p-16 rounded-xl flex items-center justify-center min-h-[300px]">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Edit Client"
        subtitle={`Modify configuration records for ${clientName}`}
      />

      <form onSubmit={handleSubmit} className="space-y-6 text-slate-800">
        {/* Core Settings Block */}
        <div className="card-panel p-6 rounded-xl space-y-6 bg-white">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Primary Classification</h3>

          {/* Toggle Type */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setClientType('BUSINESS');
                setErrors({});
              }}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all duration-200 ${
                clientType === 'BUSINESS'
                  ? 'bg-blue-50/50 border-brand-primary text-brand-primary'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="text-xs font-bold">Business Entity</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setClientType('INDIVIDUAL');
                setErrors({});
              }}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all duration-200 ${
                clientType === 'INDIVIDUAL'
                  ? 'bg-blue-50/50 border-brand-primary text-brand-primary'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs font-bold">Individual / Person</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">Client Name / Contact Person *</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className={`w-full form-input text-xs text-slate-900 placeholder:text-slate-400 ${errors.clientName ? 'border-rose-450 focus:border-rose-500' : ''}`}
                placeholder="e.g. Johnathan Doe"
              />
              {errors.clientName && (
                <p className="text-[10px] text-rose-500 mt-1">{errors.clientName}</p>
              )}
            </div>

            {clientType === 'BUSINESS' && (
              <div>
                <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">Business / Company Name *</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className={`w-full form-input text-xs text-slate-900 placeholder:text-slate-400 ${errors.businessName ? 'border-rose-450 focus:border-rose-500' : ''}`}
                  placeholder="e.g. Acme Tech Solutions Private Limited"
                />
                {errors.businessName && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.businessName}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Contact & Tax Details Block */}
        <div className="card-panel p-6 rounded-xl space-y-6 bg-white">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Contacts & Registrations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full form-input text-xs text-slate-900 placeholder:text-slate-400 ${errors.email ? 'border-rose-450 focus:border-rose-500' : ''}`}
                placeholder="client@company.com"
              />
              {errors.email && (
                <p className="text-[10px] text-rose-500 mt-1">{errors.email}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                placeholder="+91 XXXXX XXXXX"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">GSTIN</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                className="w-full form-input text-xs uppercase text-slate-900 placeholder:text-slate-400"
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">PAN</label>
              <input
                type="text"
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                className="w-full form-input text-xs uppercase text-slate-900 placeholder:text-slate-400"
                placeholder="ABCDE1234F"
              />
            </div>
          </div>
        </div>

        {/* Billing Address Block */}
        <div className="card-panel p-6 rounded-xl space-y-6 bg-white">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Billing Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">Address Line 1</label>
              <input
                type="text"
                value={billingAddress.addressLine1}
                onChange={(e) => handleAddressFieldChange('billing', 'addressLine1', e.target.value)}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                placeholder="Street address, building, plot number"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">Address Line 2</label>
              <input
                type="text"
                value={billingAddress.addressLine2}
                onChange={(e) => handleAddressFieldChange('billing', 'addressLine2', e.target.value)}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                placeholder="Floor, suite, landmark, locality"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">City</label>
              <input
                type="text"
                value={billingAddress.city}
                onChange={(e) => handleAddressFieldChange('billing', 'city', e.target.value)}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                placeholder="e.g. Bengaluru"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">State</label>
              <select
                value={billingAddress.state}
                onChange={(e) => handleStateChange('billing', e.target.value)}
                className="w-full form-input text-xs bg-white text-slate-900"
              >
                <option value="">Select State</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.name} ({s.stateCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">Pincode</label>
              <input
                type="text"
                value={billingAddress.pincode}
                onChange={(e) => handleAddressFieldChange('billing', 'pincode', e.target.value)}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                placeholder="560001"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">Country</label>
              <input
                type="text"
                value={billingAddress.country}
                onChange={(e) => handleAddressFieldChange('billing', 'country', e.target.value)}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Shipping Address Block */}
        <div className="card-panel p-6 rounded-xl space-y-6 bg-white">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Shipping Address</h3>
            <label className="flex items-center gap-2 text-xs font-semibold text-blue-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sameAsBilling}
                onChange={(e) => handleCopyAddressToggle(e.target.checked)}
                className="rounded border-slate-350 bg-white text-brand-primary focus:ring-0 focus:ring-offset-0 w-4 h-4"
              />
              Same as Billing Address
            </label>
          </div>

          {!sameAsBilling && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">Address Line 1</label>
                <input
                  type="text"
                  value={shippingAddress.addressLine1}
                  onChange={(e) => handleAddressFieldChange('shipping', 'addressLine1', e.target.value)}
                  className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                  placeholder="Street address, building, plot number"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">Address Line 2</label>
                <input
                  type="text"
                  value={shippingAddress.addressLine2}
                  onChange={(e) => handleAddressFieldChange('shipping', 'addressLine2', e.target.value)}
                  className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                  placeholder="Floor, suite, landmark, locality"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">City</label>
                <input
                  type="text"
                  value={shippingAddress.city}
                  onChange={(e) => handleAddressFieldChange('shipping', 'city', e.target.value)}
                  className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                  placeholder="e.g. Mumbai"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">State</label>
                <select
                  value={shippingAddress.state}
                  onChange={(e) => handleStateChange('shipping', e.target.value)}
                  className="w-full form-input text-xs bg-white text-slate-900"
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.name}>
                      {s.name} ({s.stateCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">Pincode</label>
                <input
                  type="text"
                  value={shippingAddress.pincode}
                  onChange={(e) => handleAddressFieldChange('shipping', 'pincode', e.target.value)}
                  className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                  placeholder="400001"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">Country</label>
                <input
                  type="text"
                  value={shippingAddress.country}
                  onChange={(e) => handleAddressFieldChange('shipping', 'country', e.target.value)}
                  className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Financial Details and Settings Block */}
        <div className="card-panel p-6 rounded-xl space-y-6 bg-white">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Financial References</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">Opening Balance (INR)</label>
              <input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full form-input text-xs bg-white text-slate-900"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-655 text-slate-650 mb-2">Internal Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full form-input text-xs min-h-[100px] resize-y text-slate-900 placeholder:text-slate-400"
                placeholder="Any special remarks or payment instructions..."
              />
            </div>
          </div>
        </div>

        {/* Actions panel */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/clients/${id}`}
            className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-705 text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-2 shadow-sm transition-colors"
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
