const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const ObjectId = mongoose.Types.ObjectId;

const NOTIFICATION_TYPES = [
  // Customer notifications
  "booking_approved",
  "booking_rejected", 
  "booking_completed",
  "message_received",
  "story_added",
  "new_service_added",
  
  // Provider notifications
  "booking_received",
  "review_submitted",
  "booking_cancelled",
  "story_added",
  "message_received",
  
  // General notifications
  "system_notification",
  "promo_notification"
];

const notificationSchema = new Schema(
  {
    title: { type: String, default: null, maxlength: 200 },
    message: { type: String, required: true, maxlength: 2000 },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    recipientId: { type: ObjectId, ref: "Customer", required: true, index: true },
    senderId: { type: ObjectId, ref: "Customer", default: null, index: true },
    bookingId: { type: ObjectId, ref: "Booking", default: null, index: true },
    messageId: { type: ObjectId, ref: "Message", default: null, index: true },
    storyId: { type: ObjectId, ref: "Story", default: null, index: true },
    serviceId: { type: ObjectId, ref: "Service", default: null, index: true },
    isRead: { type: Boolean, default: false, index: true },
    sentByAdmin: { type: Boolean, default: false, index: true }, // Flag to identify admin-sent notifications
    adminUserId: { type: ObjectId, ref: "SystemUser", default: null, index: true }, // Admin user who sent the notification
    targetAudience: { type: String, enum: ["all_users", "all_providers", "all_customers"], default: null, index: true }, // Target audience for admin notifications
    meta: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  }
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 }, { name: "inbox_read_time" });
notificationSchema.index({ type: 1, createdAt: -1 }, { name: "type_time" });
notificationSchema.index({ sentByAdmin: 1, createdAt: -1 }, { name: "admin_notifications_time" });

notificationSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = model("Notification", notificationSchema, "notifications");
