import cloudinary from "../lib/cloudinary";

export class UploadService {
  static async uploadToCloudinary(tempFilePath: string): Promise<string> {
    try {
      const { secure_url } = await cloudinary.uploader.upload(tempFilePath, {
        use_filename: true,
        folder: "fleet-management",
      });
      return secure_url;
    } catch (error) {
      console.log(`Error uploading to cloudinary` + error);
      throw error;
    }
  }
}
