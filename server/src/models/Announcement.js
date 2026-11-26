const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 8000 },
    category: {
      type: String,
      enum: ['GENERAL', 'HR', 'POLICY', 'EVENT', 'FINANCE', 'SYSTEM'],
      default: 'GENERAL',
    },
    roles: {
      type: [String],
      default: ['SUPER_ADMIN', 'ADMIN', 'HR', 'FINANCE', 'EMPLOYEE'],
      index: true,
    },
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    priority: { type: String, enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'], default: 'NORMAL' },
    publishedAt: { type: Date, default: Date.now, index: true },
    expiresAt: Date,
    isPinned: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    attachments: {
      type: [
        {
          originalName: String,
          fileName: String,
          path: String,
          mimetype: String,
          size: Number,
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

announcementSchema.index({ isActive: 1, publishedAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
