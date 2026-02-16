const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const timeSlotSchema = new Schema(
  {
    start: {
      type: String,
      required: true,
      trim: true,
    },
    end: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const providerServiceSchema = new Schema(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    categorySlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    categoryTitle: {
      type: String,
      required: true,
      trim: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      default: null,
    },
    serviceSlug: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    serviceTitle: {
      type: String,
      default: null,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
    priceMin: {
      type: Number,
      default: null,
      min: 0,
    },
    priceMax: {
      type: Number,
      default: null,
      min: 0,
    },
    location: {
      type: String,
      default: null,
      trim: true,
      maxlength: 200,
    },
    timeSlots: {
      type: [timeSlotSchema],
      default: [],
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    isApproved: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

providerServiceSchema.index({ providerId: 1, createdAt: -1 });
providerServiceSchema.index({ providerId: 1, title: 1 });
providerServiceSchema.index({ isApproved: 1, status: 1, isDeleted: 1, createdAt: -1 });

module.exports = model(
  "ProviderService",
  providerServiceSchema,
  "provider_services"
);