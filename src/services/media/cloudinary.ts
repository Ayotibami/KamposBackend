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

export async function uploadBuffer(buffer: Buffer, folder = 'kampos/profiles', isVideo = false) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        overwrite: true,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        // Videos don't get a `thumbnail_url` in Cloudinary's default upload
        // response the way images do — requesting an eager jpg derivative
        // is what actually produces a poster-frame image, at result.eager[0].
        ...(isVideo ? { eager: [{ width: 400, crop: 'scale', format: 'jpg' }] } : {}),
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

// Powers direct browser-to-Cloudinary uploads (see gist media.controller's
// `signature`/`finalize`) — the whole point being that the actual file
// bytes never touch this server or the Next.js frontend's own proxy at
// all, only this tiny signed-params handshake does. Signing `folder` and
// (for video) `eager` server-side means the browser can't redirect the
// upload somewhere else or skip thumbnail generation — Cloudinary rejects
// the request if the client's actual upload params don't exactly match
// what was signed.
export function signUpload(params: Record<string, string | number>): { signature: string; timestamp: number } {
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = { ...params, timestamp };
  const signature = cloudinary.utils.api_sign_request(toSign, env.CLOUDINARY_API_SECRET);
  return { signature, timestamp };
}

export async function deleteByPublicId(public_id: string) {
  return cloudinary.uploader.destroy(public_id, { invalidate: true, resource_type: 'image' });
}

export async function deleteByPublicIdWithType(public_id: string, resource_type: 'image' | 'video') {
  return cloudinary.uploader.destroy(public_id, { invalidate: true, resource_type });
}
