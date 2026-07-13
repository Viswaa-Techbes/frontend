'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import PageHeader from '@/components/PageHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import { INDIAN_STATES } from '@/lib/constants';

interface LineItem {
  id: string; // client-side key
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

interface CustomField {
  label: string;
  value: string;
}

interface ProformaInvoiceEditorProps {
  mode: 'create' | 'edit';
  documentId?: string;
}

export default function ProformaInvoiceEditor({ mode, documentId }: ProformaInvoiceEditorProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
  const [businessProfileIncomplete, setBusinessProfileIncomplete] = useState(false);

  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);

  // Document Headers
  const [docTitle, setDocTitle] = useState('Proforma Invoice');
  const [docSubtitle, setDocSubtitle] = useState('');
  const [showSubtitleInput, setShowSubtitleInput] = useState(false);
  const [documentNumber, setDocumentNumber] = useState('Auto-generated');
  const [poNumber, setPoNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    return date.toISOString().split('T')[0];
  });
  const [logoBase64, setLogoBase64] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // Shipping details
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
  const [taxType, setTaxType] = useState('Auto'); // 'Auto' | 'CGST + SGST' | 'IGST'

  // Currency & formatting
  const [currency, setCurrency] = useState('INR');
  const [numberFormat, setNumberFormat] = useState('en-IN'); // 'en-IN' | 'en-US' | 'custom'

  // Dynamic Line items
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

  // Optional Document Details
  const [showSignatureArea, setShowSignatureArea] = useState(false);
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryDesignation, setSignatoryDesignation] = useState('');
  const [signatureBase64, setSignatureBase64] = useState('');

  const [showTermsArea, setShowTermsArea] = useState(false);
  const [terms, setTerms] = useState('');

  const [showNotesArea, setShowNotesArea] = useState(false);
  const [notes, setNotes] = useState('');

  const [showAttachmentsArea, setShowAttachmentsArea] = useState(false);
  const [attachments, setAttachments] = useState<{ fileName: string; fileUrl: string; mimeType: string; fileSize: number }[]>([]);

  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState<CustomField[]>([]);

  const [showContactDetails, setShowContactDetails] = useState(false);
  const [contactDetails, setContactDetails] = useState({ name: '', phone: '', email: '' });

  // Recurring invoice configuration
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState('Monthly');
  const [recurrenceStart, setRecurrenceStart] = useState(new Date().toISOString().split('T')[0]);
  const [recurrenceEnd, setRecurrenceEnd] = useState('');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceIntervalUnit, setRecurrenceIntervalUnit] = useState('Months');

  // Advanced Options Toggles
  const [displayOptions, setDisplayOptions] = useState({
    showHsnSac: true,
    showTaxSummary: true,
    showItemDescriptions: true,
    showTotalQuantity: true,
    hsnColumnView: 'HSN/SAC', // 'Default' | 'HSN Only' | 'SAC Only' | 'HSN/SAC' | 'Hide'
    displayUnitAs: 'Separate column', // 'Merge with quantity' | 'Separate column' | 'Hide'
    taxSummaryDisplay: 'Summary', // 'Do not show' | 'Summary' | 'Detailed'
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

  // Column visibility / ordering state
  const [isColumnDrawerOpen, setIsColumnDrawerOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    item: true,
    hsnSac: true,
    gstRate: true,
    quantity: true,
    rate: true,
    amount: true,
    cgst: true,
    sgst: true,
    igst: true,
    total: true,
  });

  // Load baseline profile & clients
  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Business Profile
      const profileRes = await api.get('/business');
      if (profileRes.data?.success && profileRes.data.data?.business) {
        const profile = profileRes.data.data.business;
        setBusinessProfile(profile);
        setLogoBase64(profile.logo || '');
        
        // Determine readiness status
        const isProfileIncomplete = !profile.businessName || !profile.address?.stateCode || !profile.gstin;
        setBusinessProfileIncomplete(isProfileIncomplete);

        // Auto place of supply default to business state
        if (profile.address?.state && profile.address?.stateCode) {
          setPlaceOfSupply({
            state: profile.address.state,
            stateCode: profile.address.stateCode,
          });
        }
      } else {
        setBusinessProfileIncomplete(true);
      }

      // 2. Clients
      const clientsRes = await api.get('/clients?status=ACTIVE&limit=100');
      if (clientsRes.data?.success) {
        setClients(clientsRes.data.data.clients || []);
      }

      // 3. If in edit mode, load document values
      if (mode === 'edit' && documentId) {
        const docRes = await api.get(`/documents/${documentId}`);
        if (docRes.data?.success && docRes.data.data) {
          const doc = docRes.data.data;
          
          setDocTitle(doc.title || 'Proforma Invoice');
          setDocSubtitle(doc.subtitle || '');
          setShowSubtitleInput(!!doc.subtitle);
          setDocumentNumber(doc.documentNumber);
          setPoNumber(doc.poNumber || '');
          setIssueDate(doc.issueDate ? doc.issueDate.split('T')[0] : '');
          setDueDate(doc.validTill ? doc.validTill.split('T')[0] : '');
          setCustomFields(doc.customFields || []);

          if (doc.clientId) {
            setSelectedClientId(doc.clientId);
            setSelectedClient(doc.clientSnapshot);
          }

          // GST & Shipping
          setGstEnabled(doc.gstConfiguration?.gstEnabled ?? true);
          setPlaceOfSupply(doc.gstConfiguration?.placeOfSupply || { state: '', stateCode: '' });
          setReverseCharge(doc.gstConfiguration?.reverseCharge ?? false);
          setTaxType(doc.gstConfiguration?.taxType || 'Auto');

          setEnableShipping(!!doc.shippingDetails?.addressLine1);
          setShippingAddress(doc.shippingDetails || {
            addressLine1: '',
            addressLine2: '',
            city: '',
            state: '',
            stateCode: '',
            country: 'India',
            pincode: '',
          });

          // Currency
          setCurrency(doc.currency?.currencyCode || 'INR');
          setNumberFormat(doc.currency?.currencyLocale || 'en-IN');

          // Parse line items
          if (doc.items && doc.items.length > 0) {
            const parsedItems = doc.items.map((item: any) => {
              const isGroup = item.itemName && item.itemName.startsWith('[GROUP] ');
              return {
                id: item._id || Math.random().toString(36).substring(2, 9),
                isGroupHeader: isGroup,
                groupTitle: isGroup ? item.itemName.substring(8) : '',
                itemName: isGroup ? '' : item.itemName,
                description: item.description || '',
                hsnSac: item.hsnSac || '',
                gstRate: item.gstRate || 0,
                quantity: item.quantity || 1,
                unit: item.unit || 'PCS',
                rate: item.rate || 0,
                discountType: item.discountType || 'NONE',
                discountValue: item.discountValue || 0,
                image: item.image || '',
                productType: item.productType || 'PRODUCT',
              };
            });
            setItems(parsedItems);
          }

          // Doc discounts & charges
          setEnableDocDiscount(doc.documentDiscountType !== 'NONE');
          setDocDiscountType(doc.documentDiscountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED');
          setDocDiscountValue(doc.documentDiscountValue || 0);
          setAdditionalCharges(doc.additionalCharges || []);
          setSummarizeTotalQuantity(doc.displayOptions?.showTotalQuantity ?? false);

          // Details sections
          setSignatoryName(doc.signature?.signatoryName || '');
          setSignatoryDesignation(doc.signature?.designation || '');
          setSignatureBase64(doc.signature?.signatureUrl || '');
          setShowSignatureArea(!!doc.signature?.signatoryName || !!doc.signature?.signatureUrl);

          setTerms(doc.terms || '');
          setShowTermsArea(!!doc.terms);

          setNotes(doc.notes || '');
          setShowNotesArea(!!doc.notes);

          setAttachments(doc.attachments || []);
          setShowAttachmentsArea(!!doc.attachments?.length);

          setAdditionalInfo(doc.additionalInfo || []);
          setShowAdditionalInfo(!!doc.additionalInfo?.length);

          setContactDetails(doc.contactDetails || { name: '', phone: '', email: '' });
          setShowContactDetails(!!doc.contactDetails?.name);

          // Recurrence
          setIsRecurring(doc.recurrence?.isRecurring || false);
          setRecurrenceFreq(doc.recurrence?.frequency || 'Monthly');
          setRecurrenceStart(doc.recurrence?.startDate ? doc.recurrence.startDate.split('T')[0] : new Date().toISOString().split('T')[0]);
          setRecurrenceEnd(doc.recurrence?.endDate ? doc.recurrence.endDate.split('T')[0] : '');
          setRecurrenceInterval(doc.recurrence?.customInterval || 1);
          setRecurrenceIntervalUnit(doc.recurrence?.customUnit || 'Months');

          // Settings & advanced layout options
          setDisplayOptions({
            showHsnSac: doc.settings?.advanced?.showHSNSummary ?? doc.displayOptions?.showHsnSac ?? true,
            showTaxSummary: doc.displayOptions?.showTaxSummary ?? true,
            showItemDescriptions: doc.displayOptions?.showItemDescriptions ?? true,
            showTotalQuantity: doc.displayOptions?.showTotalQuantity ?? true,
            hsnColumnView: doc.settings?.advanced?.hsnColumnView || 'HSN/SAC',
            displayUnitAs: doc.settings?.advanced?.unitDisplay || 'Separate column',
            taxSummaryDisplay: doc.settings?.advanced?.taxSummaryDisplay || 'Summary',
            hidePlaceOfSupply: doc.settings?.advanced?.hidePlaceOfSupply || false,
            showHsnSummary: doc.settings?.advanced?.showHSNSummary || false,
            addImageInItems: doc.settings?.advanced?.showOriginalItemImages || false,
            showThumbnailsSeparate: doc.settings?.advanced?.showThumbnailColumn || false,
            descriptionFullWidth: doc.settings?.advanced?.showFullWidthDescription || false,
            hideSubtotalForGroup: doc.settings?.advanced?.hideGroupSubtotal || false,
            showSku: doc.settings?.advanced?.showSKU || false,
            showSerialNumbers: doc.settings?.advanced?.showSerialNumbers || false,
            displayBatchDetails: doc.settings?.advanced?.showBatchDetails || false,
          });

          if (doc.columnVisibility) {
            const mappedVis: Record<string, boolean> = {};
            if (doc.columnVisibility instanceof Map) {
              doc.columnVisibility.forEach((val: boolean, key: string) => {
                mappedVis[key] = val;
              });
            } else {
              Object.assign(mappedVis, doc.columnVisibility);
            }
            setColumnVisibility({ ...columnVisibility, ...mappedVis });
          }
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error loading initialization files.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [documentId]);

  // Handle client selection change
  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find((c) => c._id === selectedClientId);
      if (client) {
        setSelectedClient(client);
        // Automatically prefill Place of Supply state
        if (client.billingAddress?.state && client.billingAddress?.stateCode) {
          setPlaceOfSupply({
            state: client.billingAddress.state,
            stateCode: client.billingAddress.stateCode,
          });
        }
      }
    } else {
      setSelectedClient(null);
    }
  }, [selectedClientId, clients]);

  // Calculations logic (copied from backend formulas for live estimates)
  const calculateTotals = () => {
    let subtotal = 0;
    let totalQuantity = 0;

    const processedItems = items.map((item) => {
      if (item.isGroupHeader) {
        return { ...item, baseAmount: 0, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      }

      const baseAmount = item.quantity * item.rate;
      totalQuantity += item.quantity;

      let itemDiscountAmount = 0;
      if (item.discountType === 'PERCENTAGE') {
        itemDiscountAmount = baseAmount * (item.discountValue / 100);
      } else if (item.discountType === 'FIXED') {
        itemDiscountAmount = Math.min(baseAmount, item.discountValue);
      }

      const taxableAmount = baseAmount - itemDiscountAmount;
      subtotal += taxableAmount;

      return {
        ...item,
        baseAmount,
        taxableAmount,
      };
    });

    let documentDiscountAmount = 0;
    if (enableDocDiscount) {
      if (docDiscountType === 'PERCENTAGE') {
        documentDiscountAmount = subtotal * (docDiscountValue / 100);
      } else if (docDiscountType === 'FIXED') {
        documentDiscountAmount = Math.min(subtotal, docDiscountValue);
      }
    }

    const businessStateCode = businessProfile?.address?.stateCode || 'DL';
    const supplyStateCode = placeOfSupply.stateCode || businessStateCode;
    const isIntraState = taxType === 'CGST + SGST' || (taxType === 'Auto' && businessStateCode.toUpperCase() === supplyStateCode.toUpperCase());

    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const finalItems = processedItems.map((item) => {
      if (item.isGroupHeader) return item;

      const proportionalDiscount = subtotal > 0 ? (item.taxableAmount / subtotal) * documentDiscountAmount : 0;
      const finalTaxable = Math.max(0, item.taxableAmount - proportionalDiscount);

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (gstEnabled) {
        if (isIntraState) {
          cgst = finalTaxable * ((item.gstRate / 2) / 100);
          sgst = finalTaxable * ((item.gstRate / 2) / 100);
          cgstTotal += cgst;
          sgstTotal += sgst;
        } else {
          igst = finalTaxable * (item.gstRate / 100);
          igstTotal += igst;
        }
      }

      return {
        ...item,
        cgst,
        sgst,
        igst,
        total: finalTaxable + cgst + sgst + igst,
      };
    });

    let additionalChargesTotal = 0;
    const processedCharges = additionalCharges.map((charge) => {
      let taxAmount = 0;
      if (gstEnabled && charge.isTaxable) {
        taxAmount = charge.amount * (charge.gstRate / 100);
      }
      additionalChargesTotal += (charge.amount + taxAmount);
      return { ...charge, taxAmount, total: charge.amount + taxAmount };
    });

    const grandTotalNoRound = (subtotal - documentDiscountAmount) + cgstTotal + sgstTotal + igstTotal + additionalChargesTotal;
    const grandTotal = enableRoundOff ? Math.round(grandTotalNoRound) : grandTotalNoRound;
    const roundOff = enableRoundOff ? grandTotal - grandTotalNoRound : 0;

    return {
      subtotal,
      documentDiscountAmount,
      cgstTotal,
      sgstTotal,
      igstTotal,
      additionalChargesTotal,
      roundOff,
      grandTotal,
      totalQuantity,
      items: finalItems,
      additionalCharges: processedCharges,
    };
  };

  const calculated = calculateTotals();

  // Helper: line item manipulation
  const handleAddItemRow = () => {
    setItems([
      ...items,
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

  const handleAddGroupRow = () => {
    setItems([
      ...items,
      {
        id: Math.random().toString(36).substring(2, 9),
        isGroupHeader: true,
        groupTitle: 'New Group Section',
        itemName: '',
        description: '',
        hsnSac: '',
        gstRate: 0,
        quantity: 1,
        unit: '',
        rate: 0,
        discountType: 'NONE',
        discountValue: 0,
      },
    ]);
  };

  const handleUpdateItemRow = (index: number, updatedFields: Partial<LineItem>) => {
    const list = [...items];
    list[index] = { ...list[index], ...updatedFields };
    setItems(list);
  };

  const handleDuplicateRow = (index: number) => {
    const list = [...items];
    const source = list[index];
    const clone = {
      ...source,
      id: Math.random().toString(36).substring(2, 9),
    };
    list.splice(index + 1, 0, clone);
    setItems(list);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length === 1) {
      showToast('At least one line item is required.', 'warning');
      return;
    }
    const list = [...items];
    list.splice(index, 1);
    setItems(list);
  };

  // Image helpers
  const handleItemImageUpload = (index: number, file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image size exceeds 2MB limit.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      handleUpdateItemRow(index, { image: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  // Business logo upload helper
  const handleLogoUpload = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      showToast('Logo file size must be less than 2MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Signature image helper
  const handleSignatureUpload = (file: File) => {
    if (file.size > 1 * 1024 * 1024) {
      showToast('Signature file size must be less than 1MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setSignatureBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Inline Client Modal submit
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.clientName) {
      showToast('Client Name is required.', 'error');
      return;
    }
    try {
      const response = await api.post('/clients', newClient);
      if (response.data?.success) {
        const createdClient = response.data.data;
        showToast('Client created successfully!', 'success');
        // Refresh clients list and auto select
        const clientsRes = await api.get('/clients?status=ACTIVE&limit=100');
        if (clientsRes.data?.success) {
          const list = clientsRes.data.data.clients || [];
          setClients(list);
          setSelectedClientId(createdClient._id);
        }
        setIsClientModalOpen(false);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create client.', 'error');
    }
  };

  // Save document core handler
  const handleSaveDocument = async (draftOnly: boolean, redirectSetup: boolean) => {
    if (!selectedClientId) {
      showToast('Please select a client before saving.', 'error');
      return;
    }

    // Validate line items
    for (const item of items) {
      if (!item.isGroupHeader && !item.itemName.trim()) {
        showToast('Line item name is required.', 'error');
        return;
      }
      if (!item.isGroupHeader && (item.quantity <= 0 || item.rate < 0)) {
        showToast('Quantity must be greater than 0 and rate non-negative.', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      // Serialize items (prefix group headers toitemName)
      const serializedItems = items.map((item) => {
        if (item.isGroupHeader) {
          return {
            itemName: `[GROUP] ${item.groupTitle || 'Group Section'}`,
            description: '',
            quantity: 1,
            rate: 0,
            gstRate: 0,
            discountType: 'NONE',
            discountValue: 0,
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
          image: item.image,
          productType: item.productType,
        };
      });

      const payload = {
        documentType: 'PROFORMA_INVOICE',
        status: draftOnly ? 'DRAFT' : 'SENT',
        title: docTitle,
        subtitle: docSubtitle,
        poNumber,
        issueDate: new Date(issueDate).toISOString(),
        validTill: new Date(dueDate).toISOString(),
        clientId: selectedClientId,
        customFields,
        
        shippingDetails: enableShipping ? shippingAddress : null,
        currency: {
          currencyCode: currency,
          currencySymbol: currency === 'INR' ? '₹' : '$',
          currencyLocale: numberFormat,
        },
        gstConfiguration: {
          gstEnabled,
          placeOfSupply,
          reverseCharge,
          taxType,
        },
        items: serializedItems,
        documentDiscountType: enableDocDiscount ? docDiscountType : 'NONE',
        documentDiscountValue: enableDocDiscount ? docDiscountValue : 0,
        additionalCharges,
        
        terms,
        notes,
        attachments,
        additionalInfo,
        contactDetails,
        recurrence: {
          isRecurring,
          frequency: recurrenceFreq,
          startDate: isRecurring ? new Date(recurrenceStart).toISOString() : null,
          endDate: isRecurring && recurrenceEnd ? new Date(recurrenceEnd).toISOString() : null,
          customInterval: recurrenceInterval,
          customUnit: recurrenceIntervalUnit,
        },
        signature: {
          signatureUrl: signatureBase64,
          signatoryName,
          designation: signatoryDesignation,
        },
        settings: {
          design: {
            templateId: 'Professional',
            primaryColor: '#2563eb',
            fontFamily: 'Inter',
            fontScale: 'Medium',
          },
          advanced: {
            hsnColumnView: displayOptions.hsnColumnView,
            unitDisplay: displayOptions.displayUnitAs,
            taxSummaryDisplay: displayOptions.taxSummaryDisplay,
            hidePlaceOfSupply: displayOptions.hidePlaceOfSupply,
            showHSNSummary: displayOptions.showHsnSummary,
            showOriginalItemImages: displayOptions.addImageInItems,
            showThumbnailColumn: displayOptions.showThumbnailsSeparate,
            showFullWidthDescription: displayOptions.descriptionFullWidth,
            hideGroupSubtotal: displayOptions.hideSubtotalForGroup,
            showSKU: displayOptions.showSku,
            showSerialNumbers: displayOptions.showSerialNumbers,
            showBatchDetails: displayOptions.displayBatchDetails,
          }
        },
        columnVisibility,
      };

      let response;
      if (mode === 'create') {
        response = await api.post('/documents', payload);
      } else {
        response = await api.put(`/documents/${documentId}`, payload);
      }

      if (response.data?.success) {
        const docId = response.data.data._id;
        const docNum = response.data.data.documentNumber;
        showToast(`Proforma invoice ${docNum} saved successfully!`, 'success');

        if (redirectSetup) {
          router.push(`/proforma-invoices/${docId}/payment-setup`);
        } else {
          router.push(`/proforma-invoices/${docId}`);
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save proforma invoice.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card-panel p-16 rounded-xl flex items-center justify-center min-h-[400px] bg-white">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800 pb-16">
      {/* Warning Banner if profile incomplete */}
      {businessProfileIncomplete && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="font-medium">
              Complete your business profile to include full business details in generated documents.
            </p>
          </div>
          <Link
            href="/settings"
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors text-center"
          >
            Complete Profile
          </Link>
        </div>
      )}

      {/* Breadcrumb / Step Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">SALES & INVOICES / PROFORMA INVOICES</span>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            {mode === 'create' ? 'Create New Proforma Invoice' : `Edit Proforma Invoice ${documentNumber}`}
          </h1>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-blue-600">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
            <span>Invoice Details</span>
          </div>
          <svg className="w-4 h-4 text-slate-350" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
            <span className="w-5 h-5 rounded-full border border-slate-300 text-slate-450 flex items-center justify-center text-[10px]">2</span>
            <span>Bank & UPI Details</span>
          </div>
          <svg className="w-4 h-4 text-slate-350" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
            <span className="w-5 h-5 rounded-full border border-slate-300 text-slate-450 flex items-center justify-center text-[10px]">3</span>
            <span>Customise & Share</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Main Document Card */}
        <div className="xl:col-span-3 card-panel p-6 sm:p-8 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-8">
          {/* Header Title Editor */}
          <div className="border-b border-slate-100 pb-6 space-y-3">
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="text-2xl font-black text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none bg-transparent py-0.5 max-w-sm transition-all"
                placeholder="Proforma Invoice"
              />
              {!showSubtitleInput && !docSubtitle && (
                <button
                  onClick={() => setShowSubtitleInput(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  + Add Subtitle
                </button>
              )}
            </div>
            {(showSubtitleInput || docSubtitle) && (
              <div className="flex items-center gap-2 max-w-sm">
                <input
                  type="text"
                  value={docSubtitle}
                  onChange={(e) => setDocSubtitle(e.target.value)}
                  className="w-full text-xs text-slate-500 border-b border-slate-200 focus:border-blue-600 focus:outline-none bg-transparent py-1 transition-all"
                  placeholder="Enter invoice subtitle (e.g. Sales proposal for July)"
                />
                <button
                  onClick={() => {
                    setDocSubtitle('');
                    setShowSubtitleInput(false);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Document Properties Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left side: Business Logo & Details */}
            <div className="space-y-6">
              {/* Business Logo Upload Block */}
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-2">BUSINESS LOGO</label>
                {logoBase64 ? (
                  <div className="relative w-36 h-20 border border-slate-200 rounded-xl overflow-hidden group bg-slate-50 flex items-center justify-center p-2">
                    <img src={logoBase64} alt="Company Logo" className="max-h-full max-w-full object-contain" />
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <label className="p-1.5 bg-white/20 text-white hover:bg-white/30 rounded-lg cursor-pointer transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.235" />
                        </svg>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files && handleLogoUpload(e.target.files[0])}
                        />
                      </label>
                      <button
                        onClick={() => setLogoBase64('')}
                        className="p-1.5 bg-white/20 text-white hover:bg-rose-600 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-36 h-20 border-2 border-dashed border-slate-250 hover:border-blue-500 rounded-xl cursor-pointer hover:bg-blue-50/20 transition-all">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[10px] text-slate-400 font-bold mt-1.5">Upload Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files && handleLogoUpload(e.target.files[0])}
                    />
                  </label>
                )}
              </div>

              {/* Billed By Details Card */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-[10px] font-bold text-slate-455 tracking-wider uppercase">Billed By (Your Details)</h3>
                  <Link href="/settings" className="text-[10px] font-bold text-blue-600 hover:text-blue-700">Edit Details</Link>
                </div>
                <div className="text-xs text-slate-600 space-y-1 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <p className="font-bold text-slate-900">{businessProfile.businessName || 'Business Name Missing'}</p>
                  {businessProfile.address?.addressLine1 && (
                    <p>{businessProfile.address.addressLine1}, {businessProfile.address.addressLine2}</p>
                  )}
                  {businessProfile.address?.city && (
                    <p>{businessProfile.address.city}, {businessProfile.address.state} - {businessProfile.address.pincode}</p>
                  )}
                  {businessProfile.gstin && <p><span className="font-semibold text-slate-450 uppercase">GSTIN:</span> {businessProfile.gstin}</p>}
                  {businessProfile.pan && <p><span className="font-semibold text-slate-450 uppercase">PAN:</span> {businessProfile.pan}</p>}
                  <p className="text-slate-450">{businessProfile.email} | {businessProfile.phone}</p>
                </div>
              </div>
            </div>

            {/* Right side: Invoice number, PO, Dates, and Custom Fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={documentNumber}
                    disabled
                    className="w-full form-input text-xs font-semibold text-slate-500 bg-slate-50 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">PO Number (Ref)</label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="Enter PO number"
                    className="w-full form-input text-xs text-slate-900 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full form-input text-xs text-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full form-input text-xs text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Custom Header Fields */}
              {customFields.map((field, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => {
                      const updated = [...customFields];
                      updated[i].label = e.target.value;
                      setCustomFields(updated);
                    }}
                    placeholder="Field Label"
                    className="w-1/3 form-input text-xs text-slate-900 py-1.5 bg-white"
                  />
                  <input
                    type="text"
                    value={field.value}
                    onChange={(e) => {
                      const updated = [...customFields];
                      updated[i].value = e.target.value;
                      setCustomFields(updated);
                    }}
                    placeholder="Field Value"
                    className="flex-1 form-input text-xs text-slate-900 py-1.5 bg-white"
                  />
                  <button
                    onClick={() => {
                      const updated = [...customFields];
                      updated.splice(i, 1);
                      setCustomFields(updated);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                onClick={() => setCustomFields([...customFields, { label: '', value: '' }])}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                + Add Custom Fields
              </button>
            </div>
          </div>

          {/* Client Details Section (Billed To) */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Billed To (Client's Details)</h3>
                <p className="text-xs text-slate-450">Select client and assign state location for tax mapping.</p>
              </div>
              <button
                onClick={() => setIsClientModalOpen(true)}
                className="px-3.5 py-1.5 border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-lg text-xs transition-all flex items-center gap-1 w-fit"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add New Client
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              <div className="md:col-span-1">
                <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">Select Client</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full form-input text-xs text-slate-900 bg-white"
                >
                  <option value="">-- Choose Client --</option>
                  {clients.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.businessName || c.clientName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                {selectedClient ? (
                  <div className="text-xs text-slate-600 space-y-1 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <p className="font-bold text-slate-900">
                      {selectedClient.businessName || selectedClient.clientName}
                    </p>
                    {selectedClient.billingAddress?.addressLine1 && (
                      <p>{selectedClient.billingAddress.addressLine1}, {selectedClient.billingAddress.addressLine2}</p>
                    )}
                    {selectedClient.billingAddress?.city && (
                      <p>{selectedClient.billingAddress.city}, {selectedClient.billingAddress.state} - {selectedClient.billingAddress.pincode}</p>
                    )}
                    {selectedClient.gstin && <p><span className="font-semibold text-slate-450 uppercase">GSTIN:</span> {selectedClient.gstin}</p>}
                    {selectedClient.pan && <p><span className="font-semibold text-slate-450 uppercase">PAN:</span> {selectedClient.pan}</p>}
                    <p className="text-slate-450">{selectedClient.email} | {selectedClient.phone}</p>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 p-4 rounded-xl text-center py-6">
                    No client selected. Pick a client from the dropdown or add a new client to proceed.
                  </div>
                )}
              </div>
            </div>

            {/* Shipping details toggle */}
            <div className="space-y-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableShipping}
                  onChange={(e) => setEnableShipping(e.target.checked)}
                  className="rounded text-blue-600 border-slate-350 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-700">Add Shipping Details</span>
              </label>

              {enableShipping && (
                <div className="bg-slate-50/50 border border-slate-150 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs animate-slideUp">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Shipping Address Line 1</label>
                    <input
                      type="text"
                      value={shippingAddress.addressLine1}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, addressLine1: e.target.value })}
                      placeholder="Street address, unit"
                      className="w-full form-input text-xs text-slate-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">City</label>
                    <input
                      type="text"
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                      placeholder="City"
                      className="w-full form-input text-xs text-slate-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pincode</label>
                    <input
                      type="text"
                      value={shippingAddress.pincode}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, pincode: e.target.value })}
                      placeholder="Pincode"
                      className="w-full form-input text-xs text-slate-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">State</label>
                    <select
                      value={shippingAddress.stateCode}
                      onChange={(e) => {
                        const s = INDIAN_STATES.find((x) => x.stateCode === e.target.value);
                        setShippingAddress({
                          ...shippingAddress,
                          stateCode: e.target.value,
                          state: s ? s.name : '',
                        });
                      }}
                      className="w-full form-input text-xs text-slate-900 bg-white"
                    >
                      <option value="">-- Choose State --</option>
                      {INDIAN_STATES.map((state) => (
                        <option key={state.stateCode} value={state.stateCode}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Country</label>
                    <input
                      type="text"
                      value={shippingAddress.country}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
                      className="w-full form-input text-xs text-slate-900 bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Configuration toolbar for Taxes / Currency */}
          <div className="border-t border-slate-100 pt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs bg-slate-50/50 p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Currency / Locale</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full form-input py-1.5 text-xs text-slate-900 bg-white"
              >
                <option value="INR">Indian Rupee (₹, INR)</option>
                <option value="USD">US Dollar ($, USD)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">GST Place of Supply</label>
              <select
                value={placeOfSupply.stateCode}
                onChange={(e) => {
                  const s = INDIAN_STATES.find((x) => x.stateCode === e.target.value);
                  setPlaceOfSupply({
                    stateCode: e.target.value,
                    state: s ? s.name : '',
                  });
                }}
                className="w-full form-input py-1.5 text-xs text-slate-900 bg-white"
              >
                <option value="">-- Mapped Automatically --</option>
                {INDIAN_STATES.map((state) => (
                  <option key={state.stateCode} value={state.stateCode}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">GST Calculation Mode</label>
              <div className="flex gap-4 pt-1 items-center">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gstEnabled}
                    onChange={(e) => setGstEnabled(e.target.checked)}
                    className="rounded text-blue-600 border-slate-300 w-4 h-4"
                  />
                  <span>Enable GST</span>
                </label>
                {gstEnabled && (
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value)}
                    className="form-input py-1 px-2 text-xs text-slate-900 bg-white"
                  >
                    <option value="Auto">Auto-split</option>
                    <option value="CGST + SGST">CGST + SGST</option>
                    <option value="IGST">IGST</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Line Items</h3>
              <button
                onClick={() => setIsColumnDrawerOpen(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Columns Setup
              </button>
            </div>

            {/* Dynamic Items Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white">
              <table className="w-full border-collapse text-left text-xs min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="px-4 py-3 min-w-[200px]">Item Description</th>
                    {columnVisibility.hsnSac && <th className="px-3 py-3 w-28">HSN/SAC</th>}
                    {columnVisibility.gstRate && gstEnabled && <th className="px-3 py-3 w-24">GST %</th>}
                    {columnVisibility.quantity && <th className="px-3 py-3 w-24">Qty</th>}
                    {columnVisibility.rate && <th className="px-3 py-3 w-32">Rate</th>}
                    {columnVisibility.amount && <th className="px-3 py-3 w-32">Base Amount</th>}
                    <th className="px-3 py-3 w-24 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {items.map((item, i) => {
                    if (item.isGroupHeader) {
                      return (
                        <tr key={item.id} className="bg-blue-50/20 font-semibold border-y border-blue-100">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-extrabold uppercase bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Group Header</span>
                              <input
                                type="text"
                                value={item.groupTitle}
                                onChange={(e) => handleUpdateItemRow(i, { groupTitle: e.target.value })}
                                className="flex-1 form-input text-xs font-bold text-slate-900 py-1 bg-white border-blue-200 max-w-md focus:border-blue-600 focus:ring-0"
                                placeholder="Enter Section / Group title (e.g. Services)"
                              />
                              <button
                                onClick={() => handleRemoveRow(i)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors ml-auto"
                                title="Remove Group Section"
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

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/20 items-start">
                        {/* Item Details */}
                        <td className="px-4 py-3 space-y-2">
                          <div className="flex gap-2">
                            {/* Optional Item image slot */}
                            {displayOptions.addImageInItems && (
                              <div className="flex-shrink-0">
                                {item.image ? (
                                  <div className="relative w-10 h-10 border border-slate-200 rounded-lg overflow-hidden group flex items-center justify-center bg-slate-50">
                                    <img src={item.image} alt="Item" className="object-contain max-h-full max-w-full" />
                                    <button
                                      onClick={() => handleUpdateItemRow(i, { image: '' })}
                                      className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px]"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ) : (
                                  <label className="flex flex-col items-center justify-center w-10 h-10 border border-dashed border-slate-250 hover:border-blue-500 rounded-lg cursor-pointer hover:bg-blue-50/20">
                                    <span className="text-[8px] text-slate-400 font-bold text-center">Add Img</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => e.target.files && handleItemImageUpload(i, e.target.files[0])}
                                    />
                                  </label>
                                )}
                              </div>
                            )}

                            <div className="flex-1 space-y-1.5">
                              <input
                                type="text"
                                value={item.itemName}
                                onChange={(e) => handleUpdateItemRow(i, { itemName: e.target.value })}
                                placeholder="Item name / SKU"
                                className="w-full form-input text-xs font-semibold text-slate-900 bg-white"
                              />
                              <textarea
                                value={item.description}
                                onChange={(e) => handleUpdateItemRow(i, { description: e.target.value })}
                                placeholder="Add descriptive notes..."
                                rows={2}
                                className="w-full form-input text-xs text-slate-500 bg-white resize-none"
                              />
                            </div>
                          </div>
                        </td>

                        {/* HSN/SAC */}
                        {columnVisibility.hsnSac && (
                          <td className="px-3 py-3 align-top">
                            <input
                              type="text"
                              value={item.hsnSac}
                              onChange={(e) => handleUpdateItemRow(i, { hsnSac: e.target.value })}
                              placeholder="Code"
                              className="w-full form-input text-xs text-slate-900 bg-white"
                            />
                          </td>
                        )}

                        {/* GST % */}
                        {columnVisibility.gstRate && gstEnabled && (
                          <td className="px-3 py-3 align-top">
                            <select
                              value={item.gstRate}
                              onChange={(e) => handleUpdateItemRow(i, { gstRate: parseFloat(e.target.value) })}
                              className="w-full form-input text-xs text-slate-900 bg-white"
                            >
                              {[0, 5, 12, 18, 28].map((rate) => (
                                <option key={rate} value={rate}>
                                  {rate}%
                                </option>
                              ))}
                            </select>
                          </td>
                        )}

                        {/* Quantity & Unit */}
                        {columnVisibility.quantity && (
                          <td className="px-3 py-3 align-top space-y-1.5">
                            <input
                              type="number"
                              value={item.quantity}
                              min={0.0001}
                              step="any"
                              onChange={(e) => handleUpdateItemRow(i, { quantity: Math.max(0.0001, parseFloat(e.target.value) || 0) })}
                              className="w-full form-input text-xs text-slate-900 bg-white"
                            />
                            {displayOptions.displayUnitAs === 'Separate column' && (
                              <input
                                type="text"
                                value={item.unit}
                                onChange={(e) => handleUpdateItemRow(i, { unit: e.target.value })}
                                placeholder="PCS"
                                className="w-full form-input text-[10px] py-1 text-slate-500 bg-white uppercase font-bold"
                              />
                            )}
                          </td>
                        )}

                        {/* Rate / Discounts */}
                        {columnVisibility.rate && (
                          <td className="px-3 py-3 align-top space-y-1.5">
                            <input
                              type="number"
                              value={item.rate}
                              min={0}
                              step="any"
                              onChange={(e) => handleUpdateItemRow(i, { rate: Math.max(0, parseFloat(e.target.value) || 0) })}
                              className="w-full form-input text-xs font-semibold text-slate-900 bg-white"
                            />
                            {/* Inline discount */}
                            <div className="flex gap-1">
                              <select
                                value={item.discountType}
                                onChange={(e) => handleUpdateItemRow(i, { discountType: e.target.value as any })}
                                className="form-input py-0.5 px-1 text-[9px] text-slate-500 bg-white"
                              >
                                <option value="NONE">No Disc</option>
                                <option value="PERCENTAGE">%</option>
                                <option value="FIXED">Flat ₹</option>
                              </select>
                              {item.discountType !== 'NONE' && (
                                <input
                                  type="number"
                                  value={item.discountValue}
                                  onChange={(e) => handleUpdateItemRow(i, { discountValue: Math.max(0, parseFloat(e.target.value) || 0) })}
                                  className="w-12 form-input py-0.5 px-1 text-[10px] text-slate-900 bg-white"
                                />
                              )}
                            </div>
                          </td>
                        )}

                        {/* Base Amount */}
                        {columnVisibility.amount && (
                          <td className="px-3 py-3 align-top font-semibold text-slate-900 pt-5">
                            ₹{(item.quantity * item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        )}

                        {/* Actions */}
                        <td className="px-3 py-3 text-right align-top pt-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleDuplicateRow(i)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Duplicate row"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRemoveRow(i)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Remove row"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

            {/* Line items actions */}
            <div className="flex gap-4">
              <button
                onClick={handleAddItemRow}
                className="px-4 py-2 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-xs text-slate-700 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Line Item
              </button>
              <button
                onClick={handleAddGroupRow}
                className="px-4 py-2 border border-blue-200 bg-white hover:bg-blue-50/20 font-bold rounded-xl text-xs text-blue-600 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Group Section
              </button>
            </div>
          </div>

          {/* Bottom section: Optional document sections, Remarks, Terms */}
          <div className="border-t border-slate-100 pt-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left side actions triggers */}
            <div className="space-y-6">
              <div>
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Optional Document Details</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <button
                    onClick={() => setShowTermsArea(!showTermsArea)}
                    className={`p-3 rounded-xl border text-left font-bold transition-all ${
                      showTermsArea ? 'bg-blue-50/50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    + Terms & Conditions
                  </button>
                  <button
                    onClick={() => setShowNotesArea(!showNotesArea)}
                    className={`p-3 rounded-xl border text-left font-bold transition-all ${
                      showNotesArea ? 'bg-blue-50/50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    + Remarks / Notes
                  </button>
                  <button
                    onClick={() => setShowSignatureArea(!showSignatureArea)}
                    className={`p-3 rounded-xl border text-left font-bold transition-all ${
                      showSignatureArea ? 'bg-blue-50/50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    + Authorized Signatory
                  </button>
                  <button
                    onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
                    className={`p-3 rounded-xl border text-left font-bold transition-all ${
                      showAdditionalInfo ? 'bg-blue-50/50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    + Additional Info
                  </button>
                </div>
              </div>

              {/* Dynamic details render */}
              {showTermsArea && (
                <div className="space-y-2 animate-slideUp">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Terms & Conditions</label>
                  <textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder="Enter terms, payment schedules, valid periods..."
                    rows={4}
                    className="w-full form-input text-xs text-slate-900 bg-white"
                  />
                </div>
              )}

              {showNotesArea && (
                <div className="space-y-2 animate-slideUp">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remarks / Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter notes visible to clients..."
                    rows={4}
                    className="w-full form-input text-xs text-slate-900 bg-white"
                  />
                </div>
              )}

              {showAdditionalInfo && (
                <div className="space-y-3 animate-slideUp">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Additional Info</label>
                  {additionalInfo.map((field, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => {
                          const list = [...additionalInfo];
                          list[i].label = e.target.value;
                          setAdditionalInfo(list);
                        }}
                        placeholder="Info Key (e.g. Project Code)"
                        className="w-1/3 form-input text-xs text-slate-900 py-1.5 bg-white"
                      />
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => {
                          const list = [...additionalInfo];
                          list[i].value = e.target.value;
                          setAdditionalInfo(list);
                        }}
                        placeholder="Info Value"
                        className="flex-1 form-input text-xs text-slate-900 py-1.5 bg-white"
                      />
                      <button
                        onClick={() => {
                          const list = [...additionalInfo];
                          list.splice(i, 1);
                          setAdditionalInfo(list);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setAdditionalInfo([...additionalInfo, { label: '', value: '' }])}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    + Add Field
                  </button>
                </div>
              )}

              {showSignatureArea && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-4 animate-slideUp">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Authorized Signatory Setup</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Signatory Name</label>
                      <input
                        type="text"
                        value={signatoryName}
                        onChange={(e) => setSignatoryName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full form-input text-xs text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Designation</label>
                      <input
                        type="text"
                        value={signatoryDesignation}
                        onChange={(e) => setSignatoryDesignation(e.target.value)}
                        placeholder="Director"
                        className="w-full form-input text-xs text-slate-900 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Signature File (Watermark)</label>
                    {signatureBase64 ? (
                      <div className="relative w-32 h-16 border border-slate-200 rounded-lg overflow-hidden group bg-white flex items-center justify-center p-1.5">
                        <img src={signatureBase64} alt="Signature" className="max-h-full max-w-full object-contain" />
                        <button
                          onClick={() => setSignatureBase64('')}
                          className="absolute inset-0 bg-slate-900/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs transition-opacity"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-32 h-16 border border-dashed border-slate-250 hover:border-blue-500 rounded-lg cursor-pointer bg-white">
                        <span className="text-[9px] text-slate-400 font-bold">Upload File</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files && handleSignatureUpload(e.target.files[0])}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right side: Calculations totals details panel */}
            <div className="space-y-4 md:pl-6">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">Grand Summary</h3>
              <div className="space-y-3.5 text-xs text-slate-650">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-900">
                    ₹{calculated.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Doc Discount toggle options */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableDocDiscount}
                        onChange={(e) => setEnableDocDiscount(e.target.checked)}
                        className="rounded text-blue-600 border-slate-300 w-4 h-4"
                      />
                      <span>Add Document Discount</span>
                    </label>
                    {enableDocDiscount && (
                      <div className="flex gap-1.5 items-center">
                        <select
                          value={docDiscountType}
                          onChange={(e) => setDocDiscountType(e.target.value as any)}
                          className="form-input py-0.5 px-1 text-[10px] text-slate-900 bg-white"
                        >
                          <option value="PERCENTAGE">%</option>
                          <option value="FIXED">Flat ₹</option>
                        </select>
                        <input
                          type="number"
                          value={docDiscountValue}
                          onChange={(e) => setDocDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-16 form-input py-0.5 px-1 text-xs text-slate-900 bg-white font-bold"
                        />
                      </div>
                    )}
                  </div>
                  {enableDocDiscount && calculated.documentDiscountAmount > 0 && (
                    <div className="flex justify-between text-xs text-slate-500 pl-6">
                      <span>Discount Total:</span>
                      <span>- ₹{calculated.documentDiscountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>

                {/* Additional charges list */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Additional Charges</label>
                  {additionalCharges.map((charge, i) => (
                    <div key={i} className="flex gap-2 items-center text-xs animate-fadeIn">
                      <input
                        type="text"
                        value={charge.chargeName}
                        onChange={(e) => {
                          const list = [...additionalCharges];
                          list[i].chargeName = e.target.value;
                          setAdditionalCharges(list);
                        }}
                        placeholder="Charge Name (e.g. Shipping)"
                        className="w-1/3 form-input text-xs text-slate-900 py-1.5 bg-white"
                      />
                      <input
                        type="number"
                        value={charge.amount}
                        onChange={(e) => {
                          const list = [...additionalCharges];
                          list[i].amount = Math.max(0, parseFloat(e.target.value) || 0);
                          setAdditionalCharges(list);
                        }}
                        placeholder="Amount"
                        className="w-20 form-input text-xs text-slate-900 py-1.5 bg-white"
                      />
                      <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-500 uppercase">
                        <input
                          type="checkbox"
                          checked={charge.isTaxable}
                          onChange={(e) => {
                            const list = [...additionalCharges];
                            list[i].isTaxable = e.target.checked;
                            setAdditionalCharges(list);
                          }}
                          className="rounded text-blue-600 border-slate-300 w-3.5 h-3.5"
                        />
                        <span>Taxable</span>
                      </label>
                      {charge.isTaxable && (
                        <select
                          value={charge.gstRate}
                          onChange={(e) => {
                            const list = [...additionalCharges];
                            list[i].gstRate = parseFloat(e.target.value);
                            setAdditionalCharges(list);
                          }}
                          className="form-input py-1 px-1.5 text-[10px] text-slate-900 bg-white"
                        >
                          {[0, 5, 12, 18, 28].map((rate) => (
                            <option key={rate} value={rate}>
                              {rate}%
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        onClick={() => {
                          const list = [...additionalCharges];
                          list.splice(i, 1);
                          setAdditionalCharges(list);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 ml-auto"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setAdditionalCharges([...additionalCharges, { chargeName: '', amount: 0, isTaxable: false, gstRate: 18 }])}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    + Add Charge Line
                  </button>
                </div>

                {/* GST Allocation break summary */}
                {gstEnabled && (
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl space-y-1.5 text-xs text-slate-500">
                    <p className="font-bold text-[9px] text-slate-450 tracking-wider uppercase border-b border-slate-200 pb-1">GST Breakdown</p>
                    {calculated.cgstTotal > 0 && (
                      <div className="flex justify-between">
                        <span>CGST total:</span>
                        <span>₹{calculated.cgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {calculated.sgstTotal > 0 && (
                      <div className="flex justify-between">
                        <span>SGST total:</span>
                        <span>₹{calculated.sgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {calculated.igstTotal > 0 && (
                      <div className="flex justify-between">
                        <span>IGST total:</span>
                        <span>₹{calculated.igstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                )}

                {calculated.roundOff !== 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Round-off adjustment:</span>
                    <span>₹{calculated.roundOff > 0 ? '+' : ''}{calculated.roundOff.toFixed(2)}</span>
                  </div>
                )}

                {summarizeTotalQuantity && (
                  <div className="flex justify-between text-slate-500">
                    <span>Total Quantity:</span>
                    <span>{calculated.totalQuantity}</span>
                  </div>
                )}

                {/* Grand Total */}
                <div className="flex justify-between border-t border-slate-200 pt-3 text-sm font-black text-slate-900">
                  <span>Grand Total (INR):</span>
                  <span>₹{calculated.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recurring details configuration panel */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded text-blue-600 border-slate-350 focus:ring-blue-500 w-4 h-4"
              />
              <div>
                <span className="text-xs font-semibold text-slate-700 block">This is a Recurring proforma invoice</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  A draft proforma invoice will be created with the same details every next period.
                </span>
              </div>
            </label>

            {isRecurring && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs animate-slideUp">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Frequency</label>
                  <select
                    value={recurrenceFreq}
                    onChange={(e) => setRecurrenceFreq(e.target.value)}
                    className="w-full form-input text-xs text-slate-900 bg-white"
                  >
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Half Yearly">Half Yearly</option>
                    <option value="Yearly">Yearly</option>
                    <option value="Custom">Custom Interval</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
                  <input
                    type="date"
                    value={recurrenceStart}
                    onChange={(e) => setRecurrenceStart(e.target.value)}
                    className="w-full form-input text-xs text-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    value={recurrenceEnd}
                    onChange={(e) => setRecurrenceEnd(e.target.value)}
                    className="w-full form-input text-xs text-slate-900 bg-white"
                  />
                </div>
                {recurrenceFreq === 'Custom' && (
                  <div className="sm:col-span-3 grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Interval Value</label>
                      <input
                        type="number"
                        min={1}
                        value={recurrenceInterval}
                        onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full form-input text-xs text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Interval Unit</label>
                      <select
                        value={recurrenceIntervalUnit}
                        onChange={(e) => setRecurrenceIntervalUnit(e.target.value)}
                        className="w-full form-input text-xs text-slate-900 bg-white"
                      >
                        <option value="Days">Days</option>
                        <option value="Weeks">Weeks</option>
                        <option value="Months">Months</option>
                        <option value="Years">Years</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Advanced options panel */}
        <div className="xl:col-span-1 space-y-6">
          <div className="card-panel p-5 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-5">
            <h3 className="text-sm font-black text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-1.5">
              Advanced Design Configs
            </h3>

            {/* Config Fields */}
            <div className="space-y-4 text-xs text-slate-650">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Select HSN column view</label>
                <select
                  value={displayOptions.hsnColumnView}
                  onChange={(e) => setDisplayOptions({ ...displayOptions, hsnColumnView: e.target.value })}
                  className="w-full form-input text-xs text-slate-900 bg-white"
                >
                  <option value="Default">Default</option>
                  <option value="HSN Only">HSN Only</option>
                  <option value="SAC Only">SAC Only</option>
                  <option value="HSN/SAC">HSN/SAC</option>
                  <option value="Hide">Hide</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Display unit as</label>
                <select
                  value={displayOptions.displayUnitAs}
                  onChange={(e) => setDisplayOptions({ ...displayOptions, displayUnitAs: e.target.value })}
                  className="w-full form-input text-xs text-slate-900 bg-white"
                >
                  <option value="Merge with quantity">Merge with quantity</option>
                  <option value="Separate column">Separate column</option>
                  <option value="Hide">Hide</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Show tax summary in invoice</label>
                <select
                  value={displayOptions.taxSummaryDisplay}
                  onChange={(e) => setDisplayOptions({ ...displayOptions, taxSummaryDisplay: e.target.value })}
                  className="w-full form-input text-xs text-slate-900 bg-white"
                >
                  <option value="Do not show">Do not show</option>
                  <option value="Summary">Summary</option>
                  <option value="Detailed">Detailed</option>
                </select>
              </div>

              {/* Toggles */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={displayOptions.hidePlaceOfSupply}
                    onChange={(e) => setDisplayOptions({ ...displayOptions, hidePlaceOfSupply: e.target.checked })}
                    className="rounded text-blue-600 border-slate-300 w-4 h-4"
                  />
                  <span>Hide place/country of supply</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={displayOptions.showHsnSummary}
                    onChange={(e) => setDisplayOptions({ ...displayOptions, showHsnSummary: e.target.checked })}
                    className="rounded text-blue-600 border-slate-300 w-4 h-4"
                  />
                  <span>Show HSN summary in invoice</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={displayOptions.addImageInItems}
                    onChange={(e) => setDisplayOptions({ ...displayOptions, addImageInItems: e.target.checked })}
                    className="rounded text-blue-600 border-slate-300 w-4 h-4"
                  />
                  <span>Add original images in line items</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={displayOptions.showThumbnailsSeparate}
                    onChange={(e) => setDisplayOptions({ ...displayOptions, showThumbnailsSeparate: e.target.checked })}
                    className="rounded text-blue-600 border-slate-300 w-4 h-4"
                  />
                  <span>Show thumbnails in separate column</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={displayOptions.descriptionFullWidth}
                    onChange={(e) => setDisplayOptions({ ...displayOptions, descriptionFullWidth: e.target.checked })}
                    className="rounded text-blue-600 border-slate-300 w-4 h-4"
                  />
                  <span>Show description in full width</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={displayOptions.hideSubtotalForGroup}
                    onChange={(e) => setDisplayOptions({ ...displayOptions, hideSubtotalForGroup: e.target.checked })}
                    className="rounded text-blue-600 border-slate-300 w-4 h-4"
                  />
                  <span>Hide subtotal for group items</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={displayOptions.showSku}
                    onChange={(e) => setDisplayOptions({ ...displayOptions, showSku: e.target.checked })}
                    className="rounded text-blue-600 border-slate-300 w-4 h-4"
                  />
                  <span>Show SKU in Proforma Invoice</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={displayOptions.showSerialNumbers}
                    onChange={(e) => setDisplayOptions({ ...displayOptions, showSerialNumbers: e.target.checked })}
                    className="rounded text-blue-600 border-slate-300 w-4 h-4"
                  />
                  <span>Show Serial Numbers in Proforma Invoice</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={displayOptions.displayBatchDetails}
                    onChange={(e) => setDisplayOptions({ ...displayOptions, displayBatchDetails: e.target.checked })}
                    className="rounded text-blue-600 border-slate-300 w-4 h-4"
                  />
                  <span>Display Batch Details in columns</span>
                </label>
              </div>
            </div>
          </div>

          {/* Flow actions */}
          <div className="card-panel p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
            <button
              onClick={() => handleSaveDocument(true, true)}
              disabled={saving}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2 text-xs"
            >
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>
            <button
              onClick={() => handleSaveDocument(true, false)}
              disabled={saving}
              className="w-full py-2.5 border border-slate-350 bg-white hover:bg-slate-50 font-bold rounded-xl text-xs text-slate-700 transition-all flex items-center justify-center"
            >
              Save as Draft
            </button>
            <Link
              href="/proforma-invoices"
              className="w-full py-2.5 text-center text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            >
              Discard Changes
            </Link>
          </div>
        </div>
      </div>

      {/* Columns customisation drawer modal */}
      {isColumnDrawerOpen && (
        <Modal
          isOpen={isColumnDrawerOpen}
          onClose={() => setIsColumnDrawerOpen(false)}
          title="Edit Columns / Formulas"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">Enable/disable visible columns inside the proforma invoice line items editor table.</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {Object.keys(columnVisibility).map((col) => (
                <label key={col} className="flex items-center gap-2 cursor-pointer select-none border border-slate-800 p-2.5 rounded-lg bg-slate-900/20">
                  <input
                    type="checkbox"
                    checked={columnVisibility[col]}
                    onChange={(e) => setColumnVisibility({ ...columnVisibility, [col]: e.target.checked })}
                    className="rounded text-blue-600 border-slate-700 w-4 h-4 bg-slate-800"
                  />
                  <span className="capitalize font-medium text-slate-350">{col.replace(/([A-Z])/g, ' $1')}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end pt-4 border-t border-slate-850">
              <button
                onClick={() => setIsColumnDrawerOpen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition-colors"
              >
                Apply Columns
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Inline Client creation modal */}
      {isClientModalOpen && (
        <Modal
          isOpen={isClientModalOpen}
          onClose={() => setIsClientModalOpen(false)}
          title="Add New Client"
        >
          <form onSubmit={handleCreateClient} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1.5">Client Type</label>
                <select
                  value={newClient.clientType}
                  onChange={(e) => setNewClient({ ...newClient, clientType: e.target.value })}
                  className="w-full form-input text-xs text-slate-900 bg-white"
                >
                  <option value="BUSINESS">Business / Company</option>
                  <option value="INDIVIDUAL">Individual customer</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1.5">Client Name (Contact)</label>
                <input
                  type="text"
                  required
                  value={newClient.clientName}
                  onChange={(e) => setNewClient({ ...newClient, clientName: e.target.value })}
                  placeholder="Primary contact person"
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
            </div>

            {newClient.clientType === 'BUSINESS' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1.5">Business Name</label>
                <input
                  type="text"
                  value={newClient.businessName}
                  onChange={(e) => setNewClient({ ...newClient, businessName: e.target.value })}
                  placeholder="Enterprise name LLC"
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1.5">Email address</label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  placeholder="name@company.com"
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  placeholder="Contact phone"
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1.5">GSTIN</label>
                <input
                  type="text"
                  value={newClient.gstin}
                  onChange={(e) => setNewClient({ ...newClient, gstin: e.target.value.toUpperCase() })}
                  placeholder="15-character GSTIN"
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1.5">PAN</label>
                <input
                  type="text"
                  value={newClient.pan}
                  onChange={(e) => setNewClient({ ...newClient, pan: e.target.value.toUpperCase() })}
                  placeholder="10-character PAN"
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-800/80 pt-4">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Billing Address</h4>
              <div>
                <label className="block text-[9px] font-bold text-slate-450 uppercase tracking-wider mb-1">Street Address</label>
                <input
                  type="text"
                  value={newClient.billingAddress.addressLine1}
                  onChange={(e) =>
                    setNewClient({
                      ...newClient,
                      billingAddress: { ...newClient.billingAddress, addressLine1: e.target.value },
                    })
                  }
                  className="w-full form-input text-xs text-slate-900 bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[9px] font-bold text-slate-450 uppercase tracking-wider mb-1">City</label>
                  <input
                    type="text"
                    value={newClient.billingAddress.city}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        billingAddress: { ...newClient.billingAddress, city: e.target.value },
                      })
                    }
                    className="w-full form-input text-xs text-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-450 uppercase tracking-wider mb-1">State</label>
                  <select
                    value={newClient.billingAddress.stateCode}
                    onChange={(e) => {
                      const s = INDIAN_STATES.find((x) => x.stateCode === e.target.value);
                      setNewClient({
                        ...newClient,
                        billingAddress: {
                          ...newClient.billingAddress,
                          stateCode: e.target.value,
                          state: s ? s.name : '',
                        },
                      });
                    }}
                    className="w-full form-input text-xs text-slate-900 bg-white"
                  >
                    <option value="">-- State --</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state.stateCode} value={state.stateCode}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-450 uppercase tracking-wider mb-1">Pincode</label>
                  <input
                    type="text"
                    value={newClient.billingAddress.pincode}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        billingAddress: { ...newClient.billingAddress, pincode: e.target.value },
                      })
                    }
                    className="w-full form-input text-xs text-slate-900 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsClientModalOpen(false)}
                className="px-4 py-2 border border-slate-700 text-slate-400 hover:bg-slate-850 hover:text-white rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow"
              >
                Register Client
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
