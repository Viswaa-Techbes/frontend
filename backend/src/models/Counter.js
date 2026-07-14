const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
  prefix: {
    type: String,
  },
  suffix: {
    type: String,
  },
  padding: {
    type: Number,
  },
});

module.exports = mongoose.model('Counter', counterSchema);

