import mongoose from 'mongoose';
import { ENV } from './env.js';

export const connectDatabase = async () => {
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DATABASE] Connecting to MongoDB (attempt ${attempt}/${maxRetries})...`);
      const connectionInstance = await mongoose.connect(ENV.MONGODB_URI, {
        family: 4,
        maxPoolSize: 20,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 60000,
      });
      console.log(`[DATABASE] Connected to MongoDB: ${connectionInstance.connection.host}/${connectionInstance.connection.name}`);

      mongoose.connection.on('error', (err) => {
        console.error('[DATABASE ERROR] MongoDB connection runtime error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('[DATABASE WARN] MongoDB connection lost. Reconnecting...');
      });

      return connectionInstance;
    } catch (error) {
      console.warn(`[DATABASE WARN] Attempt ${attempt} failed: ${error.message}`);
      if (attempt === maxRetries) {
        console.error('[DATABASE ERROR] Failed to establish initial MongoDB connection after multiple retries.');
        process.exit(1);
      }
      // Wait 3 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
};
