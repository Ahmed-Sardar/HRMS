const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Holiday name is required'], trim: true },
    date: { type: Date, required: true, index: true },
    year: { type: Number, required: true, index: true },
    type: {
      type: String,
      enum: ['PUBLIC', 'RESTRICTED', 'COMPANY', 'OPTIONAL'],
      default: 'PUBLIC',
    },
    description: { type: String, trim: true },
    isOptional: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

holidaySchema.index({ date: 1, name: 1 }, { unique: true });

holidaySchema.pre('validate', function setYear(next) {
  if (this.date) this.year = new Date(this.date).getFullYear();
  next();
});

module.exports = mongoose.model('Holiday', holidaySchema);
