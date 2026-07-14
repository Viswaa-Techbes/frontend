const documentService = require('../services/documentService');
const asyncHandler = require('../middleware/asyncHandler');

const createDocument = asyncHandler(async (req, res) => {
  const document = await documentService.createDocument(req.user.id, req.body);
  res.status(201).json({
    success: true,
    message: 'Document created successfully',
    data: document,
  });
});

const getDocuments = asyncHandler(async (req, res) => {
  const data = await documentService.getDocuments(req.user.id, req.query);
  res.status(200).json({
    success: true,
    data,
  });
});

const getDocumentById = asyncHandler(async (req, res) => {
  const document = await documentService.getDocumentById(req.params.id, req.user.id);
  res.status(200).json({
    success: true,
    data: document,
  });
});

const updateDocument = asyncHandler(async (req, res) => {
  const document = await documentService.updateDocument(req.params.id, req.user.id, req.body);
  res.status(200).json({
    success: true,
    message: 'Document updated successfully',
    data: document,
  });
});

const updateDocumentStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required.' });
  }
  const document = await documentService.updateDocumentStatus(req.params.id, req.user.id, status);
  res.status(200).json({
    success: true,
    message: 'Document status updated successfully',
    data: document,
  });
});

const previewCalculations = asyncHandler(async (req, res) => {
  const totals = documentService.calculateDocumentTotals(req.body, req.body.businessStateCode || 'DL');
  res.status(200).json({
    success: true,
    data: totals,
  });
});

const getNextNumber = asyncHandler(async (req, res) => {
  const { type } = req.query;
  if (!type) {
    return res.status(400).json({ success: false, message: 'Document type is required.' });
  }
  const data = await documentService.getNextNumber(req.user.id, type);
  res.status(200).json({
    success: true,
    data,
  });
});

// New handlers for Proforma Invoice & Invoice workflow additions
const duplicateDocument = asyncHandler(async (req, res) => {
  const document = await documentService.duplicateDocument(req.params.id, req.user.id);
  res.status(201).json({
    success: true,
    message: 'Document duplicated successfully',
    data: document,
  });
});

const convertDocument = asyncHandler(async (req, res) => {
  const { targetType } = req.body;
  if (!targetType) {
    return res.status(400).json({ success: false, message: 'Target document type is required.' });
  }
  const document = await documentService.convertDocument(req.params.id, req.user.id, targetType);
  res.status(201).json({
    success: true,
    message: `Document converted to ${targetType} successfully`,
    data: document,
  });
});

const recordPayment = asyncHandler(async (req, res) => {
  const document = await documentService.recordPayment(req.params.id, req.user.id, req.body);
  res.status(200).json({
    success: true,
    message: 'Payment recorded successfully',
    data: document,
  });
});

const updateDocumentSettings = asyncHandler(async (req, res) => {
  const document = await documentService.updateDocumentSettings(req.params.id, req.user.id, req.body);
  res.status(200).json({
    success: true,
    message: 'Settings updated successfully',
    data: document,
  });
});

const getAuditTrail = asyncHandler(async (req, res) => {
  const document = await documentService.getDocumentById(req.params.id, req.user.id);
  res.status(200).json({
    success: true,
    data: document.auditTrail || [],
  });
});

const getAcceptanceHistory = asyncHandler(async (req, res) => {
  const document = await documentService.getDocumentById(req.params.id, req.user.id);
  res.status(200).json({
    success: true,
    data: document.acceptanceHistory || [],
  });
});

const getLinkedDocuments = asyncHandler(async (req, res) => {
  const document = await documentService.getDocumentById(req.params.id, req.user.id);
  res.status(200).json({
    success: true,
    data: document.linkedDocuments || [],
  });
});

const generatePdf = asyncHandler(async (req, res) => {
  // Return the document details and layout structure
  const document = await documentService.getDocumentById(req.params.id, req.user.id);
  res.status(200).json({
    success: true,
    data: document,
  });
});

const generateEInvoice = asyncHandler(async (req, res) => {
  const document = await documentService.generateEInvoice(req.params.id, req.user.id, req.body);
  res.status(200).json({
    success: true,
    message: 'E-Invoice generation requested successfully',
    data: document,
  });
});

const generateEWayBill = asyncHandler(async (req, res) => {
  const document = await documentService.generateEWayBill(req.params.id, req.user.id, req.body);
  res.status(200).json({
    success: true,
    message: 'E-Way Bill generation requested successfully',
    data: document,
  });
});

const getEligibleInvoices = asyncHandler(async (req, res) => {
  const invoices = await documentService.getEligibleInvoices(req.user.id, req.query.clientId);
  res.status(200).json({
    success: true,
    data: invoices
  });
});

const settleCredit = asyncHandler(async (req, res) => {
  const creditNote = await documentService.settleCredit(req.params.id, req.user.id, req.body.settlements || []);
  res.status(200).json({
    success: true,
    message: 'Credit Note settled successfully',
    data: creditNote
  });
});

module.exports = {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  updateDocumentStatus,
  previewCalculations,
  duplicateDocument,
  convertDocument,
  recordPayment,
  updateDocumentSettings,
  getAuditTrail,
  getAcceptanceHistory,
  getLinkedDocuments,
  generatePdf,
  generateEInvoice,
  generateEWayBill,
  getEligibleInvoices,
  settleCredit,
  getNextNumber,
};
