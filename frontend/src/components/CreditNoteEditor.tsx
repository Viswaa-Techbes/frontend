'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import ItemAutocomplete from '@/components/ItemAutocomplete';

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

interface InvoiceType {
  _id: string;
  documentNumber: string;
  issueDate: string;
  grandTotal: number;
  balanceDue: number;
  clientSnapshot: ClientType;
  items: any[];
  currency?: string;
  placeOfSupply?: string;
  gstConfiguration?: any;
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
  sourceInvoiceItemId?: string;
}

interface CreditNoteEditorProps {
  initialId?: string;
}

export default function CreditNoteEditor({ initialId }: CreditNoteEditorProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<any>(null);

  // Form states
  const [documentNumber, setDocumentNumber] = useState('Auto-generated');
  const [isNumberEditable, setIsNumberEditable] = useState(false);
  const [title, setTitle] = useState('Credit Note');
  const [subtitle, setSubtitle] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().substring(0, 10));

  // Linked Invoice states
  const [invoicesList, setInvoicesList] = useState<InvoiceType[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false);
  const [linkedInvoice, setLinkedInvoice] = useState<InvoiceType | null>(null);

  // Client states
  const [clients, setClients] = useState<ClientType[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientType | null>(null);

  // Inline Client Modal
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

  // Credit Note properties
  const [reason, setReason] = useState<'PRODUCT_RETURN' | 'DISCOUNT_OFFERED' | 'FAULT_OR_DEFECT' | 'ADVANCE_PAID' | 'OTHER'>('DISCOUNT_OFFERED');
  const [reasonDetails, setReasonDetails] = useState('');

  // Items
  const [items, setItems] = useState<LineItemType[]>([
    { itemName: '', gstRate: 18, quantity: 1, rate: 0, description: '', unit: 'PCS' }
  ]);

  // Pricing adjustments
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENTAGE' | 'FLAT'>('NONE');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [additionalCharges, setAdditionalCharges] = useState<{ label: string; value: number }[]>([]);

  // Advanced toggles
  const [settings, setSettings] = useState({
    hsnColumnView: 'HSN/SAC',
    unitDisplayMode: 'Separate column',
    showPlaceOfSupply: true,
    showSku: false,
    showSummarizedQuantity: false,
    showTotalInWords: true,
  });

  // Optional blocks
  const [showNotes, setShowNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [termsText, setTermsText] = useState('');
  const [showFooter, setShowFooter] = useState(false);
  const [footerText, setFooterText] = useState('');

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

  // Load setup data
  const loadInitData = async () => {
    setLoading(true);
    try {
      if (!initialId) {
        try {
          const numRes = await api.get('/documents/next-number?type=CREDIT_NOTE');
          if (numRes.data?.success) {
            if (numRes.data.data.exists) {
              setDocumentNumber(numRes.data.data.nextNumber);
              setIsNumberEditable(false);
            } else {
              setDocumentNumber('');
              setIsNumberEditable(true);
            }
          }
        } catch (e) {
          console.error("Error fetching next document number:", e);
        }
      }

      const bizRes = await api.get('/business');
      if (bizRes.data?.success) {
        const biz = bizRes.data.data.business;
        setBusinessProfile(biz);
        if (!initialId) {
          if (biz.signatureUrl || biz.signature) {
            setShowSignature(true);
            setSignatureUrl(biz.signatureUrl || biz.signature || '');
            setSignatureLabel(biz.signatoryName || 'Authorised Signatory');
          }
          if (biz.defaultTerms) {
            setTermsText(biz.defaultTerms);
            setShowTerms(true);
          }
          if (biz.defaultNotes) {
            setNotesText(biz.defaultNotes);
            setShowNotes(true);
          }
          if (biz.defaultFooter) {
            setFooterText(biz.defaultFooter);
            setShowFooter(true);
          }
        }
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

      // Populate invoices catalog
      const invoicesRes = await api.get('/documents?documentType=INVOICE&limit=100');
      if (invoicesRes.data?.success) {
        setInvoicesList(invoicesRes.data.data.documents || []);
      }

      // Handle Edit Mode population
      if (initialId) {
        const docRes = await api.get(`/documents/${initialId}`);
        if (docRes.data?.success && docRes.data.data) {
          const doc = docRes.data.data;
          setDocumentNumber(doc.documentNumber);
          setTitle(doc.title || 'Credit Note');
          setSubtitle(doc.subtitle || '');
          setIssueDate(doc.issueDate ? doc.issueDate.substring(0, 10) : '');
          setSelectedClient(doc.clientSnapshot);
          setReason(doc.reason || 'DISCOUNT_OFFERED');
          setReasonDetails(doc.reasonDetails || '');

          if (doc.linkedInvoiceId) {
            const linkedRes = await api.get(`/documents/${doc.linkedInvoiceId}`);
            if (linkedRes.data?.success) {
              setLinkedInvoice(linkedRes.data.data);
            }
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
          if (doc.footer) {
            setShowFooter(true);
            setFooterText(doc.footer);
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
      showToast(err.response?.data?.message || 'Failed to populate editor state.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitData();
  }, [initialId]);

  // Clients search query callback
  useEffect(() => {
    if (clientSearch.trim().length > 0) {
      const filtered = clients.filter((c) =>
        c.clientName.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.businessName?.toLowerCase().includes(clientSearch.toLowerCase())
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

  // Invoices search query callback
  useEffect(() => {
    if (invoiceSearch.trim().length > 0) {
      const filtered = invoicesList.filter((inv) =>
        inv.documentNumber.toLowerCase().includes(invoiceSearch.toLowerCase())
      );
      setInvoicesList(filtered);
    } else {
      api.get('/documents?documentType=INVOICE&limit=100').then((res) => {
        if (res.data?.success) {
          setInvoicesList(res.data.data.documents || []);
        }
      });
    }
  }, [invoiceSearch]);

  // Trigger when Invoice gets linked
  const handleSelectInvoice = (inv: InvoiceType) => {
    setLinkedInvoice(inv);
    setSelectedClient(inv.clientSnapshot);
    setShowInvoiceDropdown(false);
    setInvoiceSearch('');

    // Prepopulate items from invoice
    const mapped = (inv.items || []).map((it) => ({
      itemName: it.itemName,
      hsnSac: it.hsnSac || '',
      gstRate: it.gstRate || 18,
      quantity: it.quantity || 1,
      rate: it.rate || 0,
      description: it.description || '',
      unit: it.unit || 'PCS',
      sourceInvoiceItemId: it._id,
    }));
    setItems(mapped);
    showToast(`Linked invoice ${inv.documentNumber} and loaded its items/client.`, 'info');
  };

  const handleUnlinkInvoice = () => {
    setLinkedInvoice(null);
    setSelectedClient(null);
    setItems([{ itemName: '', gstRate: 18, quantity: 1, rate: 0, description: '', unit: 'PCS' }]);
  };

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
        showToast('Client created and selected.', 'success');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create client.', 'error');
    }
  };

  // Items list modifiers
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
      showToast('At least one line item is required.', 'warning');
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

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

  // Subtotal and tax formulas calculations
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

  // Signature canvas pad handlers
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
    showToast('Canvas signature saved.', 'success');
  };

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
      showToast('Attachment uploaded successfully.', 'success');
    };
    reader.readAsDataURL(file);
  };

  // Master Form save handlers
  const handleSaveCreditNote = async (targetStatus: 'DRAFT' | 'ISSUED', andCreateNew = false) => {
    if (!selectedClient) {
      showToast('Please select a client.', 'warning');
      return;
    }

    if (reason === 'OTHER' && !reasonDetails) {
      showToast('Reason Details is required when selecting Other reason.', 'warning');
      return;
    }

    const creditTotal = getGrandTotal();
    if (linkedInvoice && creditTotal > linkedInvoice.balanceDue) {
      showToast(`Credit note amount (₹${creditTotal}) exceeds remaining linked Invoice balance (₹${linkedInvoice.balanceDue}).`, 'warning');
      return;
    }

    setLoading(true);

    const payload = {
      documentType: 'CREDIT_NOTE',
      documentNumber,
      title,
      subtitle,
      issueDate,
      clientId: selectedClient._id,
      linkedInvoiceId: linkedInvoice?._id || undefined,
      linkedInvoiceSnapshot: linkedInvoice ? {
        documentNumber: linkedInvoice.documentNumber,
        grandTotal: linkedInvoice.grandTotal,
        balanceDue: linkedInvoice.balanceDue,
      } : undefined,
      reason,
      reasonDetails: (reason === 'OTHER' || reason === 'FAULT_OR_DEFECT') ? reasonDetails : undefined,
      items: items.map((item) => ({
        itemName: item.itemName,
        hsnSac: item.hsnSac || undefined,
        gstRate: item.gstRate,
        quantity: item.quantity,
        rate: item.rate,
        description: item.description || undefined,
        image: item.image || undefined,
        unit: item.unit || 'PCS',
        sourceInvoiceItemId: item.sourceInvoiceItemId || undefined,
      })),
      documentDiscountType: discountType,
      documentDiscountValue: discountValue,
      additionalCharges: additionalCharges.map((ch) => ({
        chargeName: ch.label,
        chargeValue: ch.value,
      })),
      notes: showNotes ? notesText : undefined,
      terms: showTerms ? termsText : undefined,
      footer: showFooter ? footerText : undefined,
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
            ? 'Credit Note draft saved successfully!'
            : 'Credit Note finalized and registered!',
          'success'
        );

        if (andCreateNew) {
          setLinkedInvoice(null);
          setSelectedClient(null);
          setItems([{ itemName: '', gstRate: 18, quantity: 1, rate: 0, description: '', unit: 'PCS' }]);
          setDiscountType('NONE');
          setDiscountValue(0);
          setAdditionalCharges([]);
          setNotesText('');
          setTermsText('');
          setSignatureUrl('');
          setAttachments([]);
          setReasonDetails('');
          loadInitData();
        } else {
          router.push(`/credit-notes/${res.data.data._id}`);
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save Credit Note.', 'error');
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
    <div className="space-y-6 text-slate-800 pb-16">
      <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Dashboard / <Link href="/credit-notes" className="hover:underline">Credit Notes</Link> / New
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            {initialId ? `Edit Credit Note ${documentNumber}` : 'Create New Credit Note'}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        <div className="xl:col-span-3 space-y-6">
          <div className="card-panel p-8 sm:p-12 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-8">
            
            {/* Header / Business details */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-100 pb-6">
              <div className="space-y-2 w-full sm:w-1/2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-lg font-black text-slate-900 border-b border-dashed border-slate-300 focus:border-blue-500 outline-none w-full bg-white"
                  placeholder="Credit Note"
                />
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="text-xs text-slate-500 border-b border-dashed border-slate-200 focus:border-blue-500 outline-none w-full bg-white"
                  placeholder="Add Optional Subtitle..."
                />
              </div>

              {businessProfile?.logoUrl || businessProfile?.logo ? (
                <img src={businessProfile.logoUrl || businessProfile.logo} alt="Business Logo" className="w-32 max-h-20 object-contain ml-auto" />
              ) : (
                <div className="w-32 h-16 border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 text-[10px]">
                  No logo configured
                </div>
              )}
            </div>

            {/* Doc numbers and dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Credit Note No *</label>
                <input
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  disabled={!isNumberEditable}
                  placeholder={isNumberEditable ? "Enter Credit Note No (e.g. CN-001)" : "Auto-generated"}
                  className={`w-full form-input ${
                    !isNumberEditable ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Credit Note Date *</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full form-input text-slate-900 bg-white"
                />
              </div>

              {/* Link Invoice selector */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Link Reference Invoice</label>
                {linkedInvoice ? (
                  <div className="flex gap-2 items-center bg-blue-50/50 border border-blue-200 px-3 py-2 rounded-xl text-slate-800 font-medium">
                    <span className="font-mono text-xs">{linkedInvoice.documentNumber}</span>
                    <span className="text-[10px] text-slate-500">(Outstanding: ₹{linkedInvoice.balanceDue})</span>
                    <button
                      type="button"
                      onClick={handleUnlinkInvoice}
                      className="ml-auto text-rose-600 font-bold hover:underline"
                    >
                      Unlink
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      value={invoiceSearch}
                      onChange={(e) => {
                        setInvoiceSearch(e.target.value);
                        setShowInvoiceDropdown(true);
                      }}
                      onFocus={() => setShowInvoiceDropdown(true)}
                      placeholder="Search Invoice number..."
                      className="w-full form-input bg-white text-slate-900"
                    />
                    {showInvoiceDropdown && invoicesList.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {invoicesList.map((inv) => (
                          <button
                            key={inv._id}
                            type="button"
                            onClick={() => handleSelectInvoice(inv)}
                            className="w-full px-4 py-2 text-left hover:bg-slate-50 text-slate-850 border-b border-slate-100 last:border-0"
                          >
                            <p className="font-bold font-mono">{inv.documentNumber}</p>
                            <p className="text-slate-500 text-[10px]">Client: {inv.clientSnapshot?.clientName}</p>
                            <p className="text-slate-500 text-[10px]">Due Balance: ₹{inv.balanceDue}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Reason selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-6 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Select Reason *</label>
                <select
                  value={reason}
                  onChange={(e: any) => setReason(e.target.value)}
                  className="w-full form-input bg-white text-slate-900"
                >
                  <option value="PRODUCT_RETURN">Product Return</option>
                  <option value="DISCOUNT_OFFERED">Discount Offered</option>
                  <option value="FAULT_OR_DEFECT">Fault/Defect in service / product</option>
                  <option value="ADVANCE_PAID">Advance Paid</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {(reason === 'OTHER' || reason === 'FAULT_OR_DEFECT') && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {reason === 'OTHER' ? 'Reason Details *' : 'Fault / Defect Details'}
                  </label>
                  <input
                    type="text"
                    value={reasonDetails}
                    onChange={(e) => setReasonDetails(e.target.value)}
                    placeholder="Provide additional details..."
                    className="w-full form-input bg-white text-slate-900"
                  />
                </div>
              )}
            </div>

            {/* Warehouse return logic */}
            {reason === 'PRODUCT_RETURN' && (
              <div className="border-t border-slate-100 pt-6 text-xs text-slate-600 space-y-1">
                <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wider mb-2">Inventory Stock Return Location</span>
                <p className="italic text-slate-400">No warehouse/stock location configured.</p>
              </div>
            )}

            {/* Issued By and Issued To details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 pt-6 text-xs">
              {/* Issued By */}
              <div className="space-y-2">
                <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wider">ISSUED BY</span>
                <p className="font-bold text-slate-900 text-sm">{businessProfile?.businessName}</p>
                <p className="text-slate-600">{businessProfile?.address?.addressLine1}</p>
                <p className="text-slate-600">{businessProfile?.address?.city}, {businessProfile?.address?.state} - {businessProfile?.address?.pincode}</p>
                {businessProfile?.gstin && <p className="font-mono text-slate-500">GSTIN: {businessProfile.gstin}</p>}
              </div>

              {/* Issued To */}
              <div className="space-y-2 relative">
                <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wider">ISSUED TO</span>
                {selectedClient ? (
                  <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl relative">
                    <p className="font-bold text-slate-900">{selectedClient.clientName}</p>
                    {selectedClient.businessName && <p className="text-slate-550">{selectedClient.businessName}</p>}
                    <p className="text-slate-550 mt-1">{selectedClient.billingAddress?.addressLine1}</p>
                    <p className="text-slate-550">{selectedClient.billingAddress?.city}, {selectedClient.billingAddress?.state}</p>
                    
                    {!linkedInvoice && (
                      <button
                        onClick={() => setSelectedClient(null)}
                        className="absolute top-4 right-4 text-xs text-rose-600 font-bold hover:underline"
                      >
                        Change Client
                      </button>
                    )}
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
                        placeholder="Search client catalog..."
                        className="w-full form-input bg-white text-slate-900"
                      />
                      <button
                        onClick={() => setIsClientModalOpen(true)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl whitespace-nowrap"
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
                            className="w-full px-4 py-2 text-left hover:bg-slate-50 text-slate-850 border-b border-slate-100 last:border-0"
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

            {/* Line items editor */}
            <div className="border-t border-slate-100 pt-6">
              <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wider mb-3">Line items list</span>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-505 font-semibold bg-slate-50">
                      <th className="px-4 py-2">Item Description</th>
                      {settings.hsnColumnView !== 'Hide' && <th className="px-3 py-2 w-28">HSN/SAC</th>}
                      <th className="px-3 py-2 w-20">GST %</th>
                      <th className="px-3 py-2 w-20 text-right">Qty</th>
                      <th className="px-3 py-2 w-28 text-right">Rate (₹)</th>
                      <th className="px-3 py-2 w-32 text-right">Amount (₹)</th>
                      <th className="px-4 py-2 w-20 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/20">
                        <td className="px-4 py-3 space-y-1.5">
                          <ItemAutocomplete
                            value={item.itemName}
                            onChange={(val) => handleItemLineChange(idx, 'itemName', val)}
                            onSelect={(selected) => {
                              handleItemLineChange(idx, 'itemName', selected.itemName);
                              handleItemLineChange(idx, 'description', selected.description);
                              handleItemLineChange(idx, 'hsnSac', selected.hsnSac);
                              handleItemLineChange(idx, 'gstRate', selected.gstRate);
                              handleItemLineChange(idx, 'rate', selected.sellingPrice);
                              handleItemLineChange(idx, 'unit', selected.unit);
                            }}
                            placeholder="Search item or type name..."
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
                                <img src={item.image} alt="thumb" className="w-full h-full object-contain" />
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
                              className="w-full form-input text-xs font-mono bg-white"
                            />
                          </td>
                        )}

                        <td className="px-3 py-3">
                          <select
                            value={item.gstRate}
                            onChange={(e) => handleItemLineChange(idx, 'gstRate', parseInt(e.target.value) || 0)}
                            className="w-full form-input text-xs bg-white text-slate-900"
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
                            className="w-full form-input text-xs text-right bg-white text-slate-900"
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            type="number"
                            value={item.rate || ''}
                            onChange={(e) => handleItemLineChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full form-input text-xs text-right bg-white text-slate-900"
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

              {!linkedInvoice && (
                <button
                  type="button"
                  onClick={handleAddItemLine}
                  className="mt-4 px-4 py-2 border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-xl text-xs"
                >
                  + Add New Line
                </button>
              )}
            </div>

            {/* Calculations totals block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 pt-6">
              {/* Optional selections */}
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
                      showTerms ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-355 text-slate-700'
                    }`}
                  >
                    {showTerms ? '✓ Terms & Conditions Added' : '+ Add Terms'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFooter(!showFooter)}
                    className={`px-3 py-1.5 rounded-lg border font-bold text-xs ${
                      showFooter ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-355 text-slate-700'
                    }`}
                  >
                    {showFooter ? '✓ Footer Text Added' : '+ Add Footer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSignature(!showSignature)}
                    className={`px-3 py-1.5 rounded-lg border font-bold text-xs ${
                      showSignature ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-350 text-slate-700'
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

                {showFooter && (
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="e.g. This is a computer generated document."
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

              {/* Right calculated totals columns */}
              <div className="space-y-3.5 text-right text-slate-600 max-w-sm ml-auto w-full">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-900">₹{getSubtotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between items-center gap-3">
                  <span className="text-[10px] text-slate-400">Discount:</span>
                  <div className="flex gap-2">
                    <select
                      value={discountType}
                      onChange={(e: any) => setDiscountType(e.target.value)}
                      className="form-input text-[10px] py-1 text-slate-900 bg-white"
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
                        className="w-20 form-input text-[10px] text-right py-1 bg-white text-slate-900"
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-between">
                  <span>Tax GST (preview):</span>
                  <span>₹{getGstTax().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-black text-slate-900">
                  <span>Grand Total (₹):</span>
                  <span>₹{getGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Master save actions footer bar */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => handleSaveCreditNote('DRAFT')}
              disabled={loading}
              className="px-5 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-700 transition-colors disabled:opacity-50 text-xs"
            >
              Save as Draft
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => handleSaveCreditNote('ISSUED', true)}
                disabled={loading}
                className="px-5 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-slate-700 transition-colors disabled:opacity-50 text-xs"
              >
                Save & Create New
              </button>
              <button
                onClick={() => handleSaveCreditNote('ISSUED')}
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-sm disabled:opacity-50 text-xs"
              >
                {loading ? <LoadingSpinner size="xs" /> : 'Finalize & Continue'}
              </button>
            </div>
          </div>

        </div>

        {/* Right sidebar options panel */}
        <div className="xl:col-span-1 space-y-4">
          <div className="card-panel p-5 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-4 text-xs">
            <h3 className="font-bold text-slate-900 pb-2 border-b border-slate-100 uppercase tracking-wider text-[10px]">
              Credit Note Settings
            </h3>
            
            <div className="space-y-4 text-slate-650">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">HSN Column View</label>
                <select
                  value={settings.hsnColumnView}
                  onChange={(e) => setSettings({ ...settings, hsnColumnView: e.target.value })}
                  className="w-full form-input text-xs text-slate-900 bg-white"
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
                <span>Show SKU in Credit Note</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Inline client modal form */}
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
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Company Name</label>
                <input
                  type="text"
                  value={newClient.businessName}
                  onChange={(e) => setNewClient({ ...newClient, businessName: e.target.value })}
                  className="w-full form-input text-xs text-slate-900 bg-white"
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
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Address Line 1</label>
              <input
                type="text"
                value={newClient.addressLine1}
                onChange={(e) => setNewClient({ ...newClient, addressLine1: e.target.value })}
                className="w-full form-input text-xs text-slate-900 bg-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">City</label>
                <input
                  type="text"
                  value={newClient.city}
                  onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">State</label>
                <input
                  type="text"
                  value={newClient.state}
                  onChange={(e) => setNewClient({ ...newClient, state: e.target.value })}
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Pincode</label>
                <input
                  type="text"
                  value={newClient.pincode}
                  onChange={(e) => setNewClient({ ...newClient, pincode: e.target.value })}
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsClientModalOpen(false)}
                className="px-4 py-2 border border-slate-350 text-slate-700 font-bold hover:bg-slate-55 rounded-lg text-xs"
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
