'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import PageHeader from '@/components/PageHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import { INDIAN_STATES } from '@/lib/constants';

interface LineItem {
  id: string; // client-side unique key
  isGroupHeader: boolean;
  groupTitle?: string;
  itemName: string;
  description: string;
  hsnSac: string;
  gstRate: number;
  quantity: number;
  unit: string;
  rate: number;
  discountType: 'NONE' | 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  image?: string; // base64 string
  productType?: 'PRODUCT' | 'SERVICE';
}

interface AdditionalCharge {
  chargeName: string;
  amount: number;
  isTaxable: boolean;
  gstRate: number;
}

function NewQuotationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2>(1); // Step 1: Editor, Step 2: Design & Preview

  // Business profile state
  const [businessProfile, setBusinessProfile] = useState<any>({
    businessName: '',
    email: '',
    phone: '',
    address: {},
    website: '',
    gstin: '',
    pan: '',
  });

  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clientsError, setClientsError] = useState(false);

  // Form Headers
  const [docTitle, setDocTitle] = useState('Quotation');
  const [docSubtitle, setDocSubtitle] = useState('');
  const [showSubtitleInput, setShowSubtitleInput] = useState(false);
  const [poNumber, setPoNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [validTill, setValidTill] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    return date.toISOString().split('T')[0];
  });
  const [logoBase64, setLogoBase64] = useState('');

  // Shipping details state
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
  const [gstEnabled, setGstEnabled] = useState(true);
  const [placeOfSupply, setPlaceOfSupply] = useState({
    state: '',
    stateCode: '',
  });
  const [reverseCharge, setReverseCharge] = useState(false);

  // Currency & Formats
  const [currency, setCurrency] = useState('INR');
  const [numberFormat, setNumberFormat] = useState('en-IN');

  // Dynamic Line items state
  const [items, setItems] = useState<LineItem[]>([
    {
      id: Math.random().toString(36).substring(2, 9),
      isGroupHeader: false,
      itemName: '',
      description: '',
      hsnSac: '',
      gstRate: 18,
      quantity: 1,
      unit: 'PCS',
      rate: 0,
      discountType: 'NONE',
      discountValue: 0,
      productType: 'PRODUCT',
    },
  ]);

  // Document discounts & charges
  const [enableDocDiscount, setEnableDocDiscount] = useState(false);
  const [docDiscountType, setDocDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [docDiscountValue, setDocDiscountValue] = useState(0);
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalCharge[]>([]);
  const [enableRoundOff, setEnableRoundOff] = useState(true);
  const [summarizeTotalQuantity, setSummarizeTotalQuantity] = useState(false);

  // Optional Document Details sections
  const [showSignatureArea, setShowSignatureArea] = useState(false);
  const [signatoryName, setSignatoryName] = useState('');
  const [signatureBase64, setSignatureBase64] = useState('');

  const [showTermsArea, setShowTermsArea] = useState(false);
  const [terms, setTerms] = useState('');

  const [showNotesArea, setShowNotesArea] = useState(false);
  const [notes, setNotes] = useState('');

  const [showAttachmentsArea, setShowAttachmentsArea] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; base64: string }[]>([]);

  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState<any[]>([]);

  const [showContactDetails, setShowContactDetails] = useState(false);
  const [contactDetails, setContactDetails] = useState({ name: '', phone: '', email: '' });

  // Advanced Options Toggles
  const [displayOptions, setDisplayOptions] = useState({
    showHsnSac: true,
    showTaxSummary: true,
    showItemDescriptions: true,
    showTotalQuantity: true,
    hsnColumnView: 'HSN', // 'HSN' or 'SAC' or 'BOTH'
    displayUnitAs: 'Unit',
    hidePlaceOfSupply: false,
    showHsnSummary: false,
    addImageInItems: false,
    showThumbnailsSeparate: false,
    descriptionFullWidth: false,
    hideSubtotalForGroup: false,
    showSku: false,
    showSerialNumbers: false,
    displayBatchDetails: false,
  });

  // Client modal toggle state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    clientType: 'BUSINESS',
    businessName: '',
    clientName: '',
    email: '',
    phone: '',
    gstin: '',
    pan: '',
    billingAddress: {
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      stateCode: '',
      country: 'India',
      pincode: '',
    },
    shippingAddress: {
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      stateCode: '',
      country: 'India',
      pincode: '',
    },
    notes: '',
  });

  const loadClients = async () => {
    try {
      setClientsError(false);
      const res = await api.get('/clients?status=ACTIVE&limit=100');
      if (res.data?.success) {
        setClients(res.data.data.clients || []);
      }
    } catch (err) {
      setClientsError(true);
    }
  };

  // Load setup lists on mount
  useEffect(() => {
    const loadConfiguration = async () => {
      try {
        const [profileRes] = await Promise.all([
          api.get('/business').catch(() => ({ data: { success: false } })),
        ]);

        if (profileRes.data?.success && profileRes.data.data?.business) {
          const biz = profileRes.data.data.business;
          setBusinessProfile(biz);
          if (biz.logoUrl) setLogoBase64(biz.logoUrl);
          if (biz.signatureUrl) setSignatureBase64(biz.signatureUrl);
          if (biz.signatoryName) setSignatoryName(biz.signatoryName);
          if (biz.address?.state) {
            setPlaceOfSupply({
              state: biz.address.state,
              stateCode: biz.address.stateCode || '',
            });
          }
        }
      } catch (err: any) {
        // Safe to ignore or toast
      } finally {
        await loadClients();
        setLoading(false);
      }
    };

    loadConfiguration();
  }, []);

  // Update supply and shipping on client change
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find((c) => c._id === clientId);
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
    const selected = INDIAN_STATES.find((s) => s.name === stateName);
    setPlaceOfSupply({
      state: stateName,
      stateCode: selected ? selected.stateCode : '',
    });
  };

  const handleNewClientStateChange = (stateName: string, type: 'billing' | 'shipping') => {
    const selected = INDIAN_STATES.find((s) => s.name === stateName);
    setNewClient((prev) => ({
      ...prev,
      [type === 'billing' ? 'billingAddress' : 'shippingAddress']: {
        ...prev[type === 'billing' ? 'billingAddress' : 'shippingAddress'],
        state: stateName,
        stateCode: selected ? selected.stateCode : '',
      },
    }));
  };

  // Base64 file loaders
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setSignatureBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const incomingFiles = Array.from(files);
    if (attachments.length + incomingFiles.length > 3) {
      showToast('Maximum 3 attachments are allowed per document.', 'error');
      return;
    }

    for (const file of incomingFiles) {
      if (file.size > 3 * 1024 * 1024) {
        showToast(`Attachment ${file.name} size exceeds 3MB limit.`, 'error');
        return;
      }
    }

    incomingFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachments((prev) => [...prev, { name: file.name, base64: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Line item manipulation helpers
  const handleItemFieldChange = (id: string, field: keyof LineItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addLineItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        isGroupHeader: false,
        itemName: '',
        description: '',
        hsnSac: '',
        gstRate: 18,
        quantity: 1,
        unit: 'PCS',
        rate: 0,
        discountType: 'NONE',
        discountValue: 0,
        productType: 'PRODUCT',
      },
    ]);
  };

  const addGroupHeader = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        isGroupHeader: true,
        groupTitle: 'New Group Section',
        itemName: '',
        description: '',
        hsnSac: '',
        gstRate: 0,
        quantity: 0,
        unit: '',
        rate: 0,
        discountType: 'NONE',
        discountValue: 0,
      },
    ]);
  };

  const duplicateLineItem = (id: string) => {
    const targetIdx = items.findIndex((i) => i.id === id);
    if (targetIdx === -1) return;
    const copy = { ...items[targetIdx], id: Math.random().toString(36).substring(2, 9) };
    setItems((prev) => {
      const list = [...prev];
      list.splice(targetIdx + 1, 0, copy);
      return list;
    });
  };

  const deleteLineItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Additional Charges actions
  const addAdditionalCharge = () => {
    setAdditionalCharges((prev) => [...prev, { chargeName: '', amount: 0, isTaxable: false, gstRate: 18 }]);
  };

  const removeAdditionalCharge = (index: number) => {
    setAdditionalCharges((prev) => prev.filter((_, i) => i !== index));
  };

  // Additional Info actions
  const addAdditionalInfoItem = () => {
    setAdditionalInfo((prev) => [...prev, { label: '', value: '' }]);
  };

  const removeAdditionalInfoItem = (index: number) => {
    setAdditionalInfo((prev) => prev.filter((_, i) => i !== index));
  };

  // LIVE CALCULATIONS
  const calculateTotals = () => {
    const businessStateCode = businessProfile?.address?.stateCode || 'DL';
    const supplyStateCode = placeOfSupply.stateCode || businessStateCode;
    const isIntraState = gstEnabled && businessStateCode.toUpperCase() === supplyStateCode.toUpperCase();
    const gstMode = isIntraState ? 'INTRA_STATE' : 'INTER_STATE';

    let itemsSubtotal = 0;
    let totalQtySum = 0;

    const computedItems = items.map((item) => {
      if (item.isGroupHeader) {
        return {
          ...item,
          baseAmount: 0,
          itemDiscountAmount: 0,
          taxableAmount: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total: 0,
        };
      }

      const qty = Math.max(0, item.quantity);
      totalQtySum += qty;
      const rate = Math.max(0, item.rate);
      const discVal = Math.max(0, item.discountValue);
      const gstRate = gstEnabled ? Math.max(0, item.gstRate) : 0;

      const baseAmount = Math.round(qty * rate * 100) / 100;

      let itemDiscountAmount = 0;
      if (item.discountType === 'PERCENTAGE') {
        itemDiscountAmount = Math.round(((baseAmount * discVal) / 100) * 100) / 100;
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
        documentDiscountAmount = Math.round(((itemsSubtotal * docDiscountValue) / 100) * 100) / 100;
      } else if (docDiscountType === 'FIXED') {
        documentDiscountAmount = Math.min(itemsSubtotal, Math.max(0, docDiscountValue));
      }
    }

    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let finalTaxableSum = 0;

    const finalItems = computedItems.map((item) => {
      if (item.isGroupHeader) return item;

      const proportionalDiscount =
        itemsSubtotal > 0 ? Math.round(((item.taxableAmount / itemsSubtotal) * documentDiscountAmount) * 100) / 100 : 0;

      const finalTaxable = Math.max(0, Math.round((item.taxableAmount - proportionalDiscount) * 100) / 100);
      finalTaxableSum += finalTaxable;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (gstEnabled) {
        if (isIntraState) {
          cgst = Math.round(((finalTaxable * (item.gstRate / 2)) / 100) * 100) / 100;
          sgst = Math.round(((finalTaxable * (item.gstRate / 2)) / 100) * 100) / 100;
          cgstTotal += cgst;
          sgstTotal += sgst;
        } else {
          igst = Math.round(((finalTaxable * item.gstRate) / 100) * 100) / 100;
          igstTotal += igst;
        }
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
    const computedCharges = additionalCharges.map((charge) => {
      const amt = Math.max(0, charge.amount);
      let taxAmt = 0;
      if (gstEnabled && charge.isTaxable) {
        const gstRate = Math.max(0, charge.gstRate);
        taxAmt = Math.round(((amt * gstRate) / 100) * 100) / 100;
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
    const grandTotal = enableRoundOff ? Math.round(grandTotalNoRound) : Math.round(grandTotalNoRound * 100) / 100;
    const roundOff = Math.round((grandTotal - grandTotalNoRound) * 100) / 100;
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
      totalQtySum,
    };
  };

  const totals = calculateTotals();

  // Handle saving the document
  const handleSave = async (statusOverride: 'DRAFT' | 'SENT') => {
    if (!selectedClientId) {
      showToast('Please select a Client.', 'error');
      return;
    }

    // Validate item names
    const hasInvalidItem = items.some((item) => !item.isGroupHeader && !item.itemName.trim());
    if (hasInvalidItem) {
      showToast('Each line item must have a name.', 'error');
      return;
    }

    // Check if business profile is incomplete (in DB)
    if (!businessProfile || !businessProfile.businessName) {
      showToast('Please complete your Business Profile in Settings to create quotations.', 'error');
      return;
    }

    setSaving(true);
    try {
      // Serialize items: map group header rows to [GROUP] itemName tags so the backend validators pass
      const serializedItems = items.map((item) => {
        if (item.isGroupHeader) {
          return {
            itemName: `[GROUP] ${item.groupTitle || 'Group Section'}`,
            quantity: 1,
            rate: 0,
            gstRate: 0,
            unit: 'PCS',
            discountType: 'NONE',
            discountValue: 0,
            description: 'Group Section Header Row',
          };
        }
        return {
          itemName: item.itemName,
          description: item.description,
          hsnSac: item.hsnSac,
          gstRate: item.gstRate,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          discountType: item.discountType,
          discountValue: item.discountValue,
        };
      });

      const payload = {
        clientId: selectedClientId,
        documentType: 'QUOTATION',
        poNumber,
        issueDate: new Date(issueDate).toISOString(),
        validTill: validTill ? new Date(validTill).toISOString() : undefined,
        placeOfSupply,
        items: serializedItems,
        documentDiscountType: enableDocDiscount ? docDiscountType : 'NONE',
        documentDiscountValue: enableDocDiscount ? docDiscountValue : 0,
        additionalCharges,
        terms,
        notes,
        customFields: [
          ...additionalInfo.filter((f) => f.label.trim() && f.value.trim()).map((f) => ({ key: f.label, value: f.value })),
          ...(docTitle !== 'Quotation' ? [{ key: 'doc_title_override', value: docTitle }] : []),
          ...(docSubtitle ? [{ key: 'doc_subtitle_override', value: docSubtitle }] : []),
          ...(logoBase64 ? [{ key: 'logo_url_override', value: logoBase64 }] : []),
          ...(signatureBase64 ? [{ key: 'signature_url_override', value: signatureBase64 }] : []),
          ...(contactDetails.name ? [{ key: 'contact_name_override', value: contactDetails.name }] : []),
          ...(contactDetails.phone ? [{ key: 'contact_phone_override', value: contactDetails.phone }] : []),
          ...(contactDetails.email ? [{ key: 'contact_email_override', value: contactDetails.email }] : []),
        ],
        signatoryName,
        displayOptions: {
          showHsnSac: displayOptions.showHsnSac,
          showTaxSummary: displayOptions.showTaxSummary,
          showItemDescriptions: displayOptions.showItemDescriptions,
          showTotalQuantity: displayOptions.showTotalQuantity,
        },
        status: statusOverride,
      };

      const response = await api.post('/documents', payload);
      if (response.data?.success) {
        showToast('Quotation saved successfully!', 'success');
        router.push(`/quotations/${response.data.data._id}`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save quotation.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Add client form handler
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.clientName.trim()) {
      showToast('Client Name is required.', 'error');
      return;
    }

    try {
      const response = await api.post('/clients', newClient);
      if (response.data?.success) {
        const saved = response.data.data.client;
        showToast('Client created successfully!', 'success');
        setIsClientModalOpen(false);

        // Reset new client form state
        setNewClient({
          clientType: 'BUSINESS',
          businessName: '',
          clientName: '',
          email: '',
          phone: '',
          gstin: '',
          pan: '',
          billingAddress: { addressLine1: '', addressLine2: '', city: '', state: '', stateCode: '', country: 'India', pincode: '' },
          shippingAddress: { addressLine1: '', addressLine2: '', city: '', state: '', stateCode: '', country: 'India', pincode: '' },
          notes: '',
        });

        // Refresh select options
        await loadClients();
        setSelectedClientId(saved._id);
        setSelectedClient(saved);
        if (saved.billingAddress?.state) {
          setPlaceOfSupply({
            state: saved.billingAddress.state,
            stateCode: saved.billingAddress.stateCode || '',
          });
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create client.', 'error');
    }
  };

  const isProfileIncomplete = !businessProfile || !businessProfile.businessName || !businessProfile.address?.stateCode;

  if (loading) {
    return (
      <div className="card-panel p-16 rounded-xl flex items-center justify-center min-h-[300px]">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 text-slate-800">
      {/* Non-blocking Business Profile warning banner */}
      {isProfileIncomplete && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 animate-slideUp shadow-sm text-xs">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="font-medium">
              Complete your business profile to include full business details in generated documents.
            </p>
          </div>
          <Link
            href="/settings"
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-sm transition-colors text-[11px]"
          >
            Complete Profile
          </Link>
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Create New Quotation</h1>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 font-medium">
            <span className={activeStep === 1 ? 'text-blue-600 font-bold' : ''}>1. Quotation Details</span>
            <span className="text-slate-350">/</span>
            <span className={activeStep === 2 ? 'text-blue-600 font-bold' : ''}>2. Design & Preview</span>
          </div>
        </div>

        <div className="flex gap-2">
          {activeStep === 2 ? (
            <>
              <button
                onClick={() => setActiveStep(1)}
                className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-colors"
              >
                Back to Edit
              </button>
              <button
                onClick={() => handleSave('SENT')}
                disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
              >
                {saving ? 'Saving...' : 'Save & Publish'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleSave('DRAFT')}
                disabled={saving}
                className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-colors"
              >
                {saving ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                onClick={() => {
                  if (!selectedClientId) {
                    showToast('Please select a Client to preview.', 'error');
                    return;
                  }
                  setActiveStep(2);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
              >
                Save & Continue
              </button>
            </>
          )}
        </div>
      </div>

      {activeStep === 1 ? (
        /* STEP 1: BILLING DOCUMENT EDITOR */
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
          {/* Main Card Panel Editor */}
          <div className="xl:col-span-3 card-panel p-8 rounded-xl space-y-8 bg-white border border-slate-200">
            
            {/* Logo/Watermark Title Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-slate-200">
              <div className="flex-1 w-full text-center sm:text-left">
                {/* Centered editable title */}
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="text-2xl font-black text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none w-full sm:max-w-xs transition-colors font-sans"
                  placeholder="Document Title"
                />
                
                {/* Subtitle action */}
                <div className="mt-1">
                  {showSubtitleInput || docSubtitle ? (
                    <input
                      type="text"
                      value={docSubtitle}
                      onChange={(e) => setDocSubtitle(e.target.value)}
                      onBlur={() => { if (!docSubtitle) setShowSubtitleInput(false); }}
                      className="text-xs text-slate-500 bg-transparent border-b border-slate-200 focus:border-blue-500 focus:outline-none w-full sm:max-w-xs font-medium"
                      placeholder="e.g. Estimate / Proposal"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSubtitleInput(true)}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-wider"
                    >
                      + Add Subtitle
                    </button>
                  )}
                </div>
              </div>

              {/* Metadata Details Area */}
              <div className="w-full sm:w-auto text-left sm:text-right space-y-2.5 text-xs text-slate-650 font-mono">
                <div>
                  <span className="font-semibold text-slate-500 uppercase text-[10px]">Quotation No:</span>
                  <span className="ml-2 font-bold text-slate-900">Auto-generated on save</span>
                </div>
                
                <div className="flex items-center sm:justify-end gap-2">
                  <span className="font-semibold text-slate-500 uppercase text-[10px]">PO Number:</span>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="Ref PO #"
                    className="border border-slate-300 rounded px-2 py-0.5 text-slate-900 w-28 bg-white font-sans text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center sm:justify-end gap-2">
                  <span className="font-semibold text-slate-500 uppercase text-[10px]">Date:</span>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="border border-slate-300 rounded px-1.5 py-0.5 text-slate-900 w-28 bg-white font-sans focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center sm:justify-end gap-2">
                  <span className="font-semibold text-slate-500 uppercase text-[10px]">Valid Till:</span>
                  <input
                    type="date"
                    value={validTill}
                    onChange={(e) => setValidTill(e.target.value)}
                    className="border border-slate-300 rounded px-1.5 py-0.5 text-slate-900 w-28 bg-white font-sans focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Logo Area */}
              <div className="flex-shrink-0 flex items-center justify-center sm:justify-end">
                <div className="relative w-20 h-20 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden shadow-inner group">
                  {logoBase64 ? (
                    <>
                      <img src={logoBase64} alt="Company Logo" className="max-w-full max-h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => setLogoBase64('')}
                        className="absolute inset-0 bg-black/40 text-white font-semibold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-slate-600 transition-colors">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-[9px] mt-1 font-semibold uppercase tracking-wider">Logo</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Business (Quotation From) & Client (Quotation For) Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-4">
              {/* Business Side (READ-ONLY PROFILE DETAILS) */}
              <div className="space-y-3 p-5 rounded-xl bg-slate-50/50 border border-slate-100 relative group/card">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quotation From</h4>
                    <p className="text-sm font-bold text-slate-900 mt-1">
                      {businessProfile.businessName || 'Your Business Name'}
                    </p>
                  </div>
                  <Link
                    href="/settings"
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </Link>
                </div>
                
                <div className="text-xs text-slate-600 space-y-1">
                  {businessProfile.email && <p>Email: {businessProfile.email}</p>}
                  {businessProfile.phone && <p>Phone: {businessProfile.phone}</p>}
                  {businessProfile.gstin && <p className="font-mono">GSTIN: {businessProfile.gstin}</p>}
                  {businessProfile.address?.addressLine1 && (
                    <p className="mt-1 pt-1 border-t border-slate-200/60 leading-relaxed text-slate-500">
                      Address: {businessProfile.address.addressLine1}
                      {businessProfile.address.city && `, ${businessProfile.address.city}`}
                      {businessProfile.address.state && `, ${businessProfile.address.state}`}
                      {businessProfile.address.pincode && ` - ${businessProfile.address.pincode}`}
                    </p>
                  )}
                </div>
              </div>

              {/* Client Selector & Info */}
              <div className="space-y-3 p-5 rounded-xl bg-slate-50/50 border border-slate-100">
                <div>
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quotation For</h4>
                    <button
                      type="button"
                      onClick={() => setIsClientModalOpen(true)}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-wider"
                    >
                      + Add New Client
                    </button>
                  </div>
                  
                  {/* Select Dropdown */}
                  {clientsError ? (
                    <div className="p-2 border border-rose-200 bg-rose-50 rounded-lg text-[10px] text-rose-800 mt-2">
                      Error: Complete your business profile in Settings first to load clients.
                    </div>
                  ) : (
                    <select
                      value={selectedClientId}
                      onChange={(e) => handleClientChange(e.target.value)}
                      className="w-full form-input text-xs mt-2 bg-white text-slate-900 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Select a Client</option>
                      {clients.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.clientType === 'BUSINESS' && c.businessName ? `${c.businessName} (${c.clientName})` : c.clientName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedClient && (
                  <div className="text-xs text-slate-655 space-y-1.5 animate-fadeIn mt-2 text-slate-600">
                    <p className="font-bold text-slate-900">
                      {selectedClient.clientType === 'BUSINESS' && selectedClient.businessName
                        ? selectedClient.businessName
                        : selectedClient.clientName}
                    </p>
                    {selectedClient.clientType === 'BUSINESS' && <p className="text-slate-500">Contact: {selectedClient.clientName}</p>}
                    {selectedClient.email && <p>Email: {selectedClient.email}</p>}
                    {selectedClient.phone && <p>Phone: {selectedClient.phone}</p>}
                    {selectedClient.gstin && <p className="font-mono">GSTIN: {selectedClient.gstin}</p>}
                    {selectedClient.billingAddress?.addressLine1 && (
                      <p className="mt-1 pt-1 border-t border-slate-200/60 leading-relaxed text-slate-500">
                        Billing: {selectedClient.billingAddress.addressLine1}
                        {selectedClient.billingAddress.city && `, ${selectedClient.billingAddress.city}`}
                        {selectedClient.billingAddress.state && `, ${selectedClient.billingAddress.state}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Shipping details toggle */}
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableShipping}
                  onChange={(e) => setEnableShipping(e.target.checked)}
                  className="rounded border-slate-350 text-blue-600 w-4 h-4 focus:ring-0"
                />
                Add Shipping Details
              </label>

              {enableShipping && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-xl bg-slate-50 border border-slate-100 animate-fadeIn">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Shipping Address</label>
                    <input
                      type="text"
                      value={shippingAddress.addressLine1}
                      onChange={(e) => setShippingAddress((prev) => ({ ...prev, addressLine1: e.target.value }))}
                      className="w-full form-input text-xs text-slate-900"
                      placeholder="Street address details"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">City</label>
                    <input
                      type="text"
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress((prev) => ({ ...prev, city: e.target.value }))}
                      className="w-full form-input text-xs text-slate-900"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">State</label>
                    <select
                      value={shippingAddress.state}
                      onChange={(e) => {
                        const s = INDIAN_STATES.find((x) => x.name === e.target.value);
                        setShippingAddress((prev) => ({ ...prev, state: e.target.value, stateCode: s ? s.stateCode : '' }));
                      }}
                      className="w-full form-input text-xs bg-white text-slate-900"
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s.code} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Pincode</label>
                    <input
                      type="text"
                      value={shippingAddress.pincode}
                      onChange={(e) => setShippingAddress((prev) => ({ ...prev, pincode: e.target.value }))}
                      className="w-full form-input text-xs text-slate-900"
                      placeholder="Pincode"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Country</label>
                    <input
                      type="text"
                      value={shippingAddress.country}
                      onChange={(e) => setShippingAddress((prev) => ({ ...prev, country: e.target.value }))}
                      className="w-full form-input text-xs text-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* GST and Currency Configuration */}
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-900">Tax & Currency Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">GST Registration</label>
                  <select
                    value={gstEnabled ? 'ENABLED' : 'DISABLED'}
                    onChange={(e) => setGstEnabled(e.target.value === 'ENABLED')}
                    className="w-full form-input text-xs bg-white text-slate-900"
                  >
                    <option value="ENABLED">GST Tax Calculations Enabled</option>
                    <option value="DISABLED">Non-GST (No taxes applied)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Place of Supply</label>
                  <select
                    value={placeOfSupply.state}
                    onChange={(e) => handlePlaceOfSupplyChange(e.target.value)}
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
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full form-input text-xs bg-white text-slate-900"
                  >
                    <option value="INR">Indian Rupee (INR ₹)</option>
                    <option value="USD">US Dollar (USD $)</option>
                    <option value="EUR">Euro (EUR €)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={reverseCharge}
                    onChange={(e) => setReverseCharge(e.target.checked)}
                    className="rounded border-slate-350 text-blue-600 w-4 h-4 focus:ring-0"
                  />
                  Reverse Charge Applicable
                </label>
              </div>
            </div>

            {/* Dynamic line items table */}
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-900">Line Items</h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addGroupHeader}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-colors"
                  >
                    Add New Group
                  </button>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-750 text-white text-[10px] font-bold rounded-lg uppercase tracking-wider transition-colors"
                  >
                    Add New Line
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[9px]">
                      <th className="p-3 min-w-[200px]">Item Details</th>
                      {displayOptions.showHsnSac && <th className="p-3 w-24 text-center">HSN/SAC</th>}
                      {gstEnabled && <th className="p-3 w-20 text-center">GST %</th>}
                      <th className="p-3 w-20 text-center">Qty</th>
                      <th className="p-3 w-24 text-right">Rate</th>
                      <th className="p-3 w-28 text-center">Discount</th>
                      <th className="p-3 w-28 text-right">Amount</th>
                      <th className="p-3 w-24 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => {
                      if (item.isGroupHeader) {
                        return (
                          <tr key={item.id} className="bg-blue-50/40 align-middle">
                            <td colSpan={displayOptions.showHsnSac ? (gstEnabled ? 8 : 7) : (gstEnabled ? 7 : 6)} className="p-3">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-widest">Group Header:</span>
                                <input
                                  type="text"
                                  value={item.groupTitle}
                                  onChange={(e) => handleItemFieldChange(item.id, 'groupTitle', e.target.value)}
                                  className="form-input text-xs text-slate-900 bg-white font-bold max-w-sm py-1 border-slate-200"
                                  placeholder="Enter group heading (e.g. Phase 1 Services)"
                                />
                                <button
                                  type="button"
                                  onClick={() => deleteLineItem(item.id)}
                                  className="text-rose-600 hover:text-rose-800 transition-colors p-1"
                                  title="Delete Group"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      // Dynamic amounts
                      const computedAmt = Math.round(item.quantity * item.rate * 100) / 100;
                      let compDisc = 0;
                      if (item.discountType === 'PERCENTAGE') {
                        compDisc = Math.round(((computedAmt * item.discountValue) / 100) * 100) / 100;
                      } else if (item.discountType === 'FIXED') {
                        compDisc = Math.min(computedAmt, item.discountValue);
                      }
                      const computedTotal = computedAmt - compDisc;

                      return (
                        <tr key={item.id} className="align-top hover:bg-slate-50/50 transition-colors">
                          {/* Item Details */}
                          <td className="p-3 space-y-2">
                            <input
                              type="text"
                              value={item.itemName}
                              onChange={(e) => handleItemFieldChange(item.id, 'itemName', e.target.value)}
                              className="w-full form-input text-xs text-slate-900 border-slate-200"
                              placeholder="Item or Product Name"
                            />
                            {displayOptions.showItemDescriptions && (
                              <textarea
                                value={item.description}
                                onChange={(e) => handleItemFieldChange(item.id, 'description', e.target.value)}
                                className="w-full form-input text-[11px] text-slate-600 border-slate-200 resize-none"
                                rows={2}
                                placeholder="Description notes"
                              />
                            )}
                            <div className="flex gap-2">
                              <select
                                value={item.productType}
                                onChange={(e) => handleItemFieldChange(item.id, 'productType', e.target.value)}
                                className="form-input text-[10px] text-slate-500 py-0.5 border-slate-200 bg-white"
                              >
                                <option value="PRODUCT">Product</option>
                                <option value="SERVICE">Service</option>
                              </select>
                              <input
                                type="text"
                                value={item.unit}
                                onChange={(e) => handleItemFieldChange(item.id, 'unit', e.target.value)}
                                className="form-input text-[10px] text-slate-500 py-0.5 w-16 border-slate-200 text-center"
                                placeholder="Unit (e.g. PCS)"
                              />
                            </div>
                          </td>

                          {/* HSN */}
                          {displayOptions.showHsnSac && (
                            <td className="p-3 text-center">
                              <input
                                type="text"
                                value={item.hsnSac}
                                onChange={(e) => handleItemFieldChange(item.id, 'hsnSac', e.target.value)}
                                className="w-full form-input text-xs text-center border-slate-200 font-mono"
                                placeholder="HSN"
                              />
                            </td>
                          )}

                          {/* GST Rate */}
                          {gstEnabled && (
                            <td className="p-3 text-center">
                              <select
                                value={item.gstRate}
                                onChange={(e) => handleItemFieldChange(item.id, 'gstRate', parseFloat(e.target.value))}
                                className="w-full form-input text-xs bg-white border-slate-200 text-slate-900"
                              >
                                <option value={0}>0%</option>
                                <option value={5}>5%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
                            </td>
                          )}

                          {/* Quantity */}
                          <td className="p-3">
                            <input
                              type="number"
                              min={0.0001}
                              step={1}
                              value={item.quantity}
                              onChange={(e) => handleItemFieldChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full form-input text-xs text-center border-slate-200 font-mono"
                            />
                          </td>

                          {/* Rate */}
                          <td className="p-3">
                            <input
                              type="number"
                              min={0}
                              value={item.rate}
                              onChange={(e) => handleItemFieldChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                              className="w-full form-input text-xs text-right border-slate-200 font-mono"
                            />
                          </td>

                          {/* Item Discount */}
                          <td className="p-3 space-y-1">
                            <select
                              value={item.discountType}
                              onChange={(e) => handleItemFieldChange(item.id, 'discountType', e.target.value)}
                              className="w-full form-input text-[11px] bg-white border-slate-200 py-0.5 text-slate-900"
                            >
                              <option value="NONE">None</option>
                              <option value="PERCENTAGE">% percentage</option>
                              <option value="FIXED">₹ fixed</option>
                            </select>
                            {item.discountType !== 'NONE' && (
                              <input
                                type="number"
                                min={0}
                                value={item.discountValue}
                                onChange={(e) => handleItemFieldChange(item.id, 'discountValue', parseFloat(e.target.value) || 0)}
                                className="w-full form-input text-xs text-center border-slate-200 py-0.5 font-mono"
                              />
                            )}
                          </td>

                          {/* Total Amount */}
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            ₹{computedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Row Actions */}
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => duplicateLineItem(item.id)}
                                className="p-1 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
                                title="Duplicate Row"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteLineItem(item.id)}
                                disabled={items.length <= 1}
                                className="p-1 border border-slate-200 hover:bg-slate-100 rounded-lg text-rose-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                title="Delete Row"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
            </div>

            {/* Calculations and Summary Details */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-t border-slate-200 pt-6">
              
              {/* Document level adjustments triggers */}
              <div className="flex-1 w-full space-y-4">
                <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-700 select-none">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableDocDiscount}
                      onChange={(e) => setEnableDocDiscount(e.target.checked)}
                      className="rounded border-slate-350 text-blue-600 w-4 h-4 focus:ring-0"
                    />
                    Add Document Discount
                  </label>
                  
                  <button
                    type="button"
                    onClick={addAdditionalCharge}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-wider"
                  >
                    + Add Additional Charge
                  </button>
                </div>

                {/* Document discount configuration details */}
                {enableDocDiscount && (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3 animate-fadeIn">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Document Discount Details</span>
                    <div className="flex items-center gap-3">
                      <select
                        value={docDiscountType}
                        onChange={(e) => setDocDiscountType(e.target.value as any)}
                        className="form-input text-xs bg-white max-w-[120px]"
                      >
                        <option value="PERCENTAGE">% Percentage</option>
                        <option value="FIXED">₹ Fixed Value</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={docDiscountValue}
                        onChange={(e) => setDocDiscountValue(parseFloat(e.target.value) || 0)}
                        className="form-input text-xs text-center max-w-[100px] font-mono"
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}

                {/* Additional charges table list */}
                {additionalCharges.length > 0 && (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3 animate-fadeIn">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Additional Charges Details</span>
                    <div className="space-y-2">
                      {additionalCharges.map((charge, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <input
                            type="text"
                            value={charge.chargeName}
                            onChange={(e) =>
                              setAdditionalCharges((prev) =>
                                prev.map((item, i) => (i === index ? { ...item, chargeName: e.target.value } : item))
                              )
                            }
                            className="form-input text-xs bg-white w-full max-w-[200px]"
                            placeholder="e.g. Delivery Charge"
                          />
                          <input
                            type="number"
                            min={0}
                            value={charge.amount}
                            onChange={(e) =>
                              setAdditionalCharges((prev) =>
                                prev.map((item, i) => (i === index ? { ...item, amount: parseFloat(e.target.value) || 0 } : item))
                              )
                            }
                            className="form-input text-xs text-right max-w-[100px] font-mono"
                            placeholder="Amount"
                          />
                          {gstEnabled && (
                            <>
                              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={charge.isTaxable}
                                  onChange={(e) =>
                                    setAdditionalCharges((prev) =>
                                      prev.map((item, i) => (i === index ? { ...item, isTaxable: e.target.checked } : item))
                                    )
                                  }
                                  className="rounded border-slate-350 text-blue-600 w-3.5 h-3.5"
                                />
                                Taxable
                              </label>
                              {charge.isTaxable && (
                                <select
                                  value={charge.gstRate}
                                  onChange={(e) =>
                                    setAdditionalCharges((prev) =>
                                      prev.map((item, i) => (i === index ? { ...item, gstRate: parseFloat(e.target.value) || 0 } : item))
                                    )
                                  }
                                  className="form-input text-xs bg-white max-w-[80px]"
                                >
                                  <option value={0}>0%</option>
                                  <option value={5}>5%</option>
                                  <option value={12}>12%</option>
                                  <option value={18}>18%</option>
                                  <option value={28}>28%</option>
                                </select>
                              )}
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAdditionalCharge(index)}
                            className="text-rose-600 hover:text-rose-800 transition-colors p-1"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side Summary block */}
              <div className="w-full md:w-80 space-y-3 bg-slate-50/50 border border-slate-100 p-5 rounded-xl text-xs text-slate-700">
                <div className="flex justify-between items-center text-slate-500 font-medium">
                  <span>Items Subtotal</span>
                  <span className="font-mono">₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                {totals.documentDiscountAmount > 0 && (
                  <div className="flex justify-between items-center text-rose-650 font-bold">
                    <span>Document Discount</span>
                    <span className="font-mono">-₹{totals.documentDiscountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-500 font-medium">
                  <span>Taxable Amount</span>
                  <span className="font-mono">₹{totals.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                {gstEnabled && (
                  <>
                    {totals.gstMode === 'INTRA_STATE' ? (
                      <>
                        <div className="flex justify-between items-center text-slate-500 font-medium pl-2">
                          <span>Central CGST Total</span>
                          <span className="font-mono">₹{totals.cgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500 font-medium pl-2">
                          <span>State SGST Total</span>
                          <span className="font-mono">₹{totals.sgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between items-center text-slate-500 font-medium pl-2">
                        <span>Integrated IGST Total</span>
                        <span className="font-mono">₹{totals.igstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </>
                )}

                {totals.additionalChargesTotal > 0 && (
                  <div className="flex justify-between items-center text-slate-500 font-medium">
                    <span>Additional Charges Total</span>
                    <span className="font-mono">+₹{totals.additionalChargesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                {enableRoundOff && Math.abs(totals.roundOff) > 0 && (
                  <div className="flex justify-between items-center text-slate-500 font-medium">
                    <span>Round Off</span>
                    <span className="font-mono">₹{totals.roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-xs font-bold text-slate-900 border-t border-slate-200 pt-3">
                  <span>Grand Total</span>
                  <span className="text-sm text-blue-600 font-black font-mono">
                    ₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                
                {/* Total words details */}
                <div className="text-[10px] text-slate-500 italic text-right leading-relaxed font-sans pt-1">
                  In Words: {totals.grandTotalInWords}
                </div>
              </div>
            </div>

            {/* Optional Document details triggers (Signature, Terms, Notes, etc) */}
            <div className="border-t border-slate-200 pt-6 space-y-4">
              <h4 className="text-xs font-bold text-slate-900">Optional Document details</h4>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowSignatureArea(!showSignatureArea)}
                  className={`px-3 py-1.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    showSignatureArea ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {showSignatureArea ? '✓ Signature Details' : '+ Add Signature'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowTermsArea(!showTermsArea)}
                  className={`px-3 py-1.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    showTermsArea ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {showTermsArea ? '✓ Terms & Conditions' : '+ Add Terms & Conditions'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowNotesArea(!showNotesArea)}
                  className={`px-3 py-1.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    showNotesArea ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {showNotesArea ? '✓ Remarks & Notes' : '+ Add Remarks & Notes'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowAttachmentsArea(!showAttachmentsArea)}
                  className={`px-3 py-1.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    showAttachmentsArea ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {showAttachmentsArea ? '✓ Attachments' : '+ Add Attachments'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
                  className={`px-3 py-1.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    showAdditionalInfo ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {showAdditionalInfo ? '✓ Additional Info' : '+ Add Additional Info'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowContactDetails(!showContactDetails)}
                  className={`px-3 py-1.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    showContactDetails ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {showContactDetails ? '✓ Contact Info' : '+ Add Contact Details'}
                </button>
              </div>

              {/* Signature input block */}
              {showSignatureArea && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-xl bg-slate-50 border border-slate-100 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Authorized Signatory Name</label>
                    <input
                      type="text"
                      value={signatoryName}
                      onChange={(e) => setSignatoryName(e.target.value)}
                      className="w-full form-input text-xs text-slate-900 bg-white"
                      placeholder="e.g. John Doe, Director"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Signature File Asset</label>
                    <div className="flex items-center gap-3">
                      {signatureBase64 && (
                        <div className="w-16 h-8 border border-slate-200 rounded bg-white flex items-center justify-center overflow-hidden">
                          <img src={signatureBase64} alt="Signature Preview" className="max-w-full max-h-full object-contain" />
                        </div>
                      )}
                      <label className="inline-block px-3 py-1.5 border border-slate-300 rounded bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm">
                        Select File
                        <input type="file" accept="image/*" className="hidden" onChange={handleSignatureFileChange} />
                      </label>
                      {signatureBase64 && (
                        <button type="button" onClick={() => setSignatureBase64('')} className="text-xs text-rose-600 hover:text-rose-800 font-semibold">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Terms and conditions text area */}
              {showTermsArea && (
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 animate-fadeIn">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Terms & Conditions Details</label>
                  <textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    className="w-full form-input text-xs text-slate-900 bg-white resize-y"
                    rows={4}
                    placeholder="Enter Terms & Conditions"
                  />
                </div>
              )}

              {/* Notes and remarks details */}
              {showNotesArea && (
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 animate-fadeIn">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Remarks / Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full form-input text-xs text-slate-900 bg-white resize-y"
                    rows={3}
                    placeholder="Remarks visible on documents"
                  />
                </div>
              )}

              {/* Attachments view */}
              {showAttachmentsArea && (
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-100 space-y-3 animate-fadeIn">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Document Attachments</label>
                  <div className="flex items-center gap-3">
                    <label className="inline-block px-4 py-2 border border-slate-300 rounded bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm">
                      Upload Files
                      <input type="file" multiple className="hidden" onChange={handleAttachmentUpload} />
                    </label>
                    <p className="text-[10px] text-slate-400">Upload proposal brochures, spec sheets, etc. (Max 2MB)</p>
                  </div>
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-3 py-1 border border-slate-200 bg-white rounded-lg text-xs font-medium">
                          <span className="truncate max-w-[150px]">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-rose-600 font-bold hover:text-rose-800 ml-1 text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Additional Key-Value fields */}
              {showAdditionalInfo && (
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-100 space-y-3 animate-fadeIn">
                  <div className="flex justify-between items-center">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Additional Custom Fields</span>
                    <button
                      type="button"
                      onClick={addAdditionalInfoItem}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-wider"
                    >
                      + Add Key-Value Field
                    </button>
                  </div>
                  <div className="space-y-2">
                    {additionalInfo.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-3 animate-fadeIn">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) =>
                            setAdditionalInfo((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item))
                            )
                          }
                          className="form-input text-xs bg-white w-full max-w-[150px]"
                          placeholder="Field Label"
                        />
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) =>
                            setAdditionalInfo((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, value: e.target.value } : item))
                            )
                          }
                          className="form-input text-xs bg-white w-full max-w-[200px]"
                          placeholder="Value Description"
                        />
                        <button
                          type="button"
                          onClick={() => removeAdditionalInfoItem(idx)}
                          className="text-rose-600 hover:text-rose-800 transition-colors p-1"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact details metadata input */}
              {showContactDetails && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-xl bg-slate-50 border border-slate-100 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Contact Name</label>
                    <input
                      type="text"
                      value={contactDetails.name}
                      onChange={(e) => setContactDetails((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full form-input text-xs text-slate-900 bg-white"
                      placeholder="e.g. Sales Coordinator"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Contact Phone</label>
                    <input
                      type="text"
                      value={contactDetails.phone}
                      onChange={(e) => setContactDetails((prev) => ({ ...prev, phone: e.target.value }))}
                      className="w-full form-input text-xs text-slate-900 bg-white"
                      placeholder="e.g. +91 99999 88888"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Contact Email</label>
                    <input
                      type="email"
                      value={contactDetails.email}
                      onChange={(e) => setContactDetails((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full form-input text-xs text-slate-900 bg-white"
                      placeholder="e.g. contact@techbes.com"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Editor Options / Advanced Options Column */}
          <div className="space-y-6">
            
            {/* Advanced Options panel */}
            <div className="card-panel p-6 rounded-xl space-y-4 bg-white border border-slate-200">
              <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100">Advanced Options</h3>
              
              <div className="space-y-3.5 text-xs text-slate-700">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">HSN/SAC Column Title</label>
                  <select
                    value={displayOptions.hsnColumnView}
                    onChange={(e) => setDisplayOptions((prev) => ({ ...prev, hsnColumnView: e.target.value }))}
                    className="w-full form-input text-xs bg-white py-1 border-slate-200 text-slate-900"
                  >
                    <option value="HSN">Display as HSN</option>
                    <option value="SAC">Display as SAC</option>
                    <option value="BOTH">Display as HSN/SAC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Display Unit As</label>
                  <select
                    value={displayOptions.displayUnitAs}
                    onChange={(e) => setDisplayOptions((prev) => ({ ...prev, displayUnitAs: e.target.value }))}
                    className="w-full form-input text-xs bg-white py-1 border-slate-200 text-slate-900"
                  >
                    <option value="Unit">Standard Unit (e.g. PCS)</option>
                    <option value="Qty">Only Quantity (No unit suffix)</option>
                  </select>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px]">
                    <input
                      type="checkbox"
                      checked={displayOptions.showTaxSummary}
                      onChange={(e) => setDisplayOptions((prev) => ({ ...prev, showTaxSummary: e.target.checked }))}
                      className="rounded border-slate-350 text-blue-600 w-3.5 h-3.5 focus:ring-0"
                    />
                    Show tax summary in document
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px]">
                    <input
                      type="checkbox"
                      checked={displayOptions.hidePlaceOfSupply}
                      onChange={(e) => setDisplayOptions((prev) => ({ ...prev, hidePlaceOfSupply: e.target.checked }))}
                      className="rounded border-slate-350 text-blue-600 w-3.5 h-3.5 focus:ring-0"
                    />
                    Hide place/country of supply
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px]">
                    <input
                      type="checkbox"
                      checked={displayOptions.showHsnSummary}
                      onChange={(e) => setDisplayOptions((prev) => ({ ...prev, showHsnSummary: e.target.checked }))}
                      className="rounded border-slate-350 text-blue-600 w-3.5 h-3.5 focus:ring-0"
                    />
                    Show HSN summary table
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px]">
                    <input
                      type="checkbox"
                      checked={displayOptions.showSku}
                      onChange={(e) => setDisplayOptions((prev) => ({ ...prev, showSku: e.target.checked }))}
                      className="rounded border-slate-350 text-blue-600 w-3.5 h-3.5 focus:ring-0"
                    />
                    Show Product SKU
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px]">
                    <input
                      type="checkbox"
                      checked={displayOptions.showSerialNumbers}
                      onChange={(e) => setDisplayOptions((prev) => ({ ...prev, showSerialNumbers: e.target.checked }))}
                      className="rounded border-slate-350 text-blue-600 w-3.5 h-3.5 focus:ring-0"
                    />
                    Show line item index serials
                  </label>
                </div>
              </div>
            </div>
            
            {/* Quick Summary Card */}
            <div className="card-panel p-6 rounded-xl space-y-4 bg-white border border-slate-200">
              <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100">Live Estimates</h3>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Taxable:</span>
                  <span className="font-bold font-mono">₹{totals.taxableAmount.toLocaleString('en-IN')}</span>
                </div>
                {gstEnabled && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">GST:</span>
                    <span className="font-bold font-mono">₹{(totals.cgstTotal + totals.sgstTotal + totals.igstTotal).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-100 pt-2 text-slate-900 font-bold">
                  <span>Grand Total:</span>
                  <span className="font-mono text-blue-600">₹{totals.grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: REVIEW QUOTATION (A4 STYLE PREVIEW) */
        <div className="space-y-6">
          <div className="card-panel max-w-4xl mx-auto rounded-xl p-12 bg-white border border-slate-200 shadow-sm space-y-8 animate-fadeIn text-xs text-slate-800 font-sans">
            {/* Header section preview */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{docTitle}</h2>
                {docSubtitle && <p className="text-[10px] text-slate-500 font-medium tracking-wide mt-1 uppercase">{docSubtitle}</p>}
                
                <div className="mt-4 space-y-1 font-medium text-slate-600">
                  <p className="font-bold text-slate-800 text-sm">{businessProfile.businessName || 'Your Business'}</p>
                  {businessProfile.email && <p>Email: {businessProfile.email}</p>}
                  {businessProfile.phone && <p>Phone: {businessProfile.phone}</p>}
                  {businessProfile.gstin && <p className="font-mono">GSTIN: {businessProfile.gstin}</p>}
                  {businessProfile.address?.addressLine1 && (
                    <p className="max-w-xs mt-1 leading-relaxed text-slate-500">
                      {businessProfile.address.addressLine1}, {businessProfile.address.city}, {businessProfile.address.state} - {businessProfile.address.pincode}
                    </p>
                  )}
                </div>
              </div>

              {/* Invoice details and logo preview */}
              <div className="flex flex-col items-end space-y-4">
                {logoBase64 && (
                  <div className="w-20 h-20 border border-slate-100 rounded-lg overflow-hidden flex items-center justify-center bg-slate-50 shadow-inner">
                    <img src={logoBase64} alt="Company Logo" className="max-w-full max-h-full object-contain" />
                  </div>
                )}
                <div className="text-right space-y-1 font-mono text-slate-650">
                  <p className="text-[10px] text-slate-450 uppercase font-semibold">Quotation details</p>
                  <p><span className="font-bold text-slate-800">No:</span> Draft (Auto-generated)</p>
                  <p><span className="font-bold text-slate-800">Date:</span> {issueDate}</p>
                  <p><span className="font-bold text-slate-800">Valid Till:</span> {validTill || '—'}</p>
                  {poNumber && <p><span className="font-bold text-slate-800">PO Ref:</span> {poNumber}</p>}
                </div>
              </div>
            </div>

            {/* Address information blocks */}
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
                    <p className="max-w-xs mt-1 leading-relaxed text-slate-500">
                      Billing: {selectedClient.billingAddress.addressLine1}, {selectedClient.billingAddress.city}, {selectedClient.billingAddress.state} - {selectedClient.billingAddress.pincode}
                    </p>
                  )}
                </div>
              </div>

              {enableShipping && (
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">SHIPPING DETAILS</h3>
                  <div className="space-y-1 text-slate-655 leading-relaxed text-slate-500">
                    <p>{shippingAddress.addressLine1}</p>
                    {shippingAddress.addressLine2 && <p>{shippingAddress.addressLine2}</p>}
                    <p>{shippingAddress.city}, {shippingAddress.state} - {shippingAddress.pincode}</p>
                    <p>{shippingAddress.country}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Table preview */}
            <div>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 font-semibold text-slate-500 uppercase tracking-wider text-[9px] pb-2">
                    <th className="py-2.5">Item Details</th>
                    {displayOptions.showHsnSac && (
                      <th className="py-2.5 w-[100px] text-center">
                        {displayOptions.hsnColumnView === 'BOTH' ? 'HSN/SAC' : displayOptions.hsnColumnView}
                      </th>
                    )}
                    <th className="py-2.5 w-[80px] text-center">Qty</th>
                    <th className="py-2.5 w-[90px] text-right">Rate</th>
                    <th className="py-2.5 w-[110px] text-right">Discount</th>
                    {gstEnabled && <th className="py-2.5 w-[80px] text-center">GST %</th>}
                    <th className="py-2.5 w-[110px] text-right">Total (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700">
                  {totals.items.map((item, idx) => {
                    if (item.isGroupHeader) {
                      return (
                        <tr key={idx} className="bg-slate-50 font-bold">
                          <td colSpan={displayOptions.showHsnSac ? (gstEnabled ? 7 : 6) : (gstEnabled ? 6 : 5)} className="py-2 px-1 text-blue-700">
                            {item.groupTitle}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={idx} className="align-top py-2.5">
                        <td className="py-2.5">
                          <p className="font-semibold text-slate-900">{item.itemName}</p>
                          {displayOptions.showItemDescriptions && item.description && (
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
                          )}
                        </td>
                        {displayOptions.showHsnSac && (
                          <td className="py-2.5 text-center font-mono text-[11px] text-slate-500">{item.hsnSac || '—'}</td>
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
                        {gstEnabled && <td className="py-2.5 text-center text-slate-600">{item.gstRate}%</td>}
                        <td className="py-2.5 text-right font-bold text-slate-900 font-mono">
                          ₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Calculations summary preview */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-t border-slate-200 pt-6">
              <div className="max-w-md space-y-4">
                {gstEnabled && displayOptions.showTaxSummary && (
                  <div className="space-y-1.5 text-[10px] text-slate-550 font-mono">
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

              <div className="w-full md:w-80 space-y-2.5 text-slate-700">
                <div className="flex justify-between items-center text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-mono">₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {totals.documentDiscountAmount > 0 && (
                  <div className="flex justify-between items-center text-rose-600 font-semibold">
                    <span>Document Discount</span>
                    <span className="font-mono">-₹{totals.documentDiscountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-slate-500">
                  <span>Taxable Amount</span>
                  <span className="font-mono">₹{totals.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {gstEnabled && (
                  <>
                    {totals.gstMode === 'INTRA_STATE' ? (
                      <div className="flex justify-between items-center text-slate-500">
                        <span>CGST + SGST</span>
                        <span className="font-mono">₹{(totals.cgstTotal + totals.sgstTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-slate-500">
                        <span>IGST</span>
                        <span className="font-mono">₹{totals.igstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </>
                )}
                {totals.additionalChargesTotal > 0 && (
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Additional Charges</span>
                    <span className="font-mono">+₹{totals.additionalChargesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {enableRoundOff && Math.abs(totals.roundOff) > 0 && (
                  <div className="flex justify-between items-center text-slate-450">
                    <span>Round Off</span>
                    <span className="font-mono">₹{totals.roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                  <span>Grand Total</span>
                  <span className="text-base text-blue-600 font-black font-mono">
                    ₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-[10px] text-slate-450 italic text-right mt-1 font-medium leading-relaxed">
                  In Words: {totals.grandTotalInWords}
                </div>
              </div>
            </div>

            {/* Custom clauses and signatures preview */}
            <div className="border-t border-slate-200 pt-6 grid grid-cols-1 md:grid-cols-2 gap-8 text-[11px] text-slate-600 font-sans">
              <div className="space-y-4">
                {terms && (
                  <div>
                    <p className="font-bold text-slate-450 uppercase text-[9px] mb-1 tracking-wider">Terms & Conditions</p>
                    <p className="whitespace-pre-wrap leading-relaxed text-slate-500">{terms}</p>
                  </div>
                )}
                {notes && (
                  <div>
                    <p className="font-bold text-slate-450 uppercase text-[9px] mb-1 tracking-wider">Remarks / Notes</p>
                    <p className="whitespace-pre-wrap leading-relaxed text-slate-500">{notes}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-end items-end space-y-6 pt-6">
                {signatureBase64 && (
                  <div className="w-24 h-12 overflow-hidden flex items-center justify-center bg-slate-50 border border-slate-100 rounded">
                    <img src={signatureBase64} alt="Authorized Signature" className="max-w-full max-h-full object-contain" />
                  </div>
                )}
                {signatoryName && (
                  <div className="text-center font-medium text-slate-700 min-w-[150px]">
                    <div className="h-0.5 border-b border-slate-200 mb-2" />
                    <p className="font-bold text-slate-900">{signatoryName}</p>
                    <p className="text-[10px] text-slate-450 mt-0.5 uppercase tracking-wider font-semibold">Authorized Signatory</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Client Modal Overlay Dialog */}
      <Modal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        title="Add New Client Profile"
        footer={
          <div className="flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsClientModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-slate-950 font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateClient}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-750 text-white rounded-lg font-semibold shadow-sm"
            >
              Create Client
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateClient} className="space-y-4 text-xs text-slate-700 max-h-[70vh] overflow-y-auto px-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Client Type *</label>
              <select
                value={newClient.clientType}
                onChange={(e) => setNewClient((p) => ({ ...p, clientType: e.target.value }))}
                className="w-full form-input bg-white text-slate-900"
              >
                <option value="BUSINESS">Business / Company</option>
                <option value="INDIVIDUAL">Individual / Retail Client</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Primary Contact Name *</label>
              <input
                type="text"
                value={newClient.clientName}
                onChange={(e) => setNewClient((p) => ({ ...p, clientName: e.target.value }))}
                className="w-full form-input text-slate-900"
                placeholder="e.g. Rahul Sharma"
                required
              />
            </div>

            {newClient.clientType === 'BUSINESS' && (
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Business Name</label>
                <input
                  type="text"
                  value={newClient.businessName}
                  onChange={(e) => setNewClient((p) => ({ ...p, businessName: e.target.value }))}
                  className="w-full form-input text-slate-900"
                  placeholder="e.g. Acme Corporation Pvt. Ltd."
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
              <input
                type="email"
                value={newClient.email}
                onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))}
                className="w-full form-input text-slate-900"
                placeholder="client@example.com"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
              <input
                type="text"
                value={newClient.phone}
                onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))}
                className="w-full form-input text-slate-900"
                placeholder="+91 XXXXX XXXXX"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">GSTIN</label>
              <input
                type="text"
                value={newClient.gstin}
                onChange={(e) => setNewClient((p) => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                className="w-full form-input uppercase text-slate-900"
                placeholder="15-digit GSTIN"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">PAN</label>
              <input
                type="text"
                value={newClient.pan}
                onChange={(e) => setNewClient((p) => ({ ...p, pan: e.target.value.toUpperCase() }))}
                className="w-full form-input uppercase text-slate-900"
                placeholder="10-digit PAN"
              />
            </div>
          </div>

          {/* Billing Address Sub section */}
          <div className="border-t border-slate-100 pt-3.5 space-y-2">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Billing Address</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={newClient.billingAddress.addressLine1}
                onChange={(e) =>
                  setNewClient((p) => ({ ...p, billingAddress: { ...p.billingAddress, addressLine1: e.target.value } }))
                }
                className="w-full form-input sm:col-span-2 text-slate-900"
                placeholder="Address Line 1"
              />
              <input
                type="text"
                value={newClient.billingAddress.city}
                onChange={(e) =>
                  setNewClient((p) => ({ ...p, billingAddress: { ...p.billingAddress, city: e.target.value } }))
                }
                className="w-full form-input text-slate-900"
                placeholder="City"
              />
              <select
                value={newClient.billingAddress.state}
                onChange={(e) => handleNewClientStateChange(e.target.value, 'billing')}
                className="w-full form-input bg-white text-slate-900"
              >
                <option value="">Select State</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newClient.billingAddress.pincode}
                onChange={(e) =>
                  setNewClient((p) => ({ ...p, billingAddress: { ...p.billingAddress, pincode: e.target.value } }))
                }
                className="w-full form-input text-slate-900"
                placeholder="Pincode"
              />
            </div>
          </div>

          {/* Shipping Address Sub section */}
          <div className="border-t border-slate-100 pt-3.5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shipping Address</span>
              <button
                type="button"
                onClick={() =>
                  setNewClient((p) => ({
                    ...p,
                    shippingAddress: { ...p.billingAddress },
                  }))
                }
                className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Copy Billing Address
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={newClient.shippingAddress.addressLine1}
                onChange={(e) =>
                  setNewClient((p) => ({ ...p, shippingAddress: { ...p.shippingAddress, addressLine1: e.target.value } }))
                }
                className="w-full form-input sm:col-span-2 text-slate-900"
                placeholder="Address Line 1"
              />
              <input
                type="text"
                value={newClient.shippingAddress.city}
                onChange={(e) =>
                  setNewClient((p) => ({ ...p, shippingAddress: { ...p.shippingAddress, city: e.target.value } }))
                }
                className="w-full form-input text-slate-900"
                placeholder="City"
              />
              <select
                value={newClient.shippingAddress.state}
                onChange={(e) => handleNewClientStateChange(e.target.value, 'shipping')}
                className="w-full form-input bg-white text-slate-900"
              >
                <option value="">Select State</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newClient.shippingAddress.pincode}
                onChange={(e) =>
                  setNewClient((p) => ({ ...p, shippingAddress: { ...p.shippingAddress, pincode: e.target.value } }))
                }
                className="w-full form-input text-slate-900"
                placeholder="Pincode"
              />
            </div>
          </div>

          {/* Notes description */}
          <div className="border-t border-slate-100 pt-3.5 space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Client Remarks / Internal Notes</label>
            <textarea
              value={newClient.notes}
              onChange={(e) => setNewClient((p) => ({ ...p, notes: e.target.value }))}
              className="w-full form-input text-slate-900 resize-y"
              rows={2}
              placeholder="Internal reminders about client preferences"
            />
          </div>
        </form>
      </Modal>
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

export default function NewQuotationPage() {
  return (
    <Suspense fallback={
      <div className="card-panel p-16 rounded-xl flex items-center justify-center min-h-[300px]">
        <LoadingSpinner size="md" />
      </div>
    }>
      <NewQuotationForm />
    </Suspense>
  );
}
