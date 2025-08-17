import mongoose from "mongoose";
import { env } from "./env.config";
import logger from "../utils/logger";

const connectDB = async () => {
  try {
    logger.info("Connecting...");
    await mongoose.connect(env.MONGODB_URI, {
      dbName: "JustInTime",
    });
    logger.info("DB Connected!");
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    throw error;
  }
};

export default connectDB;
