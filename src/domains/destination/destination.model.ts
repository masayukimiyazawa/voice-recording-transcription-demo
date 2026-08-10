/**
 * Destination model and schema definitions
 */

import { Schema, Document, model } from 'mongoose';

export interface IDestination extends Document {
  phoneNumber: string;
  createdAt: Date;
  updatedAt: Date;
}

const destinationSchema = new Schema<IDestination>(
  {
    phoneNumber: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

export const Destination = model<IDestination>('Destination', destinationSchema);
