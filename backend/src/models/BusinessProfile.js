const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    stateCode: { type: String, trim: true, uppercase: true },
    country: { type: String, trim: true, default: 'India' },
    pincode: { type: String, trim: true },
  },
  { _id: false }
);

const businessProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // one business per user in Phase 1
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      maxlength: 200,
    },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
    pan: { type: String, trim: true, uppercase: true },
    address: { type: addressSchema, default: () => ({}) },
    logoUrl: { type: String },

    // Bank details
    bankName: { type: String, trim: true },
    accountName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifsc: { type: String, trim: true, uppercase: true },
    branchName: { type: String, trim: true },
    upiId: { type: String, trim: true },

    // Business Defaults
    defaultTerms: { type: String, default: '' },
    defaultNotes: { type: String, default: '' },
    defaultFooter: { type: String, default: '' },

    // Signature & QR
    signatureUrl: { type: String },
    qrCodeUrl: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BusinessProfile', businessProfileSchema);
