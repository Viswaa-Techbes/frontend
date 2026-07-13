const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

if (process.env.NODE_ENV === 'production') {
  console.error("FATAL ERROR: Seeding script execution is BLOCKED in production mode to protect data integrity.");
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("FATAL ERROR: MONGODB_URI environment variable is required to run the seeding script.");
  process.exit(1);
}

async function seedData() {
  try {
    console.log("SEEDING: Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("SEEDING: Connected to MongoDB successfully.");

    // Define schemas
    const UserSchema = new mongoose.Schema({
      name: String,
      email: { type: String, unique: true },
      password: String
    }, { timestamps: true, collection: 'users' });
    const User = mongoose.models.User || mongoose.model('User', UserSchema);

    const BusinessProfileSchema = new mongoose.Schema({
      userId: mongoose.Schema.Types.ObjectId,
      businessName: String,
      email: String,
      phone: String,
      gstin: String,
      pan: String,
      address: mongoose.Schema.Types.Mixed,
      bankName: String,
      accountNumber: String,
      ifsc: String,
      branchName: String
    }, { timestamps: true, collection: 'businessprofiles' });
    const BusinessProfile = mongoose.models.BusinessProfile || mongoose.model('BusinessProfile', BusinessProfileSchema);

    const ClientSchema = new mongoose.Schema({
      businessId: mongoose.Schema.Types.ObjectId,
      clientType: String,
      businessName: String,
      clientName: String,
      email: String,
      phone: String,
      gstin: String,
      billingAddress: mongoose.Schema.Types.Mixed,
      shippingAddress: mongoose.Schema.Types.Mixed,
      status: String,
      isDeleted: { type: Boolean, default: false },
      createdBy: mongoose.Schema.Types.ObjectId
    }, { timestamps: true, collection: 'clients' });
    const Client = mongoose.models.Client || mongoose.model('Client', ClientSchema);

    const SalesDocumentSchema = new mongoose.Schema({
      businessId: mongoose.Schema.Types.ObjectId,
      clientId: mongoose.Schema.Types.ObjectId,
      documentType: String,
      documentNumber: String,
      poNumber: String,
      issueDate: Date,
      validTill: Date,
      clientSnapshot: mongoose.Schema.Types.Mixed,
      businessSnapshot: mongoose.Schema.Types.Mixed,
      currency: String,
      placeOfSupply: mongoose.Schema.Types.Mixed,
      gstMode: String,
      items: Array,
      documentDiscountType: String,
      documentDiscountValue: Number,
      documentDiscountAmount: Number,
      additionalCharges: Array,
      subtotal: Number,
      taxableAmount: Number,
      cgstTotal: Number,
      sgstTotal: Number,
      igstTotal: Number,
      additionalChargesTotal: Number,
      roundOff: Number,
      grandTotal: Number,
      grandTotalInWords: String,
      notes: String,
      terms: String,
      status: String,
      linkedDocuments: Array,
      linkedInvoiceId: mongoose.Schema.Types.ObjectId,
      reason: String,
      reasonDetails: String,
      availableCreditAmount: Number,
      settledCreditAmount: Number,
      balanceDue: Number,
      paymentStatus: String,
      amountPaid: Number
    }, { timestamps: true, collection: 'salesdocuments' });
    const SalesDocument = mongoose.models.SalesDocument || mongoose.model('SalesDocument', SalesDocumentSchema);

    const PaymentReceiptSchema = new mongoose.Schema({
      businessId: mongoose.Schema.Types.ObjectId,
      clientId: mongoose.Schema.Types.ObjectId,
      invoiceId: mongoose.Schema.Types.ObjectId,
      receiptNumber: String,
      paymentDate: Date,
      paymentMethod: String,
      depositedTo: String,
      amountReceived: Number,
      tdsWithheld: Number,
      transactionCharge: Number,
      referenceId: String,
      notes: String
    }, { timestamps: true, collection: 'paymentreceipts' });
    const PaymentReceipt = mongoose.models.PaymentReceipt || mongoose.model('PaymentReceipt', PaymentReceiptSchema);

     // 1. Create or Find User
    let demoUser = await User.findOne({ email: 'demo@techbes.com' });
    if (!demoUser) {
      console.log("SEEDING: Creating demo user...");
      const randomPassword = crypto.randomBytes(8).toString('hex'); // Generate strong dynamic password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(randomPassword, salt);
      demoUser = await User.create({
        name: 'Demo Admin',
        email: 'demo@techbes.com',
        password: hashedPassword
      });
      console.log("SEEDING: Demo user created with ID:", demoUser._id);
      console.log("-----------------------------------------------------------------");
      console.log(`  IMPORTANT: Seeded User Credentials\n  Email: demo@techbes.com\n  Password: ${randomPassword}`);
      console.log("-----------------------------------------------------------------");
    } else {
      console.log("SEEDING: Demo user already exists with ID:", demoUser._id);
    }

    // 2. Create or Find Business Profile
    let demoBusiness = await BusinessProfile.findOne({ userId: demoUser._id });
    if (!demoBusiness) {
      console.log("SEEDING: Creating demo business profile...");
      demoBusiness = await BusinessProfile.create({
        userId: demoUser._id,
        businessName: 'TechBes Solutions',
        email: 'demo@techbes.com',
        phone: '9876543210',
        gstin: '29ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        address: {
          addressLine1: 'Nagarbhavi',
          addressLine2: 'Near Library',
          city: 'Bengaluru',
          state: 'Karnataka',
          stateCode: '29',
          country: 'India',
          pincode: '560072'
        },
        bankName: 'State Bank of India',
        accountNumber: '1234567890',
        ifsc: 'SBIN0000123',
        branchName: 'Nagarbhavi Branch'
      });
      console.log("SEEDING: Demo business profile created:", demoBusiness._id);
    } else {
      console.log("SEEDING: Demo business profile already exists:", demoBusiness._id);
    }

    // 3. Clear existing test documents to prevent document duplicate errors during seeding
    await Client.deleteMany({ createdBy: demoUser._id });
    await SalesDocument.deleteMany({ businessId: demoBusiness._id });
    await PaymentReceipt.deleteMany({ businessId: demoBusiness._id });
    console.log("SEEDING: Cleared existing demo documents to prevent overlaps.");

    // 4. Create 3 Clients
    console.log("SEEDING: Inserting 3 demo clients...");
    const client1 = await Client.create({
      businessId: demoBusiness._id,
      clientType: 'BUSINESS',
      businessName: 'ABC Technologies Demo',
      clientName: 'Arun Demo',
      email: 'arun@abc-demo.com',
      phone: '9000000001',
      gstin: '29ABCDE4321G2Z8',
      billingAddress: {
        addressLine1: 'Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: '29',
        country: 'India',
        pincode: '560038'
      },
      createdBy: demoUser._id,
      status: 'ACTIVE'
    });

    const client2 = await Client.create({
      businessId: demoBusiness._id,
      clientType: 'BUSINESS',
      businessName: 'Chennai Network Systems Demo',
      clientName: 'Kumar Demo',
      email: 'kumar@chennai-demo.com',
      phone: '9000000002',
      gstin: '33FGHIJ5678K3Z9',
      billingAddress: {
        addressLine1: 'Adyar',
        city: 'Chennai',
        state: 'Tamil Nadu',
        stateCode: '33',
        country: 'India',
        pincode: '600020'
      },
      createdBy: demoUser._id,
      status: 'ACTIVE'
    });

    const client3 = await Client.create({
      businessId: demoBusiness._id,
      clientType: 'BUSINESS',
      businessName: 'Demo Retail Solutions',
      clientName: 'Priya Demo',
      email: 'priya@retail-demo.com',
      phone: '9000000003',
      gstin: '29KLMNO9012L4Z0',
      billingAddress: {
        addressLine1: 'Malleshwaram',
        city: 'Bengaluru',
        state: 'Karnataka',
        stateCode: '29',
        country: 'India',
        pincode: '560003'
      },
      createdBy: demoUser._id,
      status: 'ACTIVE'
    });
    console.log("SEEDING: Demo clients created successfully.");

    // 5. Create 3 Quotations
    console.log("SEEDING: Creating 3 quotations...");
    const itemsList = [
      {
        itemName: 'IP CCTV Camera 5MP',
        description: 'Outdoor Bullet Camera',
        hsnSac: '8525',
        gstRate: 18,
        quantity: 4,
        unit: 'PCS',
        rate: 3500,
        baseAmount: 14000,
        taxableAmount: 14000,
        cgst: 1260,
        sgst: 1260,
        igst: 0,
        total: 16520
      },
      {
        itemName: '8 Channel NVR',
        description: 'PoE Network Video Recorder',
        hsnSac: '8521',
        gstRate: 18,
        quantity: 1,
        unit: 'PCS',
        rate: 8500,
        baseAmount: 8500,
        taxableAmount: 8500,
        cgst: 765,
        sgst: 765,
        igst: 0,
        total: 10030
      },
      {
        itemName: 'CAT6 Cable Installation',
        description: 'Wiring per meter',
        hsnSac: '9987',
        gstRate: 18,
        quantity: 100,
        unit: 'MTR',
        rate: 40,
        baseAmount: 4000,
        taxableAmount: 4000,
        cgst: 360,
        sgst: 360,
        igst: 0,
        total: 4720
      }
    ];

    const q1 = await SalesDocument.create({
      businessId: demoBusiness._id,
      clientId: client1._id,
      documentType: 'QUOTATION',
      documentNumber: 'QT-0001',
      issueDate: new Date(),
      validTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      clientSnapshot: client1,
      businessSnapshot: demoBusiness,
      currency: 'INR',
      placeOfSupply: { state: 'Karnataka', stateCode: '29' },
      gstMode: 'INTRA_STATE',
      items: itemsList,
      subtotal: 26500,
      taxableAmount: 26500,
      cgstTotal: 2385,
      sgstTotal: 2385,
      igstTotal: 0,
      grandTotal: 31270,
      grandTotalInWords: 'Rupees Thirty One Thousand Two Hundred Seventy Only',
      status: 'SENT',
      notes: 'Demo Quotation for CCTV systems',
      terms: 'Validity: 30 days.'
    });

    const itemsInterstate = itemsList.map(item => ({
      ...item,
      cgst: 0,
      sgst: 0,
      igst: item.taxableAmount * 0.18,
      total: item.taxableAmount * 1.18
    }));

    const q2 = await SalesDocument.create({
      businessId: demoBusiness._id,
      clientId: client2._id,
      documentType: 'QUOTATION',
      documentNumber: 'QT-0002',
      issueDate: new Date(),
      validTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      clientSnapshot: client2,
      businessSnapshot: demoBusiness,
      currency: 'INR',
      placeOfSupply: { state: 'Tamil Nadu', stateCode: '33' },
      gstMode: 'INTER_STATE',
      items: itemsInterstate,
      subtotal: 26500,
      taxableAmount: 26500,
      cgstTotal: 0,
      sgstTotal: 0,
      igstTotal: 4770,
      grandTotal: 31270,
      grandTotalInWords: 'Rupees Thirty One Thousand Two Hundred Seventy Only',
      status: 'SENT',
      notes: 'Interstate installation quote',
      terms: 'Delivery within 7 days.'
    });

    const q3 = await SalesDocument.create({
      businessId: demoBusiness._id,
      clientId: client3._id,
      documentType: 'QUOTATION',
      documentNumber: 'QT-0003',
      issueDate: new Date(),
      validTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      clientSnapshot: client3,
      businessSnapshot: demoBusiness,
      currency: 'INR',
      placeOfSupply: { state: 'Karnataka', stateCode: '29' },
      gstMode: 'INTRA_STATE',
      items: [itemsList[0]],
      subtotal: 14000,
      taxableAmount: 14000,
      cgstTotal: 1260,
      sgstTotal: 1260,
      igstTotal: 0,
      grandTotal: 16520,
      grandTotalInWords: 'Rupees Sixteen Thousand Five Hundred Twenty Only',
      status: 'ACCEPTED',
      notes: 'Quick quotation for cameras only',
      terms: 'Payment against delivery.'
    });

    // 6. Create Proforma Invoice
    console.log("SEEDING: Creating 1 proforma invoice...");
    const pi1 = await SalesDocument.create({
      businessId: demoBusiness._id,
      clientId: client1._id,
      documentType: 'PROFORMA_INVOICE',
      documentNumber: 'PI-0001',
      issueDate: new Date(),
      clientSnapshot: client1,
      businessSnapshot: demoBusiness,
      currency: 'INR',
      placeOfSupply: { state: 'Karnataka', stateCode: '29' },
      gstMode: 'INTRA_STATE',
      items: itemsList,
      subtotal: 26500,
      taxableAmount: 26500,
      cgstTotal: 2385,
      sgstTotal: 2385,
      igstTotal: 0,
      grandTotal: 31270,
      grandTotalInWords: 'Rupees Thirty One Thousand Two Hundred Seventy Only',
      status: 'ISSUED',
      notes: 'Demo Proforma Invoice generated from Quotation'
    });

    // 7. Create 3 Invoices
    console.log("SEEDING: Creating 3 invoices...");
    // Invoice 1: Local state
    const inv1 = await SalesDocument.create({
      businessId: demoBusiness._id,
      clientId: client1._id,
      documentType: 'INVOICE',
      documentNumber: 'INV-0001',
      issueDate: new Date(),
      validTill: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      clientSnapshot: client1,
      businessSnapshot: demoBusiness,
      currency: 'INR',
      placeOfSupply: { state: 'Karnataka', stateCode: '29' },
      gstMode: 'INTRA_STATE',
      items: [
        {
          itemName: 'IP CCTV Camera 5MP',
          description: 'Outdoor Camera model',
          hsnSac: '8525',
          gstRate: 18,
          quantity: 4,
          unit: 'PCS',
          rate: 4237.28,
          baseAmount: 16949.12,
          taxableAmount: 16949.12,
          cgst: 1525.42,
          sgst: 1525.42,
          igst: 0,
          total: 19999.96
        }
      ],
      subtotal: 16949.12,
      taxableAmount: 16949.12,
      cgstTotal: 1525.42,
      sgstTotal: 1525.42,
      igstTotal: 0,
      grandTotal: 20000,
      grandTotalInWords: 'Rupees Twenty Thousand Only',
      status: 'ISSUED',
      paymentStatus: 'UNPAID',
      balanceDue: 20000,
      amountPaid: 0,
      notes: 'Standard local tax invoice'
    });

    // Invoice 2: Interstate
    const inv2 = await SalesDocument.create({
      businessId: demoBusiness._id,
      clientId: client2._id,
      documentType: 'INVOICE',
      documentNumber: 'INV-0002',
      issueDate: new Date(),
      clientSnapshot: client2,
      businessSnapshot: demoBusiness,
      currency: 'INR',
      placeOfSupply: { state: 'Tamil Nadu', stateCode: '33' },
      gstMode: 'INTER_STATE',
      items: [
        {
          itemName: '8 Channel NVR',
          description: 'Recorder unit',
          hsnSac: '8521',
          gstRate: 18,
          quantity: 1,
          unit: 'PCS',
          rate: 8474.58,
          baseAmount: 8474.58,
          taxableAmount: 8474.58,
          cgst: 0,
          sgst: 0,
          igst: 1525.42,
          total: 10000
        }
      ],
      subtotal: 8474.58,
      taxableAmount: 8474.58,
      cgstTotal: 0,
      sgstTotal: 0,
      igstTotal: 1525.42,
      grandTotal: 10000,
      grandTotalInWords: 'Rupees Ten Thousand Only',
      status: 'ISSUED',
      paymentStatus: 'UNPAID',
      balanceDue: 10000,
      amountPaid: 0,
      notes: 'Interstate tax invoice to Tamil Nadu'
    });

    // Invoice 3: Multi-item, discount, charge
    const inv3 = await SalesDocument.create({
      businessId: demoBusiness._id,
      clientId: client3._id,
      documentType: 'INVOICE',
      documentNumber: 'INV-0003',
      issueDate: new Date(),
      clientSnapshot: client3,
      businessSnapshot: demoBusiness,
      currency: 'INR',
      placeOfSupply: { state: 'Karnataka', stateCode: '29' },
      gstMode: 'INTRA_STATE',
      items: [
        {
          itemName: 'CAT6 Cable Installation',
          description: 'Wiring per meter',
          hsnSac: '9987',
          gstRate: 18,
          quantity: 100,
          unit: 'MTR',
          rate: 40,
          baseAmount: 4000,
          itemDiscountAmount: 400,
          taxableAmount: 3600,
          cgst: 324,
          sgst: 324,
          igst: 0,
          total: 4248
        }
      ],
      additionalCharges: [
        {
          chargeName: 'Transport Charge',
          amount: 500,
          isTaxable: false,
          taxAmount: 0,
          total: 500
        }
      ],
      subtotal: 4000,
      taxableAmount: 3600,
      cgstTotal: 324,
      sgstTotal: 324,
      igstTotal: 0,
      additionalChargesTotal: 500,
      grandTotal: 4748,
      grandTotalInWords: 'Rupees Four Thousand Seven Hundred Forty Eight Only',
      status: 'ISSUED',
      paymentStatus: 'UNPAID',
      balanceDue: 4748,
      amountPaid: 0,
      notes: 'Invoice with discount and additional transport charges'
    });

    // 8. Create Payment Receipts
    console.log("SEEDING: Recording payments for INV-0001...");
    const p1 = await PaymentReceipt.create({
      businessId: demoBusiness._id,
      clientId: client1._id,
      invoiceId: inv1._id,
      receiptNumber: 'REC-0001',
      paymentDate: new Date(),
      paymentMethod: 'UPI',
      depositedTo: 'Bank Account',
      amountReceived: 8000,
      tdsWithheld: 0,
      transactionCharge: 0,
      referenceId: 'UPI123456789',
      notes: 'Partial payment received'
    });

    await SalesDocument.updateOne({ _id: inv1._id }, {
      $set: {
        paymentStatus: 'PARTIALLY_PAID',
        amountPaid: 8000,
        balanceDue: 12000
      }
    });

    const p2 = await PaymentReceipt.create({
      businessId: demoBusiness._id,
      clientId: client1._id,
      invoiceId: inv1._id,
      receiptNumber: 'REC-0002',
      paymentDate: new Date(),
      paymentMethod: 'NET_BANKING',
      depositedTo: 'Bank Account',
      amountReceived: 12000,
      tdsWithheld: 0,
      transactionCharge: 0,
      referenceId: 'TXN987654321',
      notes: 'Final settlement payment'
    });

    await SalesDocument.updateOne({ _id: inv1._id }, {
      $set: {
        paymentStatus: 'PAID',
        amountPaid: 20000,
        balanceDue: 0
      }
    });

    // 9. Create Sales Order
    console.log("SEEDING: Creating 1 sales order...");
    const so1 = await SalesDocument.create({
      businessId: demoBusiness._id,
      clientId: client1._id,
      documentType: 'SALES_ORDER',
      documentNumber: 'SO-0001',
      poNumber: 'PO-998877',
      issueDate: new Date(),
      clientSnapshot: client1,
      businessSnapshot: demoBusiness,
      currency: 'INR',
      placeOfSupply: { state: 'Karnataka', stateCode: '29' },
      gstMode: 'INTRA_STATE',
      items: itemsList,
      subtotal: 26500,
      taxableAmount: 26500,
      cgstTotal: 2385,
      sgstTotal: 2385,
      igstTotal: 0,
      grandTotal: 31270,
      grandTotalInWords: 'Rupees Thirty One Thousand Two Hundred Seventy Only',
      status: 'ISSUED',
      notes: 'Demo Sales Order confirmation'
    });

    // 10. Create Delivery Challan
    console.log("SEEDING: Creating 1 delivery challan...");
    const dc1 = await SalesDocument.create({
      businessId: demoBusiness._id,
      clientId: client1._id,
      documentType: 'DELIVERY_CHALLAN',
      documentNumber: 'DC-0001',
      issueDate: new Date(),
      clientSnapshot: client1,
      businessSnapshot: demoBusiness,
      currency: 'INR',
      placeOfSupply: { state: 'Karnataka', stateCode: '29' },
      gstMode: 'INTRA_STATE',
      items: itemsList,
      subtotal: 26500,
      taxableAmount: 26500,
      cgstTotal: 2385,
      sgstTotal: 2385,
      igstTotal: 0,
      grandTotal: 31270,
      grandTotalInWords: 'Rupees Thirty One Thousand Two Hundred Seventy Only',
      status: 'ISSUED',
      notes: 'Demo Delivery Challan for camera equipment dispatch'
    });

    // 11. Create 2 Credit Notes
    console.log("SEEDING: Creating 2 credit notes...");
    const cn1 = await SalesDocument.create({
      businessId: demoBusiness._id,
      clientId: client2._id,
      documentType: 'CREDIT_NOTE',
      documentNumber: 'CN-0001',
      issueDate: new Date(),
      clientSnapshot: client2,
      businessSnapshot: demoBusiness,
      currency: 'INR',
      placeOfSupply: { state: 'Tamil Nadu', stateCode: '33' },
      gstMode: 'INTER_STATE',
      items: [
        {
          itemName: '8 Channel NVR',
          description: 'Returned defective recorder unit',
          hsnSac: '8521',
          gstRate: 18,
          quantity: 1,
          unit: 'PCS',
          rate: 8474.58,
          baseAmount: 8474.58,
          taxableAmount: 8474.58,
          cgst: 0,
          sgst: 0,
          igst: 1525.42,
          total: 10000
        }
      ],
      subtotal: 8474.58,
      taxableAmount: 8474.58,
      cgstTotal: 0,
      sgstTotal: 0,
      igstTotal: 1525.42,
      grandTotal: 10000,
      grandTotalInWords: 'Rupees Ten Thousand Only',
      status: 'ISSUED',
      linkedInvoiceId: inv2._id,
      reason: 'PRODUCT_RETURN',
      reasonDetails: 'Defective power port, item returned.',
      availableCreditAmount: 10000,
      settledCreditAmount: 0
    });

    const cn2 = await SalesDocument.create({
      businessId: demoBusiness._id,
      clientId: client3._id,
      documentType: 'CREDIT_NOTE',
      documentNumber: 'CN-0002',
      issueDate: new Date(),
      clientSnapshot: client3,
      businessSnapshot: demoBusiness,
      currency: 'INR',
      placeOfSupply: { state: 'Karnataka', stateCode: '29' },
      gstMode: 'INTRA_STATE',
      items: [
        {
          itemName: 'CAT6 Cable Installation Discount Adjustment',
          description: 'Special goodwill discount adjust',
          hsnSac: '9987',
          gstRate: 18,
          quantity: 1,
          unit: 'JOB',
          rate: 1000,
          baseAmount: 1000,
          taxableAmount: 1000,
          cgst: 90,
          sgst: 90,
          igst: 0,
          total: 1180
        }
      ],
      subtotal: 1000,
      taxableAmount: 1000,
      cgstTotal: 90,
      sgstTotal: 90,
      igstTotal: 0,
      grandTotal: 1180,
      grandTotalInWords: 'Rupees One Thousand One Hundred Eighty Only',
      status: 'ISSUED',
      linkedInvoiceId: inv3._id,
      reason: 'DISCOUNT_OFFERED',
      reasonDetails: 'Goodwill discount after billing.',
      availableCreditAmount: 1180,
      settledCreditAmount: 0
    });

    console.log("SEEDING: All demo records successfully seeded into live database!");
    await mongoose.disconnect();
  } catch (err) {
    console.error("SEEDING: Error during automated seeding process:", err);
  }
}

seedData();
