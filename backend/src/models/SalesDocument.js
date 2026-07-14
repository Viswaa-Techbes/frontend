const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  description: { type: String, default: '' },
  hsnSac: { type: String, default: '' },
  gstRate: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 },
  unit: { type: String, default: 'PCS' },
  rate: { type: Number, default: 0 },
  discountType: { type: String, enum: ['NONE', 'PERCENTAGE', 'FIXED'], default: 'NONE' },
  discountValue: { type: Number, default: 0 },
  baseAmount: { type: Number, default: 0 },
  itemDiscountAmount: { type: Number, default: 0 },
  taxableAmount: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
}, { _id: false });

const additionalChargeSchema = new mongoose.Schema({
  chargeName: { type: String, required: true },
  amount: { type: Number, default: 0 },
  isTaxable: { type: Boolean, default: false },
  gstRate: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
}, { _id: false });

const customFieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  value: { type: String, required: true },
}, { _id: false });

const salesDocumentSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessProfile',
      required: true,
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      enum: ['QUOTATION', 'PROFORMA_INVOICE', 'INVOICE', 'SALES_ORDER', 'DELIVERY_CHALLAN', 'CREDIT_NOTE'],
      required: true,
      index: true,
    },
    documentNumber: {
      type: String,
      required: true,
      index: true,
    },
    poNumber: { type: String, default: '' },
    issueDate: { type: Date, required: true },
    validTill: { type: Date },
    
    // Snapshots
    clientSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    businessSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },

    currency: { type: String, default: 'INR' },
    placeOfSupply: {
      state: { type: String, required: true },
      stateCode: { type: String, required: true },
    },
    gstMode: {
      type: String,
      enum: ['INTRA_STATE', 'INTER_STATE'],
      required: true,
    },

    // Lines & charges
    items: [itemSchema],
    documentDiscountType: { type: String, enum: ['NONE', 'PERCENTAGE', 'FIXED'], default: 'NONE' },
    documentDiscountValue: { type: Number, default: 0 },
    documentDiscountAmount: { type: Number, default: 0 },
    additionalCharges: [additionalChargeSchema],

    // Calculations
    subtotal: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    additionalChargesTotal: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    grandTotalInWords: { type: String, default: '' },

    // Clauses & Meta
    terms: { type: String, default: '' },
    notes: { type: String, default: '' },
    customFields: [customFieldSchema],
    signatoryName: { type: String, default: '' },

    title: { type: String, default: 'Proforma Invoice' },
    subtitle: { type: String, default: '' },
    shippingDetails: {
      addressLine1: { type: String, trim: true },
      addressLine2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      stateCode: { type: String, trim: true, uppercase: true },
      country: { type: String, trim: true, default: 'India' },
      pincode: { type: String, trim: true },
    },
    gstConfiguration: {
      gstEnabled: { type: Boolean, default: true },
      placeOfSupply: {
        state: { type: String },
        stateCode: { type: String, uppercase: true },
      },
      reverseCharge: { type: Boolean, default: false },
      taxType: { type: String, default: 'Auto' },
    },
    columnVisibility: { type: Map, of: Boolean, default: () => new Map() },
    columnOrder: [String],
    totalCustomFields: [customFieldSchema],
    signature: {
      signatureUrl: { type: String },
      signatoryName: { type: String },
      designation: { type: String },
    },
    attachments: [{
      fileName: { type: String },
      fileUrl: { type: String },
      mimeType: { type: String },
      fileSize: { type: Number },
    }],
    additionalInfo: [customFieldSchema],
    contactDetails: {
      name: { type: String },
      phone: { type: String },
      email: { type: String },
    },
    recurrence: {
      isRecurring: { type: Boolean, default: false },
      frequency: { type: String },
      startDate: { type: Date },
      endDate: { type: Date },
      nextGenerationDate: { type: Date },
      customInterval: { type: Number },
      customUnit: { type: String },
    },
    bankDetails: {
      accountHolderName: { type: String },
      bankName: { type: String },
      accountNumber: { type: String },
      ifsc: { type: String, uppercase: true },
      branchName: { type: String },
      accountType: { type: String },
    },
    upiDetails: {
      upiId: { type: String },
      displayName: { type: String },
    },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number },
    paymentStatus: { type: String, enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'], default: 'UNPAID' },
    payments: [{
      amount: { type: Number },
      paymentDate: { type: Date, default: Date.now },
      paymentMode: { type: String },
      referenceNumber: { type: String },
      notes: { type: String },
    }],
    settings: {
      design: {
        templateId: { type: String, default: 'Professional' },
        primaryColor: { type: String, default: '#2563eb' },
        fontFamily: { type: String, default: 'Inter' },
        fontScale: { type: String, default: 'Medium' },
        headerAlignment: { type: String, default: 'Left' },
        logoPosition: { type: String, default: 'Left' },
        tableStyle: { type: String, default: 'Standard' },
        borderStyle: { type: String, default: 'Horizontal' }
      },
      advanced: {
        hsnColumnView: { type: String, default: 'Default' },
        unitDisplay: { type: String, default: 'Separate column' },
        taxSummaryDisplay: { type: String, default: 'Summary' },
        hidePlaceOfSupply: { type: Boolean, default: false },
        showHSNSummary: { type: Boolean, default: false },
        showOriginalItemImages: { type: Boolean, default: false },
        showThumbnailColumn: { type: Boolean, default: false },
        showFullWidthDescription: { type: Boolean, default: false },
        hideGroupSubtotal: { type: Boolean, default: false },
        showSKU: { type: Boolean, default: false },
        showSerialNumbers: { type: Boolean, default: false },
        showBatchDetails: { type: Boolean, default: false }
      }
    },
    acceptanceHistory: [{
      status: { type: String },
      timestamp: { type: Date, default: Date.now },
      actorType: { type: String },
      actorName: { type: String },
      actorEmail: { type: String },
      ipAddress: { type: String },
      userAgent: { type: String },
      notes: { type: String },
    }],
    auditTrail: [{
      action: { type: String },
      description: { type: String },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      userName: { type: String },
      timestamp: { type: Date, default: Date.now },
      metadata: { type: mongoose.Schema.Types.Mixed },
    }],
    linkedDocuments: [{
      documentId: { type: mongoose.Schema.Types.ObjectId },
      documentType: { type: String },
      documentNumber: { type: String },
      relationType: { type: String },
    }],
    onlinePayment: {
      enabled: { type: Boolean, default: false },
      paymentLink: { type: String },
      showPayNowButton: { type: Boolean, default: false },
      allowPartialPayment: { type: Boolean, default: false },
    },
    approvalHistory: [{
      status: { type: String },
      approvedBy: { type: String },
      approvedAt: { type: Date },
      comments: { type: String },
    }],

    linkedContactId: { type: mongoose.Schema.Types.ObjectId },
    linkedContactSnapshot: { type: mongoose.Schema.Types.Mixed },
    eInvoice: {
      provider: { type: String },
      requestId: { type: String },
      IRN: { type: String },
      AckNo: { type: String },
      AckDate: { type: Date },
      SignedQRCode: { type: String },
      SignedInvoice: { type: String },
      status: { type: String },
      generatedAt: { type: Date },
      cancelledAt: { type: Date },
    },
    eWayBill: {
      ewbNumber: { type: String },
      ewbDate: { type: Date },
      validUntil: { type: Date },
      provider: { type: String },
      status: { type: String },
    },
    journalReference: { type: String },
    linkedLeadId: { type: mongoose.Schema.Types.ObjectId },
    linkedInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesDocument' },
    linkedInvoiceSnapshot: { type: mongoose.Schema.Types.Mixed },
    reason: { type: String },
    reasonDetails: { type: String },
    settledCreditAmount: { type: Number, default: 0 },
    availableCreditAmount: { type: Number, default: 0 },
    settlementReferences: [{
      invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesDocument' },
      invoiceNumberSnapshot: { type: String },
      amount: { type: Number }
    }],

    displayOptions: {
      showHsnSac: { type: Boolean, default: true },
      showTaxSummary: { type: Boolean, default: true },
      showItemDescriptions: { type: Boolean, default: true },
      showTotalQuantity: { type: Boolean, default: true },
    },

    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED', 'OVERDUE', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },

    // Audit
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Indexes
salesDocumentSchema.index({ businessId: 1, documentType: 1, createdAt: -1 });
salesDocumentSchema.index({ businessId: 1, documentType: 1, documentNumber: 1 }, { unique: true });

module.exports = mongoose.model('SalesDocument', salesDocumentSchema);
