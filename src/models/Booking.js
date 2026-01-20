const mongoose = require("mongoose");

const { Schema } = mongoose;
const ObjectId = mongoose.Types.ObjectId;

const bookingSchema = new Schema(
  {
    customerId: {
      type: ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    providerId: {
      type: ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    serviceId: {
      type: ObjectId,
      ref: "ProviderService",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
      required: true,
      index: true,
    },
    scheduleDate: {
      type: Date,
      default: null,
    },
    timeSlotStart: {
      type: String,
      default: null,
    },
    timeSlotEnd: {
      type: String,
      default: null,
    },
    timeLabel: {
      type: String,
      default: null,
    },
    requestedPrice: {
      type: Number,
      default: null,
    },
    notes: {
      type: String,
      default: null,
      maxlength: 2000,
    },
    serviceSnapshot: {
      title: { type: String, default: null },
      location: { type: String, default: null },
      priceMin: { type: Number, default: null },
      priceMax: { type: Number, default: null },
      images: { type: [String], default: [] },
    },
    cancelledBy: {
      type: String,
      enum: [null, "customer", "provider"],
      default: null,
    },
    cancellationReason: {
      type: String,
      default: null,
      maxlength: 200,
    },
    cancellationNote: {
      type: String,
      default: null,
      maxlength: 500,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    providerRespondedAt: {
      type: Date,
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

bookingSchema.index(
  { customerId: 1, serviceId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "confirmed"] } },
  }
);

module.exports = mongoose.models.Booking || mongoose.model("Booking", bookingSchema, "bookings");
