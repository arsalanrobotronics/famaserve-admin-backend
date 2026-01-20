const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const serviceSchema = new Schema(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: null,
      maxlength: 2000,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
    },
    type: {
      type: String,
      enum: ["manual", "automated"],
      default: "manual",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      required: true,
    },
    sequence: {
      type: Number,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

serviceSchema.index({ categoryId: 1, slug: 1 }, { unique: true });
serviceSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = model("Service", serviceSchema, "services");
