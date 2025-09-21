import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env';

cloudinary.config({
  cloud_name: env.CLOUDINARY_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export async function uploadImage(filePath: string, folder = 'kampos/profiles') {
  return cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: 'image',
    overwrite: true,
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
  });
}

export async function uploadBuffer(buffer: Buffer, folder = 'kampos/profiles') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto', overwrite: true, transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

export async function deleteByPublicId(public_id: string) {
  return cloudinary.uploader.destroy(public_id, { invalidate: true, resource_type: 'image' });
}

export async function deleteByPublicIdWithType(public_id: string, resource_type: 'image' | 'video') {
  return cloudinary.uploader.destroy(public_id, { invalidate: true, resource_type });
}
