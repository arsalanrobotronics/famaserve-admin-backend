const mongoose = require("mongoose");

const { Schema } = mongoose;
const ObjectId = mongoose.Types.ObjectId;

const reviewSchema = new Schema(
  {
    bookingId: {
      type: ObjectId,
      ref: "Booking",
      required: true,
      index: true,
      unique: true,
    },
    serviceId: {
      type: ObjectId,
      ref: "ProviderService",
      required: true,
      index: true,
    },
    providerId: {
      type: ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    customerId: {
      type: ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: null,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

reviewSchema.index({ providerId: 1, createdAt: -1 });
reviewSchema.index({ serviceId: 1, createdAt: -1 });
reviewSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.models.Review || mongoose.model("Review", reviewSchema, "reviews");
