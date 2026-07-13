const mongoose = require('mongoose');
const { CLIENT_TYPES, CLIENT_STATUS } = require('../utils/constants');

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

const clientSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessProfile',
      required: true,
      index: true,
    },
    clientType: {
      type: String,
      enum: Object.values(CLIENT_TYPES),
      required: [true, 'Client type is required'],
    },
    businessName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    clientName: {
      type: String,
      required: [true, 'Client name is required'],
      trim: true,
      maxlength: 200,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    gstin: { type: String, trim: true, uppercase: true },
    pan: { type: String, trim: true, uppercase: true },

    billingAddress: { type: addressSchema, default: () => ({}) },
    shippingAddress: { type: addressSchema, default: () => ({}) },

    openingBalance: { type: Number, default: 0 },
    notes: { type: String, trim: true },

    status: {
      type: String,
      enum: Object.values(CLIENT_STATUS),
      default: CLIENT_STATUS.ACTIVE,
    },

    // ── Soft delete ──────────────────────────────────────────────
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ── Audit ────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────
clientSchema.index({ businessId: 1, status: 1 });
clientSchema.index({ businessId: 1, isDeleted: 1 });
clientSchema.index(
  { businessId: 1, email: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      email: { $type: 'string', $ne: '' },
      isDeleted: false,
    },
  }
);
// Text index for search
clientSchema.index({
  clientName: 'text',
  businessName: 'text',
  email: 'text',
  phone: 'text',
});

module.exports = mongoose.model('Client', clientSchema);
