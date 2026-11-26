const mongoose = require('mongoose');
const { ROLE_VALUES } = require('../config/constants');
const { PERMISSIONS, ROLE_PERMISSIONS } = require('../config/permissions');

const roleSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, enum: ROLE_VALUES },
    name: { type: String, required: true },
    description: String,
    permissions: { type: [String], enum: Object.values(PERMISSIONS), default: [] },
    isSystem: { type: Boolean, default: true },
  },
  { timestamps: true },
);

roleSchema.statics.defaults = () =>
  ROLE_VALUES.map((slug) => ({
    slug,
    name: slug.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    permissions: ROLE_PERMISSIONS[slug] || [],
    isSystem: true,
  }));

module.exports = mongoose.model('Role', roleSchema);
