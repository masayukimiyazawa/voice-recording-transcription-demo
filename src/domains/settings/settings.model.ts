/**
 * Settings model - key-value store for application settings
 */

import { Schema, Document, model } from 'mongoose';

export interface ISetting extends Document {
  key: string;
  value: string;
}

const settingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

export const Setting = model<ISetting>('Setting', settingSchema);
