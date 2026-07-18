const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const importService = require('./src/services/importService');
const BusinessProfile = require('./src/models/BusinessProfile');
const User = require('./src/models/User');
const Client = require('./src/models/Client');

async function run() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    // 1. Fetch business and user
    const business = await BusinessProfile.findOne();
    if (!business) {
      console.error('No business profile found. Please run seed script first.');
      process.exit(1);
    }
    const user = await User.findOne();
    if (!user) {
      console.error('No user found.');
      process.exit(1);
    }

    console.log(`Using Business: ${business.businessName} (ID: ${business._id})`);
    console.log(`Using User: ${user.email} (ID: ${user._id})`);

    // 2. Read Clients.csv
    const csvPath = 'c:\\techbes_billing\\Clients.csv';
    if (!fs.existsSync(csvPath)) {
      console.error(`CSV file not found at: ${csvPath}`);
      process.exit(1);
    }

    const fileBuffer = fs.readFileSync(csvPath);
    console.log(`Read ${fileBuffer.length} bytes from ${csvPath}`);

    // 3. Parse CSV
    const parsed = importService.parseExcel(fileBuffer);
    console.log(`Parsed ${parsed.rows.length} rows from CSV.`);
    console.log('Headers found:', parsed.headers);

    // 4. Auto Map
    const autoMapping = importService.autoMapColumns(parsed.headers);
    console.log('Auto Mapped Columns:', JSON.stringify(autoMapping, null, 2));

    // Verify auto mapping
    const expectedMappings = {
      clientName: 'Name',
      phone: 'Phone',
      email: 'Email',
      gstin: 'GSTIN',
      pan: 'Pan',
      address: 'Street',
      city: 'City',
      state: 'State',
      postalCode: 'Postal Code',
      country: 'Country',
    };

    for (const [field, expected] of Object.entries(expectedMappings)) {
      if (autoMapping[field] !== expected) {
        console.warn(`WARNING: Mapping for ${field} expected ${expected} but got ${autoMapping[field]}`);
      } else {
        console.log(`Mapping OK: ${field} -> ${expected}`);
      }
    }

    // 5. Run validation
    console.log('\n--- Running Validation ---');
    const validationResult = await importService.validateImport(
      business._id,
      'CLIENT',
      parsed.rows,
      autoMapping
    );

    console.log(`Validation Errors count: ${validationResult.errors.length}`);
    console.log(`Validation Warnings count: ${validationResult.warnings.length}`);
    console.log(`Validation Duplicates count: ${validationResult.duplicates.length}`);
    console.log(`Validation Valid count: ${validationResult.valid.length}`);

    if (validationResult.errors.length > 0) {
      console.error('Validation FAILED with errors:', JSON.stringify(validationResult.errors, null, 2));
      process.exit(1);
    }
    console.log('Validation PASSED successfully!');

    // Clean existing clients in this test run to get accurate import results
    console.log('\nCleaning existing clients...');
    await Client.deleteMany({ businessId: business._id });

    // 6. Execute Import
    console.log('\n--- Running Import ---');
    const importResult = await importService.executeImport(
      business._id,
      user._id,
      'CLIENT',
      parsed.rows,
      autoMapping,
      'OVERWRITE',
      'SYSTEM',
      {},
      false
    );

    console.log('Import execution completed:', JSON.stringify(importResult, null, 2));

    if (!importResult.success) {
      console.error('Import failed.');
      process.exit(1);
    }

    // 7. Verify created documents in MongoDB
    const count = await Client.countDocuments({ businessId: business._id });
    console.log(`Total clients in database for business: ${count}`);

    if (count === 0) {
      console.error('ERROR: No clients created in MongoDB!');
      process.exit(1);
    }

    const samples = await Client.find({ businessId: business._id }).limit(3);
    console.log('\nSample created clients in database:');
    samples.forEach(c => {
      console.log(`- ${c.clientName} (Type: ${c.clientType})`);
      console.log(`  Email: ${c.email || 'N/A'}`);
      console.log(`  Phone: ${c.phone || 'N/A'}`);
      console.log(`  GSTIN: ${c.gstin || 'N/A'}`);
      console.log(`  PAN: ${c.pan || 'N/A'}`);
      console.log(`  Address: ${c.billingAddress?.addressLine1}, ${c.billingAddress?.city}, ${c.billingAddress?.state} - ${c.billingAddress?.pincode} (${c.billingAddress?.country})`);
    });

    console.log('\nVerification completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('E2E execution failed with error:', err);
    process.exit(1);
  }
}

run();
