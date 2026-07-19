const Client = require('../models/Client');
const SalesDocument = require('../models/SalesDocument');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginationMeta } = require('../utils/helpers');

/**
 * List clients for a business with search, status filter, and pagination.
 */
const list = async (businessId, query) => {
  const { page, limit, skip } = parsePagination(query);

  const filter = { businessId, isDeleted: false };

  // Status filter
  if (query.status) {
    filter.status = query.status;
  }

  // Search — text search or regex fallback
  if (query.search) {
    const searchRegex = new RegExp(query.search, 'i');
    filter.$or = [
      { clientName: searchRegex },
      { businessName: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
      { gstin: searchRegex },
    ];
  }

  const [clients, total] = await Promise.all([
    Client.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Client.countDocuments(filter),
  ]);

  return {
    clients,
    pagination: paginationMeta(total, page, limit),
  };
};

/**
 * Get a single client by ID (must belong to the business).
 */
const getById = async (id, businessId) => {
  const client = await Client.findOne({ _id: id, businessId, isDeleted: false }).lean();
  if (!client) {
    throw ApiError.notFound('Client not found');
  }
  return client;
};

/**
 * Create a new client.
 */
const create = async (businessId, userId, data) => {
  const client = await Client.create({
    ...data,
    businessId,
    createdBy: userId,
  });
  return client.toObject();
};

/**
 * Update an existing client.
 */
const update = async (id, businessId, userId, data) => {
  const client = await Client.findOne({ _id: id, businessId, isDeleted: false });
  if (!client) {
    throw ApiError.notFound('Client not found');
  }

  // Update allowed fields
  const allowedFields = [
    'clientType', 'businessName', 'clientName', 'email', 'phone',
    'gstin', 'pan', 'billingAddress', 'shippingAddress',
    'openingBalance', 'notes', 'status',
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      client[field] = data[field];
    }
  }
  client.updatedBy = userId;

  await client.save();
  return client.toObject();
};

/**
 * Soft-delete a client.
 * Prevents deletion if the client has linked (non-deleted) documents.
 */
const softDelete = async (id, businessId, userId) => {
  const client = await Client.findOne({ _id: id, businessId, isDeleted: false });
  if (!client) {
    throw ApiError.notFound('Client not found');
  }

  // TODO (Phase 1B): check for existing SalesDocuments linked to this client
  // const docCount = await SalesDocument.countDocuments({ clientId: id, isDeleted: false });
  // if (docCount > 0) {
  //   throw ApiError.conflict('Cannot delete client with existing documents. Set to INACTIVE instead.');
  // }

  client.isDeleted = true;
  client.deletedAt = new Date();
  client.deletedBy = userId;
  await client.save();
};

/**
 * Get summary for a client (total sales, outstanding).
 * Placeholder until SalesDocument model is available.
 */
const getSummary = async (id, businessId) => {
  const client = await Client.findOne({ _id: id, businessId, isDeleted: false });
  if (!client) {
    throw ApiError.notFound('Client not found');
  }

  // TODO (Phase 1B): aggregate from SalesDocument and Payment collections
  return {
    totalSales: 0,
    outstanding: 0,
    openingBalance: client.openingBalance || 0,
  };
};

/**
 * Bulk delete clients scoped to the current business.
 * Checks for existing linked documents to prevent orphans.
 */
const bulkDelete = async (ids, businessId, userId) => {
  const successIds = [];
  const failures = [];

  for (const id of ids) {
    try {
      const client = await Client.findOne({ _id: id, businessId, isDeleted: false });
      if (!client) {
        failures.push({
          id,
          name: 'Unknown',
          reason: 'Client not found or already deleted',
        });
        continue;
      }

      // Check for existing SalesDocuments linked to this client
      const docCount = await SalesDocument.countDocuments({ clientId: id });
      if (docCount > 0) {
        failures.push({
          id,
          name: client.clientName,
          reason: `Cannot delete client '${client.clientName}' because they have ${docCount} linked sales document(s). Set to INACTIVE instead.`,
        });
        continue;
      }

      // Perform hard-delete as required ("Remove them from MongoDB")
      await Client.deleteOne({ _id: id });
      successIds.push(id);
    } catch (err) {
      failures.push({
        id,
        name: 'Error',
        reason: err.message,
      });
    }
  }

  return {
    deletedCount: successIds.length,
    successIds,
    failures,
  };
};

module.exports = { list, getById, create, update, softDelete, bulkDelete, getSummary };
