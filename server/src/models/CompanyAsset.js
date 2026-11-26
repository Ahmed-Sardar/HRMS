const mongoose = require('mongoose');
const { ASSET_STATUS } = require('../config/constants');

const assetHistorySchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['CREATED', 'ASSIGNED', 'RETURNED', 'REPAIRED', 'RETIRED'], required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    condition: String,
    notes: String,
  },
  { _id: true },
);

const companyAssetSchema = new mongoose.Schema(
  {
    assetTag: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['LAPTOP', 'DESKTOP', 'MONITOR', 'MOBILE', 'ACCESS_CARD', 'FURNITURE', 'OTHER'],
      index: true,
    },
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    purchaseDate: Date,
    purchaseCost: { type: Number, default: 0, min: 0 },
    warrantyExpiry: Date,
    condition: {
      type: String,
      enum: ['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE'],
      default: 'GOOD',
    },
    status: {
      type: String,
      enum: Object.values(ASSET_STATUS),
      default: ASSET_STATUS.AVAILABLE,
      index: true,
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true },
    assignedAt: Date,
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expectedReturnDate: Date,
    returnedAt: Date,
    returnCondition: String,
    notes: { type: String, trim: true },
    history: { type: [assetHistorySchema], default: [] },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

companyAssetSchema.index({ status: 1, category: 1 });

module.exports = mongoose.model('CompanyAsset', companyAssetSchema);
