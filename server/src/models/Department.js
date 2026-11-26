const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Department name is required'], unique: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    description: { type: String, trim: true, maxlength: 1000 },
    head: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    email: { type: String, lowercase: true, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Department', departmentSchema);
