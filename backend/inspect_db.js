const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    // Let's inspect the documents collection
    const documents = await mongoose.connection.db.collection('documents').find({}).toArray();
    console.log(`Found ${documents.length} total documents.`);

    for (const doc of documents) {
      console.log(`Doc ID: ${doc._id}, Number: ${doc.documentNumber}, Type: ${doc.documentType || doc.type}`);
      console.log(`  grandTotal: ${doc.grandTotal} (type: ${typeof doc.grandTotal})`);
      console.log(`  amountPaid: ${doc.amountPaid} (type: ${typeof doc.amountPaid})`);
      console.log(`  balanceDue: ${doc.balanceDue} (type: ${typeof doc.balanceDue})`);
      console.log(`  issueDate: ${doc.issueDate}`);
      console.log(`  validTill: ${doc.validTill}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
