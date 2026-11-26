const mongoose = require('mongoose');

const designationSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Designation title is required'], trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true },
    level: { type: String, trim: true },
    description: { type: String, trim: true, maxlength: 1000 },
    minSalary: { type: Number, min: 0 },
    maxSalary: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

designationSchema.index({ title: 1, department: 1 }, { unique: true });

module.exports = mongoose.model('Designation', designationSchema);
