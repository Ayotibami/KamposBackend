import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.config";

cloudinary.config({
  cloud_name: env.CLOUNINARY_NAME,
  api_key: env.CLOUNINARY_API_KEY,
  api_secret: env.CLOUNINARY_API_SECRET,
});

export default cloudinary;
