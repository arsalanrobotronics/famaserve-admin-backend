const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const categorySchema = new Schema(
  {
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
    icon: {
      type: String,
      default: null,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
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

categorySchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = model("Category", categorySchema, "categories");
