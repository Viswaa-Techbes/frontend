const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

const User = require('../src/models/User');

const runProvisioning = async () => {
  const email = 'lohith@techbes.co.in';
  const password = 'Lohith*@123';
  const lowercaseEmail = email.toLowerCase().trim();

  let user = await User.findOne({ email: lowercaseEmail });
  if (user) {
    console.log('User lohith@techbes.co.in already exists. Resetting password...');
    user.password = password;
    if (!user.name) {
      user.name = 'Lohith';
    }
    await user.save();
    console.log('User password updated successfully.');
  } else {
    console.log('User lohith@techbes.co.in does not exist. Creating user...');
    user = await User.create({
      name: 'Lohith',
      email: lowercaseEmail,
      password: password,
    });
    console.log('User created successfully.');
  }
};

// If run directly
if (require.main === module) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('FATAL ERROR: MONGODB_URI environment variable is required.');
    process.exit(1);
  }

  mongoose.connect(mongoUri)
    .then(async () => {
      console.log('Connected to MongoDB.');
      await runProvisioning();
      mongoose.disconnect();
      console.log('Admin user provisioning script completed successfully.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = { runProvisioning };
