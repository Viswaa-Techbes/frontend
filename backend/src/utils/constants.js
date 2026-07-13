// ── Client ───────────────────────────────────────────────────────────
const CLIENT_TYPES = Object.freeze({
  BUSINESS: 'BUSINESS',
  INDIVIDUAL: 'INDIVIDUAL',
});

const CLIENT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});

// ── Document types ───────────────────────────────────────────────────
const DOCUMENT_TYPES = Object.freeze({
  QUOTATION: 'QUOTATION',
  PROFORMA_INVOICE: 'PROFORMA_INVOICE',
  INVOICE: 'INVOICE',
  SALES_ORDER: 'SALES_ORDER',
  DELIVERY_CHALLAN: 'DELIVERY_CHALLAN',
  CREDIT_NOTE: 'CREDIT_NOTE',
  PAYMENT_RECEIPT: 'PAYMENT_RECEIPT',
});

const DOCUMENT_PREFIX = Object.freeze({
  QUOTATION: 'QT',
  PROFORMA_INVOICE: 'PI',
  INVOICE: 'INV',
  SALES_ORDER: 'SO',
  DELIVERY_CHALLAN: 'DC',
  CREDIT_NOTE: 'CN',
  PAYMENT: 'REC',
  PAYMENT_RECEIPT: 'PR',
});

// ── Document statuses (per type) ─────────────────────────────────────
const QUOTATION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CONVERTED: 'CONVERTED',
});

const PROFORMA_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CONVERTED: 'CONVERTED',
});

const INVOICE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
});

const SALES_ORDER_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const DELIVERY_CHALLAN_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
});

const CREDIT_NOTE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  APPLIED: 'APPLIED',
});

/** Lookup: documentType → allowed statuses */
const STATUS_BY_DOCUMENT_TYPE = Object.freeze({
  [DOCUMENT_TYPES.QUOTATION]: Object.values(QUOTATION_STATUS),
  [DOCUMENT_TYPES.PROFORMA_INVOICE]: Object.values(PROFORMA_STATUS),
  [DOCUMENT_TYPES.INVOICE]: Object.values(INVOICE_STATUS),
  [DOCUMENT_TYPES.SALES_ORDER]: Object.values(SALES_ORDER_STATUS),
  [DOCUMENT_TYPES.DELIVERY_CHALLAN]: Object.values(DELIVERY_CHALLAN_STATUS),
  [DOCUMENT_TYPES.CREDIT_NOTE]: Object.values(CREDIT_NOTE_STATUS),
});

// ── Invoice sub-types ────────────────────────────────────────────────
const INVOICE_TYPES = Object.freeze({
  TAX_INVOICE: 'TAX_INVOICE',
  BILL_OF_SUPPLY: 'BILL_OF_SUPPLY',
});

// ── Discount types ───────────────────────────────────────────────────
const DISCOUNT_TYPES = Object.freeze({
  PERCENTAGE: 'PERCENTAGE',
  FIXED: 'FIXED',
});

// ── Payment modes ────────────────────────────────────────────────────
const PAYMENT_MODES = Object.freeze({
  CASH: 'CASH',
  UPI: 'UPI',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CARD: 'CARD',
  CHEQUE: 'CHEQUE',
  OTHER: 'OTHER',
});

// ── Credit note reasons ──────────────────────────────────────────────
const CREDIT_REASONS = Object.freeze({
  RETURNED_GOODS: 'RETURNED_GOODS',
  SERVICE_CANCELLATION: 'SERVICE_CANCELLATION',
  PRICE_ADJUSTMENT: 'PRICE_ADJUSTMENT',
  OTHER: 'OTHER',
});

// ── Conversion rules ─────────────────────────────────────────────────
const CONVERSION_MAP = Object.freeze({
  [DOCUMENT_TYPES.QUOTATION]: [
    DOCUMENT_TYPES.PROFORMA_INVOICE,
    DOCUMENT_TYPES.SALES_ORDER,
    DOCUMENT_TYPES.INVOICE,
  ],
  [DOCUMENT_TYPES.PROFORMA_INVOICE]: [
    DOCUMENT_TYPES.INVOICE,
    DOCUMENT_TYPES.SALES_ORDER,
    DOCUMENT_TYPES.DELIVERY_CHALLAN,
  ],
  [DOCUMENT_TYPES.SALES_ORDER]: [
    DOCUMENT_TYPES.INVOICE,
    DOCUMENT_TYPES.DELIVERY_CHALLAN,
  ],
  [DOCUMENT_TYPES.DELIVERY_CHALLAN]: [
    DOCUMENT_TYPES.INVOICE,
  ],
  [DOCUMENT_TYPES.INVOICE]: [
    DOCUMENT_TYPES.CREDIT_NOTE,
  ],
});

// ── Indian states ────────────────────────────────────────────────────
const INDIAN_STATES = Object.freeze([
  { code: '01', stateCode: 'JK', name: 'Jammu and Kashmir' },
  { code: '02', stateCode: 'HP', name: 'Himachal Pradesh' },
  { code: '03', stateCode: 'PB', name: 'Punjab' },
  { code: '04', stateCode: 'CH', name: 'Chandigarh' },
  { code: '05', stateCode: 'UT', name: 'Uttarakhand' },
  { code: '06', stateCode: 'HR', name: 'Haryana' },
  { code: '07', stateCode: 'DL', name: 'Delhi' },
  { code: '08', stateCode: 'RJ', name: 'Rajasthan' },
  { code: '09', stateCode: 'UP', name: 'Uttar Pradesh' },
  { code: '10', stateCode: 'BR', name: 'Bihar' },
  { code: '11', stateCode: 'SK', name: 'Sikkim' },
  { code: '12', stateCode: 'AR', name: 'Arunachal Pradesh' },
  { code: '13', stateCode: 'NL', name: 'Nagaland' },
  { code: '14', stateCode: 'MN', name: 'Manipur' },
  { code: '15', stateCode: 'MZ', name: 'Mizoram' },
  { code: '16', stateCode: 'TR', name: 'Tripura' },
  { code: '17', stateCode: 'ML', name: 'Meghalaya' },
  { code: '18', stateCode: 'AS', name: 'Assam' },
  { code: '19', stateCode: 'WB', name: 'West Bengal' },
  { code: '20', stateCode: 'JH', name: 'Jharkhand' },
  { code: '21', stateCode: 'OR', name: 'Odisha' },
  { code: '22', stateCode: 'CT', name: 'Chhattisgarh' },
  { code: '23', stateCode: 'MP', name: 'Madhya Pradesh' },
  { code: '24', stateCode: 'GJ', name: 'Gujarat' },
  { code: '25', stateCode: 'DD', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', stateCode: 'MH', name: 'Maharashtra' },
  { code: '28', stateCode: 'AP', name: 'Andhra Pradesh' },
  { code: '29', stateCode: 'KA', name: 'Karnataka' },
  { code: '30', stateCode: 'GA', name: 'Goa' },
  { code: '31', stateCode: 'LD', name: 'Lakshadweep' },
  { code: '32', stateCode: 'KL', name: 'Kerala' },
  { code: '33', stateCode: 'TN', name: 'Tamil Nadu' },
  { code: '34', stateCode: 'PY', name: 'Puducherry' },
  { code: '35', stateCode: 'AN', name: 'Andaman and Nicobar Islands' },
  { code: '36', stateCode: 'TG', name: 'Telangana' },
  { code: '37', stateCode: 'LA', name: 'Ladakh' },
  { code: '38', stateCode: 'OT', name: 'Other Territory' },
]);

// ── Pagination defaults ──────────────────────────────────────────────
const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});

module.exports = {
  CLIENT_TYPES,
  CLIENT_STATUS,
  DOCUMENT_TYPES,
  DOCUMENT_PREFIX,
  QUOTATION_STATUS,
  PROFORMA_STATUS,
  INVOICE_STATUS,
  SALES_ORDER_STATUS,
  DELIVERY_CHALLAN_STATUS,
  CREDIT_NOTE_STATUS,
  STATUS_BY_DOCUMENT_TYPE,
  INVOICE_TYPES,
  DISCOUNT_TYPES,
  PAYMENT_MODES,
  CREDIT_REASONS,
  CONVERSION_MAP,
  INDIAN_STATES,
  PAGINATION,
};
