const mongoose = require('mongoose');
const PaymentReceipt = require('../models/PaymentReceipt');
const SalesDocument = require('../models/SalesDocument');
const BusinessProfile = require('../models/BusinessProfile');
const Client = require('../models/Client');
const Counter = require('../models/Counter');
const ApiError = require('../utils/ApiError');

/**
 * Generate next Payment Receipt number
 */
const getNextReceiptNumber = async (businessId) => {
  const counterId = `${businessId.toString()}_PAYMENT_RECEIPT`;
  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const sequenceNum = counter.seq.toString().padStart(5, '0');
  return `PR-${sequenceNum}`;
};

/**
 * Get list of payment receipts
 */
const getPaymentReceipts = async (businessId, query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 15;
  const skip = (page - 1) * limit;

  const filter = { businessId };

  if (query.status) {
    filter.status = query.status;
  }
  if (query.clientId) {
    filter.clientId = query.clientId;
  }
  if (query.search) {
    const regex = new RegExp(query.search, 'i');
    filter.$or = [
      { receiptNumber: regex },
      { 'clientSnapshot.clientName': regex },
      { 'clientSnapshot.businessName': regex }
    ];
  }

  const [receipts, total] = await Promise.all([
    PaymentReceipt.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PaymentReceipt.countDocuments(filter)
  ]);

  return {
    receipts,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get payment receipt details by ID
 */
const getPaymentReceiptById = async (id, businessId) => {
  const receipt = await PaymentReceipt.findOne({ _id: id, businessId }).lean();
  if (!receipt) {
    throw ApiError.notFound('Payment Receipt not found.');
  }
  return receipt;
};

/**
 * Get eligible unpaid or partially paid invoices for a client
 */
const getUnpaidInvoices = async (businessId, clientId) => {
  return await SalesDocument.find({
    businessId,
    clientId,
    documentType: 'INVOICE',
    status: { $nin: ['DRAFT', 'CANCELLED'] },
    paymentStatus: { $in: ['UNPAID', 'PARTIALLY_PAID'] }
  })
    .sort({ validTill: 1, issueDate: 1, createdAt: 1 })
    .lean();
};

/**
 * Create or save a Payment Receipt
 */
const createPaymentReceipt = async (userId, data) => {
  const { clientId, status = 'DRAFT' } = data;

  const business = await BusinessProfile.findOne({ userId });
  if (!business) {
    throw ApiError.badRequest('Business profile not found. Complete your profile first.');
  }

  const client = await Client.findOne({ _id: clientId, businessId: business._id, isDeleted: false });
  if (!client) {
    throw ApiError.notFound('Client not found.');
  }

  // Generate sequence if draft or new receipt has empty number
  let receiptNumber = data.receiptNumber;
  if (!receiptNumber || receiptNumber === 'Auto-generated') {
    receiptNumber = await getNextReceiptNumber(business._id);
  }

  // Pre-calculate payment records totals
  const paymentRecords = (data.paymentRecords || []).map((rec) => {
    const amountReceived = parseFloat(rec.amountReceived) || 0;
    const tdsPercentage = parseFloat(rec.tdsPercentage) || 0;
    const tdsWithheld = parseFloat(rec.tdsWithheld) || (amountReceived * (tdsPercentage / 100));
    const transactionCharge = parseFloat(rec.transactionCharge) || 0;

    // Gross amount includes base amount received + TDS
    const grossPayment = amountReceived + tdsWithheld;
    // Settleable amount is the cash value + TDS that can be applied to invoice balances
    const settleableAmount = amountReceived + tdsWithheld;
    // Net amount deposited in bank is amount received minus gateway charges
    const netDepositedAmount = amountReceived - transactionCharge;

    return {
      ...rec,
      amountReceived,
      tdsPercentage,
      tdsWithheld,
      transactionCharge,
      grossPayment,
      settleableAmount,
      netDepositedAmount
    };
  });

  const totals = {
    amountReceived: paymentRecords.reduce((sum, r) => sum + r.amountReceived, 0),
    tdsWithheld: paymentRecords.reduce((sum, r) => sum + r.tdsWithheld, 0),
    transactionCharges: paymentRecords.reduce((sum, r) => sum + r.transactionCharge, 0),
    availableForSettlement: paymentRecords.reduce((sum, r) => sum + r.settleableAmount, 0),
    allocatedToInvoices: 0,
    advancePayment: 0,
  };

  const settlements = data.settlements || [];
  totals.allocatedToInvoices = settlements.reduce((sum, s) => sum + (parseFloat(s.settlementAmount) || 0), 0);
  totals.advancePayment = Math.max(0, totals.availableForSettlement - totals.allocatedToInvoices);

  // Define database transaction boundary if finalised
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const newReceiptPayload = {
      receiptNumber,
      status,
      businessId: business._id,
      businessSnapshot: business.toObject(),
      clientId: client._id,
      clientSnapshot: client.toObject(),
      receiptDate: data.receiptDate || new Date(),
      currency: data.currency || 'INR',
      numberFormat: data.numberFormat || 'en-IN',
      paymentRecords,
      totals,
      settlements: [],
      notes: data.notes || '',
      contactDetails: data.contactDetails || {},
      additionalInfo: data.additionalInfo || { customFields: [] },
      signature: data.signature || { label: 'Authorised Signatory' },
      attachments: data.attachments || [],
      linkedDocuments: [],
      auditTrail: [
        {
          action: 'CREATED',
          description: `Payment Receipt created in state ${status}`,
          userId,
          userName: business.businessName,
        }
      ],
      createdBy: userId,
    };

    if (status === 'FINALIZED') {
      // Loop over requested invoice allocations and apply updates atomically
      const processedSettlements = [];
      const updatedLinkedDocs = [];

      for (const settle of settlements) {
        const amt = parseFloat(settle.settlementAmount) || 0;
        if (amt <= 0) continue;

        const invoice = await SalesDocument.findOne({
          _id: settle.invoiceId,
          businessId: business._id,
          documentType: 'INVOICE'
        }).session(session);

        if (!invoice) {
          throw ApiError.notFound(`Invoice ${settle.invoiceId} not found.`);
        }

        const outstandingBefore = invoice.balanceDue ?? invoice.grandTotal;
        if (amt > outstandingBefore) {
          throw ApiError.badRequest(`Settlement amount ₹${amt} exceeds outstanding balance ₹${outstandingBefore} for Invoice ${invoice.documentNumber}`);
        }

        const outstandingAfter = Math.max(0, outstandingBefore - amt);

        // Update invoice payment status
        invoice.amountPaid = (invoice.amountPaid || 0) + amt;
        invoice.balanceDue = outstandingAfter;
        if (outstandingAfter === 0) {
          invoice.paymentStatus = 'PAID';
        } else {
          invoice.paymentStatus = 'PARTIALLY_PAID';
        }

        // Establish linked receipt references on the invoice
        invoice.linkedDocuments = invoice.linkedDocuments || [];
        invoice.linkedDocuments.push({
          documentId: null, // will update below with receiptId
          documentType: 'PAYMENT_RECEIPT',
          documentNumber: receiptNumber,
          relationType: 'PAYMENT'
        });

        invoice.auditTrail = invoice.auditTrail || [];
        invoice.auditTrail.push({
          action: 'PAYMENT_RECORDED',
          description: `Recorded payment of ₹${amt.toLocaleString('en-IN')} via receipt ${receiptNumber}`,
          userId,
          userName: business.businessName,
          timestamp: new Date()
        });

        await invoice.save({ session });

        processedSettlements.push({
          invoiceId: invoice._id,
          invoiceNumberSnapshot: invoice.documentNumber,
          invoiceTotalSnapshot: invoice.grandTotal,
          outstandingBefore,
          settlementAmount: amt,
          outstandingAfter
        });

        updatedLinkedDocs.push({
          documentId: invoice._id,
          documentType: 'INVOICE',
          documentNumber: invoice.documentNumber,
          relationType: 'PAYMENT'
        });
      }

      newReceiptPayload.settlements = processedSettlements;
      newReceiptPayload.linkedDocuments = updatedLinkedDocs;
    }

    const createdReceipt = new PaymentReceipt(newReceiptPayload);
    await createdReceipt.save({ session });

    // Link createdReceipt._id back to the invoices
    if (status === 'FINALIZED') {
      for (const settle of settlements) {
        const amt = parseFloat(settle.settlementAmount) || 0;
        if (amt <= 0) continue;
        await SalesDocument.updateOne(
          { _id: settle.invoiceId, 'linkedDocuments.documentNumber': receiptNumber },
          { $set: { 'linkedDocuments.$.documentId': createdReceipt._id } },
          { session }
        );
      }
    }

    await session.commitTransaction();
    session.endSession();

    return createdReceipt.toObject();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Cancel a finalized Payment Receipt (rollback settlements)
 */
const cancelPaymentReceipt = async (id, businessId, userId) => {
  const business = await BusinessProfile.findById(businessId);
  if (!business) throw ApiError.badRequest('Business profile not found.');

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const receipt = await PaymentReceipt.findOne({ _id: id, businessId }).session(session);
    if (!receipt) {
      throw ApiError.notFound('Payment Receipt not found.');
    }

    if (receipt.status === 'CANCELLED') {
      throw ApiError.badRequest('Receipt is already cancelled.');
    }

    if (receipt.status === 'FINALIZED') {
      // Rollback settlements
      for (const settle of receipt.settlements) {
        const invoice = await SalesDocument.findOne({
          _id: settle.invoiceId,
          businessId
        }).session(session);

        if (invoice) {
          invoice.amountPaid = Math.max(0, (invoice.amountPaid || 0) - settle.settlementAmount);
          invoice.balanceDue = (invoice.balanceDue || 0) + settle.settlementAmount;
          
          if (invoice.amountPaid === 0) {
            invoice.paymentStatus = 'UNPAID';
          } else {
            invoice.paymentStatus = 'PARTIALLY_PAID';
          }

          // Remove the linked document entry or status change
          invoice.linkedDocuments = (invoice.linkedDocuments || []).filter(
            (ld) => ld.documentNumber !== receipt.receiptNumber
          );

          invoice.auditTrail.push({
            action: 'PAYMENT_REMOVED',
            description: `Payment receipt ${receipt.receiptNumber} cancelled. Outstanding balance restored.`,
            userId,
            userName: business.businessName,
            timestamp: new Date()
          });

          await invoice.save({ session });
        }
      }
    }

    receipt.status = 'CANCELLED';
    receipt.auditTrail.push({
      action: 'CANCELLED',
      description: 'Payment Receipt cancelled and voided. Outstanding allocations rolled back.',
      userId,
      userName: business.businessName,
      timestamp: new Date()
    });

    await receipt.save({ session });

    await session.commitTransaction();
    session.endSession();

    return receipt.toObject();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Delete draft Payment Receipt
 */
const deletePaymentReceipt = async (id, businessId) => {
  const receipt = await PaymentReceipt.findOne({ _id: id, businessId });
  if (!receipt) {
    throw ApiError.notFound('Payment Receipt not found.');
  }

  if (receipt.status !== 'DRAFT') {
    throw ApiError.badRequest('Only DRAFT payment receipts can be permanently deleted.');
  }

  await PaymentReceipt.deleteOne({ _id: id });
  return true;
};

module.exports = {
  getNextReceiptNumber,
  getPaymentReceipts,
  getPaymentReceiptById,
  getUnpaidInvoices,
  createPaymentReceipt,
  cancelPaymentReceipt,
  deletePaymentReceipt
};
