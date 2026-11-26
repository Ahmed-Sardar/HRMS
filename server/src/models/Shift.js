const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Shift name is required'], unique: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    startTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:mm'],
    },
    endTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must be HH:mm'],
    },
    graceMinutes: { type: Number, default: 10, min: 0, max: 180 },
    breakMinutes: { type: Number, default: 60, min: 0, max: 300 },
    weeklyOffs: { type: [Number], default: [0, 6] },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    description: { type: String, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Shift', shiftSchema);
