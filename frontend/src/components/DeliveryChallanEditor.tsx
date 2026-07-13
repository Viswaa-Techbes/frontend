'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';

interface ClientType {
  _id: string;
  clientName: string;
  businessName?: string;
  email?: string;
  phone?: string;
  billingAddress?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
}

interface LineItemType {
  itemName: string;
  hsnSac?: string;
  gstRate: number;
  quantity: number;
  rate: number;
  description?: string;
  image?: string;
  unit?: string;
}

interface DeliveryChallanEditorProps {
  initialId?: string;
}

export default function DeliveryChallanEditor({ initialId }: DeliveryChallanEditorProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [activeStep, setActiveStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<any>(null);

  // Form states
  const [documentNumber, setDocumentNumber] = useState('Auto-generated');
  const [title, setTitle] = useState('Delivery Challan');
  const [subtitle, setSubtitle] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().substring(0, 10));

  // Client dropdown selectors
  const [clients, setClients] = useState<ClientType[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientType | null>(null);

  // Add inline client creation states
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    clientName: '',
    businessName: '',
    email: '',
    phone: '',
    addressLine1: '',
    city: '',
    state: '',
    pincode: '',
  });

  // Shipping locations details
  const [showShipping, setShowShipping] = useState(false);
  const [shippingDetails, setShippingDetails] = useState({
    shippingName: '',
    addressLine1: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
  });

  // Items table
  const [items, setItems] = useState<LineItemType[]>([
    { itemName: '', gstRate: 18, quantity: 1, rate: 0, description: '', unit: 'PCS' }
  ]);

  // Discounts and Additional charges
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENTAGE' | 'FLAT'>('NONE');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [additionalCharges, setAdditionalCharges] = useState<{ label: string; value: number }[]>([]);

  // Advanced toggles settings
  const [settings, setSettings] = useState({
    hsnColumnView: 'HSN/SAC',
    unitDisplayMode: 'Separate column',
    showPlaceOfSupply: true,
    showSku: false,
    showSummarizedQuantity: false,
    showTotalInWords: true,
  });

  // Optional sections
  const [showNotes, setShowNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [termsText, setTermsText] = useState('');

  const [showContact, setShowContact] = useState(false);
  const [contactDetails, setContactDetails] = useState({
    email: '',
    phoneCountryCode: '+91',
    phoneNumber: '',
  });

  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [customFields, setCustomFields] = useState<{ label: string; value: string }[]>([]);

  const [showSignature, setShowSignature] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState('');
  const [signatureLabel, setSignatureLabel] = useState('Authorised Signatory');
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [attachments, setAttachments] = useState<{ name: string; url: string; mimeType: string; size: number }[]>([]);

  // Load configs & snapshots
  const loadInitData = async () => {
    setLoading(true);
    try {
      if (!initialId) {
        const numRes = await api.get('/documents/next-number?type=DELIVERY_CHALLAN');
        if (numRes.data?.success) {
          setDocumentNumber(numRes.data.data);
        }
      }

      const bizRes = await api.get('/business');
      if (bizRes.data?.success) {
        const biz = bizRes.data.data.business;
        setBusinessProfile(biz);
        setContactDetails({
          email: biz.email || '',
          phoneCountryCode: '+91',
          phoneNumber: biz.phone || '',
        });
      }

      const clientsRes = await api.get('/clients?limit=100');
      if (clientsRes.data?.success) {
        setClients(clientsRes.data.data.clients || []);
      }

      // Populate for editing
      if (initialId) {
        const docRes = await api.get(`/documents/${initialId}`);
        if (docRes.data?.success && docRes.data.data) {
          const doc = docRes.data.data;
          setDocumentNumber(doc.documentNumber);
          setTitle(doc.title || 'Delivery Challan');
          setSubtitle(doc.subtitle || '');
          setIssueDate(doc.issueDate ? doc.issueDate.substring(0, 10) : '');
          setSelectedClient(doc.clientSnapshot);

          if (doc.shippingDetails?.addressLine1) {
            setShowShipping(true);
            setShippingDetails({
              shippingName: doc.shippingDetails.shippingName || '',
              addressLine1: doc.shippingDetails.addressLine1 || '',
              city: doc.shippingDetails.city || '',
              state: doc.shippingDetails.state || '',
              pincode: doc.shippingDetails.pincode || '',
              country: doc.shippingDetails.country || 'India',
            });
          }

          setItems(doc.items || []);
          setDiscountType(doc.documentDiscountType || 'NONE');
          setDiscountValue(doc.documentDiscountValue || 0);
          setAdditionalCharges(
            (doc.additionalCharges || []).map((ch: any) => ({
              label: ch.chargeName,
              value: ch.chargeValue,
            }))
          );

          if (doc.notes) {
            setShowNotes(true);
            setNotesText(doc.notes);
          }
          if (doc.terms) {
            setShowTerms(true);
            setTermsText(doc.terms);
          }
          if (doc.contactDetails?.email) {
            setShowContact(true);
            setContactDetails(doc.contactDetails);
          }
          if (doc.additionalInfo?.customFields?.length > 0) {
            setShowAdditionalInfo(true);
            setCustomFields(doc.additionalInfo.customFields);
          }
          if (doc.signature?.signatureUrl) {
            setShowSignature(true);
            setSignatureUrl(doc.signature.signatureUrl);
            setSignatureLabel(doc.signature.label || 'Authorised Signatory');
          }
          if (doc.attachments?.length > 0) {
            setAttachments(doc.attachments);
          }
          if (doc.settings) {
            setSettings({ ...(settings), ...(doc.settings.advanced || {}) });
          }
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to populate configuration.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitData();
  }, [initialId]);

  // Search clients callback
  useEffect(() => {
    if (clientSearch.trim().length > 0) {
      const filtered = clients.filter((c) =>
        c.clientName.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.businessName?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.email?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.phone?.includes(clientSearch)
      );
      setClients(filtered);
    } else {
      api.get('/clients?limit=100').then((res) => {
        if (res.data?.success) {
          setClients(res.data.data.clients || []);
        }
      });
    }
  }, [clientSearch]);

  const handleAddNewClient = async () => {
    if (!newClient.clientName) {
      showToast('Client name is required.', 'warning');
      return;
    }
    try {
      const res = await api.post('/clients', {
        clientName: newClient.clientName,
        businessName: newClient.businessName || undefined,
        email: newClient.email || undefined,
        phone: newClient.phone || undefined,
        billingAddress: {
          addressLine1: newClient.addressLine1 || undefined,
          city: newClient.city || undefined,
          state: newClient.state || undefined,
          pincode: newClient.pincode || undefined,
        },
      });

      if (res.data?.success) {
        const added = res.data.data;
        setSelectedClient(added);
        setIsClientModalOpen(false);
        setNewClient({
          clientName: '',
          businessName: '',
          email: '',
          phone: '',
          addressLine1: '',
          city: '',
          state: '',
          pincode: '',
        });
        showToast('New client created and selected.', 'success');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create client.', 'error');
    }
  };

  const handleSameAsBilling = () => {
    if (selectedClient?.billingAddress) {
      setShippingDetails({
        shippingName: selectedClient.clientName,
        addressLine1: selectedClient.billingAddress.addressLine1 || '',
        city: selectedClient.billingAddress.city || '',
        state: selectedClient.billingAddress.state || '',
        pincode: selectedClient.billingAddress.pincode || '',
        country: 'India',
      });
    } else {
      showToast('No billing address available on client profile.', 'warning');
    }
  };

  // Line items handlers
  const handleAddItemLine = () => {
    setItems([...items, { itemName: '', gstRate: 18, quantity: 1, rate: 0, description: '', unit: 'PCS' }]);
  };

  const handleItemLineChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setItems(updated);
  };

  const handleDuplicateItemLine = (index: number) => {
    const target = { ...items[index] };
    setItems([...items.slice(0, index + 1), target, ...items.slice(index + 1)]);
  };

  const handleDeleteItemLine = (index: number) => {
    if (items.length === 1) {
      showToast('At least one item line is required.', 'warning');
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Image Upload helper
  const handleLineImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const reader = new FileReader();
    reader.onload = () => {
      handleItemLineChange(index, 'image', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Live total calculations splits
  const getSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  };

  const getDiscountedSubtotal = () => {
    const sub = getSubtotal();
    if (discountType === 'PERCENTAGE') {
      return sub - (sub * (discountValue / 100));
    } else if (discountType === 'FLAT') {
      return Math.max(0, sub - discountValue);
    }
    return sub;
  };

  const getGstTax = () => {
    const discountedSub = getDiscountedSubtotal();
    return items.reduce((sum, item) => {
      const lineSub = item.quantity * item.rate;
      const proportion = lineSub / (getSubtotal() || 1);
      const allocatedLineSub = discountedSub * proportion;
      return sum + (allocatedLineSub * (item.gstRate / 100));
    }, 0);
  };

  const getAdditionalChargesTotal = () => {
    return additionalCharges.reduce((sum, ch) => sum + ch.value, 0);
  };

  const getGrandTotal = () => {
    return getDiscountedSubtotal() + getGstTax() + getAdditionalChargesTotal();
  };

  // Signature canvas handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureUrl('');
  };

  const useCanvasSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureUrl(dataUrl);
    showToast('Canvas signature registered.', 'success');
  };

  // Attachments file uploader
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (attachments.length >= 3) {
      showToast('Maximum 3 attachments are allowed per document.', 'error');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      showToast('Attachment file size must be less than 3MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachments([
        ...attachments,
        {
          name: file.name,
          url: reader.result as string,
          mimeType: file.type,
          size: file.size,
        },
      ]);
      showToast('Attachment uploaded.', 'success');
    };
    reader.readAsDataURL(file);
  };

  // Form submit handler
  const handleSaveChallan = async (targetStatus: 'DRAFT' | 'ISSUED', andCreateNew = false) => {
    if (!selectedClient) {
      showToast('Please select a client.', 'warning');
      return;
    }

    const invalidItems = items.filter((item) => !item.itemName || item.quantity <= 0 || item.rate < 0);
    if (invalidItems.length > 0) {
      showToast('Verify item names, rates, and quantities are correct.', 'warning');
      return;
    }

    setLoading(true);

    const payload = {
      documentType: 'DELIVERY_CHALLAN',
      documentNumber,
      title,
      subtitle,
      issueDate,
      clientId: selectedClient._id,
      shippingDetails: showShipping ? {
        shippingName: shippingDetails.shippingName,
        addressLine1: shippingDetails.addressLine1,
        city: shippingDetails.city,
        state: shippingDetails.state,
        pincode: shippingDetails.pincode,
        country: shippingDetails.country,
      } : undefined,
      items: items.map((item) => ({
        itemName: item.itemName,
        hsnSac: item.hsnSac || undefined,
        gstRate: item.gstRate,
        quantity: item.quantity,
        rate: item.rate,
        description: item.description || undefined,
        image: item.image || undefined,
        unit: item.unit || 'PCS',
      })),
      documentDiscountType: discountType,
      documentDiscountValue: discountValue,
      additionalCharges: additionalCharges.map((ch) => ({
        chargeName: ch.label,
        chargeValue: ch.value,
      })),
      notes: showNotes ? notesText : undefined,
      terms: showTerms ? termsText : undefined,
      contactDetails: showContact ? contactDetails : undefined,
      additionalInfo: showAdditionalInfo ? { customFields } : undefined,
      signature: showSignature ? { signatureUrl, label: signatureLabel } : undefined,
      attachments: attachments.map((a) => ({
        name: a.name,
        url: a.url,
        mimeType: a.mimeType,
        size: a.size,
      })),
      status: targetStatus,
      settings: {
        advanced: {
          hsnColumnView: settings.hsnColumnView,
          unitDisplayMode: settings.unitDisplayMode,
          showPlaceOfSupply: settings.showPlaceOfSupply,
          showSku: settings.showSku,
          showSummarizedQuantity: settings.showSummarizedQuantity,
          showTotalInWords: settings.showTotalInWords,
        },
      },
      gstConfiguration: {
        gstEnabled: true,
        placeOfSupply: {
          state: selectedClient.billingAddress?.state || 'Default State',
          stateCode: '00',
        },
      },
    };

    try {
      let res;
      if (initialId) {
        res = await api.put(`/documents/${initialId}`, payload);
      } else {
        res = await api.post('/documents', payload);
      }

      if (res.data?.success) {
        showToast(
          targetStatus === 'DRAFT'
            ? 'Delivery Challan draft saved successfully!'
            : 'Delivery Challan finalized and saved!',
          'success'
        );

        if (andCreateNew) {
          setSelectedClient(null);
          setItems([{ itemName: '', gstRate: 18, quantity: 1, rate: 0, description: '', unit: 'PCS' }]);
          setDiscountType('NONE');
          setDiscountValue(0);
          setAdditionalCharges([]);
          setNotesText('');
          setTermsText('');
          setSignatureUrl('');
          setAttachments([]);
          setCustomFields([]);
          loadInitData();
        } else {
          router.push(`/delivery-challans/${res.data.data._id}`);
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save delivery challan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !businessProfile) {
    return (
      <div className="card-panel p-16 rounded-xl flex items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-808 pb-16">
      <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Dashboard / <Link href="/delivery-challans" className="hover:underline">Delivery Challans</Link> / New
          </span>
          <h1 className="text-xl font-bold text-slate-909 mt-1">
            {initialId ? `Edit Delivery Challan ${documentNumber}` : 'Create New Delivery Challan'}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        <div className="xl:col-span-3 space-y-6">
          <div className="card-panel p-8 sm:p-12 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-8">
            {/* Header Titles */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-100 pb-6">
              <div className="space-y-2 w-full sm:w-1/2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-lg font-black text-slate-900 border-b border-dashed border-slate-300 focus:border-blue-500 outline-none w-full bg-white"
                  placeholder="Delivery Challan"
                />
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="text-xs text-slate-500 border-b border-dashed border-slate-205 focus:border-blue-500 outline-none w-full bg-white"
                  placeholder="Add Optional Subtitle..."
                />
              </div>

              {businessProfile?.logo ? (
                <img src={businessProfile.logo} alt="Company Logo" className="w-32 max-h-20 object-contain ml-auto" />
              ) : (
                <div className="w-32 h-16 border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 text-[10px]">
                  No logo configured
                </div>
              )}
            </div>

            {/* Document details metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Challan No *</label>
                <input
                  type="text"
                  value={documentNumber}
                  disabled
                  className="w-full form-input bg-slate-50 text-slate-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Challan Date *</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full form-input text-slate-905 bg-white"
                />
              </div>
            </div>

            {/* Delivered From vs Delivered To address blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 pt-6">
              {/* Billed From */}
              <div className="space-y-2 text-xs">
                <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wider">DELIVERED BY (YOUR DETAILS)</span>
                <p className="font-bold text-slate-900 text-sm">{businessProfile?.businessName}</p>
                <p className="text-slate-600">{businessProfile?.address?.addressLine1}</p>
                <p className="text-slate-600">{businessProfile?.address?.city}, {businessProfile?.address?.state} - {businessProfile?.address?.pincode}</p>
                {businessProfile?.gstin && <p className="font-mono text-slate-500">GSTIN: {businessProfile.gstin}</p>}
              </div>

              {/* Client select */}
              <div className="space-y-2 text-xs relative">
                <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wider">DELIVERED TO (CLIENT'S DETAILS)</span>
                {selectedClient ? (
                  <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl relative">
                    <p className="font-bold text-slate-900">{selectedClient.clientName}</p>
                    {selectedClient.businessName && <p className="text-slate-500">{selectedClient.businessName}</p>}
                    <p className="text-slate-550 mt-1">{selectedClient.billingAddress?.addressLine1}</p>
                    <p className="text-slate-550">{selectedClient.billingAddress?.city}, {selectedClient.billingAddress?.state}</p>
                    <button
                      onClick={() => setSelectedClient(null)}
                      className="absolute top-4 right-4 text-xs text-rose-600 font-bold hover:underline"
                    >
                      Change Client
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={clientSearch}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setShowClientDropdown(true);
                        }}
                        onFocus={() => setShowClientDropdown(true)}
                        placeholder="Search client catalog by name, email..."
                        className="w-full form-input bg-white text-slate-905"
                      />
                      <button
                        onClick={() => setIsClientModalOpen(true)}
                        className="px-3 py-2 bg-slate-805 hover:bg-slate-900 text-white font-bold rounded-xl whitespace-nowrap"
                      >
                        + Add Client
                      </button>
                    </div>
                    {showClientDropdown && clients.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {clients.map((c) => (
                          <button
                            key={c._id}
                            type="button"
                            onClick={() => {
                              setSelectedClient(c);
                              setShowClientDropdown(false);
                              setClientSearch('');
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-slate-50 text-slate-800 border-b border-slate-100 last:border-0"
                          >
                            <p className="font-bold">{c.clientName}</p>
                            {c.businessName && <p className="text-slate-500 text-[10px]">{c.businessName}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Warehouse selection unconfigured check */}
            <div className="border-t border-slate-100 pt-6 text-xs text-slate-600 space-y-1">
              <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wider mb-2">Dispatch Warehouse Location</span>
              <p className="italic text-slate-400">No warehouse/stock location configured.</p>
            </div>

            {/* Shipping details toggle */}
            <div className="border-t border-slate-100 pt-6">
              <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-xs text-slate-800">
                <input
                  type="checkbox"
                  checked={showShipping}
                  onChange={(e) => setShowShipping(e.target.checked)}
                  className="rounded text-blue-600 border-slate-350 w-4.5 h-4.5"
                />
                <span>Add Shipping / Delivery Address Details</span>
              </label>

              {showShipping && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-200 text-xs">
                  <div className="md:col-span-3 flex justify-between items-center">
                    <span className="font-bold text-slate-900">Delivery Address</span>
                    <button
                      type="button"
                      onClick={handleSameAsBilling}
                      className="text-xs text-blue-600 font-bold hover:underline"
                    >
                      Copy client billing address
                    </button>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Recipient Name</label>
                    <input
                      type="text"
                      value={shippingDetails.shippingName}
                      onChange={(e) => setShippingDetails({ ...shippingDetails, shippingName: e.target.value })}
                      className="w-full form-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={shippingDetails.addressLine1}
                      onChange={(e) => setShippingDetails({ ...shippingDetails, addressLine1: e.target.value })}
                      className="w-full form-input text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">City</label>
                      <input
                        type="text"
                        value={shippingDetails.city}
                        onChange={(e) => setShippingDetails({ ...shippingDetails, city: e.target.value })}
                        className="w-full form-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">State</label>
                      <input
                        type="text"
                        value={shippingDetails.state}
                        onChange={(e) => setShippingDetails({ ...shippingDetails, state: e.target.value })}
                        className="w-full form-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Pincode</label>
                      <input
                        type="text"
                        value={shippingDetails.pincode}
                        onChange={(e) => setShippingDetails({ ...shippingDetails, pincode: e.target.value })}
                        className="w-full form-input text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Line items table */}
            <div className="border-t border-slate-100 pt-6">
              <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wider mb-3">Line Items Details</span>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                      <th className="px-4 py-2">Item Description</th>
                      {settings.hsnColumnView !== 'Hide' && <th className="px-3 py-2 w-28">HSN/SAC</th>}
                      <th className="px-3 py-2 w-20">GST %</th>
                      <th className="px-3 py-2 w-20 text-right">Qty</th>
                      <th className="px-3 py-2 w-28 text-right">Rate (₹)</th>
                      <th className="px-3 py-2 w-32 text-right">Amount (₹)</th>
                      <th className="px-4 py-2 w-20 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/20">
                        <td className="px-4 py-3 space-y-1.5">
                          <input
                            type="text"
                            value={item.itemName}
                            onChange={(e) => handleItemLineChange(idx, 'itemName', e.target.value)}
                            placeholder="Item Name / SKU"
                            className="w-full form-input text-xs font-semibold text-slate-900"
                          />
                          <textarea
                            value={item.description || ''}
                            onChange={(e) => handleItemLineChange(idx, 'description', e.target.value)}
                            placeholder="Add item description..."
                            rows={1}
                            className="w-full form-input text-[10px] text-slate-500 bg-slate-50 border-slate-200 focus:bg-white"
                          />
                          <div className="flex gap-2 items-center text-[10px]">
                            {item.image ? (
                              <div className="relative w-8 h-8 rounded border border-slate-200 overflow-hidden bg-slate-50">
                                <img src={item.image} alt="Item thumbnail" className="w-full h-full object-contain" />
                                <button
                                  type="button"
                                  onClick={() => handleItemLineChange(idx, 'image', undefined)}
                                  className="absolute inset-0 bg-black/50 hover:bg-black/70 flex items-center justify-center text-white text-[8px] font-bold"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <label className="text-blue-600 hover:underline font-bold cursor-pointer">
                                + Add Image
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleLineImageUpload(idx, e)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        </td>

                        {settings.hsnColumnView !== 'Hide' && (
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={item.hsnSac || ''}
                              onChange={(e) => handleItemLineChange(idx, 'hsnSac', e.target.value)}
                              placeholder="HSN/SAC"
                              className="w-full form-input text-xs font-mono"
                            />
                          </td>
                        )}

                        <td className="px-3 py-3">
                          <select
                            value={item.gstRate}
                            onChange={(e) => handleItemLineChange(idx, 'gstRate', parseInt(e.target.value) || 0)}
                            className="w-full form-input text-xs"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </td>

                        <td className="px-3 py-3">
                          <input
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) => handleItemLineChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full form-input text-xs text-right"
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            type="number"
                            value={item.rate || ''}
                            onChange={(e) => handleItemLineChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full form-input text-xs text-right"
                          />
                        </td>

                        <td className="px-3 py-3 text-right font-semibold text-slate-900">
                          ₹{(item.quantity * item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => handleDuplicateItemLine(idx)}
                              className="text-blue-600 hover:underline font-bold"
                            >
                              Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItemLine(idx)}
                              className="text-rose-600 hover:underline font-bold"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={handleAddItemLine}
                className="mt-4 px-4 py-2 border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-xl text-xs"
              >
                + Add New Line
              </button>
            </div>

            {/* Calculations summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 pt-6">
              {/* Left sidebar triggers */}
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNotes(!showNotes)}
                    className={`px-3 py-1.5 rounded-lg border font-bold text-xs ${
                      showNotes ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-350 text-slate-700'
                    }`}
                  >
                    {showNotes ? '✓ Remarks Added' : '+ Add Remarks'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTerms(!showTerms)}
                    className={`px-3 py-1.5 rounded-lg border font-bold text-xs ${
                      showTerms ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-350 text-slate-700'
                    }`}
                  >
                    {showTerms ? '✓ Terms & Conditions Added' : '+ Add Terms'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSignature(!showSignature)}
                    className={`px-3 py-1.5 rounded-lg border font-bold text-xs ${
                      showSignature ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-355 text-slate-700'
                    }`}
                  >
                    {showSignature ? '✓ Signature Added' : '+ Add Signature'}
                  </button>
                </div>

                {showNotes && (
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="Enter additional remarks, notes..."
                    rows={3}
                    className="w-full form-input text-xs bg-white text-slate-900"
                  />
                )}

                {showTerms && (
                  <textarea
                    value={termsText}
                    onChange={(e) => setTermsText(e.target.value)}
                    placeholder="Enter Terms and Conditions..."
                    rows={3}
                    className="w-full form-input text-xs bg-white text-slate-900"
                  />
                )}

                {showSignature && (
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                    <span className="font-bold text-[9px] text-slate-400 uppercase tracking-wider block">Draw Signature</span>
                    <div className="border border-slate-300 rounded-xl bg-white overflow-hidden relative w-72">
                      <canvas
                        ref={signatureCanvasRef}
                        width={288}
                        height={100}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        className="cursor-crosshair w-full"
                      />
                      <div className="absolute bottom-2 right-2 flex gap-1 text-[9px]">
                        <button type="button" onClick={clearCanvas} className="bg-white hover:bg-slate-100 border border-slate-350 font-bold px-2 py-0.5 rounded shadow">Clear</button>
                        <button type="button" onClick={useCanvasSignature} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-0.5 rounded shadow">Use</button>
                      </div>
                    </div>
                    {signatureUrl && (
                      <div className="flex items-center gap-3">
                        <img src={signatureUrl} alt="Signature preview" className="h-10 object-contain bg-white border border-slate-200 p-1 rounded" />
                        <input
                          type="text"
                          value={signatureLabel}
                          onChange={(e) => setSignatureLabel(e.target.value)}
                          placeholder="Authorised Signatory"
                          className="form-input text-[10px] w-40"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right calculations details */}
              <div className="space-y-3.5 text-right text-slate-600 max-w-sm ml-auto w-full">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-905">₹{getSubtotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between items-center gap-3">
                  <span className="text-[10px] text-slate-400">Discount:</span>
                  <div className="flex gap-2">
                    <select
                      value={discountType}
                      onChange={(e: any) => setDiscountType(e.target.value)}
                      className="form-input text-[10px] py-1"
                    >
                      <option value="NONE">None</option>
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FLAT">Flat Amount (₹)</option>
                    </select>
                    {discountType !== 'NONE' && (
                      <input
                        type="number"
                        value={discountValue || ''}
                        onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                        className="w-20 form-input text-[10px] text-right py-1"
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-between">
                  <span>Tax GST (preview):</span>
                  <span>₹{getGstTax().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between border-t border-slate-205 pt-2 text-sm font-black text-slate-900">
                  <span>Grand Total (₹):</span>
                  <span>₹{getGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Master save actions footer bar */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => handleSaveChallan('DRAFT')}
              disabled={loading}
              className="px-5 py-2.5 border border-slate-355 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-705 transition-colors disabled:opacity-50 text-xs"
            >
              Save as Draft
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => handleSaveChallan('ISSUED', true)}
                disabled={loading}
                className="px-5 py-2.5 border border-slate-355 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-705 transition-colors disabled:opacity-50 text-xs"
              >
                Save & Create New
              </button>
              <button
                onClick={() => handleSaveChallan('ISSUED')}
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-sm disabled:opacity-50 text-xs"
              >
                {loading ? <LoadingSpinner size="xs" /> : 'Finalize & Continue'}
              </button>
            </div>
          </div>

        </div>

        {/* Right sidebar options */}
        <div className="xl:col-span-1 space-y-4">
          <div className="card-panel p-5 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-4 text-xs">
            <h3 className="font-bold text-slate-900 pb-2 border-b border-slate-100 uppercase tracking-wider text-[10px]">
              Challan Settings
            </h3>
            
            <div className="space-y-4 text-slate-600">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">HSN Column View</label>
                <select
                  value={settings.hsnColumnView}
                  onChange={(e) => setSettings({ ...settings, hsnColumnView: e.target.value })}
                  className="w-full form-input text-xs"
                >
                  <option value="Default">Default</option>
                  <option value="HSN Only">HSN Only</option>
                  <option value="SAC Only">SAC Only</option>
                  <option value="HSN/SAC">HSN/SAC</option>
                  <option value="Hide">Hide</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.showPlaceOfSupply}
                  onChange={(e) => setSettings({ ...settings, showPlaceOfSupply: e.target.checked })}
                  className="rounded text-blue-600 border-slate-350 w-4 h-4"
                />
                <span>Show Place of Supply</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.showSku}
                  onChange={(e) => setSettings({ ...settings, showSku: e.target.checked })}
                  className="rounded text-blue-600 border-slate-350 w-4 h-4"
                />
                <span>Show SKU in Challan</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Inline Client creation modal */}
      {isClientModalOpen && (
        <Modal
          isOpen={isClientModalOpen}
          onClose={() => setIsClientModalOpen(false)}
          title="Create New Client"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Client Name *</label>
                <input
                  type="text"
                  value={newClient.clientName}
                  onChange={(e) => setNewClient({ ...newClient, clientName: e.target.value })}
                  className="w-full form-input text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Company Name</label>
                <input
                  type="text"
                  value={newClient.businessName}
                  onChange={(e) => setNewClient({ ...newClient, businessName: e.target.value })}
                  className="w-full form-input text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Email</label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  className="w-full form-input text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  className="w-full form-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Address Line 1</label>
              <input
                type="text"
                value={newClient.addressLine1}
                onChange={(e) => setNewClient({ ...newClient, addressLine1: e.target.value })}
                className="w-full form-input text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">City</label>
                <input
                  type="text"
                  value={newClient.city}
                  onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                  className="w-full form-input text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">State</label>
                <input
                  type="text"
                  value={newClient.state}
                  onChange={(e) => setNewClient({ ...newClient, state: e.target.value })}
                  className="w-full form-input text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Pincode</label>
                <input
                  type="text"
                  value={newClient.pincode}
                  onChange={(e) => setNewClient({ ...newClient, pincode: e.target.value })}
                  className="w-full form-input text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsClientModalOpen(false)}
                className="px-4 py-2 border border-slate-350 text-slate-705 font-bold hover:bg-slate-50 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNewClient}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow"
              >
                Create & Select
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
