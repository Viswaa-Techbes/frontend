'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function SettingsPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Business profile states
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');

  // Address
  const [address, setAddress] = useState<AddressState>({
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    stateCode: '',
    country: 'India',
    pincode: '',
  });

  // Bank details
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [branchName, setBranchName] = useState('');
  const [upiId, setUpiId] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/business');
        if (response.data?.success && response.data.data?.business) {
          const biz = response.data.data.business;
          setBusinessName(biz.businessName || '');
          setEmail(biz.email || '');
          setPhone(biz.phone || '');
          setWebsite(biz.website || '');
          setGstin(biz.gstin || '');
          setPan(biz.pan || '');
          setLogoUrl(biz.logoUrl || '');
          setSignatureUrl(biz.signatureUrl || '');

          if (biz.address) {
            setAddress({
              addressLine1: biz.address.addressLine1 || '',
              addressLine2: biz.address.addressLine2 || '',
              city: biz.address.city || '',
              state: biz.address.state || '',
              stateCode: biz.address.stateCode || '',
              country: biz.address.country || 'India',
              pincode: biz.address.pincode || '',
            });
          }

          setBankName(biz.bankName || '');
          setAccountNumber(biz.accountNumber || '');
          setIfsc(biz.ifsc || '');
          setBranchName(biz.branchName || '');
          setUpiId(biz.upiId || '');
        }
      } catch (err: any) {
        showToast('Failed to fetch business profile details.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleStateChange = (stateName: string) => {
    const selected = INDIAN_STATES.find((s) => s.name === stateName);
    setAddress((prev) => ({
      ...prev,
      state: stateName,
      stateCode: selected ? selected.stateCode : '',
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'signature') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limits
    if (type === 'signature' && file.size > 1 * 1024 * 1024) {
      showToast('Signature file size must be less than 1MB', 'error');
      return;
    }
    if (type === 'logo' && file.size > 2 * 1024 * 1024) {
      showToast('Logo file size must be less than 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (type === 'logo') {
        setLogoUrl(base64String);
      } else {
        setSignatureUrl(base64String);
      }
      showToast(`${type === 'logo' ? 'Logo' : 'Signature'} loaded successfully!`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!businessName.trim()) {
      newErrors.businessName = 'Business Name is required';
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = 'Please provide a valid email format';
    }
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/.test(gstin.toUpperCase())) {
      newErrors.gstin = 'Please provide a valid 15-digit GSTIN (e.g. 29AAAAA0000A1Z5)';
    }
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase())) {
      newErrors.pan = 'Please provide a valid 10-digit PAN (e.g. ABCDE1234F)';
    }
    if (address.state && !address.stateCode) {
      newErrors.state = 'Invalid state selection';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      showToast('Please correct validation errors before saving.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        businessName: businessName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        gstin: gstin.trim().toUpperCase() || undefined,
        pan: pan.trim().toUpperCase() || undefined,
        address,
        logoUrl: logoUrl || undefined,
        bankName: bankName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        ifsc: ifsc.trim().toUpperCase() || undefined,
        branchName: branchName.trim() || undefined,
        upiId: upiId.trim() || undefined,
        signatureUrl: signatureUrl || undefined,
      };

      const response = await api.put('/business', payload);
      if (response.data?.success) {
        showToast('Business profile settings saved successfully!', 'success');
        router.push('/quotations/new');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save business settings.', 'error');
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
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      <PageHeader
        title="Business Settings"
        subtitle="Manage your company details, tax registration records, bank details, and logo assets."
        actions={
          <Link
            href="/settings/import"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-600 bg-white rounded-xl shadow-sm transition-colors"
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Excel File
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6 text-slate-800">
        {/* Core Profile Card */}
        <div className="card-panel p-6 rounded-xl bg-white space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Company Identity Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-650 mb-2">Business / Company Name *</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className={`w-full form-input text-xs text-slate-900 placeholder:text-slate-400 ${
                  errors.businessName ? 'border-rose-450 focus:border-rose-500' : ''
                }`}
                placeholder="e.g. TechBes Solutions Private Limited"
              />
              {errors.businessName && (
                <p className="text-[10px] text-rose-500 mt-1">{errors.businessName}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-650 mb-2">Company Website</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                placeholder="e.g. www.techbes.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-650 mb-2">Business Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full form-input text-xs text-slate-900 placeholder:text-slate-400 ${
                  errors.email ? 'border-rose-450 focus:border-rose-500' : ''
                }`}
                placeholder="billing@techbes.com"
              />
              {errors.email && (
                <p className="text-[10px] text-rose-500 mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-650 mb-2">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                placeholder="+91 XXXXX XXXXX"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-650 mb-2">GSTIN</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                className={`w-full form-input text-xs uppercase text-slate-900 placeholder:text-slate-400 ${
                  errors.gstin ? 'border-rose-450 focus:border-rose-500' : ''
                }`}
                placeholder="e.g. 29AAAAA0000A1Z5"
              />
              {errors.gstin && (
                <p className="text-[10px] text-rose-500 mt-1">{errors.gstin}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-650 mb-2">PAN</label>
              <input
                type="text"
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                className={`w-full form-input text-xs uppercase text-slate-900 placeholder:text-slate-400 ${
                  errors.pan ? 'border-rose-450 focus:border-rose-500' : ''
                }`}
                placeholder="e.g. ABCDE1234F"
              />
              {errors.pan && (
                <p className="text-[10px] text-rose-500 mt-1">{errors.pan}</p>
              )}
            </div>
          </div>
        </div>

        {/* Address Card */}
        <div className="card-panel p-6 rounded-xl bg-white space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Corporate Office Address</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-650 mb-2">Address Line 1</label>
              <input
                type="text"
                value={address.addressLine1}
                onChange={(e) => setAddress((p) => ({ ...p, addressLine1: e.target.value }))}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                placeholder="Street name, corporate suite, complex number"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-650 mb-2">Address Line 2</label>
              <input
                type="text"
                value={address.addressLine2}
                onChange={(e) => setAddress((p) => ({ ...p, addressLine2: e.target.value }))}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                placeholder="Building floor, landmark, locality"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-650 mb-2">City</label>
              <input
                type="text"
                value={address.city}
                onChange={(e) => setAddress((p) => ({ ...p, city: e.target.value }))}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                placeholder="e.g. Bengaluru"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-650 mb-2">State</label>
              <select
                value={address.state}
                onChange={(e) => handleStateChange(e.target.value)}
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
              <label className="block text-xs font-semibold text-slate-650 mb-2">Pincode</label>
              <input
                type="text"
                value={address.pincode}
                onChange={(e) => setAddress((p) => ({ ...p, pincode: e.target.value }))}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                placeholder="e.g. 560001"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-650 mb-2">Country</label>
              <input
                type="text"
                value={address.country}
                onChange={(e) => setAddress((p) => ({ ...p, country: e.target.value }))}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Banking Details Card */}
        <div className="card-panel p-6 rounded-xl bg-white space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Settlement Bank Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-650 mb-2">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                placeholder="e.g. HDFC Bank"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-650 mb-2">Account Number</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400 font-mono"
                placeholder="e.g. 5010029384812"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-650 mb-2">IFSC Code</label>
              <input
                type="text"
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                className="w-full form-input text-xs uppercase text-slate-900 placeholder:text-slate-400 font-mono"
                placeholder="e.g. HDFC0000123"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-650 mb-2">Branch Name</label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400"
                placeholder="e.g. Koramangala Branch"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-650 mb-2">UPI ID</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full form-input text-xs text-slate-900 placeholder:text-slate-400 font-mono"
                placeholder="e.g. techbes@okaxis"
              />
            </div>
          </div>
        </div>

        {/* Media & Logo Assets Card */}
        <div className="card-panel p-6 rounded-xl bg-white space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Assets & Signature</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Logo Upload area */}
            <div className="space-y-4">
              <span className="block text-xs font-semibold text-slate-655 text-slate-650">Business Logo</span>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden shadow-inner">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <svg className="w-8 h-8 text-slate-350" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375 0 11-.75 0 .375 0 01.75 0z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label className="inline-block px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 cursor-pointer transition-colors shadow-sm">
                    Select File
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'logo')}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[10px] text-slate-400">PNG, JPG formats supported. Max 2MB.</p>
                </div>
              </div>
            </div>

            {/* Signature Upload Area */}
            <div className="space-y-4">
              <span className="block text-xs font-semibold text-slate-655 text-slate-650">Authorized Signature</span>
              <div className="flex items-center gap-4">
                <div className="w-24 h-12 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden shadow-inner">
                  {signatureUrl ? (
                    <img src={signatureUrl} alt="Signature Preview" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <svg className="w-6 h-6 text-slate-350" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label className="inline-block px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 cursor-pointer transition-colors shadow-sm">
                    Select File
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'signature')}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[10px] text-slate-400">Transparent PNG recommended. Max 2MB.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions panel */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Link
            href="/quotations/new"
            className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-2 shadow-sm transition-colors"
          >
            {submitting ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
