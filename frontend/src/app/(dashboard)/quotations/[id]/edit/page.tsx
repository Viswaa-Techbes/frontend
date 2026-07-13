'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import PageHeader from '@/components/PageHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { INDIAN_STATES } from '@/lib/constants';

export default function EditQuotationPage() {
  const router = useRouter();
  const { id } = useParams();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2>(1); // Step 1: Edit, Step 2: Review

  // Core business & clients lists
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);

  // Form Fields
  const [documentNumber, setDocumentNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [validTill, setValidTill] = useState('');
  
  // Shipping details toggle & override values
  const [enableShipping, setEnableShipping] = useState(false);
  const [shippingAddress, setShippingAddress] = useState({
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    stateCode: '',
    country: 'India',
    pincode: '',
  });

  // GST Config
  const [placeOfSupply, setPlaceOfSupply] = useState({
    state: '',
    stateCode: '',
  });

  // Line items
  const [items, setItems] = useState<any[]>([]);

  // Document discount
  const [enableDocDiscount, setEnableDocDiscount] = useState(false);
  const [docDiscountType, setDocDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [docDiscountValue, setDocDiscountValue] = useState(0);

  // Additional charges
  const [additionalCharges, setAdditionalCharges] = useState<any[]>([]);

  // Clauses & custom metadata
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [signatoryName, setSignatoryName] = useState('');

  // Advanced options toggles
  const [displayOptions, setDisplayOptions] = useState({
    showHsnSac: true,
    showTaxSummary: true,
    showItemDescriptions: true,
    showTotalQuantity: true,
  });

  // Load configuration lists & document
  useEffect(() => {
    const loadConfigurationAndDocument = async () => {
      try {
        const [profileRes, clientsRes, documentRes] = await Promise.all([
          api.get('/business'),
          api.get('/clients?status=ACTIVE&limit=100'),
          api.get(`/documents/${id}`),
        ]);

        if (profileRes.data?.success) {
          setBusinessProfile(profileRes.data.data?.business || {});
        }
        if (clientsRes.data?.success) {
          setClients(clientsRes.data.data.clients || []);
        }

        if (documentRes.data?.success) {
          const doc = documentRes.data.data;
          
          if (doc.status !== 'DRAFT') {
            showToast('Only DRAFT quotations can be edited.', 'error');
            router.push(`/quotations/${id}`);
            return;
          }

          setDocumentNumber(doc.documentNumber);
          setSelectedClientId(doc.clientId);
          setPoNumber(doc.poNumber || '');
          setIssueDate(new Date(doc.issueDate).toISOString().split('T')[0]);
          setValidTill(doc.validTill ? new Date(doc.validTill).toISOString().split('T')[0] : '');
          
          if (doc.placeOfSupply) {
            setPlaceOfSupply(doc.placeOfSupply);
          }

          if (doc.shippingAddress && doc.shippingAddress.addressLine1) {
            setEnableShipping(true);
            setShippingAddress(doc.shippingAddress);
          }

          setItems(doc.items || []);
          
          if (doc.documentDiscountType !== 'NONE') {
            setEnableDocDiscount(true);
            setDocDiscountType(doc.documentDiscountType);
            setDocDiscountValue(doc.documentDiscountValue || 0);
          }

          setAdditionalCharges(doc.additionalCharges || []);
          setTerms(doc.terms || '');
          setNotes(doc.notes || '');
          setCustomFields(doc.customFields || []);
          setSignatoryName(doc.signatoryName || '');
          
          if (doc.displayOptions) {
            setDisplayOptions(doc.displayOptions);
          }
        }
      } catch (err: any) {
        showToast('Failed to load document details or configuration parameters.', 'error');
        router.push('/quotations');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadConfigurationAndDocument();
    }
  }, [id]);

  // Sync selectedClient state when selectedClientId or clients changes
  useEffect(() => {
    if (selectedClientId && clients.length > 0) {
      const client = clients.find(c => c._id === selectedClientId);
      setSelectedClient(client || null);
    }
  }, [selectedClientId, clients]);

  // Handle client selection change
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find(c => c._id === clientId);
    setSelectedClient(client || null);
    
    if (client) {
      if (client.billingAddress?.state) {
        setPlaceOfSupply({
          state: client.billingAddress.state,
          stateCode: client.billingAddress.stateCode || '',
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
    }
  };

  const handlePlaceOfSupplyChange = (stateName: string) => {
    const selected = INDIAN_STATES.find(s => s.name === stateName);
    setPlaceOfSupply({
      state: stateName,
      stateCode: selected ? selected.stateCode : '',
    });
  };

  // Line item manipulation helpers
  const handleItemFieldChange = (index: number, field: string, value: any) => {
    setItems(prev => {
      const list = [...prev];
      list[index] = { ...list[index], [field]: value };
      return list;
    });
  };

  const addItemLine = () => {
    setItems(prev => [
      ...prev,
      {
        itemName: '',
        description: '',
        hsnSac: '',
        gstRate: 18,
        quantity: 1,
        unit: 'PCS',
        rate: 0,
        discountType: 'NONE',
        discountValue: 0,
      }
    ]);
  };

  const duplicateItemLine = (index: number) => {
    setItems(prev => {
      const list = [...prev];
      const target = { ...list[index] };
      list.splice(index + 1, 0, target);
      return list;
    });
  };

  const removeItemLine = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Additional charges manipulation
  const handleChargeFieldChange = (index: number, field: string, value: any) => {
    setAdditionalCharges(prev => {
      const list = [...prev];
      list[index] = { ...list[index], [field]: value };
      return list;
    });
  };

  const addAdditionalCharge = () => {
    setAdditionalCharges(prev => [
      ...prev,
      {
        chargeName: '',
        amount: 0,
        isTaxable: false,
        gstRate: 18,
      }
    ]);
  };

  const removeAdditionalCharge = (index: number) => {
    setAdditionalCharges(prev => prev.filter((_, i) => i !== index));
  };

  // Key-value metadata manipulation
  const handleCustomFieldChange = (index: number, field: 'key' | 'value', value: string) => {
    setCustomFields(prev => {
      const list = [...prev];
      list[index] = { ...list[index], [field]: value };
      return list;
    });
  };

  const addCustomField = () => {
    setCustomFields(prev => [...prev, { key: '', value: '' }]);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(prev => prev.filter((_, i) => i !== index));
  };

  // LIVE CALCULATIONS UTILITY
  const calculateTotals = () => {
    const businessStateCode = businessProfile?.address?.stateCode || '';
    const supplyStateCode = placeOfSupply.stateCode || '';
    const isIntraState = businessStateCode.toUpperCase() === supplyStateCode.toUpperCase();
    const gstMode = isIntraState ? 'INTRA_STATE' : 'INTER_STATE';

    let itemsSubtotal = 0;
    const computedItems = items.map(item => {
      const qty = Math.max(0, parseFloat(item.quantity) || 0);
      const rate = Math.max(0, parseFloat(item.rate) || 0);
      const discVal = Math.max(0, parseFloat(item.discountValue) || 0);
      const gstRate = Math.max(0, parseFloat(item.gstRate) || 0);

      const baseAmount = Math.round(qty * rate * 100) / 100;
      
      let itemDiscountAmount = 0;
      if (item.discountType === 'PERCENTAGE') {
        itemDiscountAmount = Math.round((baseAmount * discVal / 100) * 100) / 100;
      } else if (item.discountType === 'FIXED') {
        itemDiscountAmount = Math.min(baseAmount, discVal);
      }

      const taxableAmount = Math.round((baseAmount - itemDiscountAmount) * 100) / 100;
      itemsSubtotal += taxableAmount;

      return {
        ...item,
        baseAmount,
        itemDiscountAmount,
        taxableAmount,
        gstRate,
      };
    });

    let documentDiscountAmount = 0;
    if (enableDocDiscount) {
      if (docDiscountType === 'PERCENTAGE') {
        documentDiscountAmount = Math.round((itemsSubtotal * (docDiscountValue || 0) / 100) * 100) / 100;
      } else if (docDiscountType === 'FIXED') {
        documentDiscountAmount = Math.min(itemsSubtotal, Math.max(0, docDiscountValue || 0));
      }
    }

    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let finalTaxableSum = 0;

    const finalItems = computedItems.map(item => {
      const proportionalDiscount = itemsSubtotal > 0
        ? Math.round(((item.taxableAmount / itemsSubtotal) * documentDiscountAmount) * 100) / 100
        : 0;

      const finalTaxable = Math.max(0, Math.round((item.taxableAmount - proportionalDiscount) * 100) / 100);
      finalTaxableSum += finalTaxable;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isIntraState) {
        cgst = Math.round((finalTaxable * (item.gstRate / 2) / 100) * 100) / 100;
        sgst = Math.round((finalTaxable * (item.gstRate / 2) / 100) * 100) / 100;
        cgstTotal += cgst;
        sgstTotal += sgst;
      } else {
        igst = Math.round((finalTaxable * item.gstRate / 100) * 100) / 100;
        igstTotal += igst;
      }

      const total = Math.round((finalTaxable + cgst + sgst + igst) * 100) / 100;

      return {
        ...item,
        cgst,
        sgst,
        igst,
        total,
      };
    });

    let additionalChargesTotal = 0;
    const computedCharges = additionalCharges.map(charge => {
      const amt = Math.max(0, parseFloat(charge.amount) || 0);
      let taxAmt = 0;
      if (charge.isTaxable) {
        const gstRate = Math.max(0, parseFloat(charge.gstRate) || 0);
        taxAmt = Math.round((amt * gstRate / 100) * 100) / 100;
      }
      const total = Math.round((amt + taxAmt) * 100) / 100;
      additionalChargesTotal += total;

      return {
        ...charge,
        amount: amt,
        taxAmount: taxAmt,
        total,
      };
    });

    const grandTotalNoRound = finalTaxableSum + cgstTotal + sgstTotal + igstTotal + additionalChargesTotal;
    const grandTotal = Math.round(grandTotalNoRound);
    const roundOff = Math.round((grandTotal - grandTotalNoRound) * 100) / 100;

    // Local conversion helper
    const grandTotalInWords = toIndianWordsLocal(grandTotal);

    return {
      items: finalItems,
      documentDiscountAmount,
      additionalCharges: computedCharges,
      subtotal: Math.round(itemsSubtotal * 100) / 100,
      taxableAmount: Math.round(finalTaxableSum * 100) / 100,
      cgstTotal: Math.round(cgstTotal * 100) / 100,
      sgstTotal: Math.round(sgstTotal * 100) / 100,
      igstTotal: Math.round(igstTotal * 100) / 100,
      additionalChargesTotal: Math.round(additionalChargesTotal * 100) / 100,
      roundOff,
      grandTotal,
      grandTotalInWords,
      gstMode,
    };
  };

  const handleUpdate = async () => {
    if (!selectedClientId) {
      showToast('Please select a Client.', 'error');
      return;
    }

    // Validate items
    const invalidItem = items.some(item => !item.itemName.trim() || parseFloat(item.quantity) <= 0 || parseFloat(item.rate) < 0);
    if (invalidItem) {
      showToast('Each line item must have a name, quantity > 0 and rate >= 0.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        clientId: selectedClientId,
        poNumber,
        issueDate: new Date(issueDate).toISOString(),
        validTill: validTill ? new Date(validTill).toISOString() : undefined,
        placeOfSupply,
        items,
        documentDiscountType: enableDocDiscount ? docDiscountType : 'NONE',
        documentDiscountValue: enableDocDiscount ? docDiscountValue : 0,
        additionalCharges,
        terms,
        notes,
        customFields: customFields.filter(f => f.key.trim() && f.value.trim()),
        signatoryName,
        displayOptions,
      };

      const response = await api.put(`/documents/${id}`, payload);
      if (response.data?.success) {
        showToast('Quotation updated successfully!', 'success');
        router.push(`/quotations/${id}`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update quotation.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card-panel p-16 rounded-xl flex items-center justify-center min-h-[300px]">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  // Live Calculated values
  const totals = calculateTotals();

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 text-slate-800">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Edit Quotation</h1>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 font-semibold font-mono">
            <span>Ref: {documentNumber}</span>
            <span className="text-slate-300">/</span>
            <span className={activeStep === 1 ? 'text-brand-primary font-bold' : ''}>1. Edit Details</span>
            <span className="text-slate-300">/</span>
            <span className={activeStep === 2 ? 'text-brand-primary font-bold' : ''}>2. Review</span>
          </div>
        </div>

        <div className="flex gap-2">
          {activeStep === 2 && (
            <button
              onClick={() => setActiveStep(1)}
              className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
            >
              Back to Editor
            </button>
          )}
          <Link
            href={`/quotations/${id}`}
            className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
          >
            Cancel
          </Link>
          {activeStep === 1 ? (
            <button
              onClick={() => setActiveStep(2)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-750 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              Review Quotation
            </button>
          ) : (
            <button
              onClick={handleUpdate}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {activeStep === 1 ? (
        /* STEP 1: BILLING DOCUMENT EDITOR */
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start animate-fadeIn">
          {/* Main Card Panel Editor */}
          <div className="xl:col-span-3 card-panel p-8 rounded-xl space-y-8 bg-white">
            {/* Logo/Watermark Title Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-100">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">EDIT QUOTATION</h2>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1">Estimate / Proposal</p>
              </div>

              <div className="text-left sm:text-right space-y-1.5 text-xs text-slate-650 font-mono">
                <div>
                  <span className="font-semibold text-slate-500 uppercase text-[10px]">Quotation No:</span>
                  <span className="ml-2 font-bold text-slate-900">{documentNumber}</span>
                </div>
                <div className="flex items-center sm:justify-end gap-2">
                  <span className="font-semibold text-slate-500 uppercase text-[10px]">Date:</span>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="border border-slate-350 rounded px-1.5 py-0.5 text-slate-900 w-28 bg-white"
                  />
                </div>
                <div className="flex items-center sm:justify-end gap-2">
                  <span className="font-semibold text-slate-500 uppercase text-[10px]">Valid Till:</span>
                  <input
                    type="date"
                    value={validTill}
                    onChange={(e) => setValidTill(e.target.value)}
                    className="border border-slate-350 rounded px-1.5 py-0.5 text-slate-900 w-28 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Business & Client Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-4">
              {/* Business Side */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quotation From</h4>
                  <p className="text-sm font-bold text-slate-900 mt-1">{businessProfile?.businessName}</p>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  {businessProfile?.email && <p>Email: {businessProfile.email}</p>}
                  {businessProfile?.phone && <p>Phone: {businessProfile.phone}</p>}
                  {businessProfile?.gstin && <p className="font-mono">GSTIN: {businessProfile.gstin}</p>}
                  {businessProfile?.address?.addressLine1 && (
                    <p className="mt-1 pt-1 border-t border-slate-100/60 leading-relaxed text-slate-600">
                      Address: {businessProfile.address.addressLine1}, {businessProfile.address.city}, {businessProfile.address.state}
                    </p>
                  )}
                </div>
              </div>

              {/* Client Selector */}
              <div className="space-y-3.5 border-t md:border-t-0 md:border-l border-slate-150/60 pt-6 md:pt-0 md:pl-8">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quotation For</h4>
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="w-full form-input text-xs mt-2 bg-white text-slate-900"
                  >
                    <option value="">Select a Client</option>
                    {clients.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.clientType === 'BUSINESS' ? (c.businessName || c.clientName) : c.clientName}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedClient && (
                  <div className="text-xs text-slate-600 space-y-1.5 animate-fadeIn">
                    <p className="font-bold text-slate-900">
                      {selectedClient.clientType === 'BUSINESS' ? selectedClient.clientName : 'Individual Customer'}
                    </p>
                    {selectedClient.email && <p>Email: {selectedClient.email}</p>}
                    {selectedClient.phone && <p>Phone: {selectedClient.phone}</p>}
                    {selectedClient.gstin && <p className="font-mono">GSTIN: {selectedClient.gstin}</p>}
                    {selectedClient.billingAddress?.addressLine1 && (
                      <p className="mt-1 pt-1 border-t border-slate-100/60 leading-relaxed text-slate-600">
                        Billing: {selectedClient.billingAddress.addressLine1}, {selectedClient.billingAddress.city}, {selectedClient.billingAddress.state}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Shipping details */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableShipping}
                  onChange={(e) => setEnableShipping(e.target.checked)}
                  className="rounded border-slate-350 text-brand-primary w-4 h-4 focus:ring-0"
                />
                Add Shipping Details
              </label>

              {enableShipping && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50 animate-fadeIn text-xs">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-550 mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={shippingAddress.addressLine1}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, addressLine1: e.target.value }))}
                      className="w-full form-input text-xs py-1.5 bg-white text-slate-900 placeholder:text-slate-400"
                      placeholder="Street address, building, plot number"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 mb-1">City</label>
                    <input
                      type="text"
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full form-input text-xs py-1.5 bg-white text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 mb-1">State</label>
                    <select
                      value={shippingAddress.state}
                      onChange={(e) => {
                        const sName = e.target.value;
                        const matched = INDIAN_STATES.find(s => s.name === sName);
                        setShippingAddress(prev => ({
                          ...prev,
                          state: sName,
                          stateCode: matched ? matched.stateCode : '',
                        }));
                      }}
                      className="w-full form-input text-xs py-1.5 bg-white text-slate-900"
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map(s => (
                        <option key={s.code} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* GST Config */}
            <div className="border-t border-slate-100 pt-5 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-[10px] font-bold text-slate-550 mb-1.5">Place of Supply</label>
                <select
                  value={placeOfSupply.state}
                  onChange={(e) => handlePlaceOfSupplyChange(e.target.value)}
                  className="w-full form-input text-xs bg-white py-1.5 text-slate-900"
                >
                  <option value="">Select Supply State</option>
                  {INDIAN_STATES.map(s => (
                    <option key={s.code} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="text-xs md:pl-6 pt-4 md:pt-0 font-medium text-slate-600">
                <span>GST Mode: </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  totals.gstMode === 'INTRA_STATE'
                    ? 'bg-blue-50 text-blue-600 border-blue-100'
                    : 'bg-orange-50 text-orange-600 border-orange-100'
                }`}>
                  {totals.gstMode === 'INTRA_STATE' ? 'Intra-state (CGST + SGST)' : 'Inter-state (IGST)'}
                </span>
              </div>
            </div>

            {/* LINE ITEMS */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Line Items</h3>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500">
                      <th className="px-4 py-3 w-[250px]">Item Details</th>
                      {displayOptions.showHsnSac && <th className="px-4 py-3 w-[100px]">HSN/SAC</th>}
                      <th className="px-4 py-3 w-[90px]">Qty</th>
                      <th className="px-4 py-3 w-[90px]">Unit</th>
                      <th className="px-4 py-3 w-[110px]">Rate</th>
                      <th className="px-4 py-3 w-[140px]">Discount</th>
                      <th className="px-4 py-3 w-[90px]">GST %</th>
                      <th className="px-4 py-3 text-right w-[110px]">Total (INR)</th>
                      <th className="px-4 py-3 text-center w-[90px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => {
                      const computedItem = totals.items[idx] || item;
                      return (
                        <tr key={idx} className="align-top hover:bg-slate-55/20 transition-colors">
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.itemName}
                              onChange={(e) => handleItemFieldChange(idx, 'itemName', e.target.value)}
                              placeholder="Item or Service Name"
                              className="w-full form-input text-xs py-1"
                            />
                            {displayOptions.showItemDescriptions && (
                              <textarea
                                value={item.description}
                                onChange={(e) => handleItemFieldChange(idx, 'description', e.target.value)}
                                placeholder="Add description..."
                                className="w-full form-input text-[11px] py-1 mt-1.5 h-10 min-h-[40px] resize-y"
                              />
                            )}
                          </td>
                          {displayOptions.showHsnSac && (
                            <td className="p-3">
                              <input
                                type="text"
                                value={item.hsnSac}
                                onChange={(e) => handleItemFieldChange(idx, 'hsnSac', e.target.value)}
                                placeholder="HSN"
                                className="w-full form-input text-xs py-1 text-center font-mono"
                              />
                            </td>
                          )}
                          <td className="p-3">
                            <input
                              type="number"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleItemFieldChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full form-input text-xs py-1 text-center"
                            />
                          </td>
                          <td className="p-3">
                            <select
                              value={item.unit}
                              onChange={(e) => handleItemFieldChange(idx, 'unit', e.target.value)}
                              className="w-full form-input text-xs py-1 bg-white px-1"
                            >
                              {['PCS', 'NOS', 'UNIT', 'METER', 'FEET', 'HOUR', 'DAY', 'MONTH', 'SERVICE'].map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              step="any"
                              value={item.rate}
                              onChange={(e) => handleItemFieldChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                              className="w-full form-input text-xs py-1 text-right font-medium"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1.5 items-center">
                              <select
                                value={item.discountType}
                                onChange={(e) => handleItemFieldChange(idx, 'discountType', e.target.value)}
                                className="form-input text-[10px] py-1 bg-white px-1 w-14"
                              >
                                <option value="NONE">None</option>
                                <option value="PERCENTAGE">%</option>
                                <option value="FIXED">₹</option>
                              </select>
                              {item.discountType !== 'NONE' && (
                                <input
                                  type="number"
                                  value={item.discountValue}
                                  onChange={(e) => handleItemFieldChange(idx, 'discountValue', parseFloat(e.target.value) || 0)}
                                  className="w-16 form-input text-xs py-1 text-right"
                                />
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <select
                              value={item.gstRate}
                              onChange={(e) => handleItemFieldChange(idx, 'gstRate', parseFloat(e.target.value) || 0)}
                              className="w-full form-input text-xs py-1 bg-white px-1"
                            >
                              {[0, 5, 12, 18, 28].map(r => (
                                <option key={r} value={r}>{r}%</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 text-right font-bold text-slate-800 align-middle">
                            ₹{computedItem.total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => duplicateItemLine(idx)}
                                className="p-1 text-slate-455 hover:text-blue-600 rounded hover:bg-slate-100"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M8 7H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2v-4" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                disabled={items.length <= 1}
                                onClick={() => removeItemLine(idx)}
                                className="p-1 text-slate-455 hover:text-rose-500 rounded hover:bg-slate-100 disabled:opacity-30"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={addItemLine}
                className="px-4 py-2 border border-dashed border-slate-305 hover:border-brand-primary text-slate-600 hover:text-brand-primary rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Line Item
              </button>
            </div>

            {/* Document Discount & Additional Charges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 pt-6">
              <div className="space-y-5">
                {/* Document Discount */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enableDocDiscount}
                      onChange={(e) => setEnableDocDiscount(e.target.checked)}
                      className="rounded border-slate-350 text-brand-primary w-4 h-4 focus:ring-0"
                    />
                    Add Document Discount
                  </label>

                  {enableDocDiscount && (
                    <div className="flex gap-2 items-center animate-fadeIn">
                      <select
                        value={docDiscountType}
                        onChange={(e) => setDocDiscountType(e.target.value as any)}
                        className="form-input text-xs py-1.5 bg-white w-28"
                      >
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FIXED">Fixed (₹)</option>
                      </select>
                      <input
                        type="number"
                        value={docDiscountValue}
                        onChange={(e) => setDocDiscountValue(parseFloat(e.target.value) || 0)}
                        className="w-32 form-input text-xs py-1.5 text-right font-medium"
                      />
                    </div>
                  )}
                </div>

                {/* Additional Charges */}
                <div className="space-y-3 border-t border-slate-100/60 pt-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Additional Charges</h4>
                    <button
                      type="button"
                      onClick={addAdditionalCharge}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      + Add Charge
                    </button>
                  </div>

                  {additionalCharges.length > 0 && (
                    <div className="space-y-3.5 animate-fadeIn">
                      {additionalCharges.map((charge, idx) => (
                        <div key={idx} className="flex gap-2 items-center text-xs">
                          <input
                            type="text"
                            value={charge.chargeName}
                            onChange={(e) => handleChargeFieldChange(idx, 'chargeName', e.target.value)}
                            placeholder="Charge name (e.g. Shipping)"
                            className="form-input text-xs py-1.5 flex-1"
                          />
                          <input
                            type="number"
                            value={charge.amount}
                            onChange={(e) => handleChargeFieldChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                            className="w-24 form-input text-xs py-1.5 text-right font-medium"
                          />
                          <label className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={charge.isTaxable}
                              onChange={(e) => handleChargeFieldChange(idx, 'isTaxable', e.target.checked)}
                              className="rounded border-slate-350 text-brand-primary w-3.5 h-3.5"
                            />
                            Tax
                          </label>
                          {charge.isTaxable && (
                            <select
                              value={charge.gstRate}
                              onChange={(e) => handleChargeFieldChange(idx, 'gstRate', parseInt(e.target.value) || 0)}
                              className="form-input text-[10px] py-1 bg-white px-1 w-14"
                            >
                              {[0, 5, 12, 18, 28].map(r => (
                                <option key={r} value={r}>{r}%</option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAdditionalCharge(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-100"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="p-5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3.5 text-xs text-slate-700">
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="font-medium text-slate-500">Subtotal</span>
                  <span className="font-semibold text-slate-800">
                    ₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {totals.documentDiscountAmount > 0 && (
                  <div className="flex justify-between items-center border-b border-slate-200/60 pb-2 text-rose-600">
                    <span className="font-medium">Document Discount</span>
                    <span className="font-bold">
                      - ₹{totals.documentDiscountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="font-medium text-slate-500">Taxable Amount</span>
                  <span className="font-semibold text-slate-800">
                    ₹{totals.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {totals.gstMode === 'INTRA_STATE' ? (
                  <>
                    <div className="flex justify-between items-center border-b border-slate-200/60 pb-2 text-[11px] text-slate-600">
                      <span>CGST</span>
                      <span>₹{totals.cgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200/60 pb-2 text-[11px] text-slate-600">
                      <span>SGST</span>
                      <span>₹{totals.sgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center border-b border-slate-200/60 pb-2 text-[11px] text-slate-600">
                    <span>IGST</span>
                    <span>₹{totals.igstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                {totals.additionalChargesTotal > 0 && (
                  <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                    <span className="font-medium text-slate-500">Additional Charges</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      + ₹{totals.additionalChargesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {Math.abs(totals.roundOff) > 0 && (
                  <div className="flex justify-between items-center border-b border-slate-200/60 pb-2 text-[11px] text-slate-450">
                    <span>Round Off</span>
                    <span>
                      {totals.roundOff >= 0 ? '+' : ''}₹{totals.roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm font-bold text-slate-900 pt-1">
                  <span>Grand Total</span>
                  <span className="text-brand-primary text-base font-black">
                    ₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                
                <div className="text-[10px] text-slate-450 leading-relaxed pt-2 border-t border-slate-250 italic">
                  In Words: {totals.grandTotalInWords}
                </div>
              </div>
            </div>

            {/* Expandable Sections */}
            <div className="border-t border-slate-100 pt-6 space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Terms & Conditions</label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full form-input text-xs h-20 resize-y"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full form-input text-xs h-20 resize-y"
                />
              </div>

              {/* Key Values */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">Additional Custom Fields</label>
                  <button
                    type="button"
                    onClick={addCustomField}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    + Add Custom Field
                  </button>
                </div>

                {customFields.length > 0 && (
                  <div className="space-y-3.5 animate-fadeIn">
                    {customFields.map((field, idx) => (
                      <div key={idx} className="flex gap-2 items-center text-xs">
                        <input
                          type="text"
                          value={field.key}
                          onChange={(e) => handleCustomFieldChange(idx, 'key', e.target.value)}
                          className="form-input text-xs py-1.5 flex-1"
                        />
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => handleCustomFieldChange(idx, 'value', e.target.value)}
                          className="form-input text-xs py-1.5 flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => removeCustomField(idx)}
                          className="p-1.5 text-slate-450 hover:text-rose-500 rounded hover:bg-slate-100"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Signature */}
              <div className="max-w-xs">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Signatory Name (Authorized Signature)</label>
                <input
                  type="text"
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                  className="w-full form-input text-xs py-1.5"
                />
              </div>
            </div>
          </div>

          {/* Configuration sidebar */}
          <div className="card-panel p-6 rounded-xl space-y-6 bg-white text-xs text-slate-700">
            <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100">Document Settings</h3>

            {/* Display options */}
            <div className="space-y-4 pt-1">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Display Options</h4>
              
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={displayOptions.showHsnSac}
                  onChange={(e) => setDisplayOptions(p => ({ ...p, showHsnSac: e.target.checked }))}
                  className="rounded text-brand-primary w-4 h-4"
                />
                Show HSN/SAC Column
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={displayOptions.showItemDescriptions}
                  onChange={(e) => setDisplayOptions(p => ({ ...p, showItemDescriptions: e.target.checked }))}
                  className="rounded text-brand-primary w-4 h-4"
                />
                Show Item Descriptions
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={displayOptions.showTaxSummary}
                  onChange={(e) => setDisplayOptions(p => ({ ...p, showTaxSummary: e.target.checked }))}
                  className="rounded text-brand-primary w-4 h-4"
                />
                Show Tax Summary Section
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={displayOptions.showTotalQuantity}
                  onChange={(e) => setDisplayOptions(p => ({ ...p, showTotalQuantity: e.target.checked }))}
                  className="rounded text-brand-primary w-4 h-4"
                />
                Show Total Quantity
              </label>
            </div>

            {/* Project References info */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PO Number</h4>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="Purchase Order Reference"
                className="w-full form-input text-xs py-1.5"
              />
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: REVIEW QUOTATION (A4 STYLE PREVIEW) */
        <div className="card-panel max-w-4xl mx-auto rounded-xl p-12 bg-white shadow-lg space-y-8 animate-fadeIn text-xs text-slate-800 font-sans border border-slate-200">
          <div className="flex justify-between items-start border-b border-slate-200 pb-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">QUOTATION REVIEW</h2>
              <p className="text-[10px] text-slate-450 uppercase tracking-wider font-semibold mt-1">Ref: {documentNumber}</p>
              
              <div className="mt-4 space-y-1 font-medium text-slate-600">
                <p className="font-bold text-slate-800 text-sm">{businessProfile?.businessName}</p>
                <p>Email: {businessProfile?.email}</p>
                <p>Phone: {businessProfile?.phone}</p>
                {businessProfile?.gstin && <p className="font-mono">GSTIN: {businessProfile.gstin}</p>}
                {businessProfile?.address?.addressLine1 && (
                  <p className="max-w-xs mt-1 leading-relaxed text-slate-500 font-normal">
                    {businessProfile.address.addressLine1}, {businessProfile.address.city}, {businessProfile.address.state}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right space-y-1 font-mono text-slate-650">
              <p className="text-[10px] text-slate-450 uppercase font-semibold">Document Details</p>
              <p><span className="font-bold text-slate-800">Doc No:</span> {documentNumber}</p>
              <p><span className="font-bold text-slate-800">Date:</span> {issueDate}</p>
              <p><span className="font-bold text-slate-800">Valid Till:</span> {validTill || '—'}</p>
              {poNumber && <p><span className="font-bold text-slate-800">PO Ref:</span> {poNumber}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 border-b border-slate-200 pb-6">
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">QUOTATION FOR</h3>
              <div className="space-y-1 text-slate-650">
                <p className="font-bold text-slate-800">{selectedClient?.businessName || selectedClient?.clientName}</p>
                {selectedClient?.businessName && <p>Attn: {selectedClient.clientName}</p>}
                <p>Email: {selectedClient?.email || '—'}</p>
                <p>Phone: {selectedClient?.phone || '—'}</p>
                {selectedClient?.gstin && <p className="font-mono">GSTIN: {selectedClient.gstin}</p>}
                {selectedClient?.billingAddress?.addressLine1 && (
                  <p className="max-w-xs mt-1 leading-relaxed text-slate-500 font-normal">
                    Billing: {selectedClient.billingAddress.addressLine1}, {selectedClient.billingAddress.city}, {selectedClient.billingAddress.state}
                  </p>
                )}
              </div>
            </div>

            {enableShipping && (
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">SHIPPING DETAILS</h3>
                <div className="space-y-1 text-slate-650 leading-relaxed text-slate-550 font-normal">
                  <p>{shippingAddress.addressLine1}</p>
                  {shippingAddress.addressLine2 && <p>{shippingAddress.addressLine2}</p>}
                  <p>{shippingAddress.city}, {shippingAddress.state} - {shippingAddress.pincode}</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 font-semibold text-slate-500">
                  <th className="py-2.5">Item Details</th>
                  {displayOptions.showHsnSac && <th className="py-2.5 w-[100px] text-center">HSN/SAC</th>}
                  <th className="py-2.5 w-[80px] text-center">Qty</th>
                  <th className="py-2.5 w-[90px] text-right">Rate</th>
                  <th className="py-2.5 w-[110px] text-right">Discount</th>
                  <th className="py-2.5 w-[80px] text-center">GST %</th>
                  <th className="py-2.5 w-[110px] text-right">Total (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {totals.items.map((item, idx) => (
                  <tr key={idx} className="align-top py-2.5">
                    <td className="py-2.5">
                      <p className="font-semibold text-slate-850">{item.itemName}</p>
                      {displayOptions.showItemDescriptions && item.description && (
                        <p className="text-[10px] text-slate-450 mt-0.5 leading-relaxed font-normal">{item.description}</p>
                      )}
                    </td>
                    {displayOptions.showHsnSac && (
                      <td className="py-2.5 text-center font-mono text-[11px] text-slate-550">{item.hsnSac || '—'}</td>
                    )}
                    <td className="py-2.5 text-center font-medium">
                      {item.quantity} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                    </td>
                    <td className="py-2.5 text-right font-mono">₹{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 text-right text-slate-500 font-mono">
                      {item.discountType === 'PERCENTAGE' ? (
                        `%${item.discountValue} (-₹${item.itemDiscountAmount.toLocaleString('en-IN')})`
                      ) : item.discountType === 'FIXED' ? (
                        `-₹${item.itemDiscountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 text-center text-slate-605">{item.gstRate}%</td>
                    <td className="py-2.5 text-right font-bold text-slate-850 font-mono">
                      ₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-t border-slate-200 pt-6">
            <div className="max-w-md space-y-4">
              {displayOptions.showTaxSummary && (
                <div className="space-y-1 text-[10px] text-slate-500 font-mono">
                  <p className="font-bold text-slate-400 uppercase tracking-wider mb-1 text-[9px]">Tax Summary</p>
                  <p>Taxable Base Sum: ₹{totals.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  {totals.gstMode === 'INTRA_STATE' ? (
                    <>
                      <p>CGST Total: ₹{totals.cgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      <p>SGST Total: ₹{totals.sgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </>
                  ) : (
                    <p>IGST Total: ₹{totals.igstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  )}
                </div>
              )}
            </div>

            <div className="w-full md:w-80 space-y-2.5 text-slate-705">
              <div className="flex justify-between items-center text-slate-500">
                <span>Subtotal</span>
                <span>₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {totals.documentDiscountAmount > 0 && (
                <div className="flex justify-between items-center text-rose-600 font-semibold">
                  <span>Document Discount</span>
                  <span>-₹{totals.documentDiscountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-slate-500">
                <span>Taxable Amount</span>
                <span>₹{totals.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {totals.gstMode === 'INTRA_STATE' ? (
                <div className="flex justify-between items-center text-slate-500">
                  <span>CGST + SGST</span>
                  <span>₹{(totals.cgstTotal + totals.sgstTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              ) : (
                <div className="flex justify-between items-center text-slate-500">
                  <span>IGST</span>
                  <span>₹{totals.igstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {totals.additionalChargesTotal > 0 && (
                <div className="flex justify-between items-center text-slate-505">
                  <span>Additional Charges</span>
                  <span>+₹{totals.additionalChargesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {Math.abs(totals.roundOff) > 0 && (
                <div className="flex justify-between items-center text-slate-450">
                  <span>Round Off</span>
                  <span>₹{totals.roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>Grand Total</span>
                <span className="text-brand-primary text-base">₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="text-[10px] text-slate-450 italic text-right mt-1 font-semibold leading-relaxed">
                In Words: {totals.grandTotalInWords}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 grid grid-cols-1 md:grid-cols-2 gap-8 text-[11px] text-slate-650 font-sans">
            <div className="space-y-4">
              {terms && (
                <div>
                  <p className="font-bold text-slate-450 uppercase text-[9px] mb-1 tracking-wider">Terms & Conditions</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{terms}</p>
                </div>
              )}
              {notes && (
                <div>
                  <p className="font-bold text-slate-450 uppercase text-[9px] mb-1 tracking-wider">Remarks / Notes</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{notes}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-end items-end space-y-6 pt-6">
              {signatoryName && (
                <div className="text-center font-medium text-slate-700 min-w-[150px]">
                  <div className="h-10 border-b border-slate-200 mb-2" />
                  <p className="font-bold text-slate-900">{signatoryName}</p>
                  <p className="text-[10px] text-slate-450 mt-0.5 uppercase tracking-wider font-bold">Authorized Signatory</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Local implementation of Indian Number-to-Words parser to guarantee no imports break
function toIndianWordsLocal(num: number) {
  if (num === null || num === undefined || isNaN(num)) return '';
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  function convertInteger(amount: number): string {
    const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teenDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const doubleDigits = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const scaleWords = ['', 'Thousand', 'Lakh', 'Crore'];

    if (amount === 0) return 'Zero';
    let word = '';
    let numberString = amount.toString();
    
    let chunks: number[] = [];
    if (numberString.length > 3) {
      chunks.push(parseInt(numberString.slice(-3), 10));
      numberString = numberString.slice(0, -3);
      while (numberString.length > 0) {
        if (numberString.length >= 2) {
          chunks.push(parseInt(numberString.slice(-2), 10));
          numberString = numberString.slice(0, -2);
        } else {
          chunks.push(parseInt(numberString, 10));
          numberString = '';
        }
      }
    } else {
      chunks.push(parseInt(numberString, 10));
    }

    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i];
      if (chunk === 0) continue;
      let chunkWord = '';
      if (i === 0) {
        let hundreds = Math.floor(chunk / 100);
        let remainder = chunk % 100;
        if (hundreds > 0) {
          chunkWord += singleDigits[hundreds] + ' Hundred ';
        }
        if (remainder > 0) {
          if (remainder < 10) {
            chunkWord += singleDigits[remainder];
          } else if (remainder < 20) {
            chunkWord += teenDigits[remainder - 10];
          } else {
            chunkWord += doubleDigits[Math.floor(remainder / 10)] + ' ' + singleDigits[remainder % 10];
          }
        }
      } else {
        if (chunk < 10) {
          chunkWord += singleDigits[chunk];
        } else if (chunk < 20) {
          chunkWord += teenDigits[chunk - 10];
        } else {
          chunkWord += doubleDigits[Math.floor(chunk / 10)] + ' ' + singleDigits[chunk % 10];
        }
      }
      if (chunkWord.trim() !== '') {
        word = chunkWord.trim() + ' ' + scaleWords[i] + ' ' + word;
      }
    }
    return word.trim();
  }

  let words = '';
  if (integerPart > 0) {
    words += convertInteger(integerPart) + ' Rupees';
  } else if (decimalPart === 0) {
    words += 'Zero Rupees';
  }

  if (decimalPart > 0) {
    if (integerPart > 0) {
      words += ' and ';
    }
    const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teenDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const doubleDigits = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    let decimalWord = '';
    if (decimalPart < 10) {
      decimalWord = singleDigits[decimalPart];
    } else if (decimalPart < 20) {
      decimalWord = teenDigits[decimalPart - 10];
    } else {
      decimalWord = doubleDigits[Math.floor(decimalPart / 10)] + ' ' + singleDigits[decimalPart % 10];
    }
    words += decimalWord.trim() + ' Paise';
  }
  return words + ' Only';
}
