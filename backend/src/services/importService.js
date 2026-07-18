const xlsx = require('xlsx');
const Client = require('../models/Client');
const SalesDocument = require('../models/SalesDocument');
const PaymentReceipt = require('../models/PaymentReceipt');
const Counter = require('../models/Counter');
const BusinessProfile = require('../models/BusinessProfile');
const ImportHistory = require('../models/ImportHistory');
const Item = require('../models/Item');
const documentService = require('./documentService');

// Column mapping aliases
const ALIASES = {
  clientName: ['client name', 'customer name', 'customer', 'client', 'party name', 'name', 'party'],
  companyName: ['company name', 'company', 'organization', 'org', 'business name', 'business'],
  email: ['email', 'email address', 'mail', 'mail id', 'email id'],
  phone: ['phone', 'mobile', 'mobile number', 'phone number', 'contact', 'contact number'],
  gstin: ['gstin', 'gst', 'gst number', 'tax id', 'gst registration'],
  addressLine1: ['address', 'address line 1', 'billing address', 'street', 'address 1'],
  city: ['city', 'town'],
  state: ['state', 'region'],
  pincode: ['pincode', 'pin', 'zip', 'zipcode', 'pin code'],
  country: ['country'],
  documentNumber: ['invoice number', 'invoice no', 'bill number', 'bill no', 'document number', 'document no', 'quotation number', 'quotation no', 'estimate number', 'estimate no', 'challan number', 'challan no', 'challan', 'order number', 'order no', 'receipt number', 'receipt no', 'receipt', 'credit note number', 'credit note no', 'note number', 'note no', 'no', 'number'],
  issueDate: ['invoice date', 'date', 'issue date', 'billing date', 'date of issue', 'document date', 'challan date', 'order date', 'receipt date'],
  validTill: ['valid till', 'due date', 'expiry date', 'validity', 'valid until'],
  poNumber: ['po number', 'po no', 'po ref', 'purchase order', 'reference'],
  itemName: ['item name', 'item', 'description', 'product name', 'product', 'service', 'item description'],
  description: ['item details', 'long description', 'notes', 'remarks'],
  hsnSac: ['hsn', 'sac', 'hsn/sac', 'hsn code', 'sac code'],
  gstRate: ['gst %', 'gst rate', 'tax %', 'tax rate', 'gst percentage'],
  quantity: ['quantity', 'qty', 'quantity/unit', 'units', 'volume'],
  rate: ['rate', 'price', 'unit price', 'rate (rs)', 'price (rs)'],
  discountType: ['discount type', 'disc type'],
  discountValue: ['discount', 'discount value', 'disc', 'item discount'],
  grandTotal: ['total', 'grand total', 'amount', 'invoice value', 'bill value', 'receipt amount', 'payment amount', 'amount paid', 'paid amount', 'paid'],
  paymentMethod: ['payment method', 'payment mode', 'mode', 'method'],
  referenceNumber: ['reference number', 'transaction id', 'reference no', 'ref no', 'ref number', 'txn id', 'transaction reference', 'ref'],
  reason: ['reason', 'return reason', 'credit reason'],
  sku: ['sku', 'part number', 'item code', 'product code', 'part no', 'item no'],
  category: ['category', 'group', 'type', 'item category', 'product category'],
};

// Normalize string for alias matching
const normalize = (str) => String(str || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ' ');

/**
 * Parses the Excel/CSV file from buffer
 */
const parseExcel = (buffer, sheetName = null) => {
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  const sheetNames = workbook.SheetNames;
  const targetSheet = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
  const worksheet = workbook.Sheets[targetSheet];
  
  // Extract headers
  const headers = [];
  const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1:A1');
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[xlsx.utils.encode_cell({ r: range.s.r, c: C })];
    if (cell && cell.v !== undefined) {
      headers.push(String(cell.v).trim());
    } else {
      headers.push(`Column_${C + 1}`);
    }
  }

  const rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
  return { sheetNames, currentSheet: targetSheet, headers, rows };
};

/**
 * Auto-detect column mapping
 */
const autoMapColumns = (headers) => {
  const mapping = {};
  for (const field of Object.keys(ALIASES)) {
    const aliasList = ALIASES[field];
    const match = headers.find(h => {
      const normH = normalize(h);
      return aliasList.some(alias => normalize(alias) === normH || normH.includes(normalize(alias)));
    });
    if (match) {
      mapping[field] = match;
    }
  }
  return mapping;
};

/**
 * Run non-mutating validation, client matching, and duplicate checks
 */
const validateImport = async (businessId, importType, rows, columnMapping, clientResolutions = {}) => {
  const business = await BusinessProfile.findById(businessId);
  if (!business) throw new Error('Business profile not found');

  const valid = [];
  const warnings = [];
  const errors = [];
  const duplicates = [];

  // Helper: map a raw row to TechBes fields
  const mapRow = (row) => {
    const mapped = {};
    for (const [tbField, excelHeader] of Object.entries(columnMapping)) {
      if (excelHeader && row[excelHeader] !== undefined) {
        mapped[tbField] = row[excelHeader];
      }
    }
    return mapped;
  };

  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/i;

  const findMatchingClient = async (clientName, rawData) => {
    if (!clientName && !rawData.gstin && !rawData.email && !rawData.phone) {
      return { client: null, conflict: false, matchedClients: [] };
    }

    // 1. GSTIN exact match
    if (rawData.gstin) {
      const clients = await Client.find({
        businessId,
        isDeleted: false,
        gstin: rawData.gstin.trim().toUpperCase()
      });
      if (clients.length === 1) return { client: clients[0], conflict: false, matchedClients: clients };
      if (clients.length > 1) return { client: null, conflict: true, matchedClients: clients };
    }

    // 2. Email normalized exact match
    if (rawData.email) {
      const clients = await Client.find({
        businessId,
        isDeleted: false,
        email: rawData.email.trim().toLowerCase()
      });
      if (clients.length === 1) return { client: clients[0], conflict: false, matchedClients: clients };
      if (clients.length > 1) return { client: null, conflict: true, matchedClients: clients };
    }

    // 3. Phone normalized exact match
    if (rawData.phone) {
      const clients = await Client.find({
        businessId,
        isDeleted: false,
        phone: rawData.phone.trim()
      });
      if (clients.length === 1) return { client: clients[0], conflict: false, matchedClients: clients };
      if (clients.length > 1) return { client: null, conflict: true, matchedClients: clients };
    }

    // 4. Client/company name normalized match
    if (clientName) {
      const clients = await Client.find({
        businessId,
        isDeleted: false,
        $or: [
          { clientName: { $regex: new RegExp(`^${clientName.trim()}$`, 'i') } },
          { businessName: { $regex: new RegExp(`^${clientName.trim()}$`, 'i') } }
        ]
      });
      if (clients.length === 1) return { client: clients[0], conflict: false, matchedClients: clients };
      if (clients.length > 1) return { client: null, conflict: true, matchedClients: clients };
    }

    return { client: null, conflict: false, matchedClients: [] };
  };

  if (importType === 'ITEM') {
    for (let idx = 0; idx < rows.length; idx++) {
      const rowNum = idx + 2;
      const rawData = mapRow(rows[idx]);
      
      if (!rawData.itemName) {
        errors.push({ rowNumber: rowNum, status: 'MISSING_ITEM_NAME', message: 'Item Name is required.', data: rawData });
        continue;
      }

      const orConditions = [
        { itemName: { $regex: new RegExp(`^${rawData.itemName.trim()}$`, 'i') } }
      ];

      if (rawData.sku) {
        orConditions.push({ sku: { $regex: new RegExp(`^${rawData.sku.trim()}$`, 'i') } });
      }

      const dupQuery = {
        businessId,
        $or: orConditions
      };

      const existingItem = await Item.findOne(dupQuery);

      if (existingItem) {
        duplicates.push({ rowNumber: rowNum, status: 'DUPLICATE_ITEM', message: `Item already exists: ${existingItem.itemName}`, data: rawData, matchedId: existingItem._id });
      } else {
        valid.push({ rowNumber: rowNum, status: 'VALID', data: rawData });
      }
    }
  } else if (importType === 'CLIENT') {
    for (let idx = 0; idx < rows.length; idx++) {
      const rowNum = idx + 2;
      const rawData = mapRow(rows[idx]);
      
      if (!rawData.clientName) {
        errors.push({ rowNumber: rowNum, status: 'MISSING_CLIENT_NAME', message: 'Client Name is required.', data: rawData });
        continue;
      }

      if (rawData.gstin && !gstRegex.test(rawData.gstin.trim())) {
        errors.push({ rowNumber: rowNum, status: 'INVALID_GSTIN', message: `GSTIN '${rawData.gstin}' is invalid.`, data: rawData });
        continue;
      }

      // Check duplicates
      const dupQuery = { businessId, isDeleted: false };
      const orConditions = [];
      if (rawData.gstin) orConditions.push({ gstin: rawData.gstin.trim().toUpperCase() });
      if (rawData.email) orConditions.push({ email: rawData.email.trim().toLowerCase() });
      if (rawData.phone) orConditions.push({ phone: rawData.phone.trim() });
      orConditions.push({ clientName: { $regex: new RegExp(`^${rawData.clientName.trim()}$`, 'i') } });
      
      dupQuery.$or = orConditions;
      const existingClient = await Client.findOne(dupQuery);

      if (existingClient) {
        duplicates.push({ rowNumber: rowNum, status: 'DUPLICATE_CLIENT', message: `Possible duplicate client matches: ${existingClient.clientName}`, data: rawData, matchedId: existingClient._id });
      } else {
        valid.push({ rowNumber: rowNum, status: 'VALID', data: rawData });
      }
    }
  } else if (importType === 'PAYMENT_RECEIPT') {
    for (let idx = 0; idx < rows.length; idx++) {
      const rowNum = idx + 2;
      const rawData = mapRow(rows[idx]);
      const docNum = String(rawData.documentNumber || '').trim();

      if (!docNum) {
        errors.push({ rowNumber: rowNum, status: 'MISSING_RECEIPT_NUMBER', message: 'Receipt number is required.', data: rawData });
        continue;
      }
      if (!rawData.grandTotal || isNaN(parseFloat(rawData.grandTotal))) {
        errors.push({ rowNumber: rowNum, status: 'INVALID_AMOUNT', message: 'Payment Amount must be a valid number.', data: rawData });
        continue;
      }

      // Check duplicates
      const existingReceipt = await PaymentReceipt.findOne({ businessId, receiptNumber: docNum });
      
      // Match client
      let client = null;
      let conflict = false;
      let matchedClients = [];

      if (clientResolutions && clientResolutions[docNum]) {
        client = await Client.findOne({ businessId, _id: clientResolutions[docNum], isDeleted: false });
      } else {
        const matchRes = await findMatchingClient(rawData.clientName, rawData);
        client = matchRes.client;
        conflict = matchRes.conflict;
        matchedClients = matchRes.matchedClients;
      }

      // Match invoice
      let invoice = null;
      if (rawData.referenceNumber) {
        invoice = await SalesDocument.findOne({
          businessId,
          documentType: 'INVOICE',
          documentNumber: rawData.referenceNumber
        });
      }

      const statusDetails = { rowNumber: rowNum, documentNumber: docNum, data: rawData };
      if (existingReceipt) {
        duplicates.push({ ...statusDetails, status: 'DUPLICATE_RECEIPT', message: `Receipt ${rawData.documentNumber} already exists.` });
      } else if (conflict) {
        errors.push({
          ...statusDetails,
          status: 'CLIENT_MATCH_CONFLICT',
          message: `Multiple matching clients found for '${rawData.clientName}'.`,
          matchedClients: matchedClients.map(c => ({ _id: c._id, clientName: c.clientName, companyName: c.companyName || c.businessName, gstin: c.gstin }))
        });
      } else if (!client) {
        errors.push({ ...statusDetails, status: 'CLIENT_MATCH_CONFLICT', message: `Client '${rawData.clientName}' not found.`, canAutoCreate: true });
      } else {
        if (rawData.referenceNumber && !invoice) {
          warnings.push({ ...statusDetails, status: 'LINKED_INVOICE_NOT_FOUND', message: `Linked invoice ${rawData.referenceNumber} not found in this tenant.`, clientId: client._id });
        } else {
          valid.push({ ...statusDetails, status: 'VALID', clientId: client._id });
        }
      }
    }
  } else {
    // SALES DOCUMENTS (QUOTATION, INVOICE, PROFORMA_INVOICE, SALES_ORDER, DELIVERY_CHALLAN, CREDIT_NOTE)
    // 1. Group rows by documentNumber
    const groups = {};
    for (let idx = 0; idx < rows.length; idx++) {
      const rowNum = idx + 2;
      const rawData = mapRow(rows[idx]);
      const docNum = String(rawData.documentNumber || '').trim();

      if (!docNum) {
        errors.push({ rowNumber: rowNum, status: 'MISSING_DOCUMENT_NUMBER', message: 'Document Number is required.', data: rawData });
        continue;
      }

      if (!groups[docNum]) {
        groups[docNum] = {
          documentNumber: docNum,
          rows: [],
          firstRowNum: rowNum,
        };
      }
      groups[docNum].rows.push(rawData);
    }

    // 2. Validate grouped documents
    for (const [docNum, group] of Object.entries(groups)) {
      const firstRow = group.rows[0];
      const items = [];
      let totalExcelGrandTotal = 0;

      // Group fields check
      let hasConflictingHeaders = false;
      const clientName = firstRow.clientName;
      const issueDate = firstRow.issueDate;

      for (const row of group.rows) {
        if (row.clientName !== clientName || String(row.issueDate) !== String(issueDate)) {
          hasConflictingHeaders = true;
        }

        const qty = parseFloat(row.quantity) ?? 1;
        const rate = parseFloat(row.rate) ?? 0;
        const gstRate = parseFloat(row.gstRate) ?? 0;

        items.push({
          itemName: row.itemName || 'Item Details',
          description: row.description || '',
          hsnSac: row.hsnSac || '',
          gstRate,
          quantity: qty,
          rate,
          unit: 'PCS',
        });

        totalExcelGrandTotal += parseFloat(row.grandTotal) || (qty * rate * (1 + gstRate / 100));
      }

      const statusDetails = {
        rowNumber: group.firstRowNum,
        documentNumber: docNum,
        clientName,
        itemsCount: items.length,
        data: {
          ...firstRow,
          items,
        },
      };

      if (hasConflictingHeaders) {
        errors.push({
          ...statusDetails,
          status: 'VALIDATION_CONFLICT',
          message: `Document ${docNum} rows contain conflicting client details or dates.`,
        });
        continue;
      }

      if (!issueDate || isNaN(Date.parse(issueDate))) {
        errors.push({
          ...statusDetails,
          status: 'INVALID_DATE',
          message: `Issue date '${issueDate}' is invalid.`,
        });
        continue;
      }

      let hasInvalidQty = false;
      let hasInvalidRate = false;
      for (const row of group.rows) {
        const qty = parseFloat(row.quantity);
        const rate = parseFloat(row.rate);
        if (isNaN(qty) || qty < 0) hasInvalidQty = true;
        if (isNaN(rate) || rate < 0) hasInvalidRate = true;
      }

      if (hasInvalidQty) {
        errors.push({ ...statusDetails, status: 'INVALID_QUANTITY', message: `Document contains invalid quantity values.` });
        continue;
      }
      if (hasInvalidRate) {
        errors.push({ ...statusDetails, status: 'INVALID_RATE', message: `Document contains invalid rate values.` });
        continue;
      }

      if (firstRow.gstin && !gstRegex.test(firstRow.gstin.trim())) {
        errors.push({ ...statusDetails, status: 'INVALID_GSTIN', message: `GSTIN '${firstRow.gstin}' is invalid.` });
        continue;
      }

      // Check duplicate document
      const existingDoc = await SalesDocument.findOne({ businessId, documentType: importType, documentNumber: docNum });

      // Match client
      let client = null;
      let conflict = false;
      let matchedClients = [];

      if (clientResolutions && clientResolutions[docNum]) {
        client = await Client.findOne({ businessId, _id: clientResolutions[docNum], isDeleted: false });
      } else {
        const matchRes = await findMatchingClient(clientName, firstRow);
        client = matchRes.client;
        conflict = matchRes.conflict;
        matchedClients = matchRes.matchedClients;
      }

      if (existingDoc) {
        duplicates.push({ ...statusDetails, status: 'DUPLICATE_DOCUMENT', message: `${importType} ${docNum} already exists.` });
      } else if (conflict) {
        errors.push({
          ...statusDetails,
          status: 'CLIENT_MATCH_CONFLICT',
          message: `Multiple matching clients found for '${clientName}'.`,
          matchedClients: matchedClients.map(c => ({ _id: c._id, clientName: c.clientName, companyName: c.companyName || c.businessName, gstin: c.gstin }))
        });
      } else if (!client) {
        errors.push({ ...statusDetails, status: 'CLIENT_MATCH_CONFLICT', message: `Client '${clientName}' not found.`, canAutoCreate: true });
      } else {
        // Run pricing calculation verification
        const calculations = documentService.calculateDocumentTotals({
          items,
          placeOfSupply: client.billingAddress || business.address,
          gstEnabled: true,
        }, business.address?.stateCode || 'DL');

        const calculatedTotal = calculations.grandTotal;
        const excelTotal = parseFloat(firstRow.grandTotal) || totalExcelGrandTotal;

        // Check numbering format conflict
        const counterId = `${businessId.toString()}_${importType}`;
        const counter = await Counter.findById(counterId);
        let numberingFormatConflict = false;
        if (counter && counter.prefix) {
          const match = docNum.match(/(\d+)(?!.*\d)/);
          if (match) {
            const prefix = docNum.substring(0, match.index);
            if (prefix !== counter.prefix) numberingFormatConflict = true;
          } else {
            numberingFormatConflict = true;
          }
        }

        const payload = {
          ...statusDetails,
          clientId: client._id,
          calculatedTotals: calculations,
        };

        if (numberingFormatConflict) {
          warnings.push({
            ...payload,
            status: 'NUMBERING_FORMAT_WARNING',
            message: `Document number format '${docNum}' does not match the active counter prefix '${counter ? counter.prefix : ''}'.`,
          });
        } else if (Math.abs(calculatedTotal - excelTotal) > 1.0) {
          warnings.push({
            ...payload,
            status: 'TOTAL_MISMATCH',
            message: `Grand Total mismatch. Excel: ₹${excelTotal.toFixed(2)}, System: ₹${calculatedTotal.toFixed(2)}`,
          });
        } else {
          valid.push({
            ...payload,
            status: 'VALID',
          });
        }
      }
    }
  }

  return { valid, warnings, errors, duplicates };
};

/**
 * Execute actual batch import to database
 */
const executeImport = async (businessId, userId, importType, rows, columnMapping, duplicatePolicy, calculatePolicy, clientResolutions = {}, autoCreateClients = false) => {
  const business = await BusinessProfile.findById(businessId);
  const businessSnapshot = business.toObject();
  businessSnapshot.logo = business.logoUrl || business.logo;
  businessSnapshot.signature = business.signatureUrl || business.signature;

  const validation = await validateImport(businessId, importType, rows, columnMapping, clientResolutions);
  
  let importedCount = 0;
  let skippedCount = 0;
  let duplicateCount = 0;

  // Combine valid and warnings as importable
  const importableList = [...validation.valid, ...validation.warnings];

  if (duplicatePolicy === 'SKIP') {
    duplicateCount += validation.duplicates.length;
    skippedCount += validation.duplicates.length;
  } else if (duplicatePolicy === 'OVERWRITE') {
    for (const dup of validation.duplicates) {
      if (importType === 'CLIENT') {
        if (dup.matchedId) {
          await Client.deleteOne({ _id: dup.matchedId });
        } else {
          await Client.deleteMany({ businessId, clientName: dup.data.clientName, isDeleted: false });
        }
      } else if (importType === 'ITEM') {
        if (dup.matchedId) {
          await Item.deleteOne({ _id: dup.matchedId });
        } else {
          await Item.deleteMany({ businessId, itemName: dup.data.itemName });
        }
      } else if (importType === 'PAYMENT_RECEIPT') {
        await PaymentReceipt.deleteMany({ businessId, receiptNumber: dup.documentNumber });
      } else {
        await SalesDocument.deleteMany({ businessId, documentType: importType, documentNumber: dup.documentNumber });
      }
    }
    importableList.push(...validation.duplicates);
  }

  if (importType === 'ITEM') {
    for (const rec of importableList) {
      const d = rec.data;
      
      // Parse GST
      let gstRate = 0;
      if (d.gstRate !== undefined) {
        const parsedGst = parseFloat(String(d.gstRate).replace(/%/g, ''));
        if (!isNaN(parsedGst)) {
          gstRate = parsedGst;
        }
      }

      // Parse Rate (sellingPrice)
      let sellingPrice = 0;
      if (d.rate !== undefined) {
        const parsedRate = parseFloat(d.rate);
        if (!isNaN(parsedRate)) {
          sellingPrice = parsedRate;
        }
      }

      await Item.create({
        businessId,
        itemName: d.itemName,
        sku: d.sku || '',
        description: d.description || '',
        hsnSac: d.hsnSac || '',
        gstRate,
        sellingPrice,
        category: d.category || '',
        status: 'ACTIVE',
      });
      importedCount++;
    }
  } else if (importType === 'CLIENT') {
    for (const rec of importableList) {
      const d = rec.data;
      await Client.create({
        businessId,
        clientType: 'BUSINESS',
        clientName: d.clientName,
        companyName: d.companyName || '',
        email: d.email || '',
        phone: d.phone || '',
        gstin: d.gstin || '',
        billingAddress: {
          addressLine1: d.addressLine1 || '',
          city: d.city || '',
          state: d.state || '',
          pincode: d.pincode || '',
          country: d.country || 'India',
        },
        createdBy: userId,
        status: 'ACTIVE',
      });
      importedCount++;
    }
  } else if (importType === 'PAYMENT_RECEIPT') {
    for (const rec of importableList) {
      const d = rec.data;
      
      let client = null;
      if (rec.clientId) {
        client = await Client.findById(rec.clientId);
      }
      
      if (!client && autoCreateClients && d.clientName) {
        client = await Client.create({
          businessId,
          clientType: 'BUSINESS',
          clientName: d.clientName,
          companyName: d.companyName || '',
          email: d.email || '',
          phone: d.phone || '',
          gstin: d.gstin || '',
          billingAddress: {
            addressLine1: d.addressLine1 || '',
            city: d.city || '',
            state: d.state || '',
            pincode: d.pincode || '',
            country: d.country || 'India',
          },
          createdBy: userId,
          status: 'ACTIVE',
        });
      }

      if (!client) continue;

      const clientSnapshot = client.toObject();
      const receiptAmount = parseFloat(d.grandTotal);
      
      const receipt = await PaymentReceipt.create({
        receiptNumber: rec.documentNumber || d.documentNumber,
        businessId,
        businessSnapshot,
        clientId: client._id,
        clientSnapshot,
        receiptDate: d.issueDate ? new Date(d.issueDate) : new Date(),
        paymentRecords: [{
          paymentMethod: d.paymentMethod ? d.paymentMethod.toUpperCase() : 'BANK_TRANSFER',
          amountReceived: receiptAmount,
          referenceId: d.referenceNumber || '',
          notes: d.notes || '',
        }],
        totals: {
          amountReceived: receiptAmount,
          availableForSettlement: receiptAmount,
          allocatedToInvoices: 0,
          advancePayment: receiptAmount,
        },
        status: 'FINALIZED',
        createdBy: userId,
      });

      // Recalculate linked invoice balance
      if (d.referenceNumber) {
        const invoice = await SalesDocument.findOne({
          businessId,
          documentType: 'INVOICE',
          documentNumber: d.referenceNumber,
        });

        if (invoice) {
          const outstanding = invoice.balanceDue ?? invoice.grandTotal;
          const settleAmount = Math.min(outstanding, receiptAmount);

          invoice.amountPaid = (invoice.amountPaid || 0) + settleAmount;
          invoice.balanceDue = Math.max(0, outstanding - settleAmount);
          invoice.paymentStatus = invoice.balanceDue === 0 ? 'PAID' : 'PARTIALLY_PAID';
          
          invoice.linkedDocuments = invoice.linkedDocuments || [];
          invoice.linkedDocuments.push({
            documentId: receipt._id,
            documentType: 'PAYMENT_RECEIPT',
            documentNumber: receipt.receiptNumber,
            relationType: 'PAYMENT_RECEIPT',
          });
          await invoice.save();

          receipt.totals.allocatedToInvoices = settleAmount;
          receipt.totals.advancePayment = receiptAmount - settleAmount;
          receipt.settlements.push({
            invoiceId: invoice._id,
            invoiceNumberSnapshot: invoice.documentNumber,
            invoiceTotalSnapshot: invoice.grandTotal,
            outstandingBefore: outstanding,
            settlementAmount: settleAmount,
            outstandingAfter: invoice.balanceDue,
          });
          await receipt.save();
        }
      }
      importedCount++;
    }
  } else {
    // SALES DOCUMENTS (QUOTATION, INVOICE, PROFORMA_INVOICE, etc.)
    let maxCounterSeq = 0;

    for (const rec of importableList) {
      const d = rec.data;
      
      let client = null;
      if (rec.clientId) {
        client = await Client.findById(rec.clientId);
      }

      if (!client && autoCreateClients && rec.clientName) {
        client = await Client.create({
          businessId,
          clientType: 'BUSINESS',
          clientName: rec.clientName,
          companyName: d.companyName || '',
          email: d.email || '',
          phone: d.phone || '',
          gstin: d.gstin || '',
          billingAddress: {
            addressLine1: d.addressLine1 || '',
            city: d.city || '',
            state: d.state || '',
            pincode: d.pincode || '',
            country: d.country || 'India',
          },
          createdBy: userId,
          status: 'ACTIVE',
        });
      }

      if (!client) continue;

      const clientSnapshot = client.toObject();
      let calcs = rec.calculatedTotals;

      if (calculatePolicy === 'EXCEL') {
        const excelTotal = parseFloat(d.grandTotal) || calcs.grandTotal;
        calcs.grandTotal = excelTotal;
        calcs.balanceDue = excelTotal;
      }

      let linkedInvoice = null;
      if (importType === 'CREDIT_NOTE' && d.linkedInvoiceNumber) {
        linkedInvoice = await SalesDocument.findOne({
          businessId,
          documentType: 'INVOICE',
          documentNumber: d.linkedInvoiceNumber
        });
      }

      const docData = {
        businessId,
        clientId: client._id,
        documentType: importType,
        documentNumber: rec.documentNumber,
        issueDate: d.issueDate ? new Date(d.issueDate) : new Date(),
        validTill: d.validTill ? new Date(d.validTill) : undefined,
        poNumber: d.poNumber || '',
        clientSnapshot,
        businessSnapshot,
        placeOfSupply: {
          state: client.billingAddress?.state || business.address?.state || 'Delhi',
          stateCode: client.billingAddress?.stateCode || business.address?.stateCode || 'DL',
        },
        gstMode: calcs.gstMode || 'INTRA_STATE',
        items: d.items,
        ...calcs,
        status: 'ISSUED',
        createdBy: userId,
        importSource: 'EXCEL',
      };

      if (importType === 'CREDIT_NOTE' && linkedInvoice) {
        docData.linkedInvoiceId = linkedInvoice._id;
        docData.linkedInvoiceSnapshot = linkedInvoice.toObject();
        docData.reason = d.reason || 'Product Return';
        docData.settledCreditAmount = calcs.grandTotal;
        docData.availableCreditAmount = 0;
        docData.settlementReferences = [{
          invoiceId: linkedInvoice._id,
          invoiceNumberSnapshot: linkedInvoice.documentNumber,
          amount: calcs.grandTotal
        }];

        const newBalance = Math.max(0, (linkedInvoice.balanceDue ?? linkedInvoice.grandTotal) - calcs.grandTotal);
        linkedInvoice.balanceDue = newBalance;
        if (newBalance === 0) {
          linkedInvoice.paymentStatus = 'PAID';
        } else if (newBalance < linkedInvoice.grandTotal) {
          linkedInvoice.paymentStatus = 'PARTIALLY_PAID';
        }
        linkedInvoice.linkedDocuments = linkedInvoice.linkedDocuments || [];
        linkedInvoice.linkedDocuments.push({
          documentId: null, // set to createdDoc._id afterwards
          documentType: 'CREDIT_NOTE',
          documentNumber: rec.documentNumber,
          relationType: 'CREDIT_NOTE',
        });
      }

      const createdDoc = await SalesDocument.create(docData);

      if (importType === 'CREDIT_NOTE' && linkedInvoice) {
        const lastLinked = linkedInvoice.linkedDocuments[linkedInvoice.linkedDocuments.length - 1];
        if (lastLinked) lastLinked.documentId = createdDoc._id;
        await linkedInvoice.save();
      }

      // Counter Sync
      const match = rec.documentNumber.match(/(\d+)(?!.*\d)/);
      if (match) {
        const seqVal = parseInt(match[1], 10);
        if (seqVal > maxCounterSeq) {
          maxCounterSeq = seqVal;
        }
      }
      importedCount++;
    }

    // Safely advance counter
    if (maxCounterSeq > 0) {
      const counterId = `${businessId.toString()}_${importType}`;
      const existingCounter = await Counter.findById(counterId);
      if (!existingCounter || existingCounter.seq < maxCounterSeq) {
        await Counter.findByIdAndUpdate(
          counterId,
          { $set: { seq: maxCounterSeq } },
          { new: true, upsert: true }
        );
      }
    }
  }

  // Create import history record
  const history = await ImportHistory.create({
    businessId,
    importType,
    originalFileName: 'historical_import_data.xlsx',
    sheetName: 'Sheet1',
    totalRows: rows.length,
    validRecords: validation.valid.length,
    warningRecords: validation.warnings.length,
    errorRecords: validation.errors.length,
    importedRecords: importedCount,
    skippedRecords: skippedCount,
    duplicateRecords: duplicateCount,
    status: validation.errors.length > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
    createdBy: userId,
  });

  return {
    success: true,
    history,
    imported: importedCount,
    skipped: skippedCount,
    duplicates: duplicateCount,
    errors: validation.errors.length,
  };
};

module.exports = {
  parseExcel,
  autoMapColumns,
  validateImport,
  executeImport,
};
