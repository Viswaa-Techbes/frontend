const SalesDocument = require('../models/SalesDocument');
const Counter = require('../models/Counter');
const Client = require('../models/Client');
const BusinessProfile = require('../models/BusinessProfile');
const ApiError = require('../utils/ApiError');
const { toIndianWords } = require('../utils/numberToWords');
const { DOCUMENT_PREFIX } = require('../utils/constants');

/**
 * Generate atomic counter for document numbers (e.g. QT-00001)
 */
const generateDocumentNumber = async (businessId, documentType) => {
  const prefix = DOCUMENT_PREFIX[documentType] || 'DOC';
  const counterId = `${businessId.toString()}_${documentType}`;
  
  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const sequenceNum = counter.seq.toString().padStart(5, '0');
  return `${prefix}-${sequenceNum}`;
};

/**
 * Perform all calculation steps for items, discounts, GST, and totals.
 * Mode determines tax allocation based on place of supply vs business state code.
 */
const calculateDocumentTotals = (data, businessStateCode) => {
  const {
    items = [],
    placeOfSupply,
    documentDiscountType = 'NONE',
    documentDiscountValue = 0,
    additionalCharges = [],
    gstEnabled = true,
  } = data;

  const supplyStateCode = (placeOfSupply && placeOfSupply.stateCode) ? placeOfSupply.stateCode : (businessStateCode || 'DL');

  // Determine GST mode
  const isIntraState = businessStateCode.toUpperCase() === supplyStateCode.toUpperCase();
  const gstMode = isIntraState ? 'INTRA_STATE' : 'INTER_STATE';

  // Calculate items taxable amounts and sum item subtotal
  let subtotal = 0;
  let totalQuantity = 0;
  const processedItems = items.map((item) => {
    // If it's a group header, do not count values
    const isGroup = item.itemName && item.itemName.startsWith('[GROUP] ');
    if (isGroup) {
      return {
        ...item,
        quantity: 0,
        rate: 0,
        baseAmount: 0,
        itemDiscountAmount: 0,
        taxableAmount: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0,
      };
    }

    const quantity = Math.max(0, parseFloat(item.quantity) || 0);
    totalQuantity += quantity;
    const rate = Math.max(0, parseFloat(item.rate) || 0);
    const discountValue = Math.max(0, parseFloat(item.discountValue) || 0);
    const gstRate = gstEnabled ? Math.max(0, parseFloat(item.gstRate) || 0) : 0;

    const baseAmount = Math.round(quantity * rate * 100) / 100;
    
    let itemDiscountAmount = 0;
    if (item.discountType === 'PERCENTAGE') {
      itemDiscountAmount = Math.round((baseAmount * discountValue / 100) * 100) / 100;
    } else if (item.discountType === 'FIXED') {
      itemDiscountAmount = Math.min(baseAmount, discountValue);
    }
    
    const taxableAmount = Math.round((baseAmount - itemDiscountAmount) * 100) / 100;
    subtotal += taxableAmount;

    return {
      ...item,
      quantity,
      rate,
      discountValue,
      gstRate,
      baseAmount,
      itemDiscountAmount,
      taxableAmount,
    };
  });

  // Calculate document-level discount
  let documentDiscountAmount = 0;
  if (documentDiscountType === 'PERCENTAGE') {
    documentDiscountAmount = Math.round((subtotal * parseFloat(documentDiscountValue || 0) / 100) * 100) / 100;
  } else if (documentDiscountType === 'FIXED') {
    documentDiscountAmount = Math.min(subtotal, Math.max(0, parseFloat(documentDiscountValue || 0)));
  }

  // Allocate document discount proportionally and calculate GST
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let finalTaxableSum = 0;

  const finalItems = processedItems.map((item) => {
    const isGroup = item.itemName && item.itemName.startsWith('[GROUP] ');
    if (isGroup) return item;

    const proportionalDiscount = subtotal > 0 
      ? Math.round(((item.taxableAmount / subtotal) * documentDiscountAmount) * 100) / 100
      : 0;
    
    const finalTaxable = Math.max(0, Math.round((item.taxableAmount - proportionalDiscount) * 100) / 100);
    finalTaxableSum += finalTaxable;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (gstEnabled) {
      if (isIntraState) {
        cgst = Math.round((finalTaxable * (item.gstRate / 2) / 100) * 100) / 100;
        sgst = Math.round((finalTaxable * (item.gstRate / 2) / 100) * 100) / 100;
        cgstTotal += cgst;
        sgstTotal += sgst;
      } else {
        igst = Math.round((finalTaxable * item.gstRate / 100) * 100) / 100;
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

  // Additional charges calculations
  let additionalChargesTotal = 0;
  const processedCharges = additionalCharges.map((charge) => {
    const amount = Math.max(0, parseFloat(charge.amount) || 0);
    let taxAmount = 0;
    if (gstEnabled && charge.isTaxable) {
      const gstRate = Math.max(0, parseFloat(charge.gstRate) || 0);
      taxAmount = Math.round((amount * gstRate / 100) * 100) / 100;
    }
    const total = Math.round((amount + taxAmount) * 100) / 100;
    additionalChargesTotal += total;

    return {
      ...charge,
      amount,
      taxAmount,
      total,
    };
  });

  // Calculate final totals
  const subtotalClean = Math.round(subtotal * 100) / 100;
  const taxableAmountClean = Math.round(finalTaxableSum * 100) / 100;
  cgstTotal = Math.round(cgstTotal * 100) / 100;
  sgstTotal = Math.round(sgstTotal * 100) / 100;
  igstTotal = Math.round(igstTotal * 100) / 100;
  additionalChargesTotal = Math.round(additionalChargesTotal * 100) / 100;

  const grandTotalNoRound = taxableAmountClean + cgstTotal + sgstTotal + igstTotal + additionalChargesTotal;
  const grandTotal = Math.round(grandTotalNoRound);
  const roundOff = Math.round((grandTotal - grandTotalNoRound) * 100) / 100;
  const grandTotalInWords = toIndianWords(grandTotal);

  return {
    items: finalItems,
    documentDiscountAmount,
    additionalCharges: processedCharges,
    subtotal: subtotalClean,
    taxableAmount: taxableAmountClean,
    cgstTotal,
    sgstTotal,
    igstTotal,
    additionalChargesTotal,
    roundOff,
    grandTotal,
    grandTotalInWords,
    gstMode,
    totalQuantity,
  };
};

/**
 * Service Helper: logs audit trail events directly into a document
 */
const logAuditEvent = async (document, action, description, userId, metadata = {}) => {
  const User = require('../models/User'); // Lazy import
  let userName = 'System';
  if (userId) {
    const user = await User.findById(userId);
    if (user) {
      userName = user.name || user.email;
    }
  }
  document.auditTrail = document.auditTrail || [];
  document.auditTrail.push({
    action,
    description,
    userId,
    userName,
    timestamp: new Date(),
    metadata,
  });
};

/**
 * Create a new document in the database
 */
const createDocument = async (userId, data) => {
  const { clientId, documentType } = data;

  if (documentType !== 'QUOTATION' && documentType !== 'PROFORMA_INVOICE' && documentType !== 'INVOICE' && documentType !== 'SALES_ORDER' && documentType !== 'DELIVERY_CHALLAN' && documentType !== 'CREDIT_NOTE') {
    throw ApiError.badRequest('Supported document types are QUOTATION, PROFORMA_INVOICE, INVOICE, SALES_ORDER, DELIVERY_CHALLAN, and CREDIT_NOTE.');
  }

  // Load profile
  const business = await BusinessProfile.findOne({ userId });
  if (!business) {
    throw ApiError.badRequest('Please complete your Business Profile before creating a document.');
  }

  // Load client
  const client = await Client.findOne({ _id: clientId, businessId: business._id, isDeleted: false });
  if (!client) {
    throw ApiError.notFound('Client not found or doesn\'t belong to this business.');
  }

  if (client.status !== 'ACTIVE') {
    throw ApiError.badRequest('Selected client must be ACTIVE.');
  }

  // Validate state
  const businessState = business.address?.stateCode || 'DL'; // fallback

  // Copy snapshots
  const businessSnapshot = business.toObject();
  const clientSnapshot = client.toObject();

  // Run calculation
  const calculations = calculateDocumentTotals(data, businessState);

  if (documentType === 'CREDIT_NOTE' && data.linkedInvoiceId) {
    const originalInvoice = await SalesDocument.findOne({ _id: data.linkedInvoiceId, businessId: business._id, documentType: 'INVOICE' });
    if (!originalInvoice) {
      throw ApiError.notFound('Linked invoice not found.');
    }
    const previousCNs = await SalesDocument.find({
      businessId: business._id,
      documentType: 'CREDIT_NOTE',
      linkedInvoiceId: data.linkedInvoiceId,
      status: { $ne: 'CANCELLED' }
    });
    const totalPrevious = previousCNs.reduce((sum, cn) => sum + cn.grandTotal, 0);
    const remaining = originalInvoice.grandTotal - totalPrevious;
    if (calculations.grandTotal > remaining) {
      throw ApiError.badRequest(`Credit Note total ₹${calculations.grandTotal.toLocaleString('en-IN')} exceeds remaining creditable amount of ₹${remaining.toLocaleString('en-IN')} for Invoice ${originalInvoice.documentNumber}`);
    }
  }

  // Generate sequence code
  const docNum = await generateDocumentNumber(business._id, documentType);

  let availableCredit = 0;
  if (documentType === 'CREDIT_NOTE') {
    availableCredit = (data.status !== 'DRAFT') ? calculations.grandTotal : 0;
  }

  const document = await SalesDocument.create({
    ...data,
    ...calculations,
    documentNumber: docNum,
    businessId: business._id,
    businessSnapshot,
    clientSnapshot,
    createdBy: userId,
    balanceDue: calculations.grandTotal,
    paymentStatus: 'UNPAID',
    availableCreditAmount: availableCredit,
  });

  await logAuditEvent(document, 'CREATED', `Created document ${docNum} of type ${documentType}`, userId);
  await document.save();

  return document.toObject();
};

/**
 * Get filterable paginated documents list
 */
const getDocuments = async (userId, query) => {
  const business = await BusinessProfile.findOne({ userId });
  if (!business) {
    return { documents: [], total: 0 };
  }

  const filter = { 
    businessId: business._id, 
    documentType: query.documentType || query.type || 'QUOTATION' 
  };

  if (query.status) {
    filter.status = query.status;
  }

  // Text search
  if (query.search) {
    const regex = new RegExp(query.search, 'i');
    filter.$or = [
      { documentNumber: regex },
      { 'clientSnapshot.clientName': regex },
      { 'clientSnapshot.businessName': regex },
    ];
  }

  // Date range filter
  if (query.fromDate || query.toDate) {
    filter.issueDate = {};
    if (query.fromDate) filter.issueDate.$gte = new Date(query.fromDate);
    if (query.toDate) filter.issueDate.$lte = new Date(query.toDate);
  }

  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.max(1, parseInt(query.limit) || 15);
  const skip = (page - 1) * limit;

  const [documents, total] = await Promise.all([
    SalesDocument.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SalesDocument.countDocuments(filter),
  ]);

  return {
    documents,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  };
};

/**
 * Get document by ID
 */
const getDocumentById = async (id, userId) => {
  const business = await BusinessProfile.findOne({ userId });
  if (!business) {
    throw ApiError.badRequest('Business profile not found.');
  }

  const document = await SalesDocument.findOne({ _id: id, businessId: business._id }).lean();
  if (!document) {
    throw ApiError.notFound('Document not found.');
  }

  return document;
};

/**
 * Update document
 */
const updateDocument = async (id, userId, data) => {
  const business = await BusinessProfile.findOne({ userId });
  if (!business) {
    throw ApiError.badRequest('Business profile not found.');
  }

  const document = await SalesDocument.findOne({ _id: id, businessId: business._id });
  if (!document) {
    throw ApiError.notFound('Document not found.');
  }

  // If client changes, refresh snapshot
  if (data.clientId && data.clientId.toString() !== document.clientId.toString()) {
    const client = await Client.findOne({ _id: data.clientId, businessId: business._id, isDeleted: false });
    if (!client) throw ApiError.notFound('New client not found.');
    document.clientId = client._id;
    document.clientSnapshot = client.toObject();
    await logAuditEvent(document, 'CLIENT_CHANGED', `Changed client to ${client.clientName}`, userId);
  }

  // Refresh business snapshot to make sure it is updated
  document.businessSnapshot = business.toObject();

  // Run calculation
  const calculations = calculateDocumentTotals(data, business.address?.stateCode || 'DL');

  if (document.documentType === 'CREDIT_NOTE' && (data.linkedInvoiceId || document.linkedInvoiceId)) {
    const targetInvoiceId = data.linkedInvoiceId || document.linkedInvoiceId;
    const originalInvoice = await SalesDocument.findOne({ _id: targetInvoiceId, businessId: business._id, documentType: 'INVOICE' });
    if (originalInvoice) {
      const previousCNs = await SalesDocument.find({
        _id: { $ne: document._id },
        businessId: business._id,
        documentType: 'CREDIT_NOTE',
        linkedInvoiceId: targetInvoiceId,
        status: { $ne: 'CANCELLED' }
      });
      const totalPrevious = previousCNs.reduce((sum, cn) => sum + cn.grandTotal, 0);
      const remaining = originalInvoice.grandTotal - totalPrevious;
      if (calculations.grandTotal > remaining) {
        throw ApiError.badRequest(`Credit Note total ₹${calculations.grandTotal.toLocaleString('en-IN')} exceeds remaining creditable amount of ₹${remaining.toLocaleString('en-IN')} for Invoice ${originalInvoice.documentNumber}`);
      }
    }
  }

  // Update fields
  const allowedFields = [
    'poNumber', 'issueDate', 'validTill', 'placeOfSupply', 'items',
    'documentDiscountType', 'documentDiscountValue', 'additionalCharges',
    'terms', 'notes', 'customFields', 'signatoryName', 'displayOptions', 'status',
    'title', 'subtitle', 'shippingDetails', 'gstConfiguration', 'columnVisibility',
    'columnOrder', 'totalCustomFields', 'signature', 'attachments', 'additionalInfo',
    'contactDetails', 'recurrence', 'bankDetails', 'upiDetails', 'settings', 'onlinePayment'
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      document[field] = data[field];
    }
  }

  // Merge calculations
  Object.assign(document, calculations);
  document.balanceDue = Math.max(0, document.grandTotal - (document.amountPaid || 0));
  if (document.documentType === 'CREDIT_NOTE') {
    if (document.status === 'DRAFT') {
      document.availableCreditAmount = 0;
    } else {
      document.availableCreditAmount = Math.max(0, document.grandTotal - (document.settledCreditAmount || 0));
    }
  }
  document.updatedBy = userId;

  await logAuditEvent(document, 'UPDATED', 'Updated document details', userId);
  await document.save();
  return document.toObject();
};

/**
 * Update document status
 */
const updateDocumentStatus = async (id, userId, status) => {
  const business = await BusinessProfile.findOne({ userId });
  if (!business) {
    throw ApiError.badRequest('Business profile not found.');
  }

  const document = await SalesDocument.findOne({ _id: id, businessId: business._id });
  if (!document) {
    throw ApiError.notFound('Document not found.');
  }

  // Validate status transition
  const allowedTransitions = {
    DRAFT: ['ISSUED', 'SENT', 'CANCELLED'],
    ISSUED: ['SENT', 'VIEWED', 'CANCELLED', 'PARTIALLY_SETTLED', 'SETTLED'],
    SENT: ['VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED', 'CANCELLED'],
    VIEWED: ['ACCEPTED', 'REJECTED', 'CONVERTED', 'CANCELLED'],
    ACCEPTED: ['CONVERTED', 'CANCELLED'],
    REJECTED: ['CANCELLED'],
    EXPIRED: ['CANCELLED'],
    CONVERTED: [],
    OVERDUE: ['CANCELLED'],
    PARTIALLY_SETTLED: ['SETTLED', 'CANCELLED'],
    SETTLED: ['CANCELLED'],
    CANCELLED: [],
  };

  const currentStatus = document.status;
  const allowedNext = allowedTransitions[currentStatus] || [];
  
  if (!allowedNext.includes(status)) {
    throw ApiError.badRequest(`Invalid status transition from ${currentStatus} to ${status}.`);
  }

  if (document.documentType === 'CREDIT_NOTE' && status === 'CANCELLED') {
    // Rollback settlements
    const settlements = document.settlementReferences || [];
    for (const settle of settlements) {
      const invoice = await SalesDocument.findOne({
        _id: settle.invoiceId,
        businessId: business._id,
        documentType: 'INVOICE'
      });

      if (invoice) {
        invoice.balanceDue = (invoice.balanceDue || 0) + settle.amount;
        invoice.amountPaid = Math.max(0, (invoice.amountPaid || 0) - settle.amount);
        if (invoice.amountPaid <= 0) {
          invoice.paymentStatus = 'UNPAID';
        } else {
          invoice.paymentStatus = 'PARTIALLY_PAID';
        }
        invoice.linkedDocuments = (invoice.linkedDocuments || []).filter(
          (ld) => ld.documentNumber !== document.documentNumber
        );
        invoice.auditTrail.push({
          action: 'CREDIT_CANCELLED',
          description: `Credit note ${document.documentNumber} cancelled. Outstanding balance restored.`,
          userId,
          userName: business.businessName,
          timestamp: new Date()
        });
        await invoice.save();
      }
    }
    document.settledCreditAmount = 0;
    document.availableCreditAmount = document.grandTotal;
    document.settlementReferences = [];
  }

  document.status = status;
  if (document.documentType === 'CREDIT_NOTE') {
    if (status === 'DRAFT') {
      document.availableCreditAmount = 0;
    } else {
      document.availableCreditAmount = Math.max(0, document.grandTotal - (document.settledCreditAmount || 0));
    }
  }
  document.updatedBy = userId;
  
  document.acceptanceHistory = document.acceptanceHistory || [];
  document.acceptanceHistory.push({
    status,
    timestamp: new Date(),
    actorType: 'BUSINESS',
    actorName: 'Business Owner',
    notes: `Manually set status to ${status}`
  });

  await logAuditEvent(document, 'STATUS_CHANGED', `Changed document status from ${currentStatus} to ${status}`, userId);
  await document.save();

  return document.toObject();
};

/**
 * Duplicate an existing document
 */
const duplicateDocument = async (id, userId) => {
  const business = await BusinessProfile.findOne({ userId });
  if (!business) throw ApiError.badRequest('Business profile not found.');

  const original = await SalesDocument.findOne({ _id: id, businessId: business._id });
  if (!original) throw ApiError.notFound('Original document not found.');

  const docNum = await generateDocumentNumber(business._id, original.documentType);
  const duplicatedData = original.toObject();

  delete duplicatedData._id;
  delete duplicatedData.createdAt;
  delete duplicatedData.updatedAt;
  duplicatedData.documentNumber = docNum;
  duplicatedData.status = 'DRAFT';
  duplicatedData.payments = [];
  duplicatedData.amountPaid = 0;
  duplicatedData.balanceDue = duplicatedData.grandTotal;
  duplicatedData.paymentStatus = 'UNPAID';
  duplicatedData.createdBy = userId;
  duplicatedData.auditTrail = [];
  duplicatedData.acceptanceHistory = [];
  duplicatedData.linkedDocuments = [];

  const duplicated = await SalesDocument.create(duplicatedData);
  await logAuditEvent(duplicated, 'CREATED', `Duplicated from ${original.documentType} ${original.documentNumber}`, userId);
  await duplicated.save();

  return duplicated.toObject();
};

/**
 * Convert document to another type (e.g. Quotation to Proforma Invoice)
 */
const convertDocument = async (id, userId, targetType) => {
  const business = await BusinessProfile.findOne({ userId });
  if (!business) throw ApiError.badRequest('Business profile not found.');

  const sourceDoc = await SalesDocument.findOne({ _id: id, businessId: business._id });
  if (!sourceDoc) throw ApiError.notFound('Source document not found.');

  const allowedConversions = {
    QUOTATION: ['PROFORMA_INVOICE', 'INVOICE', 'SALES_ORDER'],
    PROFORMA_INVOICE: ['INVOICE', 'SALES_ORDER', 'DELIVERY_CHALLAN'],
    SALES_ORDER: ['INVOICE', 'DELIVERY_CHALLAN'],
    DELIVERY_CHALLAN: ['INVOICE'],
  };
  const allowed = allowedConversions[sourceDoc.documentType] || [];
  if (!allowed.includes(targetType)) {
    throw ApiError.badRequest(`Cannot convert ${sourceDoc.documentType} to ${targetType}`);
  }

  const docNum = await generateDocumentNumber(business._id, targetType);
  const convertedData = sourceDoc.toObject();

  delete convertedData._id;
  delete convertedData.createdAt;
  delete convertedData.updatedAt;
  convertedData.documentType = targetType;
  convertedData.documentNumber = docNum;
  convertedData.status = 'DRAFT';
  convertedData.payments = [];
  convertedData.amountPaid = 0;
  convertedData.balanceDue = convertedData.grandTotal;
  convertedData.paymentStatus = 'UNPAID';
  convertedData.createdBy = userId;
  convertedData.auditTrail = [];
  convertedData.acceptanceHistory = [];
  convertedData.linkedDocuments = [];

  // Title override default update
  if (targetType === 'PROFORMA_INVOICE') {
    convertedData.title = 'Proforma Invoice';
  } else if (targetType === 'INVOICE') {
    convertedData.title = 'Invoice';
  }

  const converted = await SalesDocument.create(convertedData);
  
  // Establish links in both documents
  sourceDoc.linkedDocuments = sourceDoc.linkedDocuments || [];
  sourceDoc.linkedDocuments.push({
    documentId: converted._id,
    documentType: targetType,
    documentNumber: docNum,
    relationType: 'CONVERTED_TO'
  });
  sourceDoc.status = 'CONVERTED';
  await logAuditEvent(sourceDoc, 'STATUS_CHANGED', `Converted to ${targetType} ${docNum}`, userId);
  await sourceDoc.save();

  converted.linkedDocuments = converted.linkedDocuments || [];
  converted.linkedDocuments.push({
    documentId: sourceDoc._id,
    documentType: sourceDoc.documentType,
    documentNumber: sourceDoc.documentNumber,
    relationType: 'SOURCE'
  });
  await logAuditEvent(converted, 'CREATED', `Converted from ${sourceDoc.documentType} ${sourceDoc.documentNumber}`, userId);
  await converted.save();

  return converted.toObject();
};

/**
 * Record a payment for the document
 */
const recordPayment = async (id, userId, paymentDetails) => {
  const business = await BusinessProfile.findOne({ userId });
  if (!business) throw ApiError.badRequest('Business profile not found.');

  const document = await SalesDocument.findOne({ _id: id, businessId: business._id });
  if (!document) throw ApiError.notFound('Document not found.');

  const amount = parseFloat(paymentDetails.amount);
  if (isNaN(amount) || amount <= 0) {
    throw ApiError.badRequest('Payment amount must be greater than 0.');
  }

  document.payments = document.payments || [];
  document.payments.push({
    amount,
    paymentDate: paymentDetails.paymentDate || new Date(),
    paymentMode: paymentDetails.paymentMode,
    referenceNumber: paymentDetails.referenceNumber || '',
    notes: paymentDetails.notes || ''
  });

  document.amountPaid = (document.amountPaid || 0) + amount;
  document.balanceDue = Math.max(0, document.grandTotal - document.amountPaid);

  if (document.balanceDue === 0) {
    document.paymentStatus = 'PAID';
  } else if (document.amountPaid > 0) {
    document.paymentStatus = 'PARTIALLY_PAID';
  } else {
    document.paymentStatus = 'UNPAID';
  }

  await logAuditEvent(document, 'PAYMENT_RECORDED', `Recorded payment of ₹${amount.toLocaleString('en-IN')} via ${paymentDetails.paymentMode}`, userId);
  await document.save();

  return document.toObject();
};

/**
 * Save customization settings
 */
const updateDocumentSettings = async (id, userId, settingsData) => {
  const business = await BusinessProfile.findOne({ userId });
  if (!business) throw ApiError.badRequest('Business profile not found.');

  const document = await SalesDocument.findOne({ _id: id, businessId: business._id });
  if (!document) throw ApiError.notFound('Document not found.');

  if (settingsData.design) {
    document.settings = document.settings || {};
    document.settings.design = {
      ...(document.settings.design || {}),
      ...settingsData.design
    };
  }
  if (settingsData.advanced) {
    document.settings = document.settings || {};
    document.settings.advanced = {
      ...(document.settings.advanced || {}),
      ...settingsData.advanced
    };
  }

  await logAuditEvent(document, 'DESIGN_CHANGED', 'Updated document customization settings', userId);
  await document.save();

  return document.toObject();
};

/**
 * Generate E-Invoice compliance details
 */
const generateEInvoice = async (id, userId, data) => {
  const business = await BusinessProfile.findOne({ userId });
  if (!business) throw ApiError.badRequest('Business profile not found.');

  const document = await SalesDocument.findOne({ _id: id, businessId: business._id });
  if (!document) throw ApiError.notFound('Document not found.');

  // E-Invoice integration check
  // Since there is no real IRP/GST provider integration configured in this stage:
  throw ApiError.badRequest('E-Invoice provider is not configured. Please complete GST compliance configurations in Settings.');
};

/**
 * Generate E-Way Bill transporter compliance details
 */
const generateEWayBill = async (id, userId, data) => {
  const business = await BusinessProfile.findOne({ userId });
  if (!business) throw ApiError.badRequest('Business profile not found.');

  const document = await SalesDocument.findOne({ _id: id, businessId: business._id });
  if (!document) throw ApiError.notFound('Document not found.');

  // E-Way Bill integration check
  // Since there is no real transporter provider configured:
  throw ApiError.badRequest('E-Way Bill provider is not configured. Please complete transporter configurations in Settings.');
};

/**
 * Get eligible Invoices for settlement (client matching, unpaid/partially paid)
 */
const getEligibleInvoices = async (userId, clientId) => {
  const business = await BusinessProfile.findOne({ userId });
  if (!business) throw ApiError.badRequest('Business profile not found.');

  const query = {
    businessId: business._id,
    clientId,
    documentType: 'INVOICE',
    status: { $in: ['ISSUED', 'SENT', 'VIEWED', 'ACCEPTED', 'OVERDUE', 'PARTIALLY_SETTLED'] },
    balanceDue: { $gt: 0 }
  };

  const invoices = await SalesDocument.find(query).sort({ createdAt: 1 });
  return invoices;
};

/**
 * Settle Credit Note amount across Invoices atomically
 */
const settleCredit = async (id, userId, settlements) => {
  const business = await BusinessProfile.findOne({ userId });
  if (!business) throw ApiError.badRequest('Business profile not found.');

  const creditNote = await SalesDocument.findOne({ _id: id, businessId: business._id, documentType: 'CREDIT_NOTE' });
  if (!creditNote) throw ApiError.notFound('Credit Note not found.');

  if (creditNote.status === 'DRAFT' || creditNote.status === 'CANCELLED') {
    throw ApiError.badRequest('Cannot settle DRAFT or CANCELLED Credit Notes.');
  }

  let available = creditNote.availableCreditAmount ?? creditNote.grandTotal;

  for (const settle of settlements) {
    const amt = parseFloat(settle.amount) || 0;
    if (amt <= 0) continue;

    if (amt > available) {
      throw ApiError.badRequest(`Requested allocation ₹${amt} exceeds available Credit Note balance of ₹${available}`);
    }

    const invoice = await SalesDocument.findOne({ _id: settle.invoiceId, businessId: business._id, documentType: 'INVOICE' });
    if (!invoice) throw ApiError.notFound(`Invoice not found.`);

    const outstanding = invoice.balanceDue ?? invoice.grandTotal;
    if (amt > outstanding) {
      throw ApiError.badRequest(`Requested settlement ₹${amt} exceeds outstanding balance of ₹${outstanding} for Invoice ${invoice.documentNumber}`);
    }

    invoice.balanceDue = Math.max(0, outstanding - amt);
    invoice.amountPaid = (invoice.amountPaid || 0) + amt;
    if (invoice.balanceDue <= 0) {
      invoice.paymentStatus = 'PAID';
    } else {
      invoice.paymentStatus = 'PARTIALLY_PAID';
    }

    invoice.linkedDocuments = invoice.linkedDocuments || [];
    invoice.linkedDocuments.push({
      documentId: creditNote._id,
      documentType: 'CREDIT_NOTE',
      documentNumber: creditNote.documentNumber,
      relationType: 'CREDIT_SETTLEMENT'
    });

    invoice.auditTrail.push({
      action: 'CREDIT_APPLIED',
      description: `Applied credit of ₹${amt.toLocaleString('en-IN')} from Credit Note ${creditNote.documentNumber}`,
      userId,
      userName: business.businessName,
      timestamp: new Date()
    });

    await invoice.save();

    creditNote.linkedDocuments = creditNote.linkedDocuments || [];
    creditNote.linkedDocuments.push({
      documentId: invoice._id,
      documentType: 'INVOICE',
      documentNumber: invoice.documentNumber,
      relationType: 'CREDIT_SETTLEMENT'
    });

    creditNote.settlementReferences = creditNote.settlementReferences || [];
    creditNote.settlementReferences.push({
      invoiceId: invoice._id,
      invoiceNumberSnapshot: invoice.documentNumber,
      amount: amt
    });

    creditNote.settledCreditAmount = (creditNote.settledCreditAmount || 0) + amt;
    available -= amt;
  }

  creditNote.availableCreditAmount = available;
  if (available <= 0) {
    creditNote.status = 'SETTLED';
  } else {
    creditNote.status = 'PARTIALLY_SETTLED';
  }

  creditNote.auditTrail.push({
    action: 'CREDIT_SETTLED',
    description: `Settled Credit Note value across selected invoices. Remaining available: ₹${available.toLocaleString('en-IN')}`,
    userId,
    userName: business.businessName,
    timestamp: new Date()
  });

  await creditNote.save();
  return creditNote;
};

module.exports = {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  updateDocumentStatus,
  calculateDocumentTotals,
  duplicateDocument,
  convertDocument,
  recordPayment,
  updateDocumentSettings,
  generateEInvoice,
  generateEWayBill,
  getEligibleInvoices,
  settleCredit,
};
