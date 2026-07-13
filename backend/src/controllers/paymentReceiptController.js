const asyncHandler = require('../middleware/asyncHandler');
const paymentReceiptService = require('../services/paymentReceiptService');
const BusinessProfile = require('../models/BusinessProfile');
const ApiError = require('../utils/ApiError');

const getPaymentReceipts = asyncHandler(async (req, res) => {
  const business = await BusinessProfile.findOne({ userId: req.user.id });
  if (!business) {
    throw ApiError.badRequest('Business profile not found.');
  }
  const result = await paymentReceiptService.getPaymentReceipts(business._id, req.query);
  res.status(200).json({
    success: true,
    data: result
  });
});

const getPaymentReceiptById = asyncHandler(async (req, res) => {
  const business = await BusinessProfile.findOne({ userId: req.user.id });
  if (!business) {
    throw ApiError.badRequest('Business profile not found.');
  }
  const receipt = await paymentReceiptService.getPaymentReceiptById(req.params.id, business._id);
  res.status(200).json({
    success: true,
    data: receipt
  });
});

const getNextReceiptNumber = asyncHandler(async (req, res) => {
  const business = await BusinessProfile.findOne({ userId: req.user.id });
  if (!business) {
    throw ApiError.badRequest('Business profile not found.');
  }
  const number = await paymentReceiptService.getNextReceiptNumber(business._id);
  res.status(200).json({
    success: true,
    data: number
  });
});

const getUnpaidInvoices = asyncHandler(async (req, res) => {
  const business = await BusinessProfile.findOne({ userId: req.user.id });
  if (!business) {
    throw ApiError.badRequest('Business profile not found.');
  }
  const invoices = await paymentReceiptService.getUnpaidInvoices(business._id, req.query.clientId);
  res.status(200).json({
    success: true,
    data: invoices
  });
});

const createPaymentReceipt = asyncHandler(async (req, res) => {
  const receipt = await paymentReceiptService.createPaymentReceipt(req.user.id, req.body);
  res.status(201).json({
    success: true,
    message: 'Payment Receipt saved successfully',
    data: receipt
  });
});

const cancelPaymentReceipt = asyncHandler(async (req, res) => {
  const business = await BusinessProfile.findOne({ userId: req.user.id });
  if (!business) {
    throw ApiError.badRequest('Business profile not found.');
  }
  const receipt = await paymentReceiptService.cancelPaymentReceipt(req.params.id, business._id, req.user.id);
  res.status(200).json({
    success: true,
    message: 'Payment Receipt cancelled successfully',
    data: receipt
  });
});

const deletePaymentReceipt = asyncHandler(async (req, res) => {
  const business = await BusinessProfile.findOne({ userId: req.user.id });
  if (!business) {
    throw ApiError.badRequest('Business profile not found.');
  }
  await paymentReceiptService.deletePaymentReceipt(req.params.id, business._id);
  res.status(200).json({
    success: true,
    message: 'Draft Payment Receipt deleted successfully'
  });
});

module.exports = {
  getPaymentReceipts,
  getPaymentReceiptById,
  getNextReceiptNumber,
  getUnpaidInvoices,
  createPaymentReceipt,
  cancelPaymentReceipt,
  deletePaymentReceipt
};
