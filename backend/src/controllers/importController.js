const importService = require('../services/importService');
const ImportHistory = require('../models/ImportHistory');
const BusinessProfile = require('../models/BusinessProfile');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');

/**
 * POST /api/imports/upload
 */
const uploadAndPreview = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('Please upload an Excel or CSV file.');
  }

  const originalname = req.file.originalname;
  const allowedExtensions = ['.xlsx', '.xls', '.csv'];
  const ext = originalname.substring(originalname.lastIndexOf('.')).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw ApiError.badRequest('Invalid file format. Only .xlsx, .xls, and .csv are allowed.');
  }

  const { sheetName } = req.body;
  const result = importService.parseExcel(req.file.buffer, sheetName);
  
  // Get auto-detected mappings based on parsed headers
  const autoMapping = importService.autoMapColumns(result.headers);

  res.json({
    success: true,
    data: {
      originalFileName: req.file.originalname,
      sheetNames: result.sheetNames,
      currentSheet: result.currentSheet,
      headers: result.headers,
      autoMapping,
      previewRows: result.rows.slice(0, 20),
      totalRows: result.rows.length,
      fullRows: result.rows, // Return full rows so frontend can send it back to validation/confirm
    }
  });
});

/**
 * POST /api/imports/validate
 */
const validateImport = asyncHandler(async (req, res) => {
  const { importType, rows, columnMapping, clientResolutions = {} } = req.body;
  
  if (!importType || !rows || !columnMapping) {
    throw ApiError.badRequest('importType, rows, and columnMapping are required.');
  }

  const business = await BusinessProfile.findOne({ userId: req.user._id });
  if (!business) {
    throw ApiError.badRequest('Please complete your Business Profile first.');
  }

  const result = await importService.validateImport(business._id, importType, rows, columnMapping, clientResolutions);
  
  res.json({
    success: true,
    data: result
  });
});

/**
 * POST /api/imports/confirm
 */
const confirmImport = asyncHandler(async (req, res) => {
  const { importType, rows, columnMapping, duplicatePolicy = 'SKIP', calculatePolicy = 'SYSTEM', clientResolutions = {}, autoCreateClients = false } = req.body;

  if (!importType || !rows || !columnMapping) {
    throw ApiError.badRequest('importType, rows, and columnMapping are required.');
  }

  const business = await BusinessProfile.findOne({ userId: req.user._id });
  if (!business) {
    throw ApiError.badRequest('Please complete your Business Profile first.');
  }

  const result = await importService.executeImport(
    business._id,
    req.user._id,
    importType,
    rows,
    columnMapping,
    duplicatePolicy,
    calculatePolicy,
    clientResolutions,
    autoCreateClients
  );

  res.json({
    success: true,
    message: 'Import executed successfully.',
    data: result
  });
});

/**
 * GET /api/imports/history
 */
const getHistory = asyncHandler(async (req, res) => {
  const business = await BusinessProfile.findOne({ userId: req.user._id });
  if (!business) {
    return res.json({ success: true, data: [] });
  }

  const history = await ImportHistory.find({ businessId: business._id })
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: history
  });
});

/**
 * GET /api/imports/template/:type
 */
const downloadTemplate = asyncHandler(async (req, res) => {
  const { type } = req.params;
  
  let headers = '';
  let filename = 'template.csv';

  if (type === 'CLIENT') {
    headers = 'Client Name,Company Name,Email,Phone,GSTIN,Address Line 1,City,State,Pincode,Country\n';
    headers += 'Test Client,Test Company Pvt Ltd,client@test.com,9876543210,29AAAAA0000A1Z5,123 Main St,Bengaluru,Karnataka,560001,India\n';
    filename = 'clients_template.csv';
  } else if (['QUOTATION', 'PROFORMA_INVOICE', 'INVOICE', 'SALES_ORDER', 'DELIVERY_CHALLAN', 'CREDIT_NOTE'].includes(type)) {
    headers = 'Document Number,Client Name,Issue Date,Valid Till,PO Number,Item Name,Item Details,HSN/SAC,GST Rate,Quantity,Rate,Grand Total\n';
    headers += 'INV-0099,Test Client,2026-07-14,2026-07-29,PO-777,Camera,2K HD Sensor,8525,18,2,1500,3540\n';
    headers += 'INV-0099,Test Client,2026-07-14,2026-07-29,PO-777,Cable,5m Cat6,8544,18,5,200,3540\n';
    filename = `${type.toLowerCase()}_template.csv`;
  } else if (type === 'PAYMENT_RECEIPT') {
    headers = 'Document Number,Client Name,Issue Date,Grand Total,Payment Method,Reference Number,Notes\n';
    headers += 'REC-0012,Test Client,2026-07-14,3540,UPI,TXN-998877,Payment for INV-0099\n';
    filename = 'payment_receipts_template.csv';
  } else {
    throw ApiError.badRequest('Invalid template type.');
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.status(200).send(headers);
});

module.exports = {
  uploadAndPreview,
  validateImport,
  confirmImport,
  getHistory,
  downloadTemplate,
};
