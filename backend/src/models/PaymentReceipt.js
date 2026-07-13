const mongoose = require('mongoose');

const paymentReceiptSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'FINALIZED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessProfile',
      required: true,
      index: true,
    },
    businessSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    clientSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    receiptDate: {
      type: Date,
      required: true,
      index: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    numberFormat: {
      type: String,
      default: 'en-IN',
    },

    paymentRecords: [
      {
        paymentMethod: {
          type: String,
          enum: ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'NEFT', 'RTGS', 'IMPS', 'OTHER'],
          required: true,
        },
        paymentAccountId: {
          type: String,
        },
        paymentAccountSnapshot: {
          type: mongoose.Schema.Types.Mixed,
        },
        paymentLedgerId: {
          type: String,
        },
        amountReceived: {
          type: Number,
          required: true,
        },
        tdsPercentage: {
          type: Number,
          default: 0,
        },
        tdsWithheld: {
          type: Number,
          default: 0,
        },
        transactionCharge: {
          type: Number,
          default: 0,
        },
        grossPayment: {
          type: Number,
          default: 0,
        },
        settleableAmount: {
          type: Number,
          default: 0,
        },
        netDepositedAmount: {
          type: Number,
          default: 0,
        },
        referenceId: {
          type: String,
        },
        notes: {
          type: String,
        },
      },
    ],

    totals: {
      amountReceived: { type: Number, default: 0 },
      tdsWithheld: { type: Number, default: 0 },
      transactionCharges: { type: Number, default: 0 },
      availableForSettlement: { type: Number, default: 0 },
      allocatedToInvoices: { type: Number, default: 0 },
      advancePayment: { type: Number, default: 0 },
    },

    settlements: [
      {
        invoiceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'SalesDocument',
        },
        invoiceNumberSnapshot: { type: String },
        invoiceTotalSnapshot: { type: Number },
        outstandingBefore: { type: Number },
        settlementAmount: { type: Number },
        outstandingAfter: { type: Number },
      },
    ],

    notes: {
      type: String,
    },
    contactDetails: {
      email: { type: String },
      phoneCountryCode: { type: String },
      phoneNumber: { type: String },
    },
    additionalInfo: {
      customFields: [
        {
          label: { type: String },
          value: { type: String },
        },
      ],
    },
    signature: {
      signatureUrl: { type: String },
      label: { type: String, default: 'Authorised Signatory' },
    },
    attachments: [
      {
        name: { type: String },
        url: { type: String },
        mimeType: { type: String },
        size: { type: Number },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    linkedDocuments: [
      {
        documentId: { type: mongoose.Schema.Types.ObjectId },
        documentType: { type: String },
        documentNumber: { type: String },
        relationType: { type: String },
      },
    ],
    auditTrail: [
      {
        action: { type: String },
        description: { type: String },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

paymentReceiptSchema.index({ businessId: 1, receiptNumber: 1 }, { unique: true });

module.exports = mongoose.model('PaymentReceipt', paymentReceiptSchema);
